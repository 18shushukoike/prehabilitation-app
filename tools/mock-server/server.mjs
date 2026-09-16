// Apps Script の代わりに手元で受信するモックサーバー（開発・動作確認用。実患者データは扱わない）
// 起動: node tools/mock-server/server.mjs  → http://localhost:8787
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const PATIENTS = join(dir, 'patients.json');
const LOGS = join(dir, 'logs.jsonl');
const NOTIFY = join(dir, 'notifications.jsonl');

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const fails = {};
const patients = () => JSON.parse(readFileSync(PATIENTS, 'utf8'));
const readLines = (p) => (existsSync(p) ? readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

const REASON = { fatigue: 'だるさ', nausea: '吐き気・食欲がない', fever: '熱がある', pain: '痛み', numbness: 'しびれ・ふらつき', diarrhea: '下痢', chemo_day: '点滴の日', no_time: '時間がなかった', forgot: '忘れていた', other: 'その他' };
const PRE = { fever: '38℃以上の発熱', vomiting: '強い吐き気・嘔吐', dizziness: 'ふらつき・めまい', dehydration: '脱水気味', severe_pain: '強い痛み', cannot: '本人ができないと判断', fatigue: 'だるさ', mild_nausea: '軽い吐き気・食欲低下', diarrhea: '下痢ぎみ', numbness: 'しびれ', chemo_day: '点滴当日・翌日', mild_pain: '軽い痛み' };
const SIGNAL = { green: '青', yellow: '黄', red: '赤' };
const TYPE = { normal: '通常', mild: '軽い' };
const POST = { fine: '問題なし', tired: '少しつらかった', symptom: '症状あり' };
const POST_SYM = { dyspnea: '息切れ・動悸', dizziness: 'めまい・ふらつき', pain: '痛み', nausea: '吐き気', exhausted: '強い疲れ', other: 'その他' };
const lab = (arr, map) => (arr || []).map((x) => map[x] || x).join('、');
const SESSION = { done: 'した', partial: '一部だけした', none: 'できなかった', not_planned: '予定なし' };
const WALK = { done: '歩いた', none: '歩かなかった', rest: '休む日' };
const sessionDone = (l) => l.session_status === 'done' || l.session_status === 'partial';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}
function json(res, code, obj) { cors(res); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); }

function handlePost(body) {
  const id = String(body.study_id || '');
  const pin = String(body.pin || '');
  const p = patients().find((x) => x.study_id === id);
  if (!p || sha256(id + ':' + pin) !== p.pin_hash) {
    fails[id] = (fails[id] || 0) + 1;
    if (fails[id] >= 10) return { ok: false, error: 'locked' };
    return { ok: false, error: 'invalid_token' };
  }
  fails[id] = 0;
  if (p.status !== 'active') return { ok: false, error: 'inactive' };
  if (body.action === 'verify') return { ok: true, menu_template: p.menu_template || 1 };
  if (!SESSION[body.session_status] || !WALK[body.walk_status]) return { ok: false, error: 'bad_payload' };
  const rec = { received_at: new Date().toISOString(), ...body, pin: undefined, action: undefined };
  appendFileSync(LOGS, JSON.stringify(rec) + '\n');
  const flags = [];
  if (rec.pre_check === 'red') flags.push('赤信号・中止');
  if (rec.post_condition === 'symptom') flags.push('運動後に症状');
  if (flags.length) {
    const n = { ts: rec.received_at, study_id: id, subject: `[術前リハ] ${id} ${flags.join('・')}`, body: describe(rec) };
    appendFileSync(NOTIFY, JSON.stringify(n) + '\n');
    console.log('\n📧 即時通知（実運用ではメール）\n件名: ' + n.subject + '\n' + n.body + '\n');
  } else {
    console.log(`\n✅ 受信 ${id} 歩行 ${WALK[rec.walk_status]} / セッション ${SESSION[rec.session_status]}（通知条件に該当せず）\n`);
  }
  return { ok: true, log_date: rec.log_date };
}

function describe(r) {
  const L = [`番号: ${r.study_id}`, `記録日: ${r.log_date}`];
  if (r.pre_check) L.push(`運動前の体調: ${SIGNAL[r.pre_check]}信号${r.pre_symptoms?.length ? `（${lab(r.pre_symptoms, PRE)}）` : '（症状なし）'}`);
  if (r.pre_symptom_text) L.push('本人の記載: ' + r.pre_symptom_text);
  if (r.pre_check === 'red') L.push('【赤信号: 運動を中止】');
  L.push(`ウォーキング: ${WALK[r.walk_status]}${r.walk_status === 'done' && r.walk_min != null ? `（${r.walk_min} 分）` : ''}`);
  L.push(`セッション: ${SESSION[r.session_status]}${r.session_planned ? '（予定日）' : ''}${r.session_type ? ` ${TYPE[r.session_type]}メニュー${r.session_min != null ? `・${r.session_min} 分` : ''}` : ''}`);
  if (r.session_items_done?.length) L.push('実施種目: ' + r.session_items_done.join(', '));
  if (r.reasons?.length) L.push('理由: ' + lab(r.reasons, REASON));
  if (r.reason_other) L.push('理由（その他）: ' + r.reason_other);
  if (r.post_condition) L.push(`運動後の体調: ${POST[r.post_condition]}${r.post_symptoms?.length ? `（${lab(r.post_symptoms, POST_SYM)}）` : ''}${r.post_borg != null ? `　Borg ${r.post_borg}` : ''}`);
  if (r.post_condition === 'symptom') L.push('【運動後に症状あり】');
  if (r.free_text) L.push('ひとこと: ' + r.free_text);
  return L.join('\n');
}

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function dashboard() {
  const ps = patients();
  const logs = readLines(LOGS);
  const notes = readLines(NOTIFY).reverse();
  const today = new Date();
  const dowIso = ((today.getDay() + 6) % 7) + 1;
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - (dowIso - 1)); weekStart.setHours(0, 0, 0, 0);
  const DOW = ['日', '月', '火', '水', '木', '金', '土'];
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const patientSheets = ps.map((p) => {
    const ls = logs.filter((l) => l.study_id === p.study_id).sort((a, b) => (a.log_date < b.log_date ? 1 : -1));
    const uniq = [...new Map(ls.map((l) => [l.log_date, l])).values()];
    const byDate = new Map(uniq.map((l) => [l.log_date, l]));
    const last = uniq[0];
    const week = uniq.filter((l) => new Date(l.log_date) >= weekStart);
    const sessWeek = week.filter(sessionDone).length;
    const sdays = last?.session_days || [];
    let plannedPassed = 0;
    for (let t = new Date(weekStart); t <= today; t.setDate(t.getDate() + 1)) if (sdays.includes(t.getDay())) plannedPassed++;
    let consec = 0;
    for (const l of uniq) { if (!sessionDone(l) && l.walk_status !== 'done' && l.walk_status !== 'rest') consec++; else break; }
    const days = last ? Math.round((today - new Date(last.log_date)) / 86400000) : null;
    const why = [];
    if (p.status === 'active') {
      if (days === null || days >= 2) why.push(days === null ? '送信なし' : `未送信 ${days} 日`);
      if (plannedPassed >= 1 && sessWeek === 0) why.push(`今週セッション 0 回（予定日 ${plannedPassed} 日経過）`);
      if (consec >= 3) why.push(`運動なし ${consec} 日連続`);
      if (last?.pre_check === 'red') why.push('赤信号で中止');
      if (last?.post_condition === 'symptom') why.push('運動後に症状');
    }
    const first = uniq.length ? uniq[uniq.length - 1].log_date : ymd(today);
    const rows = [];
    for (let t = new Date(ymd(today)); ymd(t) >= first && rows.length < 400; t.setDate(t.getDate() - 1)) {
      const d = ymd(t), l = byDate.get(d), planned = sdays.includes(t.getDay());
      let bg = '#fff';
      if (!l) { bg = '#f1f3f4'; rows.push(`<tr style="background:${bg}"><td>${d}</td><td>${DOW[t.getDay()]}</td><td>${planned ? '○' : ''}</td><td>未送信</td><td colspan="14"></td></tr>`); continue; }
      if (l.pre_check === 'red') bg = '#fce8e6'; else if (l.post_condition === 'symptom') bg = '#fde2cf'; else if (l.pre_check === 'yellow') bg = '#fff4d6'; else if (sessionDone(l)) bg = '#e6f4ea'; else if (planned && l.session_status === 'none') bg = '#fbe9e7';
      rows.push(`<tr style="background:${bg}"><td>${d}</td><td>${DOW[t.getDay()]}</td><td>${planned ? '○' : ''}</td><td>送信</td><td>${l.pre_check ? SIGNAL[l.pre_check] : ''}</td><td>${lab(l.pre_symptoms, PRE)}</td><td>${esc(l.pre_symptom_text)}</td><td>${SESSION[l.session_status]}</td><td>${l.session_type ? TYPE[l.session_type] : ''}</td><td>${l.session_min ?? ''}</td><td>${l.session_items_done?.length ? l.session_items_done.length + ' 種目' : ''}</td><td>${WALK[l.walk_status]}</td><td>${l.walk_status === 'done' ? l.walk_min : ''}</td><td>${lab(l.reasons, REASON)}${l.reason_other ? `（${esc(l.reason_other)}）` : ''}</td><td>${l.post_condition ? POST[l.post_condition] : ''}</td><td>${lab(l.post_symptoms, POST_SYM)}</td><td>${l.post_borg ?? ''}</td><td>${esc(l.free_text)}</td></tr>`);
    }
    return `<h3>進捗_${p.study_id}</h3>
<table class="top"><tr><th>番号</th><td>${p.study_id}</td><th>状態</th><td>${p.status}</td><th>設定曜日</th><td>${sdays.map((d) => DOW[d]).join('・') || '（未送信のため不明）'}</td><th>今週セッション</th><td>${sessWeek} / 3（予定日 ${plannedPassed} 日経過）</td><th>最終送信</th><td>${last?.log_date ?? '—'}</td><th>要連絡</th><td class="${why.length ? 'need' : ''}">${why.join('、') || 'なし'}</td></tr></table>
<table><tr><th>日付</th><th>曜日</th><th>予定日</th><th>送信</th><th>信号</th><th>信号の項目</th><th>本人の記載</th><th>セッション</th><th>メニュー</th><th>所要時間(分)</th><th>実施種目</th><th>歩行</th><th>歩行(分)</th><th>できなかった理由</th><th>運動後の体調</th><th>運動後の症状</th><th>Borg</th><th>ひとこと</th></tr>${rows.join('')}</table>`;
  }).join('');
  const logRows = logs.slice().reverse().slice(0, 50).map((l) => `<tr><td>${esc(l.received_at).slice(0, 19).replace('T', ' ')}</td><td>${l.study_id}</td><td>${l.log_date}</td><td>${WALK[l.walk_status]}${l.walk_min ? ` ${l.walk_min}分` : ''}</td><td>${SESSION[l.session_status]}${l.session_planned ? '(予定日)' : ''}${l.session_type ? ` ${TYPE[l.session_type]}` : ''}${l.session_min != null ? ` ${l.session_min}分` : ''}</td><td>${l.pre_check ? SIGNAL[l.pre_check] : ''}</td><td>${lab(l.reasons, REASON)}</td><td>${l.post_condition ? POST[l.post_condition] + (l.post_symptoms?.length ? `（${lab(l.post_symptoms, POST_SYM)}）` : '') : ''}</td><td>${l.post_borg ?? ''}</td><td>${esc(l.free_text)}</td></tr>`).join('');
  const uniqLogs = [...new Map(logs.map((l) => [l.study_id + '|' + l.log_date, l])).values()];
  const pc = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : '—');
  const mean = (arr, d = 1) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10 ** d) / 10 ** d : '—');
  const count = (arr, f, map) => { const c = {}; arr.forEach((l) => (l[f] || []).forEach((k) => (c[k] = (c[k] || 0) + 1))); return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${map[k] || k} ${v}`).join('、'); };
  const sumRow = (id, status, ls) => {
    const planned = ls.filter((l) => l.session_planned), sess = ls.filter(sessionDone), checked = ls.filter((l) => l.pre_check), post = ls.filter((l) => l.post_condition);
    const red = checked.filter((l) => l.pre_check === 'red'), yellow = checked.filter((l) => l.pre_check === 'yellow'), symp = post.filter((l) => l.post_condition === 'symptom');
    const walk = ls.filter((l) => l.walk_status === 'done');
    const dates = ls.map((l) => l.log_date).sort();
    return `<tr><td>${id}</td><td>${status}</td><td>${dates[0] ?? ''}〜${dates.at(-1) ?? ''}</td><td>${ls.length}</td><td>${planned.filter(sessionDone).length} / ${planned.length}（${pc(planned.filter(sessionDone).length, planned.length)} %）</td><td>${sess.length}（通常 ${sess.filter((l) => l.session_type === 'normal').length}・軽い ${sess.filter((l) => l.session_type === 'mild').length}）</td><td>${mean(sess.map((l) => Number(l.session_min)).filter((v) => v > 0))}</td><td>${checked.filter((l) => l.pre_check === 'green').length} / ${yellow.length} / ${red.length}</td><td>${count(red, 'pre_symptoms', PRE)}</td><td>${post.filter((l) => l.post_condition === 'fine').length} / ${post.filter((l) => l.post_condition === 'tired').length} / ${symp.length}</td><td>${count(symp, 'post_symptoms', POST_SYM)}</td><td>${mean(ls.filter((l) => l.post_borg != null).map((l) => Number(l.post_borg)))}</td><td>${walk.length}（${pc(walk.length, ls.length)} %）平均 ${mean(walk.map((l) => Number(l.walk_min) || 0), 0)} 分</td><td>${count(ls, 'reasons', REASON)}</td></tr>`;
  };
  const summary = ps.map((p) => sumRow(p.study_id, p.status, uniqLogs.filter((l) => l.study_id === p.study_id))).join('') + sumRow('<b>全体</b>', ps.length + ' 名', uniqLogs);
  const noteRows = notes.slice(0, 30).map((n) => `<details><summary>${esc(n.ts).slice(0, 19).replace('T', ' ')} ${esc(n.subject)}</summary><pre>${esc(n.body)}</pre></details>`).join('');
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta http-equiv="refresh" content="15"><title>術前リハ モックダッシュボード</title>
<style>body{font-family:-apple-system,"Hiragino Sans",sans-serif;margin:24px;color:#1f2933}h1{font-size:1.3rem}h2{font-size:1.1rem;margin-top:28px}table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{border:1px solid #d5dde3;padding:6px 8px;text-align:left}th{background:#e8eaed}tr.need,td.need{background:#fce8e6}table.top th{background:#e8eaed}table.top{margin-bottom:6px}h3{font-size:1rem;margin:22px 0 6px}pre{background:#f4f7f9;padding:10px;border-radius:8px;white-space:pre-wrap}.note{background:#fff4d6;padding:8px 12px;border-radius:8px;font-size:.9rem}details{margin:6px 0}</style></head><body>
<h1>術前リハ モックダッシュボード（開発用）</h1>
<p class="note">Apps Script＋スプレッドシートの代わりに手元で受信しています。実運用ではこの内容がスプレッドシート「ダッシュボード」タブと通知メールになります。15 秒ごとに自動更新。</p>
<h2>全体サマリー（症例ごとの累積。最終行が全体）</h2>
<table><tr><th>番号</th><th>状態</th><th>記録期間</th><th>送信日数</th><th>予定日の遂行（した／予定日）</th><th>セッション総回数</th><th>平均所要時間 分</th><th>信号 青/黄/赤</th><th>赤の項目</th><th>運動後 問題なし/つらい/症状</th><th>症状の内訳</th><th>平均 Borg</th><th>歩いた日</th><th>理由の内訳</th></tr>${summary}</table>
<h2>患者ごとの日次シート（実運用ではタブ「進捗_番号」）</h2>
${patientSheets}
<h2>即時通知（メール相当）</h2>${noteRows || '<p>まだありません</p>'}
<h2>日次記録（直近 50 件）</h2>
<table><tr><th>受信</th><th>研究ID</th><th>記録日</th><th>歩行</th><th>セッション</th><th>信号</th><th>理由</th><th>運動後</th><th>Borg</th><th>ひとこと</th></tr>${logRows}</table>
</body></html>`;
}

createServer((req, res) => {
  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); return res.end(); }
  if (req.method === 'POST') {
    let buf = '';
    req.on('data', (c) => (buf += c));
    req.on('end', () => {
      try { json(res, 200, handlePost(JSON.parse(buf))); }
      catch { json(res, 200, { ok: false, error: 'bad_json' }); }
    });
    return;
  }
  if (req.url === '/health') return json(res, 200, { ok: true, service: 'prehab-mock' });
  cors(res); res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(dashboard());
}).listen(PORT, '0.0.0.0', () => {
  console.log(`モックサーバー起動: http://localhost:${PORT}  （ダッシュボード） / POST 受信も同じ URL`);
  console.log('テスト患者:', patients().map((p) => `番号 ${p.study_id} / 暗証番号 ${p.pin_plain}`).join(', '));
});
