import { useState } from 'react';
import DayPicker from '../components/DayPicker';
import { verifyPatient } from '../lib/api';
import { DEMO, HOSPITAL_NAME, HOSPITAL_PHONE } from '../lib/config';
import type { AppConfig } from '../lib/types';

/**
 * 初期設定: 病院で渡されたカードの「番号（4 桁）」と「暗証番号（4 桁）」を入力する。
 * サーバーで照合し、メニューの種類を受け取る。
 */
export default function Setup({ onDone }: { onDone: (c: AppConfig) => void }) {
  const [id, setId] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tpl, setTpl] = useState('1');
  const [template, setTemplate] = useState<number | null>(null);
  const [days, setDays] = useState<number[]>([1, 3, 5]);

  const valid = /^\d{4}$/.test(id) && /^\d{4}$/.test(pin);

  function make(t: number, d: number[]): AppConfig {
    return { study_id: id, pin, menu_template: t, session_days: d, reminder_time: '19:00', font_scale: 1 };
  }

  async function submit() {
    if (!valid) return;
    setBusy(true);
    setErr(null);
    const r = await verifyPatient(id, pin);
    setBusy(false);
    if (r.ok) setTemplate(r.menu_template);
    else setErr(r.message);
  }

  // 照合後: セッションを行う曜日を選ぶ
  if (template !== null) {
    return (
      <div>
        <h2>セッションをする曜日を決めましょう</h2>
        <p>週 3 回が目標です。都合のよい曜日を 3 つ選んでください。あとから「設定」で変えられます。</p>
        <DayPicker value={days} onChange={setDays} />
        <button className="btn" disabled={days.length === 0} onClick={() => onDone(make(template, days))}>この曜日で始める</button>
      </div>
    );
  }

  return (
    <div>
      <h2>はじめに設定します</h2>
      <p>病院でお渡ししたカードの <strong>番号</strong> と <strong>暗証番号</strong> を入れてください。</p>
      {DEMO && (
        <div className="ok">
          <strong>デモ版です。</strong>病院には何も送られません。
          <button className="btn" onClick={() => setTemplate(1)}>お試しで始める（番号 9001）</button>
        </div>
      )}
      {err && <div className="alert">{err}</div>}
      <label className="field" htmlFor="setup-id">番号（4 桁）
        <input id="setup-id" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={4} autoComplete="off"
          className="digits" value={id} onChange={(e) => setId(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="例: 1001" />
      </label>
      <label className="field" htmlFor="setup-pin">暗証番号（4 桁）
        <input id="setup-pin" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={4} autoComplete="off"
          className="digits" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="例: 2580" />
      </label>
      <button className="btn" disabled={!valid || busy} onClick={submit}>{busy ? '確認しています…' : '設定する'}</button>

      <details>
        <summary>スタッフ用: 通信できないときの設定</summary>
        <p className="muted">病院で通信ができない場合のみ。メニューの種類を選んで設定します（番号・暗証番号は後で送信時に照合されます）。</p>
        <div className="choice">
          {[['1', '標準'], ['2', '低体力'], ['3', '神経障害あり']].map(([v, l]) => (
            <button key={v} className={tpl === v ? 'on' : ''} onClick={() => setTpl(v)}>{l}</button>
          ))}
        </div>
        <button className="btn secondary" disabled={!valid} onClick={() => setTemplate(Number(tpl))}>照合せずに設定する</button>
      </details>
      <p className="muted">お困りのときは {HOSPITAL_NAME}（<a className="phone" href={`tel:${HOSPITAL_PHONE}`}>{HOSPITAL_PHONE}</a>）へ</p>
    </div>
  );
}
