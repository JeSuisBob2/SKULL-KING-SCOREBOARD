import { useEffect, useState } from 'react';
import HistoryDetails from './HistoryDetails';
import { useRoomStore } from '../store/useRoomStore';

const DAY_MS = 24 * 60 * 60 * 1000;

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const date = d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
};

/** Liste dépliable des parties terminées (30 derniers jours), affichée sur l'accueil. */
export default function HistoryList() {
  const { history, historyDetails, loadHistory, loadHistoryGame, myPlayerId } = useRoomStore();
  const [openId, setOpenId] = useState<string | null>(null);

  // Rechargée à chaque dépliage de la section, pour avoir les dernières parties
  useEffect(() => {
    loadHistory();
  }, []);

  // Une seule partie dépliée à la fois ; ses détails sont chargés à la première ouverture
  const toggle = (id: string) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    loadHistoryGame(id);
    // La partie précédemment dépliée se replie : on ramène celle-ci en haut de l'écran
    requestAnimationFrame(() =>
      document.getElementById(`hist-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    );
  };

  if (history === null) {
    return <div className="text-center text-sm opacity-60 py-2">Chargement...</div>;
  }

  if (history.length === 0) {
    return <div className="card p-6 text-center opacity-70">Aucune partie terminée ces 30 derniers jours.</div>;
  }

  return (
    <div className="space-y-3">
      {history.map(g => {
        const played = g.players.some(p => p.id === myPlayerId);
        const winner = g.players.find(p => !p.surrendered) ?? g.players[0];
        const daysLeft = Math.max(0, Math.ceil((new Date(g.finishedAt).getTime() + 30 * DAY_MS - Date.now()) / DAY_MS));
        const isOpen = openId === g.id;
        const details = historyDetails[g.id]; // absent = en chargement, null = introuvable

        return (
          <div
            key={g.id}
            id={`hist-${g.id}`}
            className={`card p-4 scroll-mt-28 ${played ? 'border border-accent/50' : ''}`}
          >
            <button className="w-full text-left" onClick={() => toggle(g.id)} aria-expanded={isOpen}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{formatDate(g.finishedAt)}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {played && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent">Tu as joué</span>
                  )}
                  <span className="text-sm opacity-60">{isOpen ? '▲' : '▼'}</span>
                </div>
              </div>
              {winner && (
                <div className="mt-1">
                  👑 <span className="font-semibold">{winner.name}</span>
                  <span className="opacity-60"> · {winner.total} pts</span>
                </div>
              )}
              <div className="text-xs opacity-60 mt-1 truncate">{g.players.map(p => p.name).join(' · ')}</div>
              <div className="text-xs opacity-40 mt-1">
                {g.totalRounds} manches · salle {g.code} · supprimée dans {daysLeft} j
              </div>
            </button>

            {isOpen && (
              <div className="mt-3 pt-3 border-t border-white/10">
                {details === undefined && (
                  <div className="text-center text-sm opacity-60 py-2">Chargement...</div>
                )}
                {details === null && (
                  <div className="text-center text-sm opacity-60 py-2">
                    Partie introuvable — elle a peut-être dépassé les 30 jours.
                  </div>
                )}
                {details && <HistoryDetails entry={details} />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
