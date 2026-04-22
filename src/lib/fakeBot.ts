/**
 * 🏴‍☠️ CAPITAINE BID — Faux bot niveau 3
 * Utilise le contexte réel du jeu pour donner des conseils
 * pseudo-intelligents, sans aucune IA réelle.
 *
 * NOTE: Ce fichier n'est pas encore importé dans l'app.
 */

export interface BotContext {
  round: number;
  totalRounds: number;
  totalPlayers: number;
  myScore: number;
  leaderScore: number;
  lastScore: number | null;    // score gagné à la manche précédente
  myBid: number | null;        // pari en cours (si déjà posé)
  tricksWon: number;           // plis gagnés ce round (mode milieu de manche)
  tricksNeeded: number | null; // plis restants à gagner
  playerName: string;
  roundsLeft: number;
}

export interface BotMessage {
  role: 'user' | 'assistant';
  content: string;
  isPhoto?: boolean;
  timestamp: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Phrases ────────────────────────────────────────────────────────────────

const OPENINGS = [
  'Ahoy matelot !',
  'Laisse-moi consulter les vents...',
  'Hmm, j\'analyse tes cartes...',
  'Les flots me parlent...',
  'Par les sept mers !',
  'Le Skull King m\'a soufflé quelque chose...',
  'J\'ai vu pire. Et meilleur.',
  'Mes os de pirate le sentent...',
  'Intéressant...',
  'Voyons voir ce qu\'on a là...',
  'Le Kraken m\'inspire une réponse...',
  'Penche-toi, je vais te glisser un secret...',
  'D\'après mon sextant...',
  'Mmmh... mes cartes de navigation indiquent...',
  'J\'ai navigué 40 ans, fais-moi confiance...',
  'Le fond de mon rhum révèle...',
  'Tirons les cartes du destin...',
  'Mon perroquet dit que...',
];

const PHOTO_OPENINGS = [
  '📷 Photo reçue. Analyse visuelle en cours...',
  '🔍 Scan de ta main... patience...',
  '🏴‍☠️ Je décortique chaque carte...',
  '👁️ Mon œil de pirate inspecte...',
  '📸 Bonne photo. Je vois tes cartes...',
  '🔭 Ma longue-vue est sur ta main...',
  '⏳ Consultation des parchemins anciens...',
  '🧭 Calibrage du compas stratégique...',
];

const CONTEXTS_GOOD_HAND = [
  'Ta main est redoutable.',
  'Tu as de la matière à travailler.',
  'Je vois du potentiel dans cette main.',
  'Solide. Tu pars avec de bonnes bases.',
  'Pas mal du tout. Les dieux marins sont avec toi.',
  'Cette main peut surprendre les autres.',
  'Du costaud. Bien distribué.',
  'T\'as de la chance ce tour-ci.',
  'Tes cartes sont au-dessus de la moyenne.',
];

const CONTEXTS_BAD_HAND = [
  'Ta main est... comment dire... fragile.',
  'Les flots ne t\'ont pas gâté ce tour.',
  'C\'est serré. Faut être malin.',
  'Des cartes basses, mais ça se joue.',
  'Pas évident. Il faudra ruser.',
  'Le Skull King t\'a oublié ce tour.',
  'Ta main est difficile, mais pas impossible.',
  'Courage. Les Pirates ont vu pire.',
  'C\'est un tour de sacrifice ou de bluff.',
];

const CONTEXTS_NEUTRAL = [
  'Ta main est équilibrée.',
  'Ni trop fort, ni trop faible.',
  'Une main honnête.',
  'Ça peut aller dans tous les sens.',
  'Tu pars sur du neutre. À toi de jouer.',
  'La main est correcte, le reste dépend de toi.',
  'Quelques bonnes cartes, quelques risques.',
  'Tout est dans la manière de jouer.',
];

const BID_JUSTIFICATIONS = [
  'les atouts te sortiront du pétrin.',
  'garde tes grosses cartes pour la fin.',
  'ne gaspille pas ton Skull King trop tôt.',
  'les cartes basses te serviront à te défausser.',
  'surveille les Pirates adverses.',
  'les Sirènes peuvent renverser la situation.',
  'la position dans l\'ordre de jeu compte.',
  'observe qui mène chaque pli.',
  'parfois perdre un pli c\'est gagner la manche.',
  'le bluff fait partie du jeu.',
  'joue tes atouts au bon moment.',
  'garde une Fuite pour les mauvais plis.',
  'méfie-toi du Kraken en fin de manche.',
  'Harry the Giant peut être surprenant.',
  'les pièces d\'or apportent du bonus.',
];

const RISK_LABELS = [
  '🟢 Pari sécurisé',
  '🟡 Pari modéré',
  '🔴 Pari risqué mais jouable',
  '⚡ Va à l\'aventure',
  '🛡️ Pari défensif',
  '🎯 Précis',
  '🎲 Coup de poker',
];

const CONFIDENCE_PHRASES = [
  'J\'y crois à 80%.',
  'Le vent est favorable.',
  'Pas garanti, mais probable.',
  'Fais-moi confiance. Enfin... à moitié.',
  'Les étoiles le confirment.',
  'Mon instinct de vieux loup de mer le dit.',
  'J\'ai vu des mains similaires, ça tient.',
  'Pas de garantie en mer. Mais c\'est ma meilleure lecture.',
  'Si ta main est ce que je crois, ça passe.',
  'Avec un peu de chance, largement.',
];

const MID_ROUND_WINNING = [
  'T\'es dans les clous. Continue comme ça.',
  'Bien joué jusqu\'ici. Gère la fin avec attention.',
  'Tu mènes bien. Sois vigilant sur les derniers plis.',
  'Tu es sur la bonne trajectoire. Ne t\'emballe pas.',
  'Excellent. Maintenant il faut tenir.',
  'Bien, mais les meilleurs plis restent à jouer.',
];

const MID_ROUND_STRUGGLING = [
  'C\'est tendu. Il faut sortir les grands moyens.',
  'Redresse la barre, il reste encore des plis.',
  'Dur dur. Mais rien n\'est perdu.',
  'Oublie les plis passés. Concentre-toi sur les suivants.',
  'T\'es dans la tempête. Les bons navigateurs en sortent.',
  'C\'est chaud, mais un Pirate bien placé peut tout changer.',
  'Faut lâcher une grosse carte maintenant.',
];

const MID_ROUND_EXACT = [
  'T\'es pile où il faut. Défends ta position.',
  'Parfait. Ne gagne plus rien de plus, et ne perds rien.',
  'Idéal. Maintenant il faut tenir ce score.',
  'Tu gères. Continue exactement comme ça.',
];

const LOSING_GAME_PHRASES = [
  'T\'es à la traîne. Il faut tenter quelque chose de gros.',
  'Le classement demande des risques. Ose.',
  'À ta place je parierais haut pour rattraper le retard.',
  'La prudence ne paie pas quand t\'es derrière.',
  'Parfois faut tout miser pour remonter.',
  'T\'as rien à perdre à risquer un pari ambitieux.',
];

const WINNING_GAME_PHRASES = [
  'Tu mènes. Joue prudent, protège ton avance.',
  'La sagesse dit : garde ton score et laisse les autres se planter.',
  'T\'es en tête. Pas besoin de prendre des risques inutiles.',
  'Navigue en eau calme. T\'as une belle avance.',
  'Le leader peut se permettre d\'être conservateur.',
  'Ton avance te donne le luxe de la prudence.',
];

const TIED_PHRASES = [
  'C\'est serré au classement. Le moment de se démarquer.',
  'Tout se joue maintenant. Sois stratégique.',
  'Égalité. Le prochain pari peut tout changer.',
  'Vous êtes au coude à coude. Intéressant.',
  'C\'est le moment de montrer qui est le vrai Skull King.',
];

const LAST_ROUNDS = [
  'On approche de la fin. Chaque point compte double.',
  'Les dernières manches sont cruciales. Pas d\'erreur.',
  'La finale approche. T\'as encore le temps de renverser.',
  'Fin de partie. Maintenant c\'est pour de vrai.',
  'Les ultimes manches décident du vainqueur.',
];

const FIRST_ROUND_PHRASES = [
  'C\'est la première manche. Reste prudent pour calibrer.',
  'Début de partie. Observe tes adversaires.',
  'Première main. Prends tes marques sans trop risquer.',
  'Tour 1. Les jeux sont ouverts.',
];

const ZERO_BID_JUSTIFICATIONS = [
  'Avec cette main, 0 pli c\'est la voie royale.',
  'Parfois ne rien gagner rapporte gros. C\'est le moment.',
  'Joue la carte de la discrétion totale.',
  'Pari 0 = 10 pts garantis si tu tiens. C\'est rentable.',
  'Les mains faibles sont faites pour le 0.',
];

const WILD_PHRASES = [
  'Mon rhum parle à ma place ce soir...',
  'Mon perroquet picorait tes cartes là.',
  '... (bruit de vague)',
  'Tu sais quoi ? Écoute ton instinct. Pas moi.',
  'Je regarde une autre table là, répète la question.',
  'Pose-moi ça après un tour de rhum.',
  'Le Kraken a dévoré ma réponse. Retente.',
];

// ── Calcul du pari contextuel ─────────────────────────────────────────────

function computeSuggestedBid(ctx: BotContext): { safe: number; risky: number } {
  const { round, totalPlayers, myScore, leaderScore } = ctx;

  // Base : 1 pli par N joueurs, avec bruit
  const baseBid = Math.max(0, Math.round(round / totalPlayers));
  const noise = randInt(-1, 1);
  const safe = Math.max(0, Math.min(round, baseBid + noise));

  // Risky : si on est derrière, pousser un peu
  const isLosing = myScore < leaderScore - 20;
  const risky = Math.min(round, safe + (isLosing ? randInt(1, 2) : randInt(0, 1)));

  return { safe, risky };
}

function pickContext(ctx: BotContext): string {
  const { round, myScore, leaderScore } = ctx;

  if (round === 1) return pick(FIRST_ROUND_PHRASES);
  if (ctx.roundsLeft <= 2) return pick(LAST_ROUNDS);

  const gap = myScore - leaderScore;
  if (gap > 20) return pick(WINNING_GAME_PHRASES);
  if (gap < -20) return pick(LOSING_GAME_PHRASES);
  if (Math.abs(gap) <= 10) return pick(TIED_PHRASES);
  return pick(CONTEXTS_NEUTRAL);
}

function pickHandQuality(bid: number, round: number): string {
  const ratio = bid / Math.max(1, round);
  if (ratio >= 0.5) return pick(CONTEXTS_GOOD_HAND);
  if (ratio <= 0.2) return pick(CONTEXTS_BAD_HAND);
  return pick(CONTEXTS_NEUTRAL);
}

// ── Réponse initiale (avec photo ou sans) ─────────────────────────────────

export async function generateInitialAdvice(
  ctx: BotContext,
  hasPhoto: boolean,
  onTyping: (text: string) => void
): Promise<string> {
  const { safe, risky } = computeSuggestedBid(ctx);

  // Simule le chargement
  if (hasPhoto) {
    onTyping(pick(PHOTO_OPENINGS));
    await sleep(randInt(1800, 3200));
  } else {
    onTyping(pick(OPENINGS));
    await sleep(randInt(800, 1600));
  }

  const gameCtx = pickContext(ctx);
  const handQuality = pickHandQuality(safe, ctx.round);
  const justification = pick(BID_JUSTIFICATIONS);
  const riskLabel = safe <= 1
    ? pick([RISK_LABELS[0], RISK_LABELS[3]])
    : pick(RISK_LABELS);
  const confidence = pick(CONFIDENCE_PHRASES);

  // Cas spécial : pari 0
  if (safe === 0) {
    return `🏴‍☠️ ${pick(OPENINGS)}

${handQuality} ${gameCtx}

Je te conseille : **0 pli**.
${pick(ZERO_BID_JUSTIFICATIONS)}

${confidence}`;
  }

  return `🏴‍☠️ ${pick(OPENINGS)}

${handQuality} ${gameCtx}

${riskLabel} : **${safe}** plis
↗️ Alternative risquée : **${risky}** plis

💡 ${justification.charAt(0).toUpperCase() + justification.slice(1)}

${confidence}`;
}

// ── Conseils en milieu de manche ──────────────────────────────────────────

export async function generateMidRoundAdvice(
  ctx: BotContext,
  userMessage: string,
  onTyping: (text: string) => void
): Promise<string> {
  onTyping('🤔 Analyse...');
  await sleep(randInt(700, 1400));

  const { tricksWon, tricksNeeded } = ctx;
  const remaining = tricksNeeded !== null ? tricksNeeded - tricksWon : null;

  // Détecte si c'est une photo
  const isPhotoMsg = userMessage === '[photo]';
  if (isPhotoMsg) {
    onTyping(pick(PHOTO_OPENINGS));
    await sleep(randInt(1500, 2800));
  }

  if (remaining === null) {
    return `🏴‍☠️ Dis-moi combien de plis il te reste à gagner pour que je t'aide mieux !`;
  }

  if (remaining === 0) {
    return `🏴‍☠️ ${pick(MID_ROUND_EXACT)}

Tu n'as **plus besoin de gagner de plis**. Évite de surcouper !
Défausse tes cartes les plus fortes intelligemment.`;
  }

  if (remaining < 0) {
    const over = Math.abs(remaining);
    return `🏴‍☠️ Aïe. Tu as déjà gagné **${over} pli${over > 1 ? 's' : ''} de trop**.

Tu ne peux plus atteindre ton pari. Minimise les dégâts :
joue tes cartes les plus faibles, évite de surcouper davantage.

${pick(MID_ROUND_STRUGGLING)}`;
  }

  if (remaining > 0 && tricksWon >= (ctx.tricksNeeded ?? 0) / 2) {
    return `🏴‍☠️ ${pick(MID_ROUND_WINNING)}

Il te reste encore **${remaining} pli${remaining > 1 ? 's' : ''} à gagner**.
${remaining === 1 ? 'Une seule grosse carte devrait suffire. Garde-la pour le bon moment.' : 'Espace tes meilleures cartes sur les prochains plis.'}`;
  }

  return `🏴‍☠️ ${pick(MID_ROUND_STRUGGLING)}

Il te faut encore **${remaining} pli${remaining > 1 ? 's' : ''}** sur les prochains tours.
${remaining >= 2 ? 'Lance une grande carte dès le prochain pli pour prendre le dessus.' : 'Garde ta meilleure carte pour le pli qui compte.'}

${pick(CONFIDENCE_PHRASES)}`;
}

// ── Réponse générique à une question texte ────────────────────────────────

export async function generateTextReply(
  _ctx: BotContext,
  userMessage: string,
  onTyping: (text: string) => void
): Promise<string> {
  onTyping('🏴‍☠️ Je réfléchis...');
  await sleep(randInt(600, 1200));

  const msg = userMessage.toLowerCase();

  // Questions fréquentes détectées par mots-clés
  if (msg.includes('skull king') || msg.includes('sk')) {
    return pick([
      '🏴‍☠️ Le Skull King bat tout sauf les Sirènes. Garde-le pour un pli clé.',
      '🏴‍☠️ Le SK c\'est ta bombe. Ne la jette pas dans les premiers plis.',
      '🏴‍☠️ Avec le SK, t\'es quasi certain de gagner un pli. Choisis lequel mérite ça.',
      '🏴‍☠️ Le SK peut être capturé par les Sirènes — attention si t\'en vois passer.',
    ]);
  }

  if (msg.includes('pirate')) {
    return pick([
      '🏴‍☠️ Un Pirate gagne contre tous les chiffres. Seul le SK et les Sirènes le battent.',
      '🏴‍☠️ Les Pirates s\'annulent entre eux — le premier posé gagne si les autres suivent.',
      '🏴‍☠️ Garde ton Pirate pour un pli où tu es sûr de gagner.',
    ]);
  }

  if (msg.includes('sirène') || msg.includes('mermaid') || msg.includes('sir')) {
    return pick([
      '🏴‍☠️ La Sirène capture le Skull King et gagne sur les Pirates. Redoutable.',
      '🏴‍☠️ Avec une Sirène tu peux bluffer face à un SK adverse.',
      '🏴‍☠️ Les Sirènes sont sous-estimées. Joue-la quand tu veux surprendre.',
    ]);
  }

  if (msg.includes('fuite') || msg.includes('escape')) {
    return pick([
      '🏴‍☠️ La Fuite te fait perdre à coup sûr. Utile pour se défausser sans prendre de risque.',
      '🏴‍☠️ Joue ta Fuite sur un pli que tu ne veux surtout pas gagner.',
      '🏴‍☠️ La Fuite en fin de manche c\'est souvent du génie.',
    ]);
  }

  if (msg.includes('gagn') || msg.includes('won') || msg.includes('win')) {
    return pick(MID_ROUND_WINNING);
  }

  if (msg.includes('perdu') || msg.includes('lost') || msg.includes('raté')) {
    return pick(MID_ROUND_STRUGGLING);
  }

  if (msg.includes('combien') || msg.includes('pari') || msg.includes('bet')) {
    return `🏴‍☠️ ${pick(OPENINGS)}\n\n${pick(BID_JUSTIFICATIONS).charAt(0).toUpperCase() + pick(BID_JUSTIFICATIONS).slice(1)}\n\n${pick(CONFIDENCE_PHRASES)}`;
  }

  if (msg.includes('harry')) {
    return pick([
      '🏴‍☠️ Harry the Giant peut te donner +1 ou -1 sur ton pari. Ça change tout en fin de compte.',
      '🏴‍☠️ Harry peut être ton allié ou ton ennemi. Pense à son effet avant de parier.',
      '🏴‍☠️ Avec Harry, ton pari effectif change. N\'oublie pas de recalculer.',
    ]);
  }

  if (msg.includes('kraken')) {
    return pick([
      '🏴‍☠️ Le Kraken annule le pli — personne ne gagne. Joue-le pour saborder un pli que tu ne peux pas gagner.',
      '🏴‍☠️ Le Kraken c\'est une arme défensive. Parfait quand tu es déjà à ton quota de plis.',
    ]);
  }

  if (msg.includes('aide') || msg.includes('help') || msg.includes('quoi faire')) {
    return `🏴‍☠️ Envoie-moi une photo de ta main ou dis-moi combien de plis tu as fait jusqu\'ici. Je t\'oriente !`;
  }

  if (msg.includes('nul') || msg.includes('mauvais') || msg.includes('useless')) {
    return pick([
      '🏴‍☠️ Je fais de mon mieux avec les vents que j\'ai... 🌊',
      '🏴‍☠️ Mon perroquet te dit pareil.',
      '🏴‍☠️ Tu préfères jouer tout seul ? Non ? Alors écoute le Capitaine.',
      '🏴‍☠️ Tes insultes me filent de l\'énergie. Continue.',
    ]);
  }

  // Réponse par défaut : semi-random mais contextuelle
  const chance = Math.random();
  if (chance < 0.1) {
    // Easter egg rare
    return `🏴‍☠️ ${pick(WILD_PHRASES)}`;
  }

  return `🏴‍☠️ ${pick(OPENINGS)}\n\n${pick(CONTEXTS_NEUTRAL)} ${pick(BID_JUSTIFICATIONS)}\n\n${pick(CONFIDENCE_PHRASES)}`;
}

// ── Debrief fin de manche ─────────────────────────────────────────────────

export async function generateDebriefMessage(
  bid: number,
  actual: number,
  score: number,
  onTyping: (text: string) => void
): Promise<string> {
  onTyping('🏴‍☠️ Bilan...');
  await sleep(randInt(600, 1100));

  const success = actual === bid;
  const over = actual > bid;
  const under = actual < bid;

  const successPhrases = [
    `Exactement **${bid}** plis comme prévu. Parfait, matelot. 🎯`,
    `**${bid}/${bid}**. Tu vois ? Tu m\'écoutes et ça paye.`,
    `Pari réussi. ${score > 0 ? `+${score} pts bien mérités.` : 'Le 0 tenu, chapeau.'}`,
    `En plein dans le mille. T\'avais la bonne lecture.`,
    `Bien joué. Je savais que t\'y arriverais. (Enfin... j\'espérais.)`,
  ];

  const overPhrases = [
    `Tu as fait **${actual}** plis pour un pari de **${bid}**. Un de trop.`,
    `Pli gagné en trop — ça fait mal sur le total. Retiens-toi la prochaine fois.`,
    `**${actual - bid}** pli${actual - bid > 1 ? 's' : ''} de trop. La prochaine fois, défausse plutôt que de surcouper.`,
    `Trop gourmand ! Le pli de trop t\'a coûté des points.`,
  ];

  const underPhrases = [
    `Tu n\'as fait que **${actual}** plis sur **${bid}** prévus. Il manquait quelque chose.`,
    `**${bid - actual}** pli${bid - actual > 1 ? 's' : ''} manquant. Tes grosses cartes sont sorties trop tôt ?`,
    `Pas assez de plis. La prochaine fois, garde une grande carte pour sécuriser.`,
    `Pari raté de **${bid - actual}**. Ça arrive même aux meilleurs Capitaines.`,
  ];

  const baseText = success
    ? pick(successPhrases)
    : over ? pick(overPhrases) : pick(underPhrases);

  const tips = success ? [
    'Continue sur cette lancée.',
    'La constance fait les champions.',
    'T\'as le sens du jeu.',
  ] : [
    'Analyse pourquoi ça a dérapé pour ne pas répéter.',
    'Une manche difficile ça arrive. C\'est comment tu rebondis qui compte.',
    'La prochaine manche est une nouvelle chance.',
    'Retiens la leçon et repars plus fort.',
  ];

  return `🏴‍☠️ ${baseText}

${pick(tips)} ${score >= 0 ? `✅ **${score > 0 ? '+' : ''}${score} pts**` : `❌ **${score} pts**`}`;
}
