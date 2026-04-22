interface Props {
  open: boolean;
  onClose: () => void;
}

function Block({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="card p-3 space-y-1">
      {title && <div className="font-semibold text-accent text-sm mb-2">{title}</div>}
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="opacity-60 shrink-0 w-24">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function Rule({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-snug opacity-90">• {children}</p>;
}

export default function RulesDrawer({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md flex flex-col bg-surface border-l border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <span className="font-bold text-lg">📖 Règles du jeu</span>
          <button
            className="text-2xl opacity-60 hover:opacity-100 transition-opacity"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">

          {/* Navigation rapide */}
          <div className="flex flex-wrap gap-2">
            {[
              ['scoring', '🏆 Points'],
              ['couleur', '🃏 Couleurs'],
              ['personnages', '⚔️ Personnages'],
              ['pouvoirs', '✨ Pouvoirs'],
              ['blanches', '⬜ Blanches'],
              ['mousses', '👶 Mousses'],
              ['leviathans', '🦑 Léviathans'],
              ['pieces', '🪙 Pièces'],
              ['interactions', '⚠️ Interactions'],
              ['parlante', '🤫 Parlante'],
            ].map(([id, label]) => (
              <a key={id} href={`#rules-${id}`} className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors">
                {label}
              </a>
            ))}
          </div>

          {/* Scoring */}
          <div id="rules-scoring" className="scroll-mt-4 space-y-2">
            <div className="section-title">🏆 Décompte des points</div>
            <Block title="Miser sur 1 ou plus">
              <Rule>Pari <strong>réussi</strong> : +20 pts × plis misés</Rule>
              <Rule>Pari <strong>raté</strong> : -10 pts × écart</Rule>
              <p className="text-xs opacity-50 mt-1">Ex : mise 3, réalise 3 → +60 | mise 2, réalise 4 → -20</p>
            </Block>
            <Block title="Miser sur zéro">
              <Rule>0 pli réalisé : +10 pts × numéro de manche</Rule>
              <Rule>≥1 pli réalisé : -10 pts × numéro de manche</Rule>
              <p className="text-xs opacity-50 mt-1">Ex : mise 0 manche 7, 0 pli → +70 | 2 plis → -70</p>
            </Block>
            <Block title="Bonus (si pari réussi)">
              <Rule>+10 pts par 14 classique (vert/jaune/violet) en main</Rule>
              <Rule>+20 pts pour le 14 noir en main</Rule>
              <Rule>-5 pts par 7 classique | +5 pts par 8 classique</Rule>
              <Rule>-5 pts pour le 7 noir | +5 pts pour le 8 noir</Rule>
              <Rule>+20 pts par sirène capturée par un pirate</Rule>
              <Rule>+30 pts par pirate capturé par le Skull King</Rule>
              <Rule>+30 pts par Second capturé par SK ou sirène</Rule>
              <Rule>+40 pts si ta sirène capture le Skull King</Rule>
            </Block>
          </div>

          {/* Cartes couleur */}
          <div id="rules-couleur" className="scroll-mt-4 space-y-2">
            <div className="section-title">🃏 Cartes de couleur</div>
            <Block>
              <Row label="🟢 Vert">Perroquet (1–14)</Row>
              <Row label="🟡 Jaune">Coffre (1–14)</Row>
              <Row label="🟣 Violet">Carte au trésor (1–14)</Row>
              <Row label="⬛ Noir">Drapeau pirate — ATOUT (1–14)</Row>
            </Block>
            <Block title="Règles">
              <Rule>La carte la plus haute de la couleur demandée remporte le pli</Rule>
              <Rule>Le noir bat toutes les autres couleurs, même les valeurs supérieures</Rule>
              <Rule>Si tu n'as pas la couleur demandée, tu peux jouer n'importe quelle carte</Rule>
              <Rule>Les cartes sans numéro peuvent être jouées à tout moment</Rule>
            </Block>
          </div>

          {/* Personnages */}
          <div id="rules-personnages" className="scroll-mt-4 space-y-2">
            <div className="section-title">⚔️ Cartes Personnage</div>
            <Block title="🏴‍☠️ Pirate (×6 dont Tigresse)">
              <Rule>Bat toutes les cartes numérotées</Rule>
              <Rule>Si plusieurs pirates, le premier joué gagne</Rule>
            </Block>
            <Block title="🧜‍♀️ Sirène (×2)">
              <Rule>Bat toutes les cartes numérotées</Rule>
              <Rule>Perd contre les pirates SAUF le Skull King</Rule>
              <Rule>SK + pirate + sirène dans le même pli → la sirène gagne toujours</Rule>
            </Block>
            <Block title="👑 Skull King (×1)">
              <Rule>Bat tous les pirates (y compris Tigresse en pirate)</Rule>
              <Rule>Seules les sirènes peuvent le battre</Rule>
            </Block>
            <Block title="🦜 Le Second (×1)">
              <Rule>Bat tous les pirates, perd contre sirènes et SK</Rule>
              <Rule>Permet d'utiliser les pouvoirs des pirates capturés</Rule>
              <Rule>+30 pts si capturé par sirène ou SK</Rule>
            </Block>
            <Block title="🐯 Tigresse (×1)">
              <Rule>Au moment de jouer : tu choisis Pirate OU Drapeau</Rule>
            </Block>
            <Block title="🚩 Drapeau (×5)">
              <Rule>Perd contre toutes les autres cartes</Rule>
              <Rule>Si tous jouent un drapeau/butin, la première carte jouée gagne</Rule>
            </Block>
          </div>

          {/* Pouvoirs */}
          <div id="rules-pouvoirs" className="scroll-mt-4 space-y-2">
            <div className="section-title">✨ Cartes Pouvoir</div>
            <Block title="🃏 Joker le Mystérieux">
              <Rule>Montré après l'annonce → pioche une carte supplémentaire</Rule>
              <Rule>Mise 0 réussie avec le Joker → +20 pts bonus</Rule>
            </Block>
            <Block title="🎰 Rascal le Flambeur">
              <Rule>Parie 0, 10 ou 20 pts supplémentaires</Rule>
              <Rule>Pari réussi → tu les gagnes | raté → tu les perds</Rule>
            </Block>
            <Block title="🗡️ Will le Bandit">
              <Rule>+2 cartes de la pioche, puis défausse 2 cartes</Rule>
            </Block>
            <Block title="🍰 Rosie la Douce">
              <Rule>Choisis qui commence le prochain pli (toi inclus)</Rule>
            </Block>
            <Block title="🔮 Juanita Jade">
              <Rule>Regarde secrètement les cartes non distribuées</Rule>
            </Block>
            <Block title="💪 Harry le Géant">
              <Rule>Modifie ta mise de +1, -1 ou laisse-la telle quelle</Rule>
            </Block>
            <Block title="🌊 Mary Thorne">
              <Rule>Choisit Marée haute ou basse pour le prochain tour</Rule>
              <Rule>Haute : 0/14 valent 14, Drapeau/Pirate = Pirate</Rule>
              <Rule>Basse : 0/14 valent 0, Drapeau/Pirate = Drapeau</Rule>
            </Block>
          </div>

          {/* Cartes blanches */}
          <div id="rules-blanches" className="scroll-mt-4 space-y-2">
            <div className="section-title">⬜ Cartes Blanches</div>
            <Block>
              <Rule>Jouables à tout moment — prennent la couleur demandée dans le pli</Rule>
            </Block>
            <Block title="🍾 Bouteille à la mer">
              <Rule>Le joueur avec la carte la plus faible commence le prochain pli</Rule>
            </Block>
            <Block title="😈 Le Roublard (1 blanc)">
              <Rule>Récupère toutes les Pièces Maudites du pli à la place de celui qui les a posées</Rule>
            </Block>
            <Block title="🎨 Les Barils / 4 Couleurs">
              <Rule>Annonce la couleur demandée du prochain pli — devient un 4 de cette couleur</Rule>
            </Block>
            <Block title="🔭 La Longue Vue (5 blanc)">
              <Rule>Les joueurs avec la carte la plus faible montrent leur main — tu en vois une secrètement</Rule>
            </Block>
            <Block title="🐙 La Barre Possédée (7 blanc)">
              <Rule>Résolution du pli inversée (dernière → première carte)</Rule>
              <Rule>La couleur demandée reste la première posée</Rule>
            </Block>
            <Block title="⚓ L'Ancre (6 blanc)">
              <Rule>Au prochain pli, chiffres inversés : le 1 bat le 14</Rule>
              <Rule>Les pirates restent supérieurs aux chiffres</Rule>
            </Block>
            <Block title="🎯 Le Harpon (3 ou 10 blanc)">
              <Rule>Annonce la valeur exacte de la carte qui a remporté le pli précédent</Rule>
              <Rule>Si tu oublies → sac de la honte | inutilisable au 1er tour ou après Kraken</Rule>
            </Block>
            <Block title="🥈 Jean-Marc (11 blanc)">
              <Rule>La 2ème carte la plus forte remporte le pli à la place de la 1ère</Rule>
              <Rule>Effet uniquement sur les cartes chiffrées</Rule>
            </Block>
            <Block title="👁️ La Vigie">
              <Rule>Le gagnant du pli te montre sa main → tu en vois une secrètement</Rule>
            </Block>
            <Block title="🧭 La Boussole (13 blanc)">
              <Rule>Au prochain pli, on joue dans le sens inverse</Rule>
            </Block>
            <Block title="🤢 Mal de mer">
              <Rule>Le 14 prend le bonus selon la couleur demandée</Rule>
              <Rule>Modifie les pouvoirs des pirates gagnants (Harry obligatoire ±1, Rascal auto +20…)</Rule>
            </Block>
            <Block title="🔫 Le Mousquet (3 ou 10)">
              <Rule>En présence du Marchand : échange le Marchand par la dernière carte de la pioche</Rule>
              <Rule>Deux Mousquets dans le pli : chacun est retourné avec la carte du dessous</Rule>
            </Block>
            <Block title="💀 Le Marchand">
              <Rule>Échange une carte du terrain par la 1ère carte de la pioche</Rule>
              <Rule>Peut échanger sa propre carte | SK non affecté | pouvoir obligatoire</Rule>
            </Block>
            <Block title="🐒 Richard le Sauvage (atout 15)">
              <Rule>Valeur 15, couleur jaune/violet/vert (jamais noir)</Rule>
              <Rule>Si couleur demandée = noir → le joueur choisit une alternative</Rule>
            </Block>
            <Block title="🪵 La Planche">
              <Rule>Ne remporte jamais de pli</Rule>
              <Rule>Le premier pirate joué après la Planche est annulé</Rule>
            </Block>
            <Block title="💣 Max Jones">
              <Rule>Ne remporte jamais de pli</Rule>
              <Rule>Détruit tous les Monstres Marins du pli → +20 pts par monstre</Rule>
              <Rule>Le pli est remporté par la carte restante la plus forte</Rule>
            </Block>
            <Block title="💥 Le Canon">
              <Rule>Ne remporte jamais de pli</Rule>
              <Rule>Tu rejoues une carte à la fin du pli → une carte de moins ensuite</Rule>
            </Block>
          </div>

          {/* Mousses */}
          <div id="rules-mousses" className="scroll-mt-4 space-y-2">
            <div className="section-title">👶 Les Mousses</div>
            <Block>
              <Rule>Perdent contre SK, Sirènes et Pirates</Rule>
              <Rule>Si les deux Mousses sont dans le même pli, leurs deux pouvoirs s'appliquent</Rule>
            </Block>
            <Block title="🔴 Mousse Rouge">
              <Rule>Les bonus du pli se transforment en malus (sauf pièces d'or)</Rule>
            </Block>
            <Block title="🟡 Mousse d'Or">
              <Rule>+10 si 2 couleurs différentes | +20 si 3 | +30 si 4</Rule>
              <Rule>Cartes blanches ne comptent pas | pas de points avec la Baleine</Rule>
            </Block>
          </div>

          {/* Léviathans */}
          <div id="rules-leviathans" className="scroll-mt-4 space-y-2">
            <div className="section-title">🦑 Léviathans des profondeurs</div>
            <Block title="🦑 Kraken (×1)">
              <Rule>Pli entièrement détruit — personne ne gagne, cartes sous la pioche</Rule>
              <Rule>Le prochain pli est lancé par celui qui aurait dû gagner</Rule>
            </Block>
            <Block title="🐋 Baleine Blanche (×1)">
              <Rule>La carte au numéro le plus élevé remporte, quelle que soit la couleur</Rule>
              <Rule>Égalité → première carte jouée l'emporte</Rule>
              <Rule>Si que des cartes spéciales → pli défaussé comme le Kraken</Rule>
            </Block>
            <Block title="Kraken vs Baleine">
              <Rule>Si les deux dans le même pli → la deuxième carte jouée l'emporte</Rule>
            </Block>
          </div>

          {/* Pièces maudites */}
          <div id="rules-pieces" className="scroll-mt-4 space-y-2">
            <div className="section-title">🪙 Pièces Maudites</div>
            <Block>
              <Rule>Lie le joueur qui pose les pièces et celui qui gagne le pli</Rule>
              <Rule>Les deux réussissent / les deux ratent → rien ne se passe</Rule>
              <Rule>L'un réussit, l'autre rate → le gagnant vole 20 pts au perdant</Rule>
            </Block>
          </div>

          {/* Interactions */}
          <div id="rules-interactions" className="scroll-mt-4 space-y-2">
            <div className="section-title">⚠️ Interactions spéciales</div>
            <Block title="Baleine × Jean-Marc">
              <Rule>JM (11 blanc) seul chiffre pendant la Baleine → pli annulé</Rule>
            </Block>
            <Block title="Second × Harpon">
              <Rule>Si le Second mange le Harpon, il ne récupère pas son pouvoir de pirate</Rule>
            </Block>
            <Block title="Rosie × Bouteille à la mer">
              <Rule>Rosie remporte le pli avec la Bouteille → pouvoir de Rosie prioritaire</Rule>
            </Block>
          </div>

          {/* Parlante */}
          <div id="rules-parlante" className="scroll-mt-4 space-y-2">
            <div className="section-title">🤫 La règle Parlante</div>
            <Block>
              <Rule>Tu influences le jeu de façon évidente pour couler quelqu'un</Rule>
              <Rule>Tu te trompes de carte et un autre joueur le remarque avant toi</Rule>
              <Rule>Tu joues avant ton tour</Rule>
              <Rule>Tu râles comme Raphaël</Rule>
              <p className="text-sm text-red-400 mt-2 font-semibold">→ Tu pioches dans le sac de la honte !</p>
            </Block>
          </div>

          {/* Lien PDF */}
          <div className="pt-2 border-t border-white/10 text-center">
            <a
              href="/regleskull.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-accent opacity-70 hover:opacity-100 transition-opacity"
            >
              📄 Ouvrir le PDF des règles officielles
            </a>
          </div>

        </div>
      </div>
    </>
  );
}
