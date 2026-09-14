import { useState } from 'react';
import ScoreOverview from './ScoreOverview';
import { useRoomStore } from '../store/useRoomStore';
import { exportGameToExcel } from '../lib/exportExcel';
import type { HistoryEntry } from '../lib/supabase';

const MEDALS = ['👑', '🏴‍☠️', '🧜‍♀️', '👶'];

/** Contenu d'une partie dépliée dans l'historique : podium, vue d'ensemble, export Excel. */
export default function HistoryDetails({ entry }: { entry: HistoryEntry }) {
  const myPlayerId = useRoomStore(s => s.myPlayerId);
  const [exporting, setExporting] = useState(false);
  const { room, results, bids, shameLog, thumbs } = entry;

  const totalFor = (pid: string) =>
    results.filter(r => r.player_id === pid && r.is_done).reduce((s, r) => s + r.score, 0)
    + shameLog.filter(e => e.playerId === pid).reduce((s, e) => s + e.amount, 0);

  const standings = [...room.players]
    .map(p => ({ player: p, total: totalFor(p.id) }))
    .sort((a, b) => b.total - a.total);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportGameToExcel({ room, results, bids, shameLog, date: new Date(entry.finishedAt) });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Podium final */}
      <ul className="space-y-1.5">
        {standings.map(({ player, total }, i) => {
          const thumbsUp = thumbs.filter(t => t.toId === player.id && t.dir === 1).length;
          const thumbsDown = thumbs.filter(t => t.toId === player.id && t.dir === -1).length;
          const isMe = player.id === myPlayerId;
          const isWinner = i === 0 && !player.surrendered;
          return (
            <li key={player.id} className={`flex items-center justify-between gap-2 ${player.surrendered ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg w-7 text-center shrink-0">{MEDALS[i] ?? `${i + 1}.`}</span>
                <span className={`font-semibold truncate ${player.surrendered ? 'line-through' : ''} ${isWinner ? 'text-yellow-300' : ''} ${isMe ? 'underline decoration-accent' : ''}`}>
                  {player.name}
                </span>
                {player.surrendered && <span className="text-xs shrink-0" title="Abandon">🏳️</span>}
                <span className="text-xs shrink-0">
                  <span className="text-emerald-300">👍 {thumbsUp}</span>
                  <span className="ml-1.5 text-red-300">👎 {thumbsDown}</span>
                </span>
              </div>
              <span className="font-bold tabular-nums shrink-0">{total}</span>
            </li>
          );
        })}
      </ul>

      {/* Détail manche par manche, même tableau que la vue d'ensemble en jeu */}
      <ScoreOverview room={room} results={results} bids={bids} shameLog={shameLog} myPlayerId={myPlayerId} isHost={false} />

      <button className="btn btn-ghost w-full disabled:opacity-50" onClick={handleExport} disabled={exporting}>
        {exporting ? 'Export en cours...' : '📊 Exporter en Excel'}
      </button>
    </div>
  );
}
