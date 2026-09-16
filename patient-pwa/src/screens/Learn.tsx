import { useState } from 'react';
import { ARTICLES } from '../data/content';
import Video from '../components/Video';

export default function Learn() {
  const [open, setOpen] = useState<string | null>(null);
  const a = ARTICLES.find((x) => x.id === open);
  if (a) {
    return (
      <div>
        <button className="btn secondary" onClick={() => setOpen(null)}>← 戻る</button>
        <h2>{a.title}</h2>
        {a.videoUrl && <Video url={a.videoUrl} />}
        {a.body.map((p, i) => <p key={i}>{p}</p>)}
      </div>
    );
  }
  return (
    <div>
      <h2>学ぶ</h2>
      {ARTICLES.map((x) => (
        <div key={x.id} className="card tap row" onClick={() => setOpen(x.id)}>
          <strong className="grow">{x.title}</strong><span>▶</span>
        </div>
      ))}
    </div>
  );
}
