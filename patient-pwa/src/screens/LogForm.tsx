import { useState } from 'react';
import { BORG, POST_CONDITION, POST_SYMPTOMS, REASONS, SIGNAL_LABEL } from '../data/content';
import { programById } from '../data/program';
import { APP_VERSION, HOSPITAL_NAME, HOSPITAL_PHONE } from '../lib/config';
import { todayStr } from '../lib/storage';
import type { AppConfig, DailyLog, PostCondition, PostSymptom, ReasonCode, SessionDraft, SessionStatus, WalkStatus } from '../lib/types';

interface Props {
  config: AppConfig;
  draft?: SessionDraft | null;
  onSubmit: (log: DailyLog) => Promise<{ ok: boolean; message: string; queued?: boolean }>;
  onBack: () => void;
}

type Step = 'walk' | 'session' | 'after' | 'extra' | 'sending' | 'done';

const WALK_QUICK = [0, 10, 20, 30, 45, 60];

/**
 * 毎日の記録。体調の確認は「運動後」の 1 画面のみ（セッション前の確認はセッション画面で済ませる）。
 * セッション画面から来た場合は、信号・種別・時間が入力済み。
 */
export default function LogForm({ config, draft, onSubmit, onBack }: Props) {
  const prog = programById(config.menu_template);
  const red = draft?.preCheck === 'red';
  const planned = config.session_days.includes(new Date().getDay());
  const [step, setStep] = useState<Step>('walk');
  const [walkStatus, setWalkStatus] = useState<WalkStatus | null>(red ? 'rest' : null);
  const [walkMin, setWalkMin] = useState<number | null>(red ? 0 : null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(
    draft ? (red || draft.itemsDone.length === 0 ? 'none' : draft.itemsDone.length >= draft.itemsTotal * 0.8 ? 'done' : 'partial') : (planned ? null : 'not_planned')
  );
  const [sessionMin, setSessionMin] = useState<string>(draft && !red ? String(draft.minutes) : '');
  const [borg, setBorg] = useState<number | null>(null);
  const [postCond, setPostCond] = useState<PostCondition | null>(null);
  const [postSym, setPostSym] = useState<PostSymptom[]>([]);
  const [reasons, setReasons] = useState<ReasonCode[]>([]);
  const [reasonOther, setReasonOther] = useState('');
  const [free, setFree] = useState('');
  const [result, setResult] = useState<{ ok: boolean; message: string; queued?: boolean } | null>(null);

  const exercised = walkStatus === 'done' || sessionStatus === 'done' || sessionStatus === 'partial';
  const askReason = !red && (sessionStatus === 'none' || sessionStatus === 'partial' || walkStatus === 'none');

  function toggle<T>(arr: T[], v: T, set: (a: T[]) => void) {
    set(arr.includes(v) ? arr.filter((x) => x !== v) : arr.concat(v));
  }

  async function submit() {
    if (!walkStatus || !sessionStatus) return;
    setStep('sending');
    const sessionActive = sessionStatus === 'done' || sessionStatus === 'partial';
    const log: DailyLog = {
      study_id: config.study_id,
      pin: config.pin,
      log_date: todayStr(),
      walk_status: walkStatus,
      walk_min: walkStatus === 'done' ? walkMin : 0,
      pre_check: draft?.preCheck ?? null,
      pre_symptoms: draft?.preSymptoms ?? [],
      pre_symptom_text: draft?.preSymptomText ?? '',
      session_planned: planned,
      session_days: config.session_days,
      session_status: sessionStatus,
      session_type: sessionActive ? (draft?.sessionType ?? 'normal') : null,
      session_min: sessionActive ? (sessionMin === '' ? null : Number(sessionMin)) : null,
      session_items_done: draft?.itemsDone ?? [],
      reasons: askReason ? reasons : [],
      reason_other: reasons.includes('other') ? reasonOther : '',
      post_borg: exercised ? borg : null,
      post_condition: exercised ? postCond : null,
      post_symptoms: exercised && postCond === 'symptom' ? postSym : [],
      free_text: free.trim(),
      app_version: APP_VERSION
    };
    const r = await onSubmit(log);
    setResult(r);
    setStep('done');
  }

  // 赤信号で中止した場合は、歩行・セッションの質問を飛ばして送信前の確認だけにする
  if (step === 'walk' && red) {
    const L = SIGNAL_LABEL.red;
    return (
      <div>
        <div className="signal" style={{ borderColor: L.color }}>
          <div className="lamp" style={{ background: L.color }} />
          <h2 style={{ color: L.color, margin: '8px 0' }}>今日は運動を中止します</h2>
          {draft?.preSymptomText && <p className="muted">症状: {draft.preSymptomText}</p>}
          <p>この内容を担当者に送ります。症状が強いとき、続くときは {HOSPITAL_NAME}（<a className="phone" href={`tel:${HOSPITAL_PHONE}`}>{HOSPITAL_PHONE}</a>）へお電話ください。</p>
        </div>
        <label className="field">ひとこと（任意）<span className="sub">お名前や住所は書かないでください</span>
          <textarea value={free} onChange={(e) => setFree(e.target.value)} maxLength={300} />
        </label>
        <button className="btn" onClick={submit}>送る</button>
        <button className="btn secondary" onClick={onBack}>ホームへ戻る</button>
      </div>
    );
  }

  if (step === 'walk') {
    return (
      <div>
        <button className="btn secondary" onClick={onBack}>← 戻る</button>
        <h2>今日は歩きましたか？</h2>
        <p className="muted">目標は 1 日 {prog.walking.dailyMinutes} 分。買い物などで歩いた分も含めて構いません。</p>
        <div className="choice two">
          {WALK_QUICK.map((m) => (
            <button key={m} className={walkStatus === (m === 0 ? 'none' : 'done') && (m === 0 || walkMin === m) ? 'on' : ''}
              onClick={() => { if (m === 0) { setWalkStatus('none'); setWalkMin(0); } else { setWalkStatus('done'); setWalkMin(m); } }}>
              {m === 0 ? '歩かなかった' : `${m} 分${m === 60 ? '以上' : ''}`}
            </button>
          ))}
        </div>
        <button className="btn" disabled={!walkStatus} onClick={() => setStep('session')}>次へ</button>
      </div>
    );
  }

  if (step === 'session') {
    return (
      <div>
        <button className="btn secondary" onClick={() => setStep('walk')}>← 戻る</button>
        <h2>運動セッションはしましたか？</h2>
        <p className="muted">{planned ? '今日はセッションの日です。' : '今日はセッションの予定がない日です。'}（週 {prog.sessionsPerWeek} 回・{prog.sessionMinutes}）</p>
        {draft && (
          <div className="ok">
            セッションの記録が入っています（{draft.preCheck === 'yellow' ? '黄信号・軽いメニュー' : '青信号・通常'}、{draft.minutes} 分、{draft.itemsDone.length} / {draft.itemsTotal} 項目）。違っていれば直してください。
          </div>
        )}
        <div className="choice">
          {(planned
            ? [['done', 'した'], ['partial', '一部だけした'], ['none', 'できなかった']]
            : [['not_planned', '今日はしていない（予定なし）'], ['done', '予定ではないが、した'], ['partial', '一部だけした']]
          ).map(([v, l]) => (
            <button key={v} className={sessionStatus === v ? 'on' : ''} onClick={() => setSessionStatus(v as SessionStatus)}>{l}</button>
          ))}
        </div>
        {(sessionStatus === 'done' || sessionStatus === 'partial') && (
          <label className="field">かかった時間（分）
            <input type="number" inputMode="numeric" value={sessionMin} onChange={(e) => setSessionMin(e.target.value)} placeholder="例: 40" />
          </label>
        )}
        <button className="btn" disabled={!sessionStatus} onClick={() => setStep(exercised ? 'after' : 'extra')}>次へ</button>
      </div>
    );
  }

  // ---- 運動後の体調（2 回目の体調確認） ----
  if (step === 'after') {
    return (
      <div>
        <button className="btn secondary" onClick={() => setStep('session')}>← 戻る</button>
        <h2>運動後の体調はどうですか？</h2>
        <div className="choice">
          {POST_CONDITION.map((c) => (
            <button key={c.code} className={postCond === c.code ? 'on' : ''} onClick={() => setPostCond(c.code)}>{c.label}</button>
          ))}
        </div>
        {postCond === 'symptom' && (
          <div className="choice two">
            {POST_SYMPTOMS.map((s) => (
              <button key={s.code} className={postSym.includes(s.code) ? 'on' : ''} onClick={() => toggle(postSym, s.code, setPostSym)}>{s.label}</button>
            ))}
          </div>
        )}
        <h3>どのくらいきつかったですか？</h3>
        <div className="borg">
          {BORG.map((b) => (
            <button key={b.value} className={borg === b.value ? 'on' : ''} onClick={() => setBorg(b.value)}>
              <span className="n">{b.value}</span>{b.face} {b.label}
            </button>
          ))}
        </div>
        <button className="btn" disabled={!postCond} onClick={() => setStep('extra')}>次へ</button>
      </div>
    );
  }

  if (step === 'extra') {
    return (
      <div>
        <button className="btn secondary" onClick={() => setStep(exercised ? 'after' : 'session')}>← 戻る</button>
        {askReason && (
          <>
            <h2>できなかった理由は？</h2>
            <p className="muted">あてはまるものをすべて押してください。</p>
            <div className="choice two">
              {REASONS.map((r) => (
                <button key={r.code} className={reasons.includes(r.code) ? 'on' : ''} onClick={() => toggle(reasons, r.code, setReasons)}>{r.label}</button>
              ))}
            </div>
            {reasons.includes('other') && (
              <label className="field">その他の理由
                <input type="text" value={reasonOther} onChange={(e) => setReasonOther(e.target.value)} />
              </label>
            )}
          </>
        )}
        <label className="field">ひとこと（任意）<span className="sub">お名前や住所は書かないでください</span>
          <textarea value={free} onChange={(e) => setFree(e.target.value)} maxLength={300} />
        </label>
        <button className="btn" onClick={submit}>送る</button>
      </div>
    );
  }

  if (step === 'sending') return <p className="center big">送信しています…</p>;

  return (
    <div>
      {result?.ok ? (
        <div className="ok"><strong>送信しました。</strong><br />担当者が確認します。{red ? 'ゆっくり休んでください。' : '今日もおつかれさまでした。'}</div>
      ) : result?.queued ? (
        <div className="alert"><strong>今は送れませんでした。</strong><br />記録は保存しました。電波の良いところでアプリを開くと自動で送ります。</div>
      ) : (
        <div className="alert"><strong>送れませんでした。</strong><br />{result?.message}</div>
      )}
      <div className={red || postCond === 'symptom' ? 'alert' : 'card'}>
        体調が悪いとき、心配なときは {HOSPITAL_NAME} へお電話ください。<br /><a className="phone" href={`tel:${HOSPITAL_PHONE}`}>{HOSPITAL_PHONE}</a>
      </div>
      <button className="btn" onClick={onBack}>ホームへ</button>
    </div>
  );
}
