export default function ScoreChip({ value }: { value: number }) {
  return (
    <span className={`badge ${value >= 0 ? 'badge-ok' : 'badge-bad'}`}>
      {value >= 0 ? `+${value}` : value}
    </span>
  );
}
