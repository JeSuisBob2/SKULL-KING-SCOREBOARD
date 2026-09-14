import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { useRoomStore } from '../store/useRoomStore';

export default function JoinRoom() {
  const nav = useNavigate();
  const { code: codeParam } = useParams();
  const { joinRoom, spectateRoom, loadRoomByCode, myPlayerName, loading, error } = useRoomStore();

  const [code, setCode] = useState(codeParam?.toUpperCase() ?? '');
  const [name, setName] = useState(myPlayerName);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (codeParam) setCode(codeParam.toUpperCase());
  }, [codeParam]);

  const validate = () => {
    setLocalError('');
    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode || trimmedCode.length !== 6) {
      setLocalError('Le code doit faire 6 caractères');
      return null;
    }
    if (!trimmedName) {
      setLocalError('Entrez votre nom');
      return null;
    }
    return { trimmedName, trimmedCode };
  };

  const handleJoin = async () => {
    const v = validate();
    if (!v) return;
    try {
      await joinRoom(v.trimmedCode, v.trimmedName);
      const room = await loadRoomByCode(v.trimmedCode);
      if (room) nav(`/room/${room.id}/lobby`);
    } catch (e: any) {
      setLocalError(e.message);
    }
  };

  const handleSpectate = async () => {
    const v = validate();
    if (!v) return;
    try {
      await spectateRoom(v.trimmedCode, v.trimmedName);
      const room = useRoomStore.getState().room;
      // Le lobby redirige automatiquement vers la bonne page selon la phase en cours
      if (room) nav(`/room/${room.id}/lobby`);
    } catch (e: any) {
      setLocalError(e.message);
    }
  };

  return (
    <Layout title="Rejoindre une salle">
      <div className="space-y-6">
        {(error || localError) && (
          <div className="card p-3 text-rose-400 text-sm">{localError || error}</div>
        )}

        <section className="card p-4">
          <div className="section-title mb-2">Code de la salle</div>
          <input
            className="input w-full text-center text-2xl font-bold tracking-widest uppercase"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="XXXXXX"
            maxLength={6}
          />
        </section>

        <section className="card p-4">
          <div className="section-title mb-2">Votre nom</div>
          <input
            className="input w-full"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Votre nom"
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
          />
        </section>

        <button
          className="btn btn-primary w-full disabled:opacity-40"
          disabled={loading}
          onClick={handleJoin}
        >
          {loading ? 'Connexion...' : 'Rejoindre 🏴‍☠️'}
        </button>

        <button
          className="btn btn-ghost w-full disabled:opacity-40"
          disabled={loading}
          onClick={handleSpectate}
        >
          👁️ Regarder en spectateur
        </button>
        <p className="text-xs opacity-50 text-center -mt-3">
          Le mode spectateur marche aussi quand la partie est déjà en cours
        </p>
      </div>
    </Layout>
  );
}
