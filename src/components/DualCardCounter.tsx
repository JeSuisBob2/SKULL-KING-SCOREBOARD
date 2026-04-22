interface Props {
  icon: string;
  label: string;
  value: { positive: number; negative: number };
  onChange: (v: { positive: number; negative: number }) => void;
  disablePositive?: boolean;
  disableNegative?: boolean;
}

export default function DualCardCounter({ icon, label, value, onChange, disablePositive, disableNegative }: Props) {
  const inc = () => onChange({ ...value, positive: value.positive + 1 });
  const dec = () => onChange({ ...value, negative: value.negative + 1 });
  const reset = () => onChange({ positive: 0, negative: 0 });

  return (
    <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-surface/40 border border-white/5">
      <span className="text-xl">{icon}</span>
      {label && <span className="text-xs opacity-60">{label}</span>}
      <div className="flex items-center gap-1">
        <button
          className="btn btn-ghost px-2 py-1 text-sm text-rose-400 disabled:opacity-30"
          onClick={dec}
          disabled={disableNegative}
          aria-label="négatif"
        >
          {value.negative > 0 ? `−${value.negative}` : '−'}
        </button>
        <button
          className="btn btn-ghost px-2 py-1 text-sm opacity-60"
          onClick={reset}
          aria-label="réinitialiser"
        >
          🔃
        </button>
        <button
          className="btn btn-ghost px-2 py-1 text-sm text-emerald-400 disabled:opacity-30"
          onClick={inc}
          disabled={disablePositive}
          aria-label="positif"
        >
          {value.positive > 0 ? `+${value.positive}` : '+'}
        </button>
      </div>
    </div>
  );
}
