import type { ReactNode } from 'react';
import RoundCurve from './RoundCurve';
import type { PlayerStats } from '../lib/careerStats';

export const pct = (ok: number, total: number) => (total ? `${Math.round((100 * ok) / total)} %` : '–');
export const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
const num = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-wide opacity-50">{title}</div>
      {children}
    </div>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="opacity-60 shrink-0">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

/** Une carte par thème de la fiche. */
function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card p-4 space-y-2">
      <div className="font-semibold">{title}</div>
      {children}
    </div>
  );
}

/** Chiffre clé de l'en-tête de la fiche. */
function Tile({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded-lg bg-white/5 px-3 py-2">
      <div className="text-xs opacity-60">{label}</div>
      <div className="text-xl font-semibold leading-tight">{value}</div>
      {sub && <div className="text-xs opacity-50">{sub}</div>}
    </div>
  );
}

/** Fiche complète d'un joueur, sur toutes ses parties (stats de carrière). */
export default function PlayerProfile({ p }: { p: PlayerStats }) {
  const order = p.table.bidOrder;
  const speed = order === null ? null : order < 0.4 ? 'plutôt rapide' : order > 0.6 ? 'plutôt lent' : 'dans la moyenne';

  const tendency = Math.abs(p.tendency) < 0.05
    ? 'bien calibré'
    : p.tendency > 0
      ? `fait ${num(p.tendency)} pli de plus que prévu par manche`
      : `fait ${num(-p.tendency)} pli de moins que prévu par manche`;

  const bids = p.bidSizes.reduce((t, n) => t + n, 0);
  const share = (n: number) => `${Math.round((100 * n) / bids)} %`;
  const bidSizes = ([['0', p.bidSizes[0]], ['1', p.bidSizes[1]], ['2', p.bidSizes[2]], ['3+', p.bidSizes[3] + p.bidSizes[4] + p.bidSizes[5]]] as const)
    .filter(([, n]) => n > 0)
    .map(([size, n]) => `${size} : ${share(n)}`)
    .join(' · ');

  const s = p.social;

  return (
    <div className="space-y-3">
      <div className="card p-4 space-y-3">
        <div className="rounded-lg bg-white/5 px-3 py-2 text-sm">
          <span className="text-lg mr-1">{p.profile.emoji}</span>
          <span className="font-semibold">{p.profile.label}</span>
          <span className="opacity-60"> — {p.profile.detail}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Tile label="Parties" value={p.games} sub={`dernière le ${day(p.lastPlayed)}`} />
          <Tile label="Victoires" value={p.wins} sub={pct(p.wins, p.games)} />
          <Tile label="Podiums" value={p.podiums} sub={pct(p.podiums, p.games)} />
          <Tile label="Contrats réussis" value={pct(p.contracts.ok, p.contracts.total)} sub={`${p.contracts.ok} sur ${p.contracts.total}`} />
        </div>
      </div>

      <Card title="🏴‍☠️ Bilan">
        <Row label="Place moyenne">{num(p.avgRank)} sur {num(p.avgTableSize)}</Row>
        <Row label="Score moyen">{Math.round(p.avgScore)} pts</Row>
        {p.bestGame && <Row label="Meilleure partie">{p.bestGame.score} pts ({day(p.bestGame.date)})</Row>}
        {p.worstGame && <Row label="Pire partie">{p.worstGame.score} pts ({day(p.worstGame.date)})</Row>}
        {p.bestRound && (
          <Row label="Meilleure manche">{signed(p.bestRound.score)} (manche {p.bestRound.round}, {day(p.bestRound.date)})</Row>
        )}
        {p.comeback && (
          <Row label="🔥 Remontada">
            {p.comeback.fromRank}e sur {p.comeback.tableSize} après la manche {p.comeback.afterRound}, puis vainqueur ({day(p.comeback.date)})
          </Row>
        )}
      </Card>

      <Card title="🎯 Paris et contrats">
        <div className="text-xs opacity-60">Réussite des contrats selon la manche</div>
        <RoundCurve data={p.byRound} label={p.name} />
        <div className="space-y-1 pt-1">
          {bids > 0 && <Row label="Taille des paris">{bidSizes}</Row>}
          {p.zero.total > 0 && <Row label="Paris à 0 réussis">{pct(p.zero.ok, p.zero.total)} ({p.zero.ok}/{p.zero.total})</Row>}
          {p.lateZero.total > 0 && <Row label="Zéros en fin de partie">{p.lateZero.ok}/{p.lateZero.total} réussis (manches 8 à 10)</Row>}
          <Row label="Tendance">{tendency}</Row>
          <Row label="Plus longue série">
            {plural(p.bestStreak, 'contrat')} d'affilée{p.currentStreak > 1 ? ` (en cours : ${p.currentStreak})` : ''}
          </Row>
          {p.biggestBid && (
            <Row label="Plus gros pari réussi">{plural(p.biggestBid.bid, 'pli')} (manche {p.biggestBid.round}, {day(p.biggestBid.date)})</Row>
          )}
        </div>
      </Card>

      <Card title="🃏 Pouvoirs et bonus">
        <Row label="Harry">
          {p.harry.used ? `utilisé ${p.harry.used} fois, ${plural(p.harry.saved, 'contrat sauvé', 'contrats sauvés')}` : 'jamais utilisé'}
        </Row>
        <Row label="Joker">{p.joker.total ? `${p.joker.ok} réussi${p.joker.ok > 1 ? 's' : ''} sur ${p.joker.total}` : 'jamais tenté'}</Row>
        <Row label="Bonus gagnés">{p.bonus.positiveCount} (+{p.bonus.positiveSum} pts)</Row>
        <Row label="Bonus perdus">{p.bonus.negativeCount} ({p.bonus.negativeSum} pts)</Row>
        {p.bonus.best > 0 && <Row label="Plus gros bonus">+{p.bonus.best}</Row>}
      </Card>

      <Card title="⏱️ À la table">
        {speed && (
          <Row label="Pour parier">{speed}{p.table.lastToBid ? `, dernier à valider ${p.table.lastToBid} fois` : ''}</Row>
        )}
        <Row label="Parties organisées">{p.table.hosted}</Row>
        <Row label="Abandons">{p.table.abandons}</Row>
      </Card>

      <Card title="👥 Côté social">
        <Row label="Pouces reçus">👍 {s.upReceived} · 👎 {s.downReceived}</Row>
        <Row label="Pouces donnés">👍 {s.upGiven} · 👎 {s.downGiven}</Row>
        {s.favoriteTarget && <Row label="Cible préférée">{s.favoriteTarget.name} ({s.favoriteTarget.count} 👎)</Row>}
        {s.mainCritic && <Row label="Plus gros critique">{s.mainCritic.name} ({s.mainCritic.count} 👎)</Row>}
        {s.victim && <Row label="Victime préférée">{s.victim.name} (devant {s.victim.ahead} fois sur {s.victim.together})</Row>}
        {s.nemesis && <Row label="Bête noire">{s.nemesis.name} (devant seulement {s.nemesis.ahead} fois sur {s.nemesis.together})</Row>}
      </Card>
    </div>
  );
}
