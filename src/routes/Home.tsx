import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useRoomStore } from '../store/useRoomStore';

export default function Home() {
  const nav = useNavigate();
  const { games, loadGames, deleteGame } = useStore();
  const { room, kicked, clearRoom } = useRoomStore();

  const activeRoomCode = room?.code ?? localStorage.getItem('skullking-active-room');

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  return (
    <Layout
      title="Accueil"
      right={
        <Link to="/new" className="btn btn-primary text-sm">
          Nouvelle partie
        </Link>
      }
    >
      <div className="space-y-4">
        {/* Kicked notification */}
        {kicked && (
          <div className="card p-4 border border-red-500/50 bg-red-950/30 flex items-center justify-between gap-3">
            <div className="text-sm text-red-400">⛔ Vous avez été expulsé de la salle par l'hôte.</div>
            <button className="text-xs opacity-60 hover:opacity-100" onClick={() => clearRoom()}>✕</button>
          </div>
        )}

        {/* Rejoin active room banner */}
        {activeRoomCode && !kicked && (
          <div className="card p-4 flex items-center justify-between gap-3 border border-accent/40">
            <div>
              <div className="text-sm font-semibold">Salle active</div>
              <div className="text-2xl font-bold tracking-widest text-accent">{activeRoomCode}</div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                className="btn btn-primary"
                onClick={() => nav(`/room/${activeRoomCode}/lobby`)}
              >
                Rejoindre
              </button>
              <button
                className="btn btn-danger"
                onClick={() => clearRoom()}
              >
                Quitter
              </button>
            </div>
          </div>
        )}

        {/* Multiplayer buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Link to="/create-room" className="btn btn-ghost flex-col gap-1 py-4 h-auto">
            <span className="text-2xl">🏴‍☠️</span>
            <span className="text-sm">Créer une salle</span>
          </Link>
          <Link to="/join" className="btn btn-ghost flex-col gap-1 py-4 h-auto">
            <span className="text-2xl">📱</span>
            <span className="text-sm">Rejoindre</span>
          </Link>
        </div>

        {games.length === 0 && (
          <div className="card p-6 text-center">
            <div className="text-xl font-semibold mb-2">Bienvenue</div>
            <p className="opacity-80 mb-4">Lancez une nouvelle partie de Skull King.</p>
            <Link to="/new" className="btn btn-primary">Démarrer</Link>
          </div>
        )}

        <ul className="space-y-3">
          {games.map((g) => (
            <li key={g.id} className="card p-4 flex justify-between items-center gap-3">
              <div className="min-w-0">
                <div className="font-semibold truncate">
                  {g.players.map((p) => p.name).join(' · ')}
                </div>
                <div className="text-sm opacity-70 mt-0.5">
                  {g.status === 'completed' ? 'Terminé' : 'En cours'} · Manche {g.currentRound}/{g.totalRounds}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  className="btn btn-primary text-sm"
                  onClick={() => {
                    if (g.status === 'completed') nav(`/game/${g.id}/summary`);
                    else nav(`/game/${g.id}/round/${g.currentRound}/bets`);
                  }}
                >
                  Ouvrir
                </button>
                <button
                  className="btn btn-danger text-sm"
                  onClick={() => { if (confirm('Supprimer la partie ?')) deleteGame(g.id); }}
                >
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  );
}
