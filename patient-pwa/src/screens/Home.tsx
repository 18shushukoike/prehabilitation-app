import { programById } from '../data/program';
import { HOSPITAL_NAME, HOSPITAL_PHONE } from '../lib/config';
import type { AppConfig, LocalLogSummary } from '../lib/types';
import { sessionsThisWeek, todayStr } from '../lib/storage';

interface Props {
  config: AppConfig;
  logs: LocalLogSummary[];
  pendingCount: number;
  onStartSession: () => void;
  onOpenExercise: (code: string) => void;
  onLog: () => void;
}

const DOW = ['日', '月', '火', '水', '木', '金', '土'];
const SESSION_LABEL = { done: 'セッション した', partial: 'セッション 一部', none: 'セッション なし', not_planned: 'セッション 予定なし' } as const;
const WALK_LABEL = { done: 'ウォーキング', none: 'ウォーキングなし', rest: '休む日' } as const;

export default function Home({ config, logs, pendingCount, onStartSession, onLog }: Props) {
  const now = new Date();
  const today = todayStr(now);
  const prog = programById(config.menu_template);
  const todayLog = logs.find((l) => l.log_date === today);
  const doneWeek = sessionsThisWeek(logs, now);
  const remaining = Math.max(0, prog.sessionsPerWeek - doneWeek);
  const planned = config.session_days.includes(now.getDay());
  const nextDay = [1, 2, 3, 4, 5, 6, 7].map((i) => (now.getDay() + i) % 7).find((d) => config.session_days.includes(d));
  const totalMin = prog.blocks.reduce((a, b) => a + b.minutes, 0);

  return (
    <div>
      <h2>{now.getMonth() + 1}月{now.getDate()}日（{DOW[now.getDay()]}）</h2>
      {todayLog ? (
        <div className="ok">
          今日の記録: <strong>{WALK_LABEL[todayLog.walk_status]}{todayLog.walk_min ? ` ${todayLog.walk_min} 分` : ''}</strong>
          {' ／ '}<strong>{SESSION_LABEL[todayLog.session_status]}</strong>
          {todayLog.sent ? '（送信済み）' : '（未送信・次に開いたとき送ります）'}
        </div>
      ) : (
        <p className="muted">今日の運動が終わったら、一番下の「今日の記録を送る」を押してください。</p>
      )}
      {pendingCount > 0 && <div className="alert">送信できていない記録が {pendingCount} 件あります。電波の良いところで開き直すか、「今日の記録を送る」から再送してください。</div>}

      <div className="card">
        <span className="badge">毎日</span>
        <strong className="big">ウォーキング {prog.walking.dailyMinutes} 分</strong>
        <div className="muted">{prog.walking.note}</div>
      </div>

      <div className="card">
        <span className="badge">週 {prog.sessionsPerWeek} 回</span>
        <strong className="big">運動セッション（{prog.sessionMinutes}）</strong>
        <div className="row" style={{ margin: '8px 0' }}>
          <div className="grow">
            <div>今週: <strong className="big">{doneWeek} / {prog.sessionsPerWeek} 回</strong>{remaining > 0 ? `（あと ${remaining} 回）` : '（今週の目標達成！）'}</div>
            <div className="muted">
              {planned ? '今日はセッションの日です' : `次のセッション: ${nextDay !== undefined ? DOW[nextDay] + '曜日' : '未設定'}（予定: ${config.session_days.map((d) => DOW[d]).join('・')}）`}
            </div>
          </div>
        </div>
        <ul className="plain muted">
          {prog.blocks.map((b) => <li key={b.id}>{b.name} 約 {b.minutes} 分</li>)}
        </ul>
        <button className={'btn' + (planned ? '' : ' secondary')} onClick={onStartSession}>セッションを始める（約 {totalMin} 分）</button>
        <p className="muted">始める前に体調を確認します。体調によって「軽いメニュー（5〜10 分）」や「今日は中止」になります。</p>
      </div>

      <button className="btn secondary" onClick={onLog}>{todayLog ? '今日の記録を直す' : '今日の記録を送る'}</button>

      <div className="card">
        <strong>体調が悪いとき・困ったとき</strong>
        <p className="muted">このアプリは緊急の連絡には対応していません。次の番号へお電話ください。</p>
        <p>{HOSPITAL_NAME}<br /><a className="phone" href={`tel:${HOSPITAL_PHONE}`}>{HOSPITAL_PHONE}</a></p>
      </div>
    </div>
  );
}
