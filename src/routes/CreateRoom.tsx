import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import NumberStepper from '../components/NumberStepper';
import QRCodeDisplay from '../components/QRCodeDisplay';
import { useRoomStore } from '../store/useRoomStore';
import { Player } from '../types';
import { uid } from '../lib/utils';

async function getNetworkOrigin(): Promise<string | null> {
  // HTTPS ou domaine → window.location.origin est déjà correct
  const isHttps = window.location.protocol === 'https:';
  const isLocalIp = /^\d+\.\d+\.\d+\.\d+$/.test(window.location.hostname);
  if (isHttps || (!isLocalIp && window.location.hostname !== 'localhost')) return null;

  // HTTP sur IP locale → on récupère l'IP réseau du serveur
  try {
    const res = await fetch('/api/server-info');
    if (!res.ok) return null;
    const { ips, port } = await res.json() as { ips: string[]; port: number };
    if (ips.length === 0) return null;
    return `http://${ips[0]}:${port}`;
  } catch {
    return null;
  }
}

export default function CreateRoom() {
  const nav = useNavigate();
  const { myPlayerId, createRoom, room, loading, error } = useRoomStore();

  const [rounds, setRounds] = useState(10);
  const [hostName, setHostName] = useState(useRoomStore.getState().myPlayerName || '');
  const [players, setPlayers] = useState<Player[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [networkOrigin, setNetworkOrigin] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState(false);

  useEffect(() => {
    getNetworkOrigin().then(setNetworkOrigin);
  }, []);

  const addPlayer = () => {
    const name = newPlayerName.trim();
    if (!name || players.some(p => p.name.toLowerCase() === name.toLowerCase())) return;
    setPlayers(ps => [...ps, { id: uid(), name }]);
    setNewPlayerName('');
  };

  const removePlayer = (id: string) => setPlayers(ps => ps.filter(p => p.id !== id));

  const handleCreate = async () => {
    const hostPlayerName = hostName.trim() || 'Hôte';
    useRoomStore.getState().setMyPlayerName(hostPlayerName);

    const hostPlayer: Player = { id: myPlayerId, name: hostPlayerName };
    const allPlayers = [
      { id: myPlayerId, name: hostPlayerName, isHost: true },
      ...players.map(p => ({ id: p.id, name: p.name, isHost: false, managedByHost: true })),
    ];

    await createRoom({ totalRounds: rounds, scoringPresetId: 'standard', players: allPlayers });
    setJustCreated(true);
  };

  // Once room is created in this session, show QR code
  if (justCreated && room) {
    const origin = networkOrigin ?? window.location.origin;
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const joinUrl = `${origin}${import.meta.env.BASE_URL}join/${room.code}`;
    return (
      <Layout title="Salle créée">
        <div className="space-y-6">
          {isLocalhost && !networkOrigin && (
            <div className="card p-3 text-amber-400 text-sm">
              Serveur ouvert sur localhost — les autres appareils ne pourront pas rejoindre.
              Ouvrez l'application via l'IP réseau affichée dans la console du serveur.
            </div>
          )}
          <div className="card p-6 flex flex-col items-center gap-4">
            <div className="text-4xl font-bold tracking-widest text-accent">{room.code}</div>
            <QRCodeDisplay value={joinUrl} size={220} />
            <p className="text-sm opacity-70 text-center">
              Les joueurs scannent le QR code ou saisissent le code pour rejoindre
            </p>
            {networkOrigin && (
              <p className="text-xs opacity-50 text-center break-all">{joinUrl}</p>
            )}
          </div>

          <div className="card p-4">
            <div className="section-title mb-2">Joueurs ({room.players.length}/{room.total_rounds > 0 ? '∞' : '?'})</div>
            <ul className="space-y-1">
              {room.players.map(p => (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <span>{p.isHost ? '👑' : '🏴‍☠️'}</span>
                  <span>{p.name}</span>
                </li>
              ))}
            </ul>
          </div>

          <button
            className="btn btn-primary w-full"
            onClick={() => nav(`/room/${room.id}/lobby`)}
          >
            Aller dans la salle →
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Créer une salle">
      <div className="space-y-6">
        {error && <div className="card p-3 text-rose-400 text-sm">{error}</div>}

        <section className="card p-4">
          <div className="section-title mb-2">Votre nom</div>
          <input
            className="input w-full"
            value={hostName}
            onChange={e => setHostName(e.target.value)}
            placeholder="Votre nom"
          />
        </section>

        <section className="card p-4">
          <div className="section-title mb-2">Manches</div>
          <NumberStepper value={rounds} min={1} max={20} onChange={setRounds} />
        </section>

        <section className="card p-4">
          <div className="section-title mb-2">Rajouter pour joueur sans téléphone</div>
          <p className="text-sm opacity-60 mb-3">
            Pour les joueurs qui n'ont pas de téléphone — c'est toi l'hôte qui saisiras leurs paris et leurs résultats à leur place.
          </p>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              value={newPlayerName}
              onChange={e => setNewPlayerName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPlayer()}
              placeholder="Nom du joueur"
            />
            <button className="btn btn-ghost" onClick={addPlayer}>Ajouter</button>
          </div>
          {players.length > 0 && (
            <ul className="mt-3 space-y-1">
              {players.map(p => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span>{p.name}</span>
                  <button className="btn btn-danger text-xs py-0.5 px-2" onClick={() => removePlayer(p.id)}>✕</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <button
          className="btn btn-primary w-full disabled:opacity-40"
          disabled={loading || !hostName.trim()}
          onClick={handleCreate}
        >
          {loading ? 'Création...' : 'Créer la salle 🏴‍☠️'}
        </button>
      </div>
    </Layout>
  );
}
