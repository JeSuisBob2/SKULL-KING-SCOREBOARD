import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import QRCodeDisplay from '../components/QRCodeDisplay';
import { useRoomStore } from '../store/useRoomStore';

export default function RoomLobby() {
  const nav = useNavigate();
  const { roomId } = useParams();
  const { room, myPlayerId, kicked, startGame, shufflePlayers, kickPlayer, subscribeToRoom, unsubscribeFromRoom, clearRoom } = useRoomStore();

  const isHost = room?.host_player_id === myPlayerId;
  const joinUrl = `${window.location.origin}${import.meta.env.BASE_URL}join/${room?.code ?? ''}`;

  useEffect(() => {
    if (roomId) subscribeToRoom(roomId);
    return () => unsubscribeFromRoom();
  }, [roomId]);

  // Auto-navigate based on current game state
  useEffect(() => {
    if (!room) return;
    const r = room.current_round;
    if (room.status === 'bidding' || room.status === 'revealing') {
      nav(`/room/${room.id}/round/${r}/bets`, { replace: true });
    } else if (room.status === 'scoring' || room.status === 'round-complete' || room.status === 'complete') {
      nav(`/room/${room.id}/round/${r}/results`, { replace: true });
    }
  }, [room?.status, room?.current_round]);

  // Kicked by host → go home
  useEffect(() => {
    if (kicked) nav('/', { replace: true });
  }, [kicked]);

  const handleStart = async () => {
    if (!room) return;
    await startGame();
  };

  const handleLeave = () => {
    clearRoom();
    nav('/');
  };

  if (!room) return (
    <Layout title="Salle">
      <div className="text-center opacity-60 mt-8">Chargement...</div>
    </Layout>
  );

  return (
    <Layout title={`Salle · ${room.code}`}>
      <div className="space-y-5">
        {/* QR Code for easy sharing */}
        <div className="card p-5 flex flex-col items-center gap-3">
          <QRCodeDisplay value={joinUrl} size={180} />
          <div className="text-3xl font-bold tracking-widest text-accent">{room.code}</div>
          <p className="text-xs opacity-60 text-center">Scannez pour rejoindre</p>
        </div>

        {/* Players list */}
        <div className="card p-4">
          <div className="section-title mb-3">
            Joueurs ({room.players.length})
          </div>
          <ul className="space-y-2">
            {room.players.map(p => (
              <li key={p.id} className="flex items-center gap-2">
                <span className="text-lg">{p.isHost ? '👑' : '🏴‍☠️'}</span>
                <span className={`flex-1 ${p.id === myPlayerId ? 'font-semibold text-accent' : ''}`}>
                  {p.name}
                  {p.id === myPlayerId && ' (vous)'}
                  {p.managedByHost && <span className="ml-1 text-xs opacity-50">(sans tel)</span>}
                </span>
                {isHost && !p.isHost && (
                  <button
                    className="text-xs px-2 py-0.5 rounded bg-red-900/40 text-red-400 hover:bg-red-800/60 transition-colors"
                    onClick={() => kickPlayer(p.id)}
                  >
                    Expulser
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Game settings */}
        <div className="card p-4">
          <div className="section-title mb-2">Configuration</div>
          <div className="text-sm opacity-70">
            {room.total_rounds} manches · Preset {room.scoring_preset_id}
          </div>
        </div>

        {isHost ? (
          <div className="space-y-3">
            <button className="btn btn-ghost w-full" onClick={shufflePlayers}>
              🔀 Ordre aléatoire
            </button>
            <button
              className="btn btn-primary w-full disabled:opacity-40"
              disabled={room.players.length < 2}
              onClick={handleStart}
            >
              Démarrer la partie ({room.players.length} joueurs)
            </button>
            {room.players.length < 2 && (
              <p className="text-xs opacity-60 text-center">En attente d'au moins 2 joueurs...</p>
            )}
          </div>
        ) : (
          <div className="card p-4 text-center opacity-70">
            En attente que l'hôte démarre la partie...
          </div>
        )}

        <button className="btn btn-ghost w-full text-sm" onClick={handleLeave}>
          Quitter la salle
        </button>
      </div>
    </Layout>
  );
}
