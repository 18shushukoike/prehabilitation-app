import Video from '../components/Video';
import { byCode, CATEGORY_LABEL } from '../data/exercises';

export default function Exercise({ code, onBack }: { code: string; onBack: () => void }) {
  const ex = byCode(code);
  if (!ex) return <div><p>見つかりませんでした</p><button className="btn secondary" onClick={onBack}>戻る</button></div>;
  return (
    <div>
      <button className="btn secondary" onClick={onBack}>← 戻る</button>
      <h2><span className="badge">{CATEGORY_LABEL[ex.category]}</span>{ex.name}</h2>
      <Video url={ex.videoUrl} />
      <p>{ex.summary}</p>
      <h3>やり方</h3>
      <ol className="steps">{ex.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      <h3>注意</h3>
      <ul className="plain">{ex.cautions.map((s, i) => <li key={i}>{s}</li>)}</ul>
      <button className="btn secondary" onClick={onBack}>戻る</button>
    </div>
  );
}
