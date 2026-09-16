import { useCallback, useEffect, useState } from 'react';
import Setup from './screens/Setup';
import Home from './screens/Home';
import Exercise from './screens/Exercise';
import Session from './screens/Session';
import LogForm from './screens/LogForm';
import History from './screens/History';
import Learn from './screens/Learn';
import Settings from './screens/Settings';
import { clearAll, loadState, setConfig, setPending, summarize, upsertLocalLog } from './lib/storage';
import { programById } from './data/program';
import { errorMessage, sendLog } from './lib/api';
import type { AppConfig, AppState, DailyLog, SessionDraft } from './lib/types';
import { DEMO } from './lib/config';

type Tab = 'home' | 'history' | 'learn' | 'settings';
type View = { tab: Tab } | { tab: 'exercise'; code: string } | { tab: 'session' } | { tab: 'log'; draft?: SessionDraft };

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [view, setView] = useState<View>({ tab: 'home' });

  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', String(state.config?.font_scale ?? 1));
  }, [state.config?.font_scale]);

  // 未送信の再送（起動時・オンライン復帰時）
  const flushPending = useCallback(async () => {
    const s = loadState();
    if (!s.pending.length) return;
    const remain: DailyLog[] = [];
    let cur = s;
    for (const p of s.pending) {
      const r = await sendLog(p);
      if (r.ok) cur = upsertLocalLog(cur, summarize(p, true));
      else if (r.offline) remain.push(p);
      // オフライン以外のエラー（トークン無効等）は再送しても直らないため破棄する
    }
    setState(setPending(cur, remain));
  }, []);

  useEffect(() => {
    flushPending();
    window.addEventListener('online', flushPending);
    return () => window.removeEventListener('online', flushPending);
  }, [flushPending]);

  const handleSubmit = useCallback(async (log: DailyLog) => {
    const r = await sendLog(log);
    if (r.ok) {
      setState((s) => upsertLocalLog(s, summarize(log, true)));
      return { ok: true, message: '' };
    }
    if (r.offline) {
      setState((s) => {
        const s1 = upsertLocalLog(s, summarize(log, false));
        return setPending(s1, s1.pending.filter((p) => p.log_date !== log.log_date).concat(log));
      });
      return { ok: false, queued: true, message: errorMessage(r.error) };
    }
    return { ok: false, message: errorMessage(r.error) };
  }, []);

  if (!state.config) {
    return (
      <>
        <header className="app"><h1>術前リハビリ</h1></header>
        <main><Setup onDone={(c) => setState((s) => setConfig(s, c))} /></main>
      </>
    );
  }
  const config: AppConfig = state.config;

  let body: JSX.Element;
  switch (view.tab) {
    case 'exercise': body = <Exercise code={view.code} onBack={() => setView({ tab: 'home' })} />; break;
    case 'session': body = <Session config={config} onFinish={(draft) => setView({ tab: 'log', draft })} onExit={() => setView({ tab: 'home' })} />; break;
    case 'log': body = <LogForm config={config} draft={view.draft} onSubmit={handleSubmit} onBack={() => setView({ tab: 'home' })} />; break;
    case 'history': body = <History logs={state.logs} sessionsPerWeek={programById(config.menu_template).sessionsPerWeek} />; break;
    case 'learn': body = <Learn />; break;
    case 'settings':
      body = <Settings config={config} onChange={(c) => setState((s) => setConfig(s, c))} onReset={() => { clearAll(); setState(loadState()); setView({ tab: 'home' }); }} />;
      break;
    default:
      body = <Home config={config} logs={state.logs} pendingCount={state.pending.length}
        onStartSession={() => setView({ tab: 'session' })}
        onOpenExercise={(code) => setView({ tab: 'exercise', code })} onLog={() => setView({ tab: 'log' })} />;
  }

  const tabs: [Tab, string, string][] = [['home', '🏠', 'ホーム'], ['history', '📅', '記録'], ['learn', '📖', '学ぶ'], ['settings', '⚙️', '設定']];
  const activeTab = view.tab === 'exercise' || view.tab === 'log' || view.tab === 'session' ? 'home' : view.tab;

  return (
    <>
      <header className="app"><h1>術前リハビリ</h1><span className="id">{config.study_id}</span></header>
      <main>{DEMO && <div className="demo">デモ版: 送信内容は病院に届きません（この端末に保存されるだけです）</div>}{body}</main>
      <nav className="tabs">
        {tabs.map(([t, ic, l]) => (
          <button key={t} className={activeTab === t ? 'active' : ''} onClick={() => setView({ tab: t })}><span className="ic">{ic}</span>{l}</button>
        ))}
      </nav>
    </>
  );
}
