import { useEffect, useMemo, useState } from 'react';
import Video from '../components/Video';
import { byCode } from '../data/exercises';
import { programById } from '../data/program';
import { judgeSignal, PRE_CHECK, SIGNAL_LABEL } from '../data/content';
import { HOSPITAL_NAME, HOSPITAL_PHONE } from '../lib/config';
import type { AppConfig, PreSymptom, SessionDraft, SessionType, Signal } from '../lib/types';

interface Props {
  config: AppConfig;
  onFinish: (draft: SessionDraft) => void;
  onExit: () => void;
}

type Phase = 'precheck' | 'signal' | 'run' | 'end';

/**
 * セッションプレイヤー。
 * 1. セッション前の体調確認（信号判定）: 青=通常、黄=軽いメニュー、赤=中止
 * 2. ブロック順に種目を 1 つずつ表示し、所要時間と実施項目を記録
 * 3. 終了後は記録画面へ引き継ぐ（運動後の体調はそこで確認する）
 */
export default function Session({ config, onFinish, onExit }: Props) {
  const prog = programById(config.menu_template);
  const [phase, setPhase] = useState<Phase>('precheck');
  const [pre, setPre] = useState<PreSymptom[]>([]);
  const [preText, setPreText] = useState('');
  const [noneChecked, setNoneChecked] = useState(false);
  const [signal, setSignal] = useState<Signal>('green');
  const [type, setType] = useState<SessionType>('normal');
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState<string[]>([]);
  const [startAt, setStartAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const blocks = type === 'mild' ? prog.mildBlocks : prog.blocks;
  const steps = useMemo(
    () => blocks.flatMap((b) => b.items.map((it) => ({ block: b, code: it.code, target: it.target }))),
    [blocks]
  );
  const totalMin = blocks.reduce((a, b) => a + b.minutes, 0);

  useEffect(() => {
    if (phase !== 'run') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const elapsedMin = startAt ? Math.max(0, Math.round((now - startAt) / 60000)) : 0;
  const elapsedStr = startAt ? `${Math.floor((now - startAt) / 60000)}:${String(Math.floor(((now - startAt) / 1000) % 60)).padStart(2, '0')}` : '0:00';

  function togglePre(code: PreSymptom) {
    setNoneChecked(false);
    setPre((p) => (p.includes(code) ? p.filter((c) => c !== code) : p.concat(code)));
  }
  function judge() {
    const s = judgeSignal(pre);
    setSignal(s);
    setType(s === 'yellow' ? 'mild' : 'normal');
    setPhase('signal');
  }
  function start() {
    setIdx(0); setDone([]);
    setStartAt(Date.now()); setNow(Date.now());
    setPhase('run');
  }
  function next(markDone: boolean) {
    const s = steps[idx];
    if (markDone) setDone((d) => d.concat(s.code + '#' + idx));
    if (idx + 1 >= steps.length) setPhase('end');
    else setIdx(idx + 1);
  }
  function finish() {
    const codes = Array.from(new Set(done.map((k) => k.split('#')[0])));
    onFinish({ preCheck: signal, preSymptoms: pre, preSymptomText: preText.trim(), sessionType: type, minutes: Math.max(1, elapsedMin), itemsDone: codes, itemsTotal: steps.length });
  }
  function stopRed() {
    onFinish({ preCheck: 'red', preSymptoms: pre, preSymptomText: preText.trim(), sessionType: null, minutes: 0, itemsDone: [], itemsTotal: 0 });
  }

  // ---- 1. セッション前の体調確認 ----
  if (phase === 'precheck') {
    return (
      <div>
        <button className="btn secondary" onClick={onExit}>← ホームへ</button>
        <h2>今日の体調はどうですか？</h2>
        <p className="muted">あてはまるものをすべて押してください。なければ「症状なし・概ね元気」を押してください。</p>
        <div className="choice">
          <button className={noneChecked ? 'on' : ''} onClick={() => { setNoneChecked(true); setPre([]); }}>症状なし・概ね元気</button>
        </div>
        <div className="choice two">
          {PRE_CHECK.map((p) => (
            <button key={p.code} className={pre.includes(p.code) ? 'on' : ''} onClick={() => togglePre(p.code)}>{p.label}</button>
          ))}
        </div>
        {pre.includes('cannot') && (
          <label className="field" htmlFor="pre-text">どのような症状がありますか？<span className="sub">担当者に伝わります。お名前や住所は書かないでください</span>
            <textarea id="pre-text" value={preText} onChange={(e) => setPreText(e.target.value)} maxLength={300} placeholder="例: 朝から吐き気が続いていて食事がとれない" />
          </label>
        )}
        <button className="btn" disabled={!noneChecked && pre.length === 0} onClick={judge}>判定する</button>
      </div>
    );
  }

  // ---- 信号の表示と分岐 ----
  if (phase === 'signal') {
    const L = SIGNAL_LABEL[signal];
    return (
      <div>
        <div className="signal" style={{ borderColor: L.color }}>
          <div className="lamp" style={{ background: L.color }} />
          <h2 style={{ color: L.color, margin: '8px 0' }}>{L.title}</h2>
          <p>{L.body}</p>
        </div>
        {signal === 'red' ? (
          <>
            <p>{HOSPITAL_NAME}: <a className="phone" href={`tel:${HOSPITAL_PHONE}`}>{HOSPITAL_PHONE}</a></p>
            <button className="btn" onClick={stopRed}>今日は中止して、記録を送る</button>
            <button className="btn secondary" onClick={() => setPhase('precheck')}>体調の入力に戻る</button>
          </>
        ) : (
          <>
            <h3>今日の流れ（約 {totalMin} 分）</h3>
            {blocks.map((b) => (
              <div key={b.id} className="card">
                <strong>{b.name}</strong> <span className="muted">約 {b.minutes} 分</span>
                <ul className="plain muted">{b.items.map((it, i) => <li key={i}>{byCode(it.code)?.name ?? it.code} — {it.target}</li>)}</ul>
              </div>
            ))}
            <button className="btn" onClick={start}>スタート</button>
            {signal === 'yellow' && (
              <button className="btn secondary" onClick={() => { setType('normal'); }} disabled={type === 'normal'}>
                {type === 'normal' ? '通常メニューに切り替えました' : '体調に自信があれば通常メニューにする'}
              </button>
            )}
            <button className="btn secondary" onClick={() => setPhase('precheck')}>体調の入力に戻る</button>
            <p className="muted">水を近くに置き、つかまれる椅子や壁のそばで行いましょう。途中でやめても、やった分は記録できます。</p>
          </>
        )}
      </div>
    );
  }

  // ---- 2. 種目の進行 ----
  if (phase === 'run') {
    const s = steps[idx];
    const ex = byCode(s.code);
    return (
      <div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="badge">{type === 'mild' ? '軽いメニュー・' : ''}{s.block.name}</span>
          <span className="muted">{idx + 1} / {steps.length}　⏱ {elapsedStr}</span>
        </div>
        <h2>{ex?.name ?? s.code}</h2>
        <p><strong>{s.target}</strong></p>
        <Video url={ex?.videoUrl ?? ''} />
        {ex && (
          <>
            <p>{ex.summary}</p>
            <details><summary>やり方と注意</summary>
              <ol className="steps">{ex.steps.map((t, i) => <li key={i}>{t}</li>)}</ol>
              <ul className="plain">{ex.cautions.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </details>
          </>
        )}
        <div className="choice two">
          <button className="on" onClick={() => next(true)}>できた → 次へ</button>
          <button onClick={() => next(false)}>飛ばす</button>
        </div>
        <button className="btn secondary" onClick={() => setPhase('end')}>ここで終わる</button>
      </div>
    );
  }

  // ---- 3. 終了 ----
  return (
    <div>
      <h2>おつかれさまでした</h2>
      <div className="ok">
        {type === 'mild' ? '軽いメニュー' : '通常セッション'}　所要時間 <strong className="big">{elapsedMin} 分</strong>、実施 <strong className="big">{done.length} / {steps.length}</strong> 項目
      </div>
      <p>続けて、運動後の体調ときつさを記録して送ります。</p>
      <button className="btn" onClick={finish}>運動後の体調を記録して送る</button>
      <button className="btn secondary" onClick={onExit}>あとで記録する</button>
    </div>
  );
}
