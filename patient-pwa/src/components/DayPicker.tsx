const DOW = ['日', '月', '火', '水', '木', '金', '土'];

export default function DayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  function toggle(d: number) {
    onChange(value.includes(d) ? value.filter((x) => x !== d) : value.concat(d).sort());
  }
  return (
    <div className="days">
      {[1, 2, 3, 4, 5, 6, 0].map((d) => (
        <button key={d} type="button" className={value.includes(d) ? 'on' : ''} onClick={() => toggle(d)} aria-pressed={value.includes(d)}>{DOW[d]}</button>
      ))}
    </div>
  );
}
