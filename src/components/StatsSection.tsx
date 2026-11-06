import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoomStore } from '../store/useRoomStore';
import { playerKey } from '../lib/careerStats';
import { Section, Row, pct, day, plural } from './PlayerProfile';
import RoundCurve from './RoundCurve';

/** Dernier joueur consulté : la liste se replace dessus au retour de sa fiche. */
export const LAST_PLAYER_KEY = 'skullking-stats-last-player';
const QUERY_KEY = 'skullking-stats-query';

const session = {
  get: (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch {} },
  remove: (k: string) => { try { sessionStorage.removeItem(k); } catch {} },
};

const duration = (minutes: number) => {
  const m = Math.round(minutes);
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
};

/** Statistiques des joueurs, sur toutes les parties : recherche, liste des joueurs et records de la table. */
export default function StatsSection() {
  const nav = useNavigate();
  const { stats, loadStats } = useRoomStore();
  const [query, setQuery] = useState(() => session.get(QUERY_KEY) ?? '');

  // Rechargées à chaque ouverture de la section : la partie de ce soir compte dès qu'elle est finie
  useEffect(() => {
    loadStats();
  }, []);

  // Retour d'une fiche joueur : on replace la liste sur ce joueur
  useEffect(() => {
    const last = session.get(LAST_PLAYER_KEY);
    if (!stats || !last) return;
    session.remove(LAST_PLAYER_KEY);
    requestAnimationFrame(() => document.getElementById(`player-${last}`)?.scrollIntoView({ block: 'center' }));
  }, [stats]);

  const players = useMemo(() => {
    const q = playerKey(query);
    return (stats?.players ?? []).filter(p => !q || p.key.includes(q));
  }, [stats, query]);

  if (!stats) return <div className="text-center text-sm opacity-60 py-2">Chargement...</div>;
  if (stats.games === 0) {
    return <div className="card p-6 text-center opacity-70">Aucune partie terminée pour l'instant.</div>;
  }

  const g = stats.global;

  return (
    <div className="space-y-3">
      <p className="text-xs opacity-60">
        Sur {plural(stats.games, 'partie')}{stats.since ? ` depuis le ${day(stats.since)}` : ''} · mises à jour à chaque partie terminée
      </p>

      <input
        type="search"
        value={query}
        onChange={e => { setQuery(e.target.value); session.set(QUERY_KEY, e.target.value); }}
        placeholder="🔎 Rechercher un joueur"
        className="w-full bg-white/5 border border-white/10 rounded px-3 py-2"
      />

      <div className="space-y-2">
        {players.map(p => (
          <button
            key={p.key}
            id={`player-${p.key}`}
            className="card p-3 w-full flex items-center justify-between gap-2 text-left hover:bg-white/5 transition-colors"
            onClick={() => nav(`/player/${encodeURIComponent(p.key)}`)}
          >
            <div className="min-w-0">
              <div className="font-semibold truncate">{p.profile.emoji} {p.name}</div>
              <div className="text-xs opacity-60">
                {plural(p.games, 'partie')} · {plural(p.wins, 'victoire')} · {pct(p.contracts.ok, p.contracts.total)} de contrats réussis
              </div>
            </div>
            <span className="text-xl opacity-40 shrink-0">›</span>
          </button>
        ))}
        {players.length === 0 && (
          <div className="text-sm opacity-60 text-center py-2">Aucun joueur ne correspond à « {query} »</div>
        )}
      </div>

      <div className="card p-4 space-y-4">
        <div className="font-semibold">🏆 Records de la table</div>

        <Section title="📈 Réussite des contrats par manche">
          <RoundCurve data={g.byRound} label="toute la table" />
        </Section>

        {g.comeback && (
          <Section title="🔥 La remontada">
            <p className="text-sm">
              <span className="font-semibold">{g.comeback.name}</span>, {g.comeback.fromRank}e sur {g.comeback.tableSize} après
              la manche {g.comeback.afterRound}, a fini vainqueur ({day(g.comeback.date)})
            </p>
          </Section>
        )}

        <Section title="🎯 Paris et contrats">
          {g.zeroKing && <Row label="Roi du zéro (manches 8-10)">{g.zeroKing.name} ({pct(g.zeroKing.ok, g.zeroKing.total)})</Row>}
          {g.longestStreak && <Row label="Plus longue série">{g.longestStreak.name} ({g.longestStreak.count} d'affilée)</Row>}
          {g.biggestBid && <Row label="Plus gros pari réussi">{g.biggestBid.name} ({plural(g.biggestBid.bid, 'pli')}, manche {g.biggestBid.round})</Row>}
        </Section>

        <Section title="🃏 Pouvoirs et bonus">
          <Row label="Harry">{g.harry.used} fois, {plural(g.harry.saved, 'contrat sauvé', 'contrats sauvés')}</Row>
          {g.harry.topSaver && <Row label="Meilleur sauveteur">{g.harry.topSaver.name} ({g.harry.topSaver.count})</Row>}
          {g.joker.total > 0 && <Row label="Joker">{g.joker.ok} réussi{g.joker.ok > 1 ? 's' : ''} sur {g.joker.total}</Row>}
        </Section>

        <Section title="⏱️ À la table">
          {g.slowest && <Row label="Le plus lent à parier">{g.slowest.name}</Row>}
          {g.fastest && <Row label="Le plus rapide">{g.fastest.name}</Row>}
          {g.lastToBidMost && <Row label="Dernier à valider">{g.lastToBidMost.name} ({g.lastToBidMost.count} manches)</Row>}
          {g.avgDurationMin !== null && <Row label="Durée moyenne d'une partie">{duration(g.avgDurationMin)}</Row>}
          {g.organizer && <Row label="L'organisateur">{g.organizer.name} ({plural(g.organizer.count, 'partie')})</Row>}
        </Section>

        <Section title="👥 Côté social">
          {g.judge && <Row label="Le juge">{g.judge.name} ({g.judge.count} 👎 donnés)</Row>}
          {g.tenseDuo && <Row label="Duo le plus tendu">{g.tenseDuo.from} → {g.tenseDuo.to} ({g.tenseDuo.count} 👎)</Row>}
          {g.mostLoved && <Row label="Le plus apprécié">{g.mostLoved.name} ({g.mostLoved.count} 👍)</Row>}
          {g.mostBooed && <Row label="Le plus hué">{g.mostBooed.name} ({g.mostBooed.count} 👎)</Row>}
        </Section>
      </div>
    </div>
  );
}
