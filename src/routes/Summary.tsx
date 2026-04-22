import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import ScoreChip from '../components/ScoreChip';
import { useGame } from '../hooks/useGame';
import { useStore } from '../store/useStore';
import { exportCSV, exportXLSX } from '../lib/export';
import { sum } from '../lib/utils';

const RANK_EMOJI = ['👑', '🏴‍☠️', '🧜‍♀️', '👶'];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Summary() {
  const { gameId } = useParams();
  const nav = useNavigate();
  const { game, rounds } = useGame(gameId);
  const { unlockRound } = useStore();

  const ranked = useMemo(() => {
    if (!game) return [];
    return game.players
      .map(p => ({
        player: p,
        total: sum(rounds.map(r => r.results[p.id]?.score ?? 0)),
      }))
      .sort((a, b) => b.total - a.total);
  }, [game, rounds]);

  if (!game) return null;

  return (
    <Layout
      title={game.date ? `Résumé · ${game.date}` : 'Résumé'}
      right={
        game.status === 'in-progress' ? (
          <button
            className="btn btn-primary text-sm"
            onClick={() => nav(`/game/${game.id}/round/${game.currentRound}/bets`)}
          >
            Continuer →
          </button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {/* Rankings */}
        <section className="card p-4">
          <div className="section-title mb-3">Classement</div>
          <ul className="space-y-2">
            {ranked.map(({ player, total }, i) => (
              <li key={player.id} className="flex items-center justify-between">
                <span className="font-medium">
                  {RANK_EMOJI[i] ?? `${i + 1}.`} {player.name}
                </span>
                <ScoreChip value={total} />
              </li>
            ))}
          </ul>
        </section>

        {/* Per-round table */}
        <section className="card p-4 overflow-x-auto">
          <div className="section-title mb-3">Détail par manche</div>
          <table className="w-full text-sm min-w-max">
            <thead>
              <tr className="text-left opacity-60">
                <th className="pb-2 pr-3">Manche</th>
                {game.players.map(p => (
                  <th key={p.id} className="pb-2 px-2">{p.name}</th>
                ))}
                <th className="pb-2 pl-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rounds.map(r => {
                let cumulative: Record<string, number> = {};
                for (const rr of rounds.filter(x => x.roundNumber <= r.roundNumber)) {
                  for (const p of game.players) {
                    cumulative[p.id] = (cumulative[p.id] ?? 0) + (rr.results[p.id]?.score ?? 0);
                  }
                }
                return (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="py-2 pr-3 font-semibold">{r.roundNumber}</td>
                    {game.players.map(p => {
                      const bid = r.bids[p.id]?.bid;
                      const result = r.results[p.id];
                      return (
                        <td key={p.id} className="py-2 px-2">
                          {result ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="opacity-60 text-xs">
                                {bid ?? '?'} pari · {result.tricks} plis
                              </span>
                              <ScoreChip value={result.score} />
                              <span className="text-xs opacity-40">cum: {cumulative[p.id] >= 0 ? '+' : ''}{cumulative[p.id]}</span>
                            </div>
                          ) : (
                            <span className="opacity-30">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2 pl-2">
                      <div className="flex gap-1">
                        <button
                          className="btn btn-ghost text-xs py-1 px-2"
                          onClick={async () => {
                            if (r.locked) await unlockRound(game.id, r.roundNumber);
                            nav(`/game/${game.id}/round/${r.roundNumber}/bets`);
                          }}
                        >
                          Paris
                        </button>
                        <button
                          className="btn btn-ghost text-xs py-1 px-2"
                          onClick={async () => {
                            if (r.locked) await unlockRound(game.id, r.roundNumber);
                            nav(`/game/${game.id}/round/${r.roundNumber}/results`);
                          }}
                        >
                          Résultats
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Export */}
        {game.status === 'completed' && (
          <section className="card p-4">
            <div className="section-title mb-3">Exporter</div>
            <div className="flex gap-2">
              <button
                className="btn btn-ghost text-sm"
                onClick={() => downloadBlob(exportCSV(game, rounds), `skull-king-${game.id}.csv`)}
              >
                CSV
              </button>
              <button
                className="btn btn-ghost text-sm"
                onClick={() => downloadBlob(exportXLSX(game, rounds), `skull-king-${game.id}.xlsx`)}
              >
                Excel
              </button>
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}
