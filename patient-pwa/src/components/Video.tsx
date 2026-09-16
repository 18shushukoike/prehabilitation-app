export default function Video({ url, portrait }: { url: string; portrait?: boolean }) {
  if (!url) {
    return <div className={'video' + (portrait ? ' portrait' : '')}>動画は準備中です</div>;
  }
  return (
    <div className={'video' + (portrait ? ' portrait' : '')}>
      <iframe src={url} title="運動の動画" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
    </div>
  );
}
