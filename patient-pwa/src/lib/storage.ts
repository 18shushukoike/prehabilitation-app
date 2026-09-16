import type { AppConfig, AppState, DailyLog, LocalLogSummary } from './types';

const KEY = 'prehab.state.v3';

const empty = (): AppState => ({ config: null, logs: [], pending: [] });

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const s = JSON.parse(raw) as AppState;
    const config = s.config ? { ...s.config, session_days: s.config.session_days ?? [1, 3, 5] } : null;
    return { config, logs: s.logs ?? [], pending: s.pending ?? [] };
  } catch {
    return empty();
  }
}

export function saveState(s: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 端末の保存領域が使えない場合は無視する */
  }
}

export function setConfig(s: AppState, c: AppConfig): AppState {
  const n = { ...s, config: c };
  saveState(n);
  return n;
}

export function summarize(log: DailyLog, sent: boolean): LocalLogSummary {
  return {
    log_date: log.log_date,
    walk_status: log.walk_status,
    walk_min: log.walk_min,
    session_status: log.session_status,
    session_type: log.session_type,
    session_min: log.session_min,
    pre_check: log.pre_check,
    sent
  };
}

export function upsertLocalLog(s: AppState, log: LocalLogSummary): AppState {
  const logs = s.logs.filter((l) => l.log_date !== log.log_date).concat(log)
    .sort((a, b) => (a.log_date < b.log_date ? 1 : -1))
    .slice(0, 120);
  const n = { ...s, logs };
  saveState(n);
  return n;
}

export function setPending(s: AppState, pending: DailyLog[]): AppState {
  const n = { ...s, pending };
  saveState(n);
  return n;
}

export function clearAll() {
  try {
    localStorage.removeItem(KEY);
  } catch { /* noop */ }
}

export function todayStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 今週（月曜始まり）のセッション完了数（done ＋ partial） */
export function sessionsThisWeek(logs: LocalLogSummary[], now = new Date()): number {
  const s = new Date(now);
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  const start = todayStr(s);
  return logs.filter((l) => l.log_date >= start && (l.session_status === 'done' || l.session_status === 'partial')).length;
}
