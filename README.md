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
