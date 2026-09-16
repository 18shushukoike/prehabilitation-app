/**
 * 術前リハビリテーション支援アプリ ― Apps Script（スプレッドシート バインド）
 *
 * 想定プログラム: 週 3 回（患者が曜日を設定）・1 回 30〜50 分の運動セッション ＋ 毎日のウォーキング
 * 体調確認は「セッション前（青・黄・赤の信号）」と「運動後」の 2 回のみ
 *
 * 役割:
 *   - doPost          : 患者 PWA からの日次記録を受信し「日次記録」に追記（同日再送は上書き）
 *                       action=verify の場合は番号・暗証番号の照合のみ行い、メニュー種別を返す（初期設定用）
 *   - 即時通知        : 赤信号で中止／運動後に症状 のときだけ担当者へメール
 *   - dailySummary    : 毎朝、前日一覧・未送信者・予定日に未実施の患者をメール
 *   - weeklySummary   : 毎週月曜、先週の実施状況をメール
 *   - refreshDashboard: 「全体サマリー」（症例ごと 1 行）と患者ごとの日次シート（進捗_番号）を再計算
 *   - setupSheets     : 必要なタブ・見出し・保護を作成（初回のみ実行）
 *
 * 患者の認証は 4 桁の番号（study_id）＋ 4 桁の暗証番号（pin）。pin_hash = SHA-256(study_id + ':' + pin)。
 * 連続失敗 10 回で 6 時間ロック（CacheService）。
 * 患者の識別情報（氏名・病院ID 等）および臨床データ（レジメン・評価値・外来日等）は一切扱わない。
 * それらは REDCap 等の院内管理システムで番号と紐づけて管理する。このシートは番号・患者入力・対応記録・運用情報のみ。
 */

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------
var SHEET = {
  PATIENTS: '患者一覧',
  LOGS: '日次記録',
  ACTIONS: '対応記録',
  SUMMARY: '全体サマリー',
  NOTIFY: '通知ログ',
  SETTINGS: '設定'
};

var HEADERS = {};
HEADERS[SHEET.PATIENTS] = [
  'study_id', 'pin_hash', 'menu_template', 'assignee_pt', 'assignee_dr', 'status', 'note'
];
HEADERS[SHEET.LOGS] = [
  'received_at', 'log_date', 'study_id',
  'walk_status', 'walk_min',
  'pre_check', 'pre_symptoms', 'pre_symptom_text',
  'session_planned', 'session_days', 'session_status', 'session_type', 'session_min', 'session_items_done',
  'reasons', 'reason_other',
  'post_borg', 'post_condition', 'post_symptoms',
  'free_text', 'app_version', 'notified'
];
HEADERS[SHEET.ACTIONS] = [
  'ts', 'study_id', 'staff', 'channel', 'trigger', 'content', 'next_action', 'chart_noted'
];
/** 患者ごとの日次シート（タブ名 進捗_番号）。1 日 1 行で最新日が上 */
var PATIENT_SHEET_PREFIX = '進捗_';
var PATIENT_SHEET_HEADERS = [
  '日付', '曜日', '予定日', '送信', '信号', '信号の項目', '本人の記載',
  'セッション', 'メニュー', '所要時間(分)', '実施種目',
  '歩行', '歩行(分)', 'できなかった理由',
  '運動後の体調', '運動後の症状', 'Borg', 'ひとこと', '受信日時'
];
HEADERS[SHEET.SUMMARY] = [
  'study_id', 'status', 'first_log', 'last_log', 'days_logged',
  'planned_days', 'planned_done', 'planned_adherence_pct', 'planned_missed',
  'sessions_total', 'sessions_full', 'sessions_partial', 'sessions_unplanned', 'sessions_normal', 'sessions_mild', 'mean_session_min',
  'checks', 'green', 'yellow', 'red', 'green_pct', 'yellow_pct', 'red_pct', 'red_items', 'yellow_items',
  'post_records', 'post_fine', 'post_tired', 'post_symptom', 'post_symptom_pct', 'post_symptom_items', 'mean_borg',
  'walk_days', 'walk_pct', 'mean_walk_min', 'walk_total_min',
  'reason_items',
  'days_since_log', 'session_days', 'sessions_this_week', 'planned_this_week', 'consecutive_no_exercise',
  'needs_contact', 'reason_for_contact', 'updated_at'
];
HEADERS[SHEET.NOTIFY] = ['ts', 'type', 'study_id', 'to', 'subject', 'detail'];
HEADERS[SHEET.SETTINGS] = ['key', 'value', '説明'];

var DEFAULT_SETTINGS = [
  ['notify_emails', '', '即時通知の共通宛先（カンマ区切り）。患者一覧の担当者にも送る'],
  ['summary_emails', '', '朝のまとめ・週次の宛先（カンマ区切り）。空なら notify_emails'],
  ['no_input_days', '2', '未送信何日で要連絡にするか'],
  ['sessions_per_week', '3', '週あたりのセッション目標回数'],
  ['consecutive_no_exercise_days', '3', 'ウォーキングもセッションもない日が何日続いたら要連絡か'],
  ['rate_limit_per_min', '10', '番号ごとの 1 分あたり受信上限'],
  ['lock_after_failures', '10', '暗証番号の連続失敗が何回でロックするか'],
  ['lock_hours', '6', 'ロック時間（時間）'],
  ['immediate_notify', 'true', '即時通知（赤信号・運動後の症状）を送るか'],
  ['subject_prefix', '[術前リハ]', 'メール件名の接頭辞']
];

var REASON_LABEL = {
  fatigue: 'だるさ', nausea: '吐き気・食欲がない', fever: '熱がある', pain: '痛み',
  numbness: 'しびれ・ふらつき', diarrhea: '下痢', chemo_day: '点滴の日',
  no_time: '時間がなかった', forgot: '忘れていた', other: 'その他'
};
var PRE_LABEL = {
  fever: '38℃以上の発熱', vomiting: '強い吐き気・嘔吐', dizziness: 'ふらつき・めまい', dehydration: '脱水気味',
  severe_pain: '強い痛み', cannot: '本人ができないと判断',
  fatigue: 'だるさ', mild_nausea: '軽い吐き気・食欲低下', diarrhea: '下痢ぎみ', numbness: 'しびれ', chemo_day: '点滴当日・翌日', mild_pain: '軽い痛み'
};
var SIGNAL_LABEL = { green: '青', yellow: '黄', red: '赤' };
var TYPE_LABEL = { normal: '通常', mild: '軽い' };
var POST_LABEL = { fine: '問題なし', tired: '少しつらかった', symptom: '症状あり' };
var POST_SYM_LABEL = { dyspnea: '息切れ・動悸', dizziness: 'めまい・ふらつき', pain: '痛み', nausea: '吐き気', exhausted: '強い疲れ', other: 'その他' };
var SESSION_LABEL = { done: 'した', partial: '一部だけした', none: 'できなかった', not_planned: '予定なし' };
var WALK_LABEL = { done: '歩いた', none: '歩かなかった', rest: '休む日' };
var DOW = ['日', '月', '火', '水', '木', '金', '土'];

function exercised_(l) { return l.session_status === 'done' || l.session_status === 'partial' || l.walk_status === 'done'; }
function sessionDone_(l) { return l.session_status === 'done' || l.session_status === 'partial'; }
function truthy_(v) { return v === true || String(v).toLowerCase() === 'true'; }

// ---------------------------------------------------------------------------
// 初期セットアップ（初回に手動で実行）
// ---------------------------------------------------------------------------
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(HEADERS).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]])
        .setFontWeight('bold').setBackground('#e8eaed');
      sh.setFrozenRows(1);
      var idCol = HEADERS[name].indexOf('study_id') + 1;
      if (idCol > 0) sh.getRange(2, idCol, sh.getMaxRows() - 1, 1).setNumberFormat('@');
    }
  });
  var st = ss.getSheetByName(SHEET.SETTINGS);
  if (st.getLastRow() <= 1) st.getRange(2, 1, DEFAULT_SETTINGS.length, 3).setValues(DEFAULT_SETTINGS);
  var s1 = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
  if (s1 && s1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s1);
  protectSheets_();
  refreshDashboard();
  Logger.log('セットアップ完了。設定タブに通知先メールを入力し、installTriggers を実行してください。');
}

function protectSheets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var me = Session.getEffectiveUser();
  var names = [SHEET.LOGS, SHEET.NOTIFY, SHEET.SUMMARY];
  ss.getSheets().forEach(function (sh) { if (sh.getName().indexOf(PATIENT_SHEET_PREFIX) === 0) names.push(sh.getName()); });
  names.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function (p) { p.remove(); });
    var p = sh.protect().setDescription('自動更新のみ。手動編集しないでください');
    p.removeEditors(p.getEditors());
    p.addEditor(me);
    if (p.canDomainEdit()) p.setDomainEdit(false);
  });
  var ps = ss.getSheetByName(SHEET.PATIENTS);
  ps.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function (p) { p.remove(); });
  var col = HEADERS[SHEET.PATIENTS].indexOf('pin_hash') + 1;
  var rp = ps.getRange(2, col, ps.getMaxRows() - 1, 1).protect().setDescription('pin_hash は管理者のみ編集');
  rp.removeEditors(rp.getEditors());
  rp.addEditor(me);
  if (rp.canDomainEdit()) rp.setDomainEdit(false);
}

function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('dailySummary').timeBased().everyDays(1).atHour(8).nearMinute(0).create();
  ScriptApp.newTrigger('weeklySummary').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).nearMinute(15).create();
  ScriptApp.newTrigger('refreshDashboard').timeBased().everyHours(1).create();
  Logger.log('トリガーを設定しました（毎日 8:00 まとめ、月曜 8:15 週次、毎時集計更新）');
}

// ---------------------------------------------------------------------------
// Web App
// ---------------------------------------------------------------------------
function doGet() {
  return json_({ ok: true, service: 'prehab', ts: new Date().toISOString() });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (err) { return json_({ ok: false, error: 'busy' }); }
  try {
    var body;
    try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_json' }); }
    var studyId = String(body.study_id || '').trim();
    var pin = String(body.pin || '').trim();
    if (!/^\d{4}$/.test(studyId) || !/^\d{4}$/.test(pin)) return json_({ ok: false, error: 'invalid_token' });

    if (!checkRate_(studyId)) return json_({ ok: false, error: 'rate_limited' });
    if (isLocked_(studyId)) return json_({ ok: false, error: 'locked' });

    var patient = findPatient_(studyId);
    if (!patient || sha256_(studyId + ':' + pin) !== String(patient.pin_hash).toLowerCase()) {
      recordFailure_(studyId);
      return json_({ ok: false, error: 'invalid_token' });
    }
    clearFailures_(studyId);
    if (String(patient.status).toLowerCase() !== 'active') return json_({ ok: false, error: 'inactive' });

    if (String(body.action || '') === 'verify') {
      return json_({ ok: true, menu_template: Number(patient.menu_template) || 1 });
    }

    var rec = normalizeLog_(body, studyId);
    if (!rec) return json_({ ok: false, error: 'bad_payload' });

    var shouldNotify = needsImmediateNotify_(rec);
    rec.notified = false;
    upsertLog_(rec);

    if (shouldNotify && getSetting_('immediate_notify', 'true') === 'true') {
      try { sendImmediate_(rec, patient); markNotified_(rec); }
      catch (err) { logNotify_('error', studyId, '', 'immediate failed', String(err)); }
    }
    try { refreshDashboard(); } catch (err) { /* 集計失敗は受信成功に影響させない */ }
    return json_({ ok: true, log_date: rec.log_date });
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function checkRate_(studyId) {
  var cache = CacheService.getScriptCache();
  var key = 'rate:' + studyId;
  var n = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(n), 60);
  return n <= Number(getSetting_('rate_limit_per_min', '10'));
}
function isLocked_(studyId) {
  var n = Number(CacheService.getScriptCache().get('fail:' + studyId) || 0);
  return n >= Number(getSetting_('lock_after_failures', '10'));
}
function recordFailure_(studyId) {
  var cache = CacheService.getScriptCache();
  var key = 'fail:' + studyId;
  var n = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(n), Math.min(21600, Number(getSetting_('lock_hours', '6')) * 3600));
}
function clearFailures_(studyId) { CacheService.getScriptCache().remove('fail:' + studyId); }

function sha256_(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

// ---------------------------------------------------------------------------
// 受信データの正規化
// ---------------------------------------------------------------------------
function normalizeLog_(b, studyId) {
  var ws = String(b.walk_status || '');
  var ss = String(b.session_status || '');
  if (!WALK_LABEL[ws] || !SESSION_LABEL[ss]) return null;
  var logDate = String(b.log_date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(logDate)) logDate = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  var pre = String(b.pre_check || '');
  if (!SIGNAL_LABEL[pre]) pre = '';
  var preSym = arr_(b.pre_symptoms).filter(function (r) { return PRE_LABEL[r]; });
  var reasons = arr_(b.reasons).filter(function (r) { return REASON_LABEL[r]; });
  var items = arr_(b.session_items_done).filter(function (c) { return /^[a-z_]{1,30}$/.test(c); }).slice(0, 30);
  var sessionActive = ss === 'done' || ss === 'partial';
  var type = String(b.session_type || '');
  if (!TYPE_LABEL[type]) type = '';
  var post = String(b.post_condition || '');
  if (!POST_LABEL[post]) post = '';
  var postSym = arr_(b.post_symptoms).filter(function (r) { return POST_SYM_LABEL[r]; });
  var days = arr_(b.session_days).map(Number).filter(function (d) { return d >= 0 && d <= 6; });
  return {
    received_at: new Date(),
    log_date: logDate,
    study_id: studyId,
    walk_status: ws,
    walk_min: ws === 'done' ? numOrBlank_(b.walk_min, 0, 600) : 0,
    pre_check: pre,
    pre_symptoms: preSym.join(','),
    pre_symptom_text: trunc_(b.pre_symptom_text, 300),
    session_planned: !!b.session_planned,
    session_days: days.join(','),
    session_status: ss,
    session_type: sessionActive ? type : '',
    session_min: sessionActive ? numOrBlank_(b.session_min, 0, 300) : '',
    session_items_done: items.join(','),
    reasons: reasons.join(','),
    reason_other: trunc_(b.reason_other, 200),
    post_borg: numOrBlank_(b.post_borg, 0, 10),
    post_condition: post,
    post_symptoms: post === 'symptom' ? postSym.join(',') : '',
    free_text: trunc_(b.free_text, 500),
    app_version: trunc_(b.app_version, 20)
  };
}

function arr_(v) { return Array.isArray(v) ? v.map(String) : (v !== undefined && v !== null && v !== '' ? String(v).split(',') : []); }
function clamp_(n, lo, hi) { return isNaN(n) ? '' : Math.max(lo, Math.min(hi, Math.round(n))); }
function numOrBlank_(v, lo, hi) { if (v === null || v === undefined || v === '') return ''; return clamp_(Number(v), lo, hi); }
function trunc_(s, n) { return String(s || '').replace(/[\r\n]+/g, ' ').slice(0, n); }

/** 即時通知は「赤信号で中止」「運動後に症状」の 2 条件のみ */
function needsImmediateNotify_(rec) {
  return rec.pre_check === 'red' || rec.post_condition === 'symptom';
}

// ---------------------------------------------------------------------------
// シート操作
// ---------------------------------------------------------------------------
function sheet_(name) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); }

function readTable_(name) {
  var sh = sheet_(name);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var head = HEADERS[name];
  var vals = sh.getRange(2, 1, last - 1, head.length).getValues();
  return vals.map(function (row, i) {
    var o = { _row: i + 2 };
    head.forEach(function (h, j) { o[h] = row[j]; });
    return o;
  }).filter(function (o) { return o.study_id !== '' && o.study_id !== undefined; });
}

function findPatient_(studyId) {
  var rows = readTable_(SHEET.PATIENTS);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].study_id).replace(/\.0$/, '') === studyId) return rows[i];
  }
  return null;
}

function upsertLog_(rec) {
  var sh = sheet_(SHEET.LOGS);
  var head = HEADERS[SHEET.LOGS];
  var row = head.map(function (h) { return rec[h] === undefined ? '' : rec[h]; });
  var last = sh.getLastRow();
  if (last >= 2) {
    var ids = sh.getRange(2, 3, last - 1, 1).getValues();
    var dates = sh.getRange(2, 2, last - 1, 1).getValues();
    for (var i = ids.length - 1; i >= 0; i--) {
      if (String(ids[i][0]) === rec.study_id && dateStr_(dates[i][0]) === rec.log_date) {
        sh.getRange(i + 2, 1, 1, head.length).setValues([row]);
        rec._row = i + 2;
        return;
      }
    }
  }
  sh.appendRow(row);
  rec._row = sh.getLastRow();
}

function markNotified_(rec) {
  if (!rec._row) return;
  var col = HEADERS[SHEET.LOGS].indexOf('notified') + 1;
  sheet_(SHEET.LOGS).getRange(rec._row, col).setValue(true);
}

function dateStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy-MM-dd');
  return String(v || '').slice(0, 10);
}

function getSetting_(key, def) {
  var rows = sheet_(SHEET.SETTINGS).getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === key) {
      var v = String(rows[i][1]).trim();
      return v === '' ? def : v;
    }
  }
  return def;
}

function emails_(csv) {
  return String(csv || '').split(/[,\s;]+/).map(function (s) { return s.trim(); }).filter(function (s) { return /@/.test(s); });
}
function uniq_(a) { return a.filter(function (v, i) { return v && a.indexOf(v) === i; }); }
function labels_(csv, map) { return String(csv || '').split(',').filter(Boolean).map(function (r) { return map[r] || r; }).join('、'); }
function pct_(n, d) { return d ? Math.round(1000 * n / d) / 10 : ''; }

function daysAgo_(d, now) {
  var t = new Date(dateStr_(d) + 'T00:00:00+09:00').getTime();
  var n = new Date(Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd') + 'T00:00:00+09:00').getTime();
  return Math.round((n - t) / 86400000);
}
function dowOf_(d) { return new Date(dateStr_(d) + 'T00:00:00+09:00').getDay(); }
function weekStartStr_(now) {
  var dowIso = ((now.getDay() + 6) % 7) + 1;
  return Utilities.formatDate(new Date(now.getTime() - (dowIso - 1) * 86400000), 'Asia/Tokyo', 'yyyy-MM-dd');
}
function weekStartOf_(dstr) {
  var d = new Date(dstr + 'T00:00:00+09:00');
  var dowIso = ((d.getDay() + 6) % 7) + 1;
  return Utilities.formatDate(new Date(d.getTime() - (dowIso - 1) * 86400000), 'Asia/Tokyo', 'yyyy-MM-dd');
}

// ---------------------------------------------------------------------------
// 通知
// ---------------------------------------------------------------------------
function describeLog_(rec) {
  var lines = [];
  lines.push('番号: ' + rec.study_id);
  lines.push('記録日: ' + rec.log_date);
  if (rec.pre_check) {
    lines.push('運動前の体調: ' + SIGNAL_LABEL[rec.pre_check] + '信号' + (rec.pre_symptoms ? '（' + labels_(rec.pre_symptoms, PRE_LABEL) + '）' : '（症状なし）'));
  }
  if (rec.pre_symptom_text) lines.push('本人の記載: ' + rec.pre_symptom_text);
  if (rec.pre_check === 'red') lines.push('【赤信号: 運動を中止】');
  lines.push('ウォーキング: ' + (WALK_LABEL[rec.walk_status] || rec.walk_status) + (rec.walk_status === 'done' && rec.walk_min !== '' ? '（' + rec.walk_min + ' 分）' : ''));
  var sess = 'セッション: ' + (SESSION_LABEL[rec.session_status] || rec.session_status) + (rec.session_planned ? '（予定日）' : '');
  if (rec.session_type) sess += ' ' + TYPE_LABEL[rec.session_type] + 'メニュー' + (rec.session_min !== '' ? '・' + rec.session_min + ' 分' : '');
  lines.push(sess);
  if (rec.reasons) lines.push('理由: ' + labels_(rec.reasons, REASON_LABEL));
  if (rec.reason_other) lines.push('理由（その他）: ' + rec.reason_other);
  if (rec.post_condition) {
    lines.push('運動後の体調: ' + POST_LABEL[rec.post_condition] + (rec.post_symptoms ? '（' + labels_(rec.post_symptoms, POST_SYM_LABEL) + '）' : '') + (rec.post_borg !== '' ? '　Borg ' + rec.post_borg : ''));
  }
  if (rec.post_condition === 'symptom') lines.push('【運動後に症状あり】');
  if (rec.free_text) lines.push('ひとこと: ' + rec.free_text);
  return lines.join('\n');
}

function sendImmediate_(rec, patient) {
  var to = uniq_(emails_(getSetting_('notify_emails', '')).concat(emails_(patient.assignee_dr), emails_(patient.assignee_pt)));
  if (!to.length) { logNotify_('immediate', rec.study_id, '', '(宛先未設定)', ''); return; }
  var flags = [];
  if (rec.pre_check === 'red') flags.push('赤信号・中止');
  if (rec.post_condition === 'symptom') flags.push('運動後に症状');
  var subject = getSetting_('subject_prefix', '[術前リハ]') + ' ' + rec.study_id + ' ' + flags.join('・');
  var body = describeLog_(rec) + '\n\n---\n本メールは自動送信です。対応内容は「対応記録」タブに記入してください。\n' +
    SpreadsheetApp.getActiveSpreadsheet().getUrl();
  MailApp.sendEmail({ to: to.join(','), subject: subject, body: body, name: '術前リハ支援' });
  logNotify_('immediate', rec.study_id, to.join(','), subject, '');
}

function logNotify_(type, studyId, to, subject, detail) {
  sheet_(SHEET.NOTIFY).appendRow([new Date(), type, studyId, to, subject, detail]);
}

function dailySummary() {
  var dash = refreshDashboard();
  var yesterday = Utilities.formatDate(new Date(Date.now() - 86400000), 'Asia/Tokyo', 'yyyy-MM-dd');
  var logs = readTable_(SHEET.LOGS).filter(function (l) { return dateStr_(l.log_date) === yesterday; });
  var noInputDays = Number(getSetting_('no_input_days', '2'));

  var out = [];
  out.push('■ 前日（' + yesterday + '）の送信 ' + logs.length + ' 件');
  logs.sort(function (a, b) { return String(a.study_id).localeCompare(String(b.study_id)); });
  logs.forEach(function (l) {
    var s = '  ' + l.study_id + ': ' + (l.pre_check ? SIGNAL_LABEL[l.pre_check] + ' ' : '') + '歩行 ' + (WALK_LABEL[l.walk_status] || l.walk_status) + (l.walk_status === 'done' && l.walk_min !== '' ? l.walk_min + '分' : '') +
      ' / セッション ' + (SESSION_LABEL[l.session_status] || l.session_status) + (truthy_(l.session_planned) ? '(予定日)' : '') + (l.session_type ? ' ' + TYPE_LABEL[l.session_type] + (l.session_min !== '' ? l.session_min + '分' : '') : '');
    if (l.reasons) s += '（' + labels_(l.reasons, REASON_LABEL) + '）';
    if (l.post_condition) s += ' 運動後: ' + POST_LABEL[l.post_condition] + (l.post_symptoms ? '(' + labels_(l.post_symptoms, POST_SYM_LABEL) + ')' : '') + (l.post_borg !== '' ? ' Borg ' + l.post_borg : '');
    if (l.pre_check === 'red') s += ' 【赤信号】';
    if (l.free_text) s += ' ひとこと: ' + l.free_text;
    out.push(s);
  });
  out.push('');
  var missed = logs.filter(function (l) { return truthy_(l.session_planned) && l.session_status === 'none'; });
  out.push('■ 予定日にセッション未実施 ' + missed.length + ' 名');
  missed.forEach(function (l) { out.push('  ' + l.study_id + (l.reasons ? '（' + labels_(l.reasons, REASON_LABEL) + '）' : '')); });
  out.push('');
  var noInput = dash.filter(function (d) { return d.status === 'active' && (d.days_since_log === '' || d.days_since_log >= noInputDays); });
  out.push('■ ' + noInputDays + ' 日以上未送信 ' + noInput.length + ' 名');
  noInput.forEach(function (d) { out.push('  ' + d.study_id + ': ' + (d.last_log_date ? '最終 ' + d.last_log_date + '（' + d.days_since_log + ' 日前）' : '送信なし')); });
  out.push('');
  var target = Number(getSetting_('sessions_per_week', '3'));
  out.push('■ 今週のセッション回数（目標 ' + target + ' 回）');
  dash.filter(function (d) { return d.status === 'active'; }).forEach(function (d) {
    out.push('  ' + d.study_id + ': ' + d.sessions_this_week + ' 回（予定日 ' + d.planned_this_week + ' 日経過）、歩いた日（7日）' + d.walk_days_7d + ' 日');
  });
  out.push('');
  var contact = dash.filter(function (d) { return d.needs_contact === true; });
  out.push('■ 要連絡 ' + contact.length + ' 名');
  contact.forEach(function (d) { out.push('  ' + d.study_id + ': ' + d.reason_for_contact); });
  out.push('', 'スプレッドシート: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl());

  var to = uniq_(emails_(getSetting_('summary_emails', '')).concat(emails_(getSetting_('notify_emails', ''))));
  if (!to.length) { logNotify_('daily', '', '', '(宛先未設定)', ''); return; }
  var subject = getSetting_('subject_prefix', '[術前リハ]') + ' 朝のまとめ ' + yesterday;
  MailApp.sendEmail({ to: to.join(','), subject: subject, body: out.join('\n'), name: '術前リハ支援' });
  logNotify_('daily', '', to.join(','), subject, logs.length + ' logs');
}

function weeklySummary() {
  var patients = readTable_(SHEET.PATIENTS).filter(function (p) { return String(p.status).toLowerCase() === 'active'; });
  var logs = readTable_(SHEET.LOGS);
  var now = new Date();
  var target = Number(getSetting_('sessions_per_week', '3'));
  var out = ['■ 先週（直近 7 日）の実施状況  セッション目標 ' + target + ' 回/週', ''];
  patients.forEach(function (p) {
    var w = logs.filter(function (l) { return l.study_id === p.study_id && daysAgo_(l.log_date, now) >= 1 && daysAgo_(l.log_date, now) <= 7; });
    var sess = w.filter(sessionDone_).length;
    var planned = w.filter(function (l) { return truthy_(l.session_planned); }).length;
    var walkDays = w.filter(function (l) { return l.walk_status === 'done'; }).length;
    var walkMin = w.reduce(function (a, l) { return a + (Number(l.walk_min) || 0); }, 0);
    var red = w.filter(function (l) { return l.pre_check === 'red'; }).length;
    out.push('  ' + p.study_id + ': 送信 ' + w.length + ' 日 / セッション ' + sess + ' 回（予定日 ' + planned + ' 日） / 歩いた日 ' + walkDays + ' 日（計 ' + walkMin + ' 分）' + (red ? ' / 赤信号 ' + red + ' 回' : ''));
  });
  out.push('', 'スプレッドシート: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
  var to = uniq_(emails_(getSetting_('summary_emails', '')).concat(emails_(getSetting_('notify_emails', ''))));
  if (!to.length) return;
  var subject = getSetting_('subject_prefix', '[術前リハ]') + ' 週次まとめ';
  MailApp.sendEmail({ to: to.join(','), subject: subject, body: out.join('\n'), name: '術前リハ支援' });
  logNotify_('weekly', '', to.join(','), subject, '');
}

// ---------------------------------------------------------------------------
// 集計の再計算: 患者ごとの現在状況（メール・全体サマリー用）＋ 患者ごとの日次シート
// ---------------------------------------------------------------------------
function refreshDashboard() {
  var patients = readTable_(SHEET.PATIENTS);
  var logs = readTable_(SHEET.LOGS);
  var now = new Date();
  var byId = {};
  logs.forEach(function (l) {
    l._d = dateStr_(l.log_date);
    (byId[String(l.study_id)] = byId[String(l.study_id)] || []).push(l);
  });
  var statuses = patients.map(function (p) { return patientStatus_(p, byId[String(p.study_id)] || [], now); });
  try { refreshSummary_(patients, logs, statuses, now); } catch (err) { logNotify_('error', '', '', 'summary failed', String(err)); }
  try { refreshPatientSheets_(patients, byId, statuses, now); } catch (err) { logNotify_('error', '', '', 'patient sheets failed', String(err)); }
  return statuses;
}

/** 患者 1 名の現在状況（要連絡判定を含む） */
function patientStatus_(p, lsIn, now) {
  var noInputDays = Number(getSetting_('no_input_days', '2'));
  var target = Number(getSetting_('sessions_per_week', '3'));
  var consecLimit = Number(getSetting_('consecutive_no_exercise_days', '3'));
  var todayStr = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd');
  var wkStart = weekStartStr_(now);
  var ls = lsIn.slice().sort(function (a, b) { return a._d < b._d ? 1 : -1; });
  var last = ls[0];
  var w7 = ls.filter(function (l) { return daysAgo_(l._d, now) < 7; });
  var week = ls.filter(function (l) { return l._d >= wkStart && l._d <= todayStr; });
  var sessWeek = week.filter(sessionDone_).length;
  var days = last && last.session_days !== '' ? String(last.session_days).split(',').map(Number) : [];
  var plannedPassed = 0;
  for (var t = new Date(wkStart + 'T00:00:00+09:00'); Utilities.formatDate(t, 'Asia/Tokyo', 'yyyy-MM-dd') <= todayStr; t = new Date(t.getTime() + 86400000)) {
    if (days.indexOf(t.getDay()) >= 0) plannedPassed++;
  }
  var consec = 0;
  for (var i = 0; i < ls.length; i++) { if (!exercised_(ls[i]) && ls[i].walk_status !== 'rest') consec++; else break; }
  var dsl = last ? daysAgo_(last._d, now) : '';
  var reasons = [];
  var active = String(p.status).toLowerCase() === 'active';
  if (active) {
    if (dsl === '' || dsl >= noInputDays) reasons.push(dsl === '' ? '送信なし' : '未送信 ' + dsl + ' 日');
    if (plannedPassed >= 1 && sessWeek === 0) reasons.push('今週セッション 0 回（予定日 ' + plannedPassed + ' 日経過）');
    if (consec >= consecLimit) reasons.push('運動なし ' + consec + ' 日連続');
    if (last && last.pre_check === 'red' && dsl <= 1) reasons.push('赤信号で中止');
    if (last && last.post_condition === 'symptom' && dsl <= 1) reasons.push('運動後に症状');
  }
  return {
    study_id: String(p.study_id), status: p.status, assignee_dr: p.assignee_dr, assignee_pt: p.assignee_pt,
    last_log_date: last ? last._d : '', days_since_log: dsl,
    session_days_arr: days, session_days: days.map(function (d) { return DOW[d]; }).join('・'),
    sessions_this_week: sessWeek, planned_this_week: plannedPassed, session_target: target,
    walk_days_7d: w7.filter(function (l) { return l.walk_status === 'done'; }).length,
    consecutive_no_exercise: consec,
    needs_contact: reasons.length > 0, reason_for_contact: reasons.join('、')
  };
}

// ---------------------------------------------------------------------------
// 患者ごとの日次シート（進捗_番号）: 1 日 1 行で、セッションができたかを日ごとに追う
// ---------------------------------------------------------------------------
function refreshPatientSheets_(patients, byId, statuses, now) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var todayStr = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd');
  patients.forEach(function (p, idx) {
    var id = String(p.study_id);
    var st = statuses[idx];
    var ls = (byId[id] || []).slice();
    var map = {};
    ls.forEach(function (l) { map[l._d] = l; });
    var firstStr = ls.length ? ls.map(function (l) { return l._d; }).sort()[0] : todayStr;
    var days = st.session_days_arr;

    var rows = [], bgs = [];
    for (var t = new Date(todayStr + 'T00:00:00+09:00'); Utilities.formatDate(t, 'Asia/Tokyo', 'yyyy-MM-dd') >= firstStr && rows.length < 400; t = new Date(t.getTime() - 86400000)) {
      var d = Utilities.formatDate(t, 'Asia/Tokyo', 'yyyy-MM-dd');
      var l = map[d];
      var planned = days.indexOf(t.getDay()) >= 0;
      var bg = '#ffffff';
      if (!l) {
        rows.push([d, DOW[t.getDay()], planned ? '○' : '', '未送信', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
        bg = '#f1f3f4';
      } else {
        var sess = SESSION_LABEL[l.session_status] || l.session_status;
        var nItems = String(l.session_items_done || '').split(',').filter(Boolean).length;
        rows.push([
          d, DOW[t.getDay()], planned ? '○' : '', '送信',
          l.pre_check ? SIGNAL_LABEL[l.pre_check] : '', labels_(l.pre_symptoms, PRE_LABEL), l.pre_symptom_text || '',
          sess, l.session_type ? TYPE_LABEL[l.session_type] : '', l.session_min !== '' ? l.session_min : '', nItems ? nItems + ' 種目' : '',
          WALK_LABEL[l.walk_status] || l.walk_status, l.walk_status === 'done' ? l.walk_min : '', labels_(l.reasons, REASON_LABEL) + (l.reason_other ? '（' + l.reason_other + '）' : ''),
          l.post_condition ? POST_LABEL[l.post_condition] : '', labels_(l.post_symptoms, POST_SYM_LABEL), l.post_borg !== '' ? l.post_borg : '', l.free_text || '',
          l.received_at instanceof Date ? Utilities.formatDate(l.received_at, 'Asia/Tokyo', 'MM-dd HH:mm') : String(l.received_at || '')
        ]);
        if (l.pre_check === 'red') bg = '#fce8e6';
        else if (l.post_condition === 'symptom') bg = '#fde2cf';
        else if (l.pre_check === 'yellow') bg = '#fff4d6';
        else if (sessionDone_(l)) bg = '#e6f4ea';
        else if (planned && l.session_status === 'none') bg = '#fbe9e7';
      }
      bgs.push(rows[rows.length - 1].map(function () { return bg; }));
    }

    var name = PATIENT_SHEET_PREFIX + id;
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.clearContents();
    sh.clearFormats();
    var top = [
      ['番号', id, '状態', p.status, '担当医', p.assignee_dr || '', '担当PT', p.assignee_pt || ''],
      ['設定曜日', st.session_days || '（未送信のため不明）', '今週セッション', st.sessions_this_week + ' / ' + st.session_target + '（予定日 ' + st.planned_this_week + ' 日経過）', '最終送信', st.last_log_date || '—', '要連絡', st.needs_contact ? st.reason_for_contact : 'なし']
    ];
    sh.getRange(1, 1, 2, 8).setValues(top).setFontWeight('bold');
    [1, 3, 5, 7].forEach(function (c) { sh.getRange(1, c, 2, 1).setBackground('#e8eaed'); });
    if (st.needs_contact) sh.getRange(2, 8).setBackground('#fce8e6');
    sh.getRange(4, 1, 1, PATIENT_SHEET_HEADERS.length).setValues([PATIENT_SHEET_HEADERS]).setFontWeight('bold').setBackground('#e8eaed');
    if (rows.length) {
      sh.getRange(5, 1, rows.length, PATIENT_SHEET_HEADERS.length).setValues(rows).setBackgrounds(bgs);
      sh.getRange(5, 1, rows.length, 1).setNumberFormat('@');
    }
    sh.setFrozenRows(4);
    sh.setFrozenColumns(2);
  });
  // 患者一覧から消えた番号のシートはそのまま残す（手動で削除）
}

// ---------------------------------------------------------------------------
// 全体サマリー（症例ごとに 1 行、全期間の累積。最終行に全体合計）
// ---------------------------------------------------------------------------
function summarizeRows_(id, status, ls, now) {
  var n = ls.length;
  var dates = ls.map(function (l) { return l._d; }).sort();
  var planned = ls.filter(function (l) { return truthy_(l.session_planned); });
  var plannedDone = planned.filter(sessionDone_).length;
  var sessAll = ls.filter(sessionDone_);
  var mins = sessAll.map(function (l) { return Number(l.session_min); }).filter(function (v) { return !isNaN(v) && v > 0; });
  var checked = ls.filter(function (l) { return l.pre_check; });
  var green = checked.filter(function (l) { return l.pre_check === 'green'; });
  var yellow = checked.filter(function (l) { return l.pre_check === 'yellow'; });
  var red = checked.filter(function (l) { return l.pre_check === 'red'; });
  var post = ls.filter(function (l) { return l.post_condition; });
  var symp = post.filter(function (l) { return l.post_condition === 'symptom'; });
  var borgs = ls.filter(function (l) { return l.post_borg !== '' && l.post_borg !== undefined && l.post_borg !== null; })
    .map(function (l) { return Number(l.post_borg); }).filter(function (v) { return !isNaN(v) && l_valid_(v); });
  var walk = ls.filter(function (l) { return l.walk_status === 'done'; });
  var walkMins = walk.map(function (l) { return Number(l.walk_min) || 0; });
  var mean = function (arr, dec) { if (!arr.length) return ''; var m = arr.reduce(function (a, b) { return a + b; }, 0) / arr.length; var f = Math.pow(10, dec || 0); return Math.round(m * f) / f; };
  return {
    study_id: id, status: status,
    first_log: n ? dates[0] : '', last_log: n ? dates[n - 1] : '', days_logged: n,
    planned_days: planned.length, planned_done: plannedDone, planned_adherence_pct: pct_(plannedDone, planned.length),
    planned_missed: planned.filter(function (l) { return l.session_status === 'none'; }).length,
    sessions_total: sessAll.length,
    sessions_full: ls.filter(function (l) { return l.session_status === 'done'; }).length,
    sessions_partial: ls.filter(function (l) { return l.session_status === 'partial'; }).length,
    sessions_unplanned: sessAll.filter(function (l) { return !truthy_(l.session_planned); }).length,
    sessions_normal: sessAll.filter(function (l) { return l.session_type === 'normal'; }).length,
    sessions_mild: sessAll.filter(function (l) { return l.session_type === 'mild'; }).length,
    mean_session_min: mean(mins, 1),
    checks: checked.length, green: green.length, yellow: yellow.length, red: red.length,
    green_pct: pct_(green.length, checked.length), yellow_pct: pct_(yellow.length, checked.length), red_pct: pct_(red.length, checked.length),
    red_items: countLabels_(red, 'pre_symptoms', PRE_LABEL), yellow_items: countLabels_(yellow, 'pre_symptoms', PRE_LABEL),
    post_records: post.length,
    post_fine: post.filter(function (l) { return l.post_condition === 'fine'; }).length,
    post_tired: post.filter(function (l) { return l.post_condition === 'tired'; }).length,
    post_symptom: symp.length, post_symptom_pct: pct_(symp.length, post.length),
    post_symptom_items: countLabels_(symp, 'post_symptoms', POST_SYM_LABEL),
    mean_borg: mean(borgs, 1),
    walk_days: walk.length, walk_pct: pct_(walk.length, n), mean_walk_min: mean(walkMins, 0),
    walk_total_min: walkMins.reduce(function (a, b) { return a + b; }, 0),
    reason_items: countLabels_(ls, 'reasons', REASON_LABEL),
    days_since_log: '', session_days: '', sessions_this_week: '', planned_this_week: '', consecutive_no_exercise: '',
    needs_contact: '', reason_for_contact: '',
    updated_at: now
  };
}

function refreshSummary_(patients, logs, statuses, now) {
  var ls = logs.map(function (l) { l._d = l._d || dateStr_(l.log_date); return l; });
  var byId = {};
  ls.forEach(function (l) { (byId[String(l.study_id)] = byId[String(l.study_id)] || []).push(l); });
  var rows = patients.map(function (p, i) {
    var r = summarizeRows_(String(p.study_id), p.status, byId[String(p.study_id)] || [], now);
    var st = statuses[i];
    r.days_since_log = st.days_since_log; r.session_days = st.session_days; r.sessions_this_week = st.sessions_this_week;
    r.planned_this_week = st.planned_this_week; r.consecutive_no_exercise = st.consecutive_no_exercise;
    r.needs_contact = st.needs_contact; r.reason_for_contact = st.reason_for_contact;
    return r;
  });
  // 患者一覧にない番号の送信があれば末尾に（通常は起きない）
  Object.keys(byId).forEach(function (id) {
    if (!patients.some(function (p) { return String(p.study_id) === id; })) rows.push(summarizeRows_(id, '(未登録)', byId[id], now));
  });
  var total = summarizeRows_('全体', patients.length + ' 名', ls, now);
  rows.push(total);

  var sh = sheet_(SHEET.SUMMARY);
  var head = HEADERS[SHEET.SUMMARY];
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, head.length).clearContent();
  if (rows.length) {
    sh.getRange(2, 1, rows.length, head.length).setValues(rows.map(function (r) { return head.map(function (h) { return r[h]; }); }));
    sh.getRange(rows.length + 1, 1, 1, head.length).setFontWeight('bold').setBackground('#f4f7f9');
    var col = head.indexOf('needs_contact') + 1;
    sh.clearConditionalFormatRules();
    var colLetter = col <= 26 ? String.fromCharCode(64 + col) : String.fromCharCode(64 + Math.floor((col - 1) / 26)) + String.fromCharCode(65 + ((col - 1) % 26));
    sh.setConditionalFormatRules([SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + colLetter + '2=TRUE').setBackground('#fce8e6').setRanges([sh.getRange(2, 1, rows.length, head.length)]).build()]);
  }
  sh.setFrozenRows(1);
  sh.setFrozenColumns(1);
}

function l_valid_(v) { return v >= 0 && v <= 10; }

function countLabels_(rows, field, map) {
  var c = {};
  rows.forEach(function (l) { String(l[field] || '').split(',').filter(Boolean).forEach(function (k) { c[k] = (c[k] || 0) + 1; }); });
  return Object.keys(c).sort(function (a, b) { return c[b] - c[a]; }).map(function (k) { return (map[k] || k) + ' ' + c[k]; }).join('、');
}

// ---------------------------------------------------------------------------
// 開発用: ダミー患者でのテスト（実患者データでは使わない）
// ---------------------------------------------------------------------------
function testPostDummy() {
  var studyId = '9001';
  var pin = '0000';
  if (!findPatient_(studyId)) {
    var ps = sheet_(SHEET.PATIENTS);
    ps.appendRow([studyId, sha256_(studyId + ':' + pin), 1, '', '', 'active', 'テスト用ダミー']);
    ps.getRange(ps.getLastRow(), 1).setNumberFormat('@');
  }
  var res = doPost({ postData: { contents: JSON.stringify({
    study_id: studyId, pin: pin, log_date: Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd'),
    walk_status: 'done', walk_min: 20,
    pre_check: 'red', pre_symptoms: ['fever', 'cannot'], pre_symptom_text: '朝から吐き気が続いている（テスト）',
    session_planned: true, session_days: [1, 3, 5], session_status: 'none', session_type: null, session_min: null, session_items_done: [],
    reasons: [], post_borg: null, post_condition: null, post_symptoms: [], free_text: 'テスト送信', app_version: 'test'
  }) } });
  Logger.log(res.getContent());
}
