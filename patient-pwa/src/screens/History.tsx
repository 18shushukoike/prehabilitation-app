import { sessionsThisWeek, todayStr } from '../lib/storage';
import type { LocalLogSummary } from '../lib/types';

export default function History({ logs, sessionsPerWeek }: { logs: LocalLogSummary[]; sessionsPerWeek: number }) {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 27 - ((today.getDay() + 6) % 7)); // 4 週前の月曜から
  const days: Date[] = [];
  for (let i = 0; i < 35; i++) { const d = new Date(start); d.setDate(start.getDate() + i); if (d <= today) days.push(d); }
  const map = new Map(logs.map((l) => [l.log_date, l]));
  const last28 = logs.filter((l) => (today.getTime() - new Date(l.log_date).getTime()) / 86400000 < 28);
  const walkDays = last28.filter((l) => l.walk_status === 'done').length;
  const walkMin = last28.reduce((a, l) => a + (l.walk_min ?? 0), 0);
  const sessions = last28.filter((l) => l.session_status === 'done' || l.session_status === 'partial').length;
  const t = todayStr(today);

  return (
    <div>
      <h2>これまでの記録</h2>
      <div className="card">
        <div>今週のセッション: <strong className="big">{sessionsThisWeek(logs, today)} / {sessionsPerWeek} 回</strong></div>
        <div className="muted">直近 4 週間: 送った日 {last28.length} 日、歩いた日 {walkDays} 日（合計 {walkMin} 分）、セッション {sessions} 回</div>
      </div>
      <div className="cal">
        {['月', '火', '水', '木', '金', '土', '日'].map((h) => <div key={h} className="h">{h}</div>)}
        {days.map((d) => {
          const key = todayStr(d);
          const l = map.get(key);
          let cls = '';
          if (l) {
            if (l.session_status === 'done' || l.session_status === 'partial') cls = 'session';
            else if (l.walk_status === 'done') cls = 'walk';
            else if (l.walk_status === 'rest' || l.pre_check === 'red') cls = 'rest';
            else cls = 'none';
          }
          return <div key={key} className={'d ' + cls + (key === t ? ' today' : '')}>{d.getDate()}{cls === 'session' ? <small>S</small> : ''}</div>;
        })}
      </div>
      <div className="legend">
        <span><i style={{ background: '#1e7b4f' }} />セッションをした日</span>
        <span><i style={{ background: '#8fce9f' }} />歩いた日</span>
        <span><i style={{ background: '#f3b3ae' }} />運動なし</span>
        <span><i style={{ background: '#cfd8e3' }} />休んだ日（赤信号）</span>
      </div>
      <p className="muted">この記録はこの端末の中だけに保存されています。アプリを削除すると消えます。</p>
    </div>
  );
}
