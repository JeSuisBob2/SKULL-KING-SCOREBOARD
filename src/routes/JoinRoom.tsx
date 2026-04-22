import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { useRoomStore } from '../store/useRoomStore';

export default function JoinRoom() {
  const nav = useNavigate();
  const { code: codeParam } = useParams();
  const { joinRoom, loadRoomByCode, myPlayerName, loading, error } = useRoomStore();

  const [code, setCode] = useState(codeParam?.toUpperCase() ?? '');
  const [name, setName] = useState(myPlayerName);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (codeParam) setCode(codeParam.toUpperCase());
  }, [codeParam]);

  const handleJoin = async () => {
    setLocalError('');
    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode || trimmedCode.length !== 6) {
      setLocalError('Le code doit faire 6 caractères');
      return;
    }
    if (!trimmedName) {
      setLocalError('Entrez votre nom');
      return;
    }
    try {
      await joinRoom(trimmedCode, trimmedName);
      const room = await loadRoomByCode(trimmedCode);
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
      </div>
    </Layout>
  );
}
