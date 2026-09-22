# 🏴‍☠️ Skull King Scoreboard

Application web de suivi des scores pour le jeu de cartes **Skull King**, en mode multijoueur local sur réseau.

## Fonctionnalités

- 🎮 **Multijoueur en temps réel** via WebSocket — plusieurs téléphones sur le même réseau
- 📱 **QR Code** pour rejoindre une salle instantanément
- 🏆 **Gestion complète des manches** — paris, révélation, résultats, classement
- 📊 **Vue d'ensemble** des scores par manche avec modification possible
- 🎒 **Sac de la honte** — pénalités -10 / -20 pts applicables par l'hôte
- 👑 **Joueurs gérés par l'hôte** — pour les joueurs sans téléphone
- ✏️ **Correction des scores** — l'hôte peut modifier n'importe quelle manche passée
- 🔀 **Ordre aléatoire** des joueurs
- 📜 **Historique** des parties terminées, conservé 30 jours sur le serveur
- 🔒 **Accès admin** — suppression de parties dans l'historique (mot de passe haché argon2id)
- 📴 **PWA** — installable sur l'écran d'accueil iOS/Android

## Stack technique

| Côté | Technologie |
|------|------------|
| Runtime | [Bun](https://bun.sh) |
| Serveur | Bun HTTP + WebSocket natif |
| Frontend | React 18 + TypeScript + Vite |
| Routing | React Router 7 |
| État global | Zustand |
| Style | Tailwind CSS |
| PWA | Vite PWA + Workbox |
| Base de données | Aucune — tout en RAM |

## Installation

```bash
# Cloner le repo
git clone https://github.com/JeSuisBob2/SKULL-KING-SCOREBOARD.git
cd SKULL-KING-SCOREBOARD

# Installer les dépendances
bun install

# Builder le frontend
VITE_BASE=/ bun run build

# Lancer le serveur
bun server.ts
```

L'application sera accessible sur `http://localhost:2456`.

## Accès admin

L'accès admin ajoute une seule possibilité : **supprimer une partie de l'historique**. Tout le reste
du jeu est inchangé.

```bash
# 1. Définir le mot de passe (saisie interactive) — le script écrit le hachage dans .env
bun scripts/hash-admin-password.ts

# 2. Relancer le serveur
bun server.ts
```

Le serveur affiche au démarrage si l'accès admin est actif. Ensuite, dans l'app : accueil →
**Historique des parties** → **🔒 Admin** en bas de la liste.

Choix de sécurité :

- Le mot de passe n'est **jamais stocké** : seul son hachage **argon2id** est lu depuis `.env`, qui est ignoré par git. Laissez le script écrire cette ligne — les `$` du hachage doivent y être échappés, sinon le lecteur de `.env` les interprète comme des variables.
- La connexion renvoie un **jeton de session** aléatoire (256 bits) valable 12 h, gardé **en mémoire** côté serveur — un redémarrage invalide toutes les sessions.
- **5 tentatives** ratées par adresse IP entraînent un blocage de 15 minutes ; le mot de passe saisi n'est jamais écrit dans les logs.
- Sans `SK_ADMIN_PASSWORD_HASH`, l'accès admin est **complètement désactivé** (aucun mot de passe par défaut).
- Le mot de passe circule chiffré via HTTPS/WSS sur le domaine public. En accès direct `http://ip:2456` (réseau local), il circule en clair : utilisez un mot de passe dédié à ce serveur.

## Architecture réseau

```
Téléphones (navigateur)
        ↕ WebSocket + HTTP
    Bun Server :2456
        ↕ Reverse proxy
  Nginx Proxy Manager
        ↕ DNS proxy
     Cloudflare
        ↕
  skullking.jesuisbob.fr
```

## Déploiement

Le projet tourne sur un serveur Debian local avec :
- **Nginx Proxy Manager** comme reverse proxy (HTTPS)
- **Cloudflare** pour le DNS et le cache

## Licence

Projet personnel — non affilié aux créateurs de Skull King.
