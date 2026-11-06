// Statistiques de carrière des joueurs.
//
// Chaque partie terminée est résumée dans un format compact et permanent (CareerGame),
// conservé au-delà des 60 jours de l'historique. Les stats sont recalculées à partir de
// ces résumés à chaque demande : une correction ou une suppression se répercute d'elle-même,
// et de nouvelles stats pourront être ajoutées plus tard sans rien perdre.
//
// Module pur (aucun accès disque) : le serveur s'en sert pour calculer, l'appli pour les types.

import type { HistoryEntry } from './supabase';

// ─── Seuils ───────────────────────────────────────────────────────────────────

const MIN_PROFILE_CONTRACTS = 30;   // manches jouées avant de déterminer un profil
const MIN_FACEOFF_GAMES = 3;        // parties ensemble pour parler de victime / bête noire
const MIN_SPEED_VALIDATIONS = 40;   // validations de pari pour juger la rapidité
const MIN_LATE_ZERO = 5;            // paris à 0 en fin de partie pour le « roi du zéro »
const MAX_GAME_MINUTES = 24 * 60;   // au-delà, durée aberrante (partie laissée ouverte)

// Profils de parieur, calibrés sur les parties réelles du groupe
const KAMIKAZE_TENDENCY = -0.08;    // fait en moyenne moins de plis qu'il n'en annonce
const PRUDENT_ZERO_RATE = 0.55;     // parie 0 dans plus de la moitié des manches
const COMPTABLE_ACCURACY = 0.70;    // réussit au moins 70 % de ses contrats

// ─── Format permanent d'une partie ─────────────────────────────────────────────

/** Pseudo normalisé : un joueur est reconnu par son pseudo, sans tenir compte des majuscules ni des accents. */
export function playerKey(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

/** Une manche d'un joueur. */
export interface CareerRound {
  round: number;
  bid: number | null;          // pari annoncé (null si le résultat a été saisi sans pari)
  harry: number;               // ajustement de Harry (0 si non utilisé)
  joker: boolean;              // Joker déclaré au moment du pari
  jokerSuccess: boolean;       // Joker débarrassé, confirmé aux résultats
  tricks: number;
  score: number;
  bonus: number[];             // bonus un par un
  readyAt: string | null;      // validation du pari (rapidité à parier)
}

export interface CareerPlayer {
  key: string;
  name: string;
  surrendered: boolean;
  managed: boolean;            // joueur « sans tel », saisi par l'hôte
  rounds: CareerRound[];
}

/** Résumé permanent d'une partie terminée (jamais purgé). */
export interface CareerGame {
  v: 1;
  id: string;                  // même identifiant que dans l'historique
  finishedAt: string;
  totalRounds: number;
  hostKey: string | null;      // hôte en fin de partie
  players: CareerPlayer[];
  thumbs: { round: number; from: string; to: string; dir: 1 | -1 }[];
  shame: { key: string; amount: number; round: number }[];
}

/** Résume une partie de l'historique au format permanent. */
export function toCareerGame(e: HistoryEntry): CareerGame {
  // Clé par joueur ; deux pseudos identiques une fois normalisés reçoivent un suffixe
  const keyOf = new Map<string, string>();
  const used = new Set<string>();
  for (const p of e.room.players) {
    const base = playerKey(p.name) || p.id;
    let key = base;
    for (let i = 2; used.has(key); i++) key = `${base}#${i}`;
    used.add(key);
    keyOf.set(p.id, key);
  }

  return {
    v: 1,
    id: e.id,
    finishedAt: e.finishedAt,
    totalRounds: e.room.total_rounds,
    hostKey: keyOf.get(e.room.host_player_id) ?? null,
    players: e.room.players.map(p => ({
      key: keyOf.get(p.id)!,
      name: p.name,
      surrendered: !!p.surrendered,
      managed: !!p.managedByHost,
      rounds: e.results
        .filter(r => r.player_id === p.id && r.is_done)
        .sort((a, b) => a.round_number - b.round_number)
        .map(r => {
          const b = e.bids.find(x => x.player_id === p.id && x.round_number === r.round_number);
          return {
            round: r.round_number,
            bid: b?.bid ?? null,
            harry: b?.harry_adjustment ?? 0,
            joker: !!b?.joker,
            jokerSuccess: !!r.joker_success,
            tricks: r.tricks,
            score: r.score,
            bonus: r.bonus_details ?? (r.bonus ? [r.bonus] : []),
            readyAt: b?.ready_at ?? null,
          };
        }),
    })),
    thumbs: (e.thumbs ?? []).flatMap(t => {
      const from = keyOf.get(t.fromId), to = keyOf.get(t.toId);
      return from && to ? [{ round: t.round, from, to, dir: t.dir }] : [];
    }),
    shame: (e.shameLog ?? []).flatMap(s => {
      const key = keyOf.get(s.playerId);
      return key ? [{ key, amount: s.amount, round: s.round }] : [];
    }),
  };
}

// ─── Résultat des calculs ──────────────────────────────────────────────────────

export interface Ratio { ok: number; total: number }
export interface RoundRatio extends Ratio { round: number }
export interface Named { name: string; count: number }
export interface Comeback { fromRank: number; tableSize: number; afterRound: number; date: string }

export type ProfileKind = 'prudent' | 'kamikaze' | 'comptable' | 'equilibre' | 'nouveau';

export interface PlayerStats {
  key: string;
  name: string;
  lastPlayed: string;
  // Fiche
  games: number;
  wins: number;
  podiums: number;
  avgRank: number;
  avgTableSize: number;
  avgScore: number;
  bestGame: { score: number; date: string } | null;
  worstGame: { score: number; date: string } | null;
  bestRound: { score: number; round: number; date: string } | null;
  comeback: Comeback | null;
  // Profil de parieur
  profile: { kind: ProfileKind; emoji: string; label: string; detail: string };
  // Paris et contrats
  contracts: Ratio;
  byRound: RoundRatio[];
  zero: Ratio;
  lateZero: Ratio;                   // paris à 0 en manches 8 à 10
  bidSizes: number[];                // index = taille du pari effectif (5 = 5 et plus)
  tendency: number;                  // plis réalisés − pari effectif, en moyenne par manche
  bestStreak: number;
  currentStreak: number;
  biggestBid: { bid: number; round: number; date: string } | null;
  // Pouvoirs et bonus
  harry: { used: number; saved: number; broke: number };
  joker: Ratio;                      // Joker déclaré avec un pari à 0 / réussi
  bonus: { positiveCount: number; positiveSum: number; negativeCount: number; negativeSum: number; best: number; worst: number };
  // Comportement à la table
  table: { bidOrder: number | null; lastToBid: number; hosted: number; abandons: number };
  // Côté social
  social: {
    upReceived: number;
    downReceived: number;
    upGiven: number;
    downGiven: number;
    favoriteTarget: Named | null;    // à qui il met le plus de 👎
    mainCritic: Named | null;        // qui lui met le plus de 👎
    victim: { name: string; ahead: number; together: number } | null;
    nemesis: { name: string; ahead: number; together: number } | null;
  };
}

export interface GlobalStats {
  byRound: RoundRatio[];
  comeback: (Comeback & { name: string }) | null;
  zeroKing: { name: string; ok: number; total: number } | null;
  longestStreak: Named | null;
  biggestBid: { name: string; bid: number; round: number; date: string } | null;
  harry: { used: number; saved: number; broke: number; topSaver: Named | null };
  joker: Ratio;
  slowest: { name: string; order: number } | null;
  fastest: { name: string; order: number } | null;
  lastToBidMost: Named | null;
  avgDurationMin: number | null;
  organizer: Named | null;
  judge: Named | null;
  tenseDuo: { from: string; to: string; count: number } | null;
  mostLoved: Named | null;
  mostBooed: Named | null;
}

export interface StatsPayload {
  generatedAt: string;
  games: number;
  since: string | null;
  players: PlayerStats[];
  global: GlobalStats;
}

// ─── Calculs ───────────────────────────────────────────────────────────────────

interface Acc {
  key: string; name: string; lastPlayed: string;
  games: number; wins: number; podiums: number; rankSum: number; sizeSum: number; scoreSum: number;
  bestGame: { score: number; date: string } | null; worstGame: { score: number; date: string } | null;
  bestRound: { score: number; round: number; date: string } | null; comeback: Comeback | null;
  contracts: Ratio; byRound: Map<number, Ratio>; zero: Ratio; lateZero: Ratio; bidSizes: number[];
  tendencySum: number; streak: number; bestStreak: number;
  biggestBid: { bid: number; round: number; date: string } | null;
  harry: { used: number; saved: number; broke: number }; joker: Ratio;
  bonus: PlayerStats['bonus'];
  orderSum: number; validations: number; lastToBid: number; hosted: number; abandons: number;
  upReceived: number; downReceived: number; upGiven: number; downGiven: number;
  downTargets: Map<string, number>; critics: Map<string, number>;
  faceoff: Map<string, { together: number; ahead: number }>;
}

function newAcc(key: string, name: string): Acc {
  return {
    key, name, lastPlayed: '',
    games: 0, wins: 0, podiums: 0, rankSum: 0, sizeSum: 0, scoreSum: 0,
    bestGame: null, worstGame: null, bestRound: null, comeback: null,
    contracts: { ok: 0, total: 0 }, byRound: new Map(), zero: { ok: 0, total: 0 }, lateZero: { ok: 0, total: 0 },
    bidSizes: [0, 0, 0, 0, 0, 0], tendencySum: 0, streak: 0, bestStreak: 0, biggestBid: null,
    harry: { used: 0, saved: 0, broke: 0 }, joker: { ok: 0, total: 0 },
    bonus: { positiveCount: 0, positiveSum: 0, negativeCount: 0, negativeSum: 0, best: 0, worst: 0 },
    orderSum: 0, validations: 0, lastToBid: 0, hosted: 0, abandons: 0,
    upReceived: 0, downReceived: 0, upGiven: 0, downGiven: 0,
    downTargets: new Map(), critics: new Map(), faceoff: new Map(),
  };
}

const inc = (m: Map<string, number>, k: string, by = 1) => m.set(k, (m.get(k) ?? 0) + by);
const tally = (r: Ratio, ok: boolean) => { r.total++; if (ok) r.ok++; };

function tallyRound(m: Map<number, Ratio>, round: number, ok: boolean) {
  const r = m.get(round) ?? { ok: 0, total: 0 };
  tally(r, ok);
  m.set(round, r);
}

const roundList = (m: Map<number, Ratio>): RoundRatio[] =>
  [...m].sort((a, b) => a[0] - b[0]).map(([round, r]) => ({ round, ...r }));

/** Plus grande valeur d'une Map ; à égalité, la première rencontrée. */
function maxEntry<K>(m: Map<K, number>): [K, number] | null {
  let best: [K, number] | null = null;
  for (const e of m) if (!best || e[1] > best[1]) best = e;
  return best;
}

const pct = (r: number) => `${Math.round(r * 100)} %`;

function profileOf(a: Acc): PlayerStats['profile'] {
  const n = a.contracts.total;
  if (n < MIN_PROFILE_CONTRACTS) {
    return { kind: 'nouveau', emoji: '🆕', label: 'Profil en cours', detail: `encore ${MIN_PROFILE_CONTRACTS - n} manches pour le déterminer` };
  }
  // Comparaisons sur les valeurs arrondies telles qu'affichées sur la fiche : un joueur
  // affiché à « 70 % de réussite » doit bien être Comptable, même à 69,6 % réels.
  const tendency = Math.round((a.tendencySum / n) * 100) / 100;
  const zeroRate = Math.round((a.zero.total / n) * 100) / 100;
  const accuracy = Math.round((a.contracts.ok / n) * 100) / 100;
  // La précision passe avant tout : un joueur qui parie haut ET réussit n'est pas un kamikaze.
  if (accuracy >= COMPTABLE_ACCURACY) {
    return { kind: 'comptable', emoji: '🧮', label: 'Comptable', detail: `réussit ${pct(accuracy)} de ses contrats` };
  }
  if (tendency <= KAMIKAZE_TENDENCY) {
    return { kind: 'kamikaze', emoji: '💥', label: 'Kamikaze', detail: `annonce plus de plis qu'il n'en fait (${tendency.toFixed(2).replace('.', ',')} par manche)` };
  }
  if (zeroRate >= PRUDENT_ZERO_RATE) {
    return { kind: 'prudent', emoji: '🛡️', label: 'Prudent', detail: `parie 0 dans ${pct(zeroRate)} des manches` };
  }
  return { kind: 'equilibre', emoji: '⚖️', label: 'Équilibré', detail: 'ni trop prudent, ni trop gourmand' };
}

export function computeStats(games: CareerGame[]): StatsPayload {
  const sorted = [...games].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
  const accs = new Map<string, Acc>();
  const accOf = (key: string, name: string) => {
    let a = accs.get(key);
    if (!a) { a = newAcc(key, name); accs.set(key, a); }
    return a;
  };

  const globalByRound = new Map<number, Ratio>();
  const hostCounts = new Map<string, number>();
  const downPairs = new Map<string, number>();
  const durations: number[] = [];
  let comeback: GlobalStats['comeback'] = null;
  let biggestBid: GlobalStats['biggestBid'] = null;

  for (const g of sorted) {
    const date = g.finishedAt;
    for (const p of g.players) {
      const a = accOf(p.key, p.name);
      a.name = p.name;            // pseudo le plus récent
      a.lastPlayed = date;
    }

    // Classement final (même calcul que l'appli : manches + sac de la honte)
    const totalFor = (p: CareerPlayer, upTo = Infinity) =>
      p.rounds.filter(r => r.round <= upTo).reduce((t, r) => t + r.score, 0)
      + g.shame.filter(s => s.key === p.key && s.round <= upTo).reduce((t, s) => t + s.amount, 0);
    const final = g.players.map(p => ({ p, total: totalFor(p) })).sort((a, b) => b.total - a.total);
    const rankOf = new Map(final.map((x, i) => [x.p.key, i + 1]));
    const size = final.length;

    // Remontada : pire place du vainqueur entre la 3e et l'avant-dernière manche
    const rounds = [...new Set(g.players.flatMap(p => p.rounds.map(r => r.round)))].sort((a, b) => a - b);
    const lastRound = rounds.at(-1) ?? 0;
    const winner = final[0]?.p;
    if (winner) {
      let worst: { rank: number; round: number } | null = null;
      for (const rn of rounds) {
        if (rn < 3 || rn >= lastRound) continue;
        const ranking = g.players.map(p => ({ key: p.key, t: totalFor(p, rn) })).sort((a, b) => b.t - a.t);
        const rank = ranking.findIndex(x => x.key === winner.key) + 1;
        if (!worst || rank > worst.rank) worst = { rank, round: rn };
      }
      if (worst && worst.rank > 1) {
        const c: Comeback = { fromRank: worst.rank, tableSize: size, afterRound: worst.round, date };
        const a = accs.get(winner.key)!;
        if (!a.comeback || c.fromRank >= a.comeback.fromRank) a.comeback = c;
        if (!comeback || c.fromRank > comeback.fromRank || (c.fromRank === comeback.fromRank && c.tableSize >= comeback.tableSize)) {
          comeback = { ...c, name: winner.name };
        }
      }
    }

    // Durée de la partie : de la première validation de pari à la fin
    const firstReady = g.players
      .flatMap(p => p.rounds.filter(r => r.round === rounds[0] && r.readyAt).map(r => r.readyAt!))
      .sort()[0];
    if (firstReady) {
      const minutes = (Date.parse(g.finishedAt) - Date.parse(firstReady)) / 60_000;
      if (minutes > 0 && minutes < MAX_GAME_MINUTES) durations.push(minutes);
    }

    if (g.hostKey) {
      inc(hostCounts, g.hostKey);
      const host = accs.get(g.hostKey);
      if (host) host.hosted++;
    }

    // Rapidité à parier : ordre de validation entre joueurs avec téléphone
    // (pour un joueur « sans tel », c'est l'hôte qui valide : sa vitesse ne compte pas)
    for (const rn of rounds) {
      const ready = g.players
        .filter(p => !p.managed)
        .flatMap(p => {
          const r = p.rounds.find(x => x.round === rn);
          return r?.readyAt ? [{ key: p.key, at: r.readyAt }] : [];
        })
        .sort((a, b) => a.at.localeCompare(b.at));
      if (ready.length < 2) continue;
      ready.forEach((x, i) => {
        const a = accs.get(x.key)!;
        a.orderSum += i / (ready.length - 1);
        a.validations++;
        if (i === ready.length - 1) a.lastToBid++;
      });
    }

    for (const p of g.players) {
      const a = accs.get(p.key)!;
      const rank = rankOf.get(p.key)!;
      const total = final.find(x => x.p.key === p.key)!.total;
      a.games++;
      if (rank === 1) a.wins++;
      if (rank <= 3) a.podiums++;
      a.rankSum += rank;
      a.sizeSum += size;
      a.scoreSum += total;
      if (!a.bestGame || total > a.bestGame.score) a.bestGame = { score: total, date };
      if (!a.worstGame || total < a.worstGame.score) a.worstGame = { score: total, date };
      if (p.surrendered) a.abandons++;

      for (const r of p.rounds) {
        if (!a.bestRound || r.score > a.bestRound.score) a.bestRound = { score: r.score, round: r.round, date };
        for (const b of r.bonus) {
          if (b > 0) { a.bonus.positiveCount++; a.bonus.positiveSum += b; a.bonus.best = Math.max(a.bonus.best, b); }
          if (b < 0) { a.bonus.negativeCount++; a.bonus.negativeSum += b; a.bonus.worst = Math.min(a.bonus.worst, b); }
        }
        if (r.bid === null) continue;

        const eff = r.bid + r.harry;
        const ok = r.tricks === eff;
        tally(a.contracts, ok);
        tallyRound(a.byRound, r.round, ok);
        tallyRound(globalByRound, r.round, ok);
        a.tendencySum += r.tricks - eff;
        a.bidSizes[Math.min(5, Math.max(0, eff))]++;
        if (eff === 0) {
          tally(a.zero, ok);
          if (r.round >= 8) tally(a.lateZero, ok);
        }
        a.streak = ok ? a.streak + 1 : 0;
        a.bestStreak = Math.max(a.bestStreak, a.streak);
        if (ok && eff > 0 && (!a.biggestBid || eff > a.biggestBid.bid)) a.biggestBid = { bid: eff, round: r.round, date };
        if (ok && eff > 0 && (!biggestBid || eff > biggestBid.bid)) biggestBid = { name: p.name, bid: eff, round: r.round, date };

        if (r.harry !== 0) {
          a.harry.used++;
          if (ok && r.tricks !== r.bid) a.harry.saved++;      // sans Harry, le contrat était raté
          if (!ok && r.tricks === r.bid) a.harry.broke++;     // sans Harry, le contrat était réussi
        }
        if (r.joker && r.bid === 0) tally(a.joker, r.jokerSuccess && ok && eff === 0);
      }
    }

    // Face-à-face : qui finit devant qui
    for (const x of g.players) {
      for (const y of g.players) {
        if (x.key === y.key) continue;
        const a = accs.get(x.key)!;
        const f = a.faceoff.get(y.key) ?? { together: 0, ahead: 0 };
        f.together++;
        if (rankOf.get(x.key)! < rankOf.get(y.key)!) f.ahead++;
        a.faceoff.set(y.key, f);
      }
    }

    for (const t of g.thumbs) {
      const from = accs.get(t.from), to = accs.get(t.to);
      if (!from || !to) continue;
      if (t.dir === 1) { to.upReceived++; from.upGiven++; continue; }
      to.downReceived++;
      from.downGiven++;
      inc(from.downTargets, t.to);
      inc(to.critics, t.from);
      inc(downPairs, `${t.from}\u0000${t.to}`);
    }
  }

  const nameOf = (key: string) => accs.get(key)?.name ?? key;
  const named = (e: [string, number] | null): Named | null => (e ? { name: nameOf(e[0]), count: e[1] } : null);

  const players: PlayerStats[] = [...accs.values()].map(a => {
    const faceoffs = [...a.faceoff]
      .filter(([, f]) => f.together >= MIN_FACEOFF_GAMES)
      .map(([key, f]) => ({ name: nameOf(key), ...f, ratio: f.ahead / f.together }));
    const byRatio = (dir: 1 | -1) => [...faceoffs].sort((x, y) => dir * (y.ratio - x.ratio) || y.together - x.together)[0];
    const victim = byRatio(1), nemesis = byRatio(-1);
    return {
      key: a.key,
      name: a.name,
      lastPlayed: a.lastPlayed,
      games: a.games,
      wins: a.wins,
      podiums: a.podiums,
      avgRank: a.games ? a.rankSum / a.games : 0,
      avgTableSize: a.games ? a.sizeSum / a.games : 0,
      avgScore: a.games ? a.scoreSum / a.games : 0,
      bestGame: a.bestGame,
      worstGame: a.worstGame,
      bestRound: a.bestRound,
      comeback: a.comeback,
      profile: profileOf(a),
      contracts: a.contracts,
      byRound: roundList(a.byRound),
      zero: a.zero,
      lateZero: a.lateZero,
      bidSizes: a.bidSizes,
      tendency: a.contracts.total ? a.tendencySum / a.contracts.total : 0,
      bestStreak: a.bestStreak,
      currentStreak: a.streak,
      biggestBid: a.biggestBid,
      harry: a.harry,
      joker: a.joker,
      bonus: a.bonus,
      table: {
        bidOrder: a.validations >= 10 ? a.orderSum / a.validations : null,
        lastToBid: a.lastToBid,
        hosted: a.hosted,
        abandons: a.abandons,
      },
      social: {
        upReceived: a.upReceived,
        downReceived: a.downReceived,
        upGiven: a.upGiven,
        downGiven: a.downGiven,
        favoriteTarget: named(maxEntry(a.downTargets)),
        mainCritic: named(maxEntry(a.critics)),
        victim: victim && victim.ahead > 0 ? { name: victim.name, ahead: victim.ahead, together: victim.together } : null,
        nemesis: nemesis && nemesis !== victim ? { name: nemesis.name, ahead: nemesis.ahead, together: nemesis.together } : null,
      },
    };
  }).sort((x, y) => y.games - x.games || x.name.localeCompare(y.name));

  // Records de la table
  const speed = players.filter(p => p.table.bidOrder !== null && accs.get(p.key)!.validations >= MIN_SPEED_VALIDATIONS);
  const bySpeed = [...speed].sort((x, y) => x.table.bidOrder! - y.table.bidOrder!);
  const zeroKing = players
    .filter(p => p.lateZero.total >= MIN_LATE_ZERO)
    .sort((x, y) => y.lateZero.ok / y.lateZero.total - x.lateZero.ok / x.lateZero.total || y.lateZero.total - x.lateZero.total)[0];
  const top = <T,>(list: T[], value: (t: T) => number) =>
    list.reduce<T | null>((best, t) => (!best || value(t) > value(best) ? t : best), null);
  const streakTop = top(players, p => p.bestStreak);
  const saverTop = top(players, p => p.harry.saved);
  const lastTop = top(players, p => p.table.lastToBid);
  const lovedTop = top(players, p => p.social.upReceived);
  const booedTop = top(players, p => p.social.downReceived);
  const judgeTop = top(players, p => p.social.downGiven);
  const duo = maxEntry(downPairs);
  const sum = (f: (p: PlayerStats) => number) => players.reduce((t, p) => t + f(p), 0);

  const global: GlobalStats = {
    byRound: roundList(globalByRound),
    comeback,
    zeroKing: zeroKing ? { name: zeroKing.name, ok: zeroKing.lateZero.ok, total: zeroKing.lateZero.total } : null,
    longestStreak: streakTop && streakTop.bestStreak > 0 ? { name: streakTop.name, count: streakTop.bestStreak } : null,
    biggestBid,
    harry: {
      used: sum(p => p.harry.used),
      saved: sum(p => p.harry.saved),
      broke: sum(p => p.harry.broke),
      topSaver: saverTop && saverTop.harry.saved > 0 ? { name: saverTop.name, count: saverTop.harry.saved } : null,
    },
    joker: { ok: sum(p => p.joker.ok), total: sum(p => p.joker.total) },
    slowest: bySpeed.length >= 2 ? { name: bySpeed.at(-1)!.name, order: bySpeed.at(-1)!.table.bidOrder! } : null,
    fastest: bySpeed.length >= 2 ? { name: bySpeed[0].name, order: bySpeed[0].table.bidOrder! } : null,
    lastToBidMost: lastTop && lastTop.table.lastToBid > 0 ? { name: lastTop.name, count: lastTop.table.lastToBid } : null,
    avgDurationMin: durations.length ? durations.reduce((t, d) => t + d, 0) / durations.length : null,
    organizer: named(maxEntry(hostCounts)),
    judge: judgeTop && judgeTop.social.downGiven > 0 ? { name: judgeTop.name, count: judgeTop.social.downGiven } : null,
    tenseDuo: duo ? { from: nameOf(duo[0].split('\u0000')[0]), to: nameOf(duo[0].split('\u0000')[1]), count: duo[1] } : null,
    mostLoved: lovedTop && lovedTop.social.upReceived > 0 ? { name: lovedTop.name, count: lovedTop.social.upReceived } : null,
    mostBooed: booedTop && booedTop.social.downReceived > 0 ? { name: booedTop.name, count: booedTop.social.downReceived } : null,
  };

  return {
    generatedAt: new Date().toISOString(),
    games: sorted.length,
    since: sorted[0]?.finishedAt ?? null,
    players,
    global,
  };
}
