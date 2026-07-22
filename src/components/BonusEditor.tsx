export const sumBonus = (details: number[]) => details.reduce((s, n) => s + n, 0);

interface Props {
  details: number[];
  onChange: (next: number[]) => void;
}

/**
 * Saisie des bonus en liste : chaque clic ajoute une entrée (+5, +10, −10...),
 * conservée individuellement pour l'affichage détaillé dans les résultats.
 * Cliquer sur une pastille la retire (correction d'une erreur de saisie).
 */
export default function BonusEditor({ details, onChange }: Props) {
  const total = sumBonus(details);

  return (
    <div>
      <div className="flex items-center justify-between">
        <span>Bonus</span>
        <div className="flex items-center gap-1">
          {[-20, -10, -5].map(delta => (
            <button
              key={delta}
              className="btn btn-ghost text-sm px-2 py-1"
              onClick={() => onChange([...details, delta])}
            >
              {delta}
            </button>
          ))}
          <span className="w-10 text-center tabular-nums font-semibold">{total}</span>
          {[+5, +10, +20].map(delta => (
            <button
              key={delta}
              className="btn btn-ghost text-sm px-2 py-1"
              onClick={() => onChange([...details, delta])}
            >
              +{delta}
            </button>
          ))}
        </div>
      </div>
      {details.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {details.map((b, i) => (
            <button
              key={i}
              className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                b > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
              } hover:bg-white/20`}
              onClick={() => onChange(details.filter((_, j) => j !== i))}
              title="Retirer ce bonus"
            >
              {b > 0 ? `+${b}` : b} ✕
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
