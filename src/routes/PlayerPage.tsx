import { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import PlayerProfile from '../components/PlayerProfile';
import { LAST_PLAYER_KEY } from '../components/StatsSection';
import { useRoomStore } from '../store/useRoomStore';

/** Page dédiée à la fiche d'un joueur, ouverte depuis la liste des statistiques. */
export default function PlayerPage() {
  const { key = '' } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const { stats, loadStats } = useRoomStore();

  // Données fraîches à chaque ouverture : la partie de ce soir compte dès qu'elle est finie
  useEffect(() => {
    loadStats();
  }, []);

  // De retour sur l'accueil, la liste se replacera sur ce joueur
  useEffect(() => {
    try { sessionStorage.setItem(LAST_PLAYER_KEY, key); } catch {}
  }, [key]);

  // Page ouverte directement (lien, rechargement) : pas de page précédente dans l'appli
  const back = () => (location.key !== 'default' ? nav(-1) : nav('/'));

  const p = stats?.players.find(x => x.key === key);

  return (
    <Layout title={p ? `${p.profile.emoji} ${p.name}` : 'Fiche joueur'}>
      <div className="space-y-3 pb-8">
        <button className="btn btn-ghost text-sm" onClick={back}>
          ← Retour
        </button>
        {!stats && <div className="text-center opacity-60 mt-8">Chargement...</div>}
        {stats && !p && <div className="card p-6 text-center opacity-70">Joueur introuvable.</div>}
        {p && <PlayerProfile p={p} />}
      </div>
    </Layout>
  );
}
