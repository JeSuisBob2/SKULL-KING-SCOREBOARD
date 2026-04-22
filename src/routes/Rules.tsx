import Layout from '../components/Layout';

interface Section {
  id: string;
  icon: string;
  title: string;
  content: React.ReactNode;
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

const sections: Section[] = [
  {
    id: 'scoring',
    icon: '🏆',
    title: 'Décompte des points',
    content: (
      <div className="space-y-3">
        <Block title="Miser sur 1 ou plus">
          <Rule>Pari <strong>réussi</strong> : +20 pts × nombre de plis misés</Rule>
          <Rule>Pari <strong>raté</strong> : -10 pts × écart entre plis misés et réalisés</Rule>
          <p className="text-xs opacity-50 mt-1">Ex : mise 3, réalise 3 → +60 pts | mise 2, réalise 4 → -20 pts</p>
        </Block>
        <Block title="Miser sur zéro">
          <Rule>Zéro pli réalisé : +10 pts × numéro de la manche</Rule>
          <Rule>Au moins 1 pli réalisé : -10 pts × numéro de la manche</Rule>
          <p className="text-xs opacity-50 mt-1">Ex : mise 0 à la manche 7, 0 pli → +70 pts | 2 plis → -70 pts</p>
        </Block>
        <Block title="Points bonus (si pari réussi)">
          <Rule>+10 pts par 14 classique (vert/jaune/violet) en main en fin de manche</Rule>
          <Rule>+20 pts pour le 14 noir en main en fin de manche</Rule>
          <Rule>-5 pts par 7 classique en main</Rule>
          <Rule>+5 pts par 8 classique en main</Rule>
          <Rule>-5 pts pour le 7 noir | +5 pts pour le 8 noir</Rule>
          <Rule>+20 pts par sirène capturée par un pirate</Rule>
          <Rule>+30 pts par pirate capturé par le Skull King</Rule>
          <Rule>+30 pts par Second capturé par le Skull King ou une sirène</Rule>
          <Rule>+40 pts si votre sirène capture le Skull King</Rule>
        </Block>
      </div>
    ),
  },
  {
    id: 'cartes-couleur',
    icon: '🃏',
    title: 'Cartes de couleur',
    content: (
      <div className="space-y-3">
        <Block>
          <Row label="🟢 Vert">Perroquet (1–14)</Row>
          <Row label="🟡 Jaune">Coffre (1–14)</Row>
          <Row label="🟣 Violet">Carte au trésor (1–14)</Row>
          <Row label="⬛ Noir">Drapeau pirate — ATOUT (1–14)</Row>
        </Block>
        <Block title="Règles">
          <Rule>La carte la plus haute de la couleur demandée remporte le pli</Rule>
          <Rule>Le noir (atout) bat toutes les autres couleurs, même les plus hautes valeurs</Rule>
          <Rule>Si tu n'as pas la couleur demandée, tu peux jouer n'importe quelle carte</Rule>
          <Rule>Les cartes sans numéro (spéciales) peuvent être jouées à tout moment</Rule>
        </Block>
      </div>
    ),
  },
  {
    id: 'personnages',
    icon: '⚔️',
    title: 'Cartes Personnage',
    content: (
      <div className="space-y-2">
        <Block title="🏴‍☠️ Pirate (×6 dont Tigresse)">
          <Rule>Bat toutes les cartes numérotées</Rule>
          <Rule>Si plusieurs pirates dans un pli, le premier joué gagne</Rule>
        </Block>
        <Block title="🧜‍♀️ Sirène (×2)">
          <Rule>Bat toutes les cartes numérotées</Rule>
          <Rule>Perd contre les pirates SAUF contre le Skull King</Rule>
          <Rule>Si deux sirènes dans un pli, la première jouée gagne</Rule>
          <Rule>Si Skull King + pirate + sirène dans le même pli → la sirène gagne toujours</Rule>
        </Block>
        <Block title="👑 Skull King (×1)">
          <Rule>Bat tous les pirates (y compris Tigresse en pirate)</Rule>
          <Rule>Seules les sirènes peuvent le battre</Rule>
        </Block>
        <Block title="🦜 Le Second (×1)">
          <Rule>Bat tous les pirates, perd contre les sirènes et le Skull King</Rule>
          <Rule>Permet d'utiliser les pouvoirs des pirates capturés dans le pli</Rule>
          <Rule>+30 pts si capturé par une sirène ou le Skull King</Rule>
        </Block>
        <Block title="🐯 Tigresse (×1)">
          <Rule>Au moment de jouer, tu choisis : Pirate OU Drapeau</Rule>
          <Rule>Elle possède alors toutes les caractéristiques du pouvoir choisi</Rule>
        </Block>
        <Block title="🚩 Drapeau (×5)">
          <Rule>Perd contre toutes les autres cartes — sert à ne pas prendre de pli</Rule>
          <Rule>Si tous les joueurs jouent un drapeau/butin, la première carte jouée gagne</Rule>
        </Block>
      </div>
    ),
  },
  {
    id: 'pouvoirs',
    icon: '✨',
    title: 'Cartes Pouvoir',
    content: (
      <div className="space-y-2">
        <Block title="🃏 Joker le Mystérieux">
          <Rule>Montré après l'annonce des plis → pioche une carte supplémentaire</Rule>
          <Rule>Si mise 0 réussie avec le Joker → +20 pts bonus</Rule>
        </Block>
        <Block title="🎰 Rascal le Flambeur">
          <Rule>Parie 0, 10 ou 20 pts supplémentaires</Rule>
          <Rule>Pari réussi → tu les gagnes | raté → tu les perds</Rule>
        </Block>
        <Block title="🗡️ Will le Bandit">
          <Rule>Ajoute 2 cartes de la pioche à ta main, puis défausse 2 cartes</Rule>
        </Block>
        <Block title="🍰 Rosie la Douce">
          <Rule>Choisis n'importe quel joueur (toi inclus) pour commencer le prochain pli</Rule>
        </Block>
        <Block title="🔮 Juanita Jade">
          <Rule>Regarde secrètement les cartes non distribuées</Rule>
        </Block>
        <Block title="💪 Harry le Géant">
          <Rule>Modifie ta mise de +1, -1 ou laisse-la telle quelle</Rule>
        </Block>
        <Block title="🌊 Mary Thorne">
          <Rule>Choisit Marée haute ou Marée basse pour le prochain tour</Rule>
          <Rule>Marée haute : 0/14 valent 14, Drapeau/Pirate = Pirate</Rule>
          <Rule>Marée basse : 0/14 valent 0, Drapeau/Pirate = Drapeau</Rule>
        </Block>
      </div>
    ),
  },
  {
    id: 'cartes-blanches',
    icon: '⬜',
    title: 'Cartes Blanches',
    content: (
      <div className="space-y-2">
        <Block>
          <Rule>Jouables à tout moment — prennent la couleur demandée dans le pli</Rule>
        </Block>
        <Block title="🍾 Bouteille à la mer">
          <Rule>Le joueur ayant la carte la plus faible du pli commence le prochain tour</Rule>
        </Block>
        <Block title="😈 Le Roublard (1 blanc)">
          <Rule>Récupère toutes les Pièces Maudites du pli à la place de celui qui les a posées</Rule>
        </Block>
        <Block title="🎨 Les Barils (4 Couleurs)">
          <Rule>Annonce la couleur demandée du prochain pli</Rule>
          <Rule>Devient un 4 de cette couleur</Rule>
        </Block>
        <Block title="🔭 La Longue Vue">
          <Rule>Les joueurs ayant la carte la plus faible montrent leur main — tu en regardes une secrètement</Rule>
          <Rule>Valeur 5 blanc — attention à ne pas être le plus faible !</Rule>
        </Block>
        <Block title="🐙 La Barre Possédée (7 blanc)">
          <Rule>La résolution du pli est inversée (de la dernière à la première carte)</Rule>
          <Rule>La couleur demandée reste la première posée</Rule>
        </Block>
        <Block title="⚓ L'Ancre (6 blanc)">
          <Rule>Au prochain pli, les chiffres sont inversés : le 1 devient plus fort que le 14</Rule>
          <Rule>La puissance des pirates reste supérieure aux chiffres</Rule>
        </Block>
        <Block title="🎯 Le Harpon (3 ou 10 blanc)">
          <Rule>Annonce la valeur exacte de la carte qui a remporté le pli précédent</Rule>
          <Rule>Si tu oublies → pioche dans le sac de la honte</Rule>
          <Rule>Inutilisable au 1er tour ou après le Kraken (valeur 8 blanc)</Rule>
        </Block>
        <Block title="🥈 Jean-Marc (11 blanc)">
          <Rule>La 2ème carte la plus forte remporte le pli à la place de la 1ère</Rule>
          <Rule>Effet uniquement sur les cartes chiffrées</Rule>
        </Block>
        <Block title="👁️ La Vigie">
          <Rule>Le joueur qui remporte le pli doit te montrer sa main → tu en regardes une secrètement</Rule>
        </Block>
        <Block title="🧭 La Boussole (13 blanc)">
          <Rule>Au prochain pli, on joue dans le sens inverse</Rule>
        </Block>
        <Block title="🤢 Mal de mer">
          <Rule>Le 14 prend le bonus selon la couleur demandée</Rule>
          <Rule>Modifie les pouvoirs des pirates qui remportent le pli (Harry obligatoire ±1, Rascal automatiquement +20, etc.)</Rule>
        </Block>
        <Block title="🔫 Le Mousquet (3 ou 10)">
          <Rule>Effet uniquement en présence du Marchand — échange le Marchand par la dernière carte de la pioche</Rule>
          <Rule>Deux Mousquets dans le même pli : on retourne chacun avec la carte du dessous</Rule>
        </Block>
        <Block title="💀 Le Marchand">
          <Rule>Échange une carte du terrain par la première carte de la pioche</Rule>
          <Rule>Peut échanger sa propre carte | Le Skull King n'est pas affecté</Rule>
          <Rule>Le Marchand est obligé d'appliquer son pouvoir</Rule>
        </Block>
        <Block title="🐒 Richard le Sauvage (atout 15)">
          <Rule>Carte d'atout valeur 15 — se comporte comme une carte blanche jaune/violet/vert (jamais noir)</Rule>
          <Rule>Si couleur demandée = noir, le joueur annonce une couleur alternative</Rule>
        </Block>
        <Block title="🪵 La Planche">
          <Rule>Ne remporte jamais de pli</Rule>
          <Rule>Le premier pirate joué après la Planche est annulé</Rule>
        </Block>
        <Block title="💣 Max Jones">
          <Rule>Ne remporte jamais de pli</Rule>
          <Rule>Détruit tous les Monstres Marins du pli → +20 pts par monstre détruit</Rule>
          <Rule>Le pli est remporté par la carte restante la plus forte</Rule>
        </Block>
        <Block title="💥 Le Canon">
          <Rule>Ne remporte jamais de pli</Rule>
          <Rule>Tu rejoues une carte à la fin du pli (en plus des autres)</Rule>
          <Rule>Tu as donc une carte de moins pour les tours suivants</Rule>
        </Block>
      </div>
    ),
  },
  {
    id: 'mousses',
    icon: '👶',
    title: 'Les Mousses',
    content: (
      <div className="space-y-2">
        <Block>
          <Rule>Perdent contre Skull King, Sirènes et Pirates</Rule>
          <Rule>Si les deux Mousses sont dans le même pli, leurs deux pouvoirs s'appliquent</Rule>
        </Block>
        <Block title="🔴 Mousse Rouge">
          <Rule>Les bonus du pli se transforment en malus (sauf les pièces d'or)</Rule>
        </Block>
        <Block title="🟡 Mousse d'Or">
          <Rule>+10 pts si 2 couleurs différentes dans le pli</Rule>
          <Rule>+20 pts si 3 couleurs différentes</Rule>
          <Rule>+30 pts si 4 couleurs différentes</Rule>
          <Rule>Les cartes blanches ne comptent pas comme couleur</Rule>
          <Rule>Pas de points en présence de la Baleine</Rule>
        </Block>
      </div>
    ),
  },
  {
    id: 'leviathans',
    icon: '🦑',
    title: 'Léviathans des profondeurs',
    content: (
      <div className="space-y-2">
        <Block title="🦑 Kraken (×1)">
          <Rule>Le pli est entièrement détruit — personne ne gagne</Rule>
          <Rule>Les cartes sont remises sous la pioche</Rule>
          <Rule>Le prochain pli est lancé par le joueur qui aurait dû gagner</Rule>
        </Block>
        <Block title="🐋 Baleine Blanche (×1)">
          <Rule>La carte avec le numéro le plus élevé remporte le pli, quelle que soit la couleur</Rule>
          <Rule>En cas d'égalité, la première carte jouée l'emporte</Rule>
          <Rule>Si seules des cartes spéciales → pli défaussé (comme le Kraken)</Rule>
          <Rule>Ex : 2 noir, Pirate, 14 jaune, Skull King, Baleine → le 14 jaune gagne</Rule>
        </Block>
        <Block title="Kraken vs Baleine">
          <Rule>Si les deux sont dans le même pli, la deuxième carte jouée l'emporte</Rule>
        </Block>
      </div>
    ),
  },
  {
    id: 'pieces',
    icon: '🪙',
    title: 'Pièces Maudites',
    content: (
      <div className="space-y-2">
        <Block>
          <Rule>Le joueur qui pose les pièces et celui qui gagne le pli sont liés par le destin</Rule>
          <Rule>Les deux réussissent leur pari → rien ne se passe</Rule>
          <Rule>Les deux ratent leur pari → rien ne se passe</Rule>
          <Rule>L'un réussit, l'autre rate → le gagnant vole 20 pts au perdant</Rule>
        </Block>
      </div>
    ),
  },
  {
    id: 'interactions',
    icon: '⚠️',
    title: 'Interactions spéciales',
    content: (
      <div className="space-y-2">
        <Block title="Baleine × Jean-Marc">
          <Rule>Si Jean-Marc (11 blanc) est le seul chiffre lors de la Baleine → pli annulé</Rule>
        </Block>
        <Block title="Second × Harpon">
          <Rule>Si le Second mange le Harpon (pirate), il ne peut pas récupérer son pouvoir</Rule>
        </Block>
        <Block title="Rosie × Bouteille à la mer">
          <Rule>Si Rosie remporte le pli contenant la Bouteille à la mer → le pouvoir de Rosie est prioritaire</Rule>
        </Block>
      </div>
    ),
  },
  {
    id: 'parlante',
    icon: '🤫',
    title: 'La règle Parlante',
    content: (
      <Block>
        <Rule>Tu influences le jeu de manière évidente pour couler quelqu'un ou te sauver</Rule>
        <Rule>Tu te trompes de carte et un autre joueur le remarque avant toi</Rule>
        <Rule>Tu joues avant ton tour</Rule>
        <Rule>Tu râles comme Raphaël</Rule>
        <p className="text-sm text-red-400 mt-2 font-semibold">→ Tu pioches un trésor dans le sac de la honte !</p>
      </Block>
    ),
  },
];

export default function Rules() {
  return (
    <Layout title="📖 Règles du jeu">
      <div className="space-y-4 pb-8">
        {/* Navigation rapide */}
        <div className="flex flex-wrap gap-2">
          {sections.map(s => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
            >
              {s.icon} {s.title}
            </a>
          ))}
        </div>

        {sections.map(s => (
          <div key={s.id} id={s.id} className="scroll-mt-20">
            <div className="section-title mb-2">{s.icon} {s.title}</div>
            {s.content}
          </div>
        ))}
      </div>
    </Layout>
  );
}
