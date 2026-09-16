import DayPicker from '../components/DayPicker';
import { HOSPITAL_NAME, HOSPITAL_PHONE, APP_VERSION } from '../lib/config';
import type { AppConfig } from '../lib/types';

interface Props {
  config: AppConfig;
  onChange: (c: AppConfig) => void;
  onReset: () => void;
}

export default function Settings({ config, onChange, onReset }: Props) {
  return (
    <div>
      <h2>設定</h2>
      <div className="card">
        <div className="muted">あなたの番号</div>
        <strong className="big">{config.study_id}</strong>
        <div className="muted">メニュー: {['', '標準', '低体力', '神経障害あり'][config.menu_template]}</div>
      </div>

      <h3>セッションをする曜日</h3>
      <p className="muted">週 3 回が目標です。都合に合わせて変えられます。</p>
      <DayPicker value={config.session_days} onChange={(d) => onChange({ ...config, session_days: d })} />

      <h3>文字の大きさ</h3>
      <div className="choice two">
        {[[1, 'ふつう'], [1.25, '大きく'], [1.5, 'とても大きく']].map(([v, l]) => (
          <button key={String(v)} className={config.font_scale === v ? 'on' : ''} onClick={() => onChange({ ...config, font_scale: v as number })}>{l as string}</button>
        ))}
      </div>

      <h3>毎日の運動の時間</h3>
      <label className="field">
        <input type="time" value={config.reminder_time} onChange={(e) => onChange({ ...config, reminder_time: e.target.value })} />
        <span className="sub">アプリからの自動のお知らせはありません。スマートフォンの「アラーム」や「リマインダー」に、この時間を登録しておくと忘れにくくなります。</span>
      </label>

      <h3>お問い合わせ</h3>
      <p>{HOSPITAL_NAME}<br /><a className="phone" href={`tel:${HOSPITAL_PHONE}`}>{HOSPITAL_PHONE}</a></p>

      <h3>設定をやり直す</h3>
      <p className="muted">病院で新しい番号を受け取ったときや、別の人の端末に設定してしまったときに使います。この端末の記録も消えます。</p>
      <button className="btn danger" onClick={() => { if (confirm('設定と記録を消して、最初からやり直しますか？')) onReset(); }}>最初からやり直す</button>
      <p className="muted center">バージョン {APP_VERSION}</p>
    </div>
  );
}
