// Contenu unique des règles du jeu — utilisé par la page Règles ET le tiroir latéral.
// Source : public/regleskull.pdf (règles maison, extension Mutinerie incluse).

export interface RuleSection {
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

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-xs opacity-50 mt-1">{children}</p>;
}

export const rulesSections: RuleSection[] = [
  {
    id: 'deroulement',
    icon: '🏁',
    title: 'Déroulement',
    content: (
      <div className="space-y-3">
        <Block title="Les bases">
          <Rule>La partie se joue en <strong>10 manches</strong> : 1 carte distribuée à la manche 1, 2 à la manche 2… jusqu'à 10 cartes à la manche 10</Rule>
          <Rule>Toutes les cartes (y compris celles jouées) sont remélangées entre chaque manche</Rule>
          <Rule>Une manche = autant de plis que de cartes distribuées</Rule>
          <Note>Journal de bord : une fois que Steve a fini de distribuer, recomptez vos cartes face cachée. Il se trompe toujours.</Note>
        </Block>
        <Block title="Parier">
          <Rule>Après avoir vu vos cartes, estimez le nombre <strong>exact</strong> de plis que vous pensez remporter</Rule>
          <Rule>Tout le monde révèle sa mise en même temps : frappez trois fois du poing, puis tendez autant de doigts que votre mise (poing fermé = zéro)</Rule>
          <Rule>Vous misez plus de 5 ? Utilisez vos deux mains. Comme Raphaël, vous pouvez bluffer en misant 0 avec les deux mains</Rule>
          <Rule>Un joueur note toutes les mises sur l'appli</Rule>
        </Block>
        <Block title="Tour de jeu">
          <Rule>Le premier joueur pose une carte face visible, puis chacun joue dans le sens horaire</Rule>
          <Rule>La carte la plus forte remporte le pli — le gagnant entame le pli suivant</Rule>
          <Rule>En fin de manche, on inscrit les scores (bonus et malus compris), puis le rôle de donneur passe au joueur suivant</Rule>
          <Rule>Les jetons de classement (1er, 2e, 3e, 4e) sont placés devant les joueurs <strong>à partir de la cinquième manche</strong></Rule>
          <Rule>Après la dixième manche, le meilleur score est élu <strong>Capitaine des Sept Mers</strong> !</Rule>
        </Block>
      </div>
    ),
  },
  {
    id: 'scoring',
    icon: '🏆',
    title: 'Décompte des points',
    content: (
      <div className="space-y-3">
        <Block title="Miser sur 1 ou plus">
          <Rule>Pari <strong>réussi</strong> : +20 pts par pli remporté</Rule>
          <Rule>Pari <strong>raté</strong> : −10 pts par pli d'écart (et aucun point pour les plis remportés)</Rule>
          <Note>Ex : mise 3, réalise 3 → +60 pts | mise 2, réalise 4 → −20 pts</Note>
          <Note>Règle maison : interdit de demander plus de 5 plis pour Sami. Les autres sont intelligents et ne le font pas d'eux-mêmes.</Note>
        </Block>
        <Block title="Miser sur zéro">
          <Rule>Aucun pli remporté : +10 pts × numéro de la manche</Rule>
          <Rule>Au moins 1 pli remporté : −10 pts × numéro de la manche</Rule>
          <Note>Ex : mise 0 à la manche 7 → +70 pts si 0 pli, −70 pts sinon</Note>
          <Note>Règle maison : si Sami passe sous −300, il est banni du Skull King.</Note>
        </Block>
        <Block title="Points bonus (uniquement si pari réussi)">
          <Rule>Les 14, 8 et 7 comptent s'ils sont <strong>dans vos plis remportés</strong> en fin de manche, peu importe qui les a joués</Rule>
          <Rule>+10 pts par 14 classique (vert, jaune, violet) | +20 pts pour le 14 noir</Rule>
          <Rule>+5 pts par 8 (toutes couleurs) | −5 pts par 7 (toutes couleurs)</Rule>
          <Rule>+20 pts par sirène capturée par un pirate</Rule>
          <Rule>+30 pts par pirate capturé par le Skull King</Rule>
          <Rule>+30 pts par Second capturé par le Skull King ou une sirène</Rule>
          <Rule>+40 pts si votre sirène capture le Skull King</Rule>
          <Note>L'ordre dans lequel les cartes sont jouées ne change rien à l'attribution de ces bonus.</Note>
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
          <Rule>La première carte de couleur jouée fixe la <strong>couleur demandée</strong> : il faut la suivre si on en possède</Rule>
          <Rule>La carte la plus haute de la couleur demandée remporte le pli</Rule>
          <Rule>Une autre couleur (hors atout) ne peut pas gagner, même avec une valeur plus élevée</Rule>
          <Rule>Le noir (atout) bat toutes les autres couleurs, même les valeurs supérieures</Rule>
          <Rule>Sans la couleur demandée en main, jouez n'importe quelle carte</Rule>
          <Rule>Les cartes sans numéro ne sont pas obligées de suivre la couleur</Rule>
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
        <Block title="🏴‍☠️ Pirates (×7)">
          <Rule>Battent toutes les cartes numérotées</Rule>
          <Rule>Si plusieurs pirates dans un pli, le premier joué gagne</Rule>
          <Rule>Chaque pirate a un pouvoir (voir section suivante) : Joker, Rascal, Will, Rosie, Juanita, Harry et Mary Thorne</Rule>
        </Block>
        <Block title="🧜‍♀️ Sirènes (×2)">
          <Rule>Battent toutes les cartes numérotées et le Skull King, mais perdent contre les pirates</Rule>
          <Rule>Si les deux sirènes sont dans le même pli, la première jouée gagne</Rule>
          <Rule>Skull King + pirate + sirène dans le même pli → la sirène gagne toujours, quel que soit l'ordre</Rule>
        </Block>
        <Block title="👑 Skull King (×1)">
          <Rule>Bat toutes les cartes numérotées et tous les pirates (y compris la Tigresse jouée en pirate)</Rule>
          <Rule>Seules les sirènes peuvent le vaincre</Rule>
        </Block>
        <Block title="🦜 Le Second (×1)">
          <Rule>Bat tous les pirates, mais perd contre les sirènes et le Skull King</Rule>
          <Rule>Permet d'utiliser les pouvoirs de tous les pirates capturés dans le pli</Rule>
          <Rule>Ne rapporte <strong>pas</strong> de bonus pour les pirates qu'il capture</Rule>
          <Rule>+30 pts pour la sirène ou le Skull King qui le capture</Rule>
        </Block>
        <Block title="🐯 Tigresse (×1)">
          <Rule>Au moment de la jouer, tu choisis : Pirate OU Drapeau</Rule>
          <Rule>Elle possède alors toutes les caractéristiques du camp choisi</Rule>
        </Block>
        <Block title="🚩 Drapeau (×5)">
          <Rule>Perd contre toutes les autres cartes — parfait pour sécuriser sa mise</Rule>
          <Rule>Si tout le monde joue un drapeau (ou équivalent), la première carte jouée gagne</Rule>
        </Block>
      </div>
    ),
  },
  {
    id: 'pouvoirs',
    icon: '✨',
    title: 'Pouvoirs des Pirates',
    content: (
      <div className="space-y-2">
        <Block title="🃏 Joker le Mystérieux">
          <Rule>Montré après l'annonce des mises → pioche une carte supplémentaire</Rule>
          <Rule>Mise 0 réussie en ayant montré le Joker → +20 pts bonus</Rule>
        </Block>
        <Block title="🎰 Rascal le Flambeur">
          <Rule>Parie 0, 10 ou 20 pts supplémentaires : gagnés si ton contrat réussit, perdus sinon</Rule>
        </Block>
        <Block title="🗡️ Will le Bandit">
          <Rule>Ajoute 2 cartes de la pioche à ta main, puis défausse 2 cartes</Rule>
        </Block>
        <Block title="🍰 Rosie la Douce">
          <Rule>Choisis n'importe quel joueur (toi compris) pour commencer le prochain pli</Rule>
        </Block>
        <Block title="🔮 Juanita Jade">
          <Rule>Regarde secrètement les cartes non distribuées</Rule>
        </Block>
        <Block title="💪 Harry le Géant">
          <Rule>Modifie ta mise de +1 ou −1, ou laisse-la telle quelle</Rule>
        </Block>
        <Block title="🌊 Mary Thorne">
          <Rule>Choisis Marée haute ou Marée basse pour le prochain tour</Rule>
          <Rule>Marée haute : les 0/14 valent 14, les Drapeau/Pirate comptent comme Pirate</Rule>
          <Rule>Marée basse : les 0/14 valent 0, les Drapeau/Pirate comptent comme Drapeau</Rule>
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
          <Rule>Jouables à tout moment — elles prennent la couleur demandée du pli</Rule>
          <Rule>Leur pouvoir s'applique <strong>obligatoirement</strong></Rule>
        </Block>
        <Block title="😈 Le Roublard (1 blanc)">
          <Rule>Si des Pièces Mauduites sont dans le pli, c'est lui qui les récupère à la place de celui qui les a posées</Rule>
          <Rule>Il devient alors le porteur de la malédiction, lié au joueur qui remporte le pli</Rule>
        </Block>
        <Block title="🔫 Le Mousquet (3 et 10 blanc)">
          <Rule>Effet uniquement en présence du Marchand : échange le Marchand contre la dernière carte de la pioche</Rule>
          <Rule>Joué avant le Marchand, il le neutralise avant que son pouvoir s'active</Rule>
          <Rule>Les deux Mousquets dans le même pli : chacun est retourné avec la carte du dessous, en commençant par le premier posé</Rule>
        </Block>
        <Block title="🎨 Les Barils / 4 Couleurs (4 blanc)">
          <Rule>Annonce la couleur qui sera demandée au <strong>prochain</strong> pli (la Barre et l'Ancre prendront cette couleur)</Rule>
          <Rule>Devient un 4 de la couleur demandée du pli <strong>en cours</strong> (si elle change, le 4 change avec)</Rule>
          <Rule>Pli composé uniquement de cartes nulles : Drapeau &lt; Pièce &lt; carte défaussée</Rule>
        </Block>
        <Block title="🔭 La Longue Vue (5 blanc)">
          <Rule>Les joueurs ayant joué la carte la plus faible du pli te donnent leur main : tu mélanges, regardes une carte en secret, remélanges et rends le tout</Rule>
          <Rule>En cas d'égalité sur la carte la plus faible, tous les joueurs concernés y passent</Rule>
          <Rule>Attention à ne pas être toi-même le plus faible : elle ne vaut que 5 !</Rule>
        </Block>
        <Block title="⚓ L'Ancre (6 blanc)">
          <Rule>Au prochain pli, les chiffres sont inversés : le 1 devient plus fort que le 15</Rule>
          <Rule>La puissance des couleurs reste respectée, et les pirates restent supérieurs aux chiffres</Rule>
          <Rule>Devient un 6 de la couleur demandée (si elle change, le 6 change avec)</Rule>
        </Block>
        <Block title="🐙 La Barre Possédée (7 blanc)">
          <Rule>La résolution du pli est inversée : on la fait de la dernière carte jouée vers la première</Rule>
          <Rule>Pendant le pli, la couleur demandée reste la première posée</Rule>
          <Rule>Devient un 7 de la couleur demandée (si elle change, le 7 change avec)</Rule>
          <Rule>La résolution inversée prend le dessus sur la couleur annoncée par le 4 Couleurs</Rule>
        </Block>
        <Block title="🎯 Le Harpon (8 blanc)">
          <Rule>En posant la carte, annonce la valeur <strong>exacte</strong> de celle qui a remporté le pli précédent — si tu oublies, sac de la honte !</Rule>
          <Rule>Permet de repêcher un pirate gagnant du pli précédent et de réutiliser son pouvoir</Rule>
          <Rule>Joué au premier pli ou juste après un Kraken : il perd tout son pouvoir et ne vaut plus que son 8 blanc</Rule>
          <Rule>Ne provoque ni bonus ni malus pour l'adversaire, et les bonus +10/+20 des 14 ne s'appliquent pas</Rule>
        </Block>
        <Block title="🥈 Jean-Marc (11 blanc)">
          <Rule>La <strong>deuxième</strong> carte la plus forte remporte le pli à la place de la première</Rule>
          <Rule>Effet uniquement si la carte normalement gagnante est une carte chiffrée, sinon résolution normale</Rule>
        </Block>
        <Block title="👁️ La Vigie (12 blanc)">
          <Rule>Le gagnant du pli te donne sa main : tu mélanges, regardes une carte en secret, remélanges et rends le tout</Rule>
        </Block>
        <Block title="🧭 La Boussole (13 blanc)">
          <Rule>Au prochain pli, on joue dans le sens inverse</Rule>
          <Rule>Devient un 13 de la couleur demandée (si elle change, le 13 change avec)</Rule>
        </Block>
        <Block title="🤢 Mal de mer (14 blanc)">
          <Rule>Effet uniquement si la carte est remportée par un pirate</Rule>
          <Rule>Le 14 prend le bonus de la couleur demandée (noir demandé → +20)</Rule>
          <Rule>Harry : modification de mise obligatoire (±1) | Rosie : joueur tiré aux dés | Rascal : pari automatique de +20</Rule>
          <Rule>Will : pioche 1 carte au-dessus, repose 1 carte en dessous | Joker : repose une carte en trop sous le paquet</Rule>
          <Rule>Tigresse : tous les bonus/malus du pli sont annulés | Juanita : divination brouillée (sauf les 10 premières cartes) | Mary : marée tirée à pile ou face</Rule>
        </Block>
        <Block title="💀 Le Marchand">
          <Rule>Échange une carte du terrain (la sienne comprise) contre la première carte de la pioche</Rule>
          <Rule>Le Skull King n'est pas affecté | son pouvoir est obligatoire</Rule>
        </Block>
        <Block title="🐒 Richard le Sauvage (valeur 15)">
          <Rule>Carte d'atout de valeur 15 — représente le jaune, le violet ou le vert, jamais le noir</Rule>
          <Rule>Si une couleur est déjà demandée, il l'adopte ; sinon le joueur la choisit ; si le noir est demandé, il annonce une couleur de repli</Rule>
          <Rule>Face à la Baleine : règles normales, le 15 reste la valeur la plus haute et remporte le pli</Rule>
        </Block>
        <Block title="🪵 La Planche">
          <Rule>Ne remporte jamais de pli</Rule>
          <Rule>Le premier pirate joué après elle est annulé (les suivants ne sont pas affectés)</Rule>
          <Rule>Un pirate annulé ne rapporte aucun bonus au Skull King qui remporte le pli</Rule>
          <Rule>Si la Barre inverse le sens, le pirate annulé est déterminé selon le nouveau sens</Rule>
        </Block>
        <Block title="💣 Max Jones">
          <Rule>Ne remporte jamais de pli</Rule>
          <Rule>Détruit tous les Monstres Marins présents dans le pli (sans bonus de points)</Rule>
          <Rule>Les monstres détruits et Max Jones sont retirés du pli, la carte restante la plus forte l'emporte</Rule>
        </Block>
        <Block title="💥 Le Canon">
          <Rule>Ne remporte jamais de pli</Rule>
          <Rule>Tu rejoues une carte à la fin du pli, ajoutée après toutes les autres (le Canon reste dans le pli)</Rule>
          <Rule>Tu as donc une carte de moins : tu ne joueras pas le dernier pli de la manche</Rule>
        </Block>
        <Block title="🍾 Bouteille à la Mer (2 blanc)">
          <Rule>Le joueur ayant joué la carte la plus faible du pli commence le prochain pli</Rule>
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
          <Rule>Deux jumeaux qui perdent contre le Skull King, les sirènes et les pirates</Rule>
          <Rule>S'ils sont tous les deux dans le même pli : force égale, et leurs deux pouvoirs s'appliquent</Rule>
        </Block>
        <Block title="🟡 Mousse d'Or">
          <Rule>Bonus selon le nombre de couleurs différentes dans le pli : +10 (2 couleurs), +20 (3), +30 (4)</Rule>
          <Rule>Les cartes blanches ne comptent pas comme des couleurs</Rule>
          <Rule>Aucun point en présence de la Baleine</Rule>
        </Block>
        <Block title="🔴 Mousse Rouge">
          <Rule>Les bonus du pli se transforment en malus (les pièces d'or ne sont pas touchées)</Rule>
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
          <Rule>Le pli est entièrement détruit : personne ne le gagne, les cartes sont mélangées puis remises sous la pioche</Rule>
          <Rule>Le pli suivant est lancé par le joueur à gauche de celui qui a joué le Kraken</Rule>
        </Block>
        <Block title="🐋 Baleine Blanche (×1)">
          <Rule>Les cartes spéciales sont détruites et ne peuvent pas gagner</Rule>
          <Rule>La carte au numéro le plus élevé remporte le pli, quelle que soit la couleur (égalité → première jouée)</Rule>
          <Rule>S'il n'y a que des cartes spéciales, le pli est défaussé (comme le Kraken) et celui qui a joué la Baleine commence le pli suivant</Rule>
          <Note>Ex : 2 noir, Pirate, 14 jaune, Skull King, Baleine → le 14 jaune gagne !</Note>
        </Block>
        <Block title="Kraken vs Baleine">
          <Rule>Vieux ennemis : si les deux sont dans le même pli, la deuxième carte jouée gagne la bataille et applique son effet</Rule>
        </Block>
      </div>
    ),
  },
  {
    id: 'pieces',
    icon: '🪙',
    title: 'Pièces Mauduites',
    content: (
      <Block>
        <Rule>Le joueur qui pose une Pièce Mauduite et celui qui remporte le pli sont liés par le destin</Rule>
        <Rule>Les deux réussissent leur pari → rien ne se passe</Rule>
        <Rule>Les deux ratent leur pari → rien ne se passe</Rule>
        <Rule>L'un réussit et l'autre chute → le gagnant vole 20 pts au perdant</Rule>
      </Block>
    ),
  },
  {
    id: 'interactions',
    icon: '⚠️',
    title: 'Interactions spéciales',
    content: (
      <div className="space-y-2">
        <Block title="Baleine × Jean-Marc">
          <Rule>Si Jean-Marc (11 blanc) est le seul chiffre pendant la Baleine → pli annulé</Rule>
        </Block>
        <Block title="Second × Harpon">
          <Rule>Si le Second capture le Harpon (utilisé comme pirate), il ne peut pas récupérer son pouvoir</Rule>
        </Block>
        <Block title="Rosie × Bouteille à la mer">
          <Rule>Si la Bouteille à la mer se trouve dans un pli remporté par Rosie, le pouvoir de Rosie est prioritaire</Rule>
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
        <p className="text-sm opacity-70 mb-2">
          C'est à toi de suivre le jeu : inutile de demander qui a mis telle ou telle carte, personne ne te répondra.
          La parlante s'applique entre la première et la dernière carte posées de la manche :
        </p>
        <Rule>Tu influences le jeu de manière évidente pour couler quelqu'un ou sauver tes fesses</Rule>
        <Rule>Tu te trompes de carte (ex : mauvaise couleur) et un autre joueur le remarque avant toi</Rule>
        <Rule>Tu joues avant ton tour</Rule>
        <Rule>Tu râles comme Raphaël</Rule>
        <p className="text-sm text-red-400 mt-2 font-semibold">→ Les plus rebelles piochent un trésor dans le sac de la honte !</p>
      </Block>
    ),
  },
];
