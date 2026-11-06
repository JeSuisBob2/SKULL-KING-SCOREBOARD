import { useState } from 'react';
import type { RoundRatio } from '../lib/careerStats';

const PLOT_HEIGHT = 88; // hauteur de la zone de tracé, en px

const pct = (r: RoundRatio) => (r.total ? Math.round((100 * r.ok) / r.total) : 0);

interface Props {
  data: RoundRatio[];
  /** Ce qui est mesuré (« toute la table », un pseudo...), pour l'accessibilité. */
  label: string;
}

/**
 * Réussite des contrats par manche : une colonne par manche, une seule série, donc une
 * seule couleur (l'accent de l'appli, validée sur le fond des cartes) et pas de légende.
 * Seules la première et la dernière colonne sont étiquetées ; le détail de chaque manche
 * s'obtient au toucher et dans le tableau « Voir les chiffres ».
 */
export default function RoundCurve({ data, label }: Props) {
  const [active, setActive] = useState<number | null>(null);
  if (data.length === 0) return null;

  const first = data[0].round;
  const last = data[data.length - 1].round;
  const current = active === null ? null : data.find(d => d.round === active) ?? null;

  return (
    <div>
      <div className="text-xs opacity-60 h-4 mb-3" aria-live="polite">
        {current
          ? `Manche ${current.round} : ${pct(current)} % (${current.ok} contrats réussis sur ${current.total})`
          : 'Touchez une colonne pour le détail'}
      </div>

      <div className="flex">
        {/* Repères de l'axe : 100 % et 50 % */}
        <div className="relative w-8 shrink-0 text-[10px] opacity-40 tabular-nums" style={{ height: PLOT_HEIGHT }}>
          <span className="absolute right-1 -top-1.5">100 %</span>
          <span className="absolute right-1" style={{ top: PLOT_HEIGHT / 2 - 6 }}>50 %</span>
        </div>

        <div className="relative flex-1" style={{ height: PLOT_HEIGHT }} role="img" aria-label={`Réussite des contrats par manche, ${label}`}>
          <div className="absolute inset-x-0 top-0 border-t border-white/10" />
          <div className="absolute inset-x-0 border-t border-white/10" style={{ top: PLOT_HEIGHT / 2 }} />
          <div className="absolute inset-0 flex items-end">
            {data.map(d => {
              const p = pct(d);
              const dimmed = active !== null && active !== d.round;
              return (
                <button
                  key={d.round}
                  type="button"
                  className="flex-1 h-full flex flex-col justify-end items-center focus:outline-none"
                  onMouseEnter={() => setActive(d.round)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(d.round)}
                  onBlur={() => setActive(null)}
                  onClick={() => setActive(a => (a === d.round ? null : d.round))}
                  aria-label={`Manche ${d.round} : ${p} %`}
                >
                  {(d.round === first || d.round === last) && (
                    <span className="text-[10px] opacity-80 mb-0.5 tabular-nums">{p} %</span>
                  )}
                  <span
                    className={`w-full max-w-[22px] rounded-t transition-opacity ${dimmed ? 'opacity-40' : 'opacity-100'}`}
                    style={{ height: Math.max(2, (p / 100) * PLOT_HEIGHT), background: 'var(--color-accent)' }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Axe des manches */}
      <div className="flex pl-8">
        <div className="flex flex-1 border-t border-white/20">
          {data.map(d => (
            <span
              key={d.round}
              className={`flex-1 text-center text-[10px] tabular-nums pt-0.5 ${active === d.round ? 'opacity-100' : 'opacity-50'}`}
            >
              {d.round}
            </span>
          ))}
        </div>
      </div>

      <details className="mt-1">
        <summary className="text-[11px] opacity-50 cursor-pointer">Voir les chiffres</summary>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] tabular-nums mt-1 opacity-80">
          {data.map(d => (
            <span key={d.round}>
              Manche {d.round} : {pct(d)} % ({d.ok}/{d.total})
            </span>
          ))}
        </div>
      </details>
    </div>
  );
}
