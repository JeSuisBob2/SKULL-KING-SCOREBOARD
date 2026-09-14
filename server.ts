// server.ts — Skull King Multiplayer Server (Bun)
// Lance avec : bun server.ts
// Sert les fichiers statiques (dist/) ET gère les WebSockets sur le même port.

import { networkInterfaces } from 'os';
import { writeFileSync, renameSync, readFileSync, existsSync } from 'fs';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoomPlayer {
  id: string;
  name: string;
  isHost: boolean;
  managedByHost?: boolean;
  autoManaged?: boolean;   // contrôle pris par l'hôte suite à une déconnexion (rendu au retour)
  surrendered?: boolean;
  surrenderedAt?: string;
}

interface Room {
  id: string;
  code: string;
  host_player_id: string;
  status: string;
  total_rounds: number;
  current_round: number;
  scoring_preset_id: string;
  players: RoomPlayer[];
  created_at: string;
  updated_at: string;
}

interface Bid {
  id: string;
  room_id: string;
  round_number: number;
  player_id: string;
  bid: number | null;
  harry_adjustment: number;
  joker?: boolean;
  is_ready: boolean;
  ready_at: string | null;
}

interface Result {
  id: string;
  room_id: string;
  round_number: number;
  player_id: string;
  tricks: number;
  bonus: number;
  bonus_details?: number[];
  specials: Record<string, unknown>;
  score: number;
  joker_success?: boolean;
  is_done: boolean;
}

/** Nettoie une liste de bonus reçue du client (nombres finis non nuls uniquement). */
function cleanBonusDetails(raw: unknown): number[] {
  return Array.isArray(raw) ? raw.map(Number).filter(n => Number.isFinite(n) && n !== 0) : [];
}

// ─── State ────────────────────────────────────────────────────────────────────

const rooms        = new Map<string, Room>();
const roomBids     = new Map<string, Bid[]>();
const roomResults  = new Map<string, Result[]>();
const roomShameLog = new Map<string, Array<{ id: string; playerId: string; playerName: string; amount: number; round: number }>>();
// Pouces 👍/👎 donnés par les joueurs, liés à une manche (reset naturel à la manche suivante)
const roomThumbs   = new Map<string, Array<{ id: string; round: number; fromId: string; toId: string; dir: 1 | -1 }>>();
// Spectateurs par salle : lecture seule, jamais dans room.players
const roomSpectators = new Map<string, Array<{ id: string; name: string }>>();

/** Retire tous les spectateurs d'une salle (avec notification de fermeture). */
function dropSpectators(code: string) {
  for (const s of roomSpectators.get(code) ?? []) {
    sendTo(s.id, { type: 'room-deleted' });
    playerToRoom.delete(s.id);
    playerToWs.delete(s.id);
  }
  roomSpectators.delete(code);
}

const playerToRoom = new Map<string, string>(); // playerId → roomCode
const playerToWs   = new Map<string, ReturnType<typeof Bun.serve>['upgrade'] extends (...a: any[]) => any ? any : any>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() { return crypto.randomUUID(); }
function now() { return new Date().toISOString(); }
function log(...args: any[]) {
  const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  console.log(`[${time}]`, ...args);
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(code) ? generateCode() : code;
}

// ─── Persistance disque (survie à un redémarrage / coupure de courant) ─────────
// On sauvegarde uniquement les DONNÉES de jeu. Les sockets (playerToWs) sont
// volontairement exclues : une connexion WebSocket ne survit pas à un redémarrage,
// les joueurs se reconnectent d'eux-mêmes (message 'reconnect').

const SNAPSHOT_FILE = process.env.SK_SAVE_FILE ?? './skullking-save.json';
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Écrit l'état de jeu sur le disque, de façon atomique (.tmp puis renommage). */
function saveSnapshot() {
  try {
    const snapshot = {
      version: 1,
      savedAt: now(),
      rooms:        [...rooms.entries()],
      roomBids:     [...roomBids.entries()],
      roomResults:  [...roomResults.entries()],
      roomShameLog: [...roomShameLog.entries()],
      roomThumbs:   [...roomThumbs.entries()],
      roomSpectators: [...roomSpectators.entries()],
      playerToRoom: [...playerToRoom.entries()],
    };
    const tmp = SNAPSHOT_FILE + '.tmp';
    writeFileSync(tmp, JSON.stringify(snapshot));
    renameSync(tmp, SNAPSHOT_FILE); // renommage atomique : jamais de fichier à moitié écrit
  } catch (e) {
    log('[save] échec de la sauvegarde :', e);
  }
}

/** Sauvegarde différée : les changements rapprochés sont regroupés en une seule écriture. */
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveSnapshot();
    if (historyDirty) saveHistory();
  }, 800);
}

// ─── Historique des parties terminées (conservé 30 jours) ─────────────────────
// Fichier séparé de la sauvegarde des parties en cours : fermer une salle
// n'efface plus la partie de l'historique.

interface HistoryEntry {
  id: string;           // code + date de création (un code peut être réutilisé plus tard)
  finishedAt: string;
  room: Room;
  bids: Bid[];
  results: Result[];
  shameLog: Array<{ id: string; playerId: string; playerName: string; amount: number; round: number }>;
  thumbs: Array<{ id: string; round: number; fromId: string; toId: string; dir: 1 | -1 }>;
}

const HISTORY_FILE = process.env.SK_HISTORY_FILE ?? './skullking-history.json';
const HISTORY_TTL_MS = 30 * 24 * 60 * 60 * 1000;
let history: HistoryEntry[] = [];
let historyDirty = false;

function saveHistory() {
  try {
    const tmp = HISTORY_FILE + '.tmp';
    writeFileSync(tmp, JSON.stringify(history));
    renameSync(tmp, HISTORY_FILE); // même écriture atomique que la sauvegarde principale
    historyDirty = false;
  } catch (e) {
    log('[history] échec de la sauvegarde :', e);
  }
}

/** Supprime les parties terminées depuis plus de 30 jours. Retourne le nombre supprimé. */
function purgeHistory(): number {
  const limit = Date.now() - HISTORY_TTL_MS;
  const before = history.length;
  history = history.filter(e => new Date(e.finishedAt).getTime() > limit);
  const removed = before - history.length;
  if (removed > 0) {
    historyDirty = true;
    log(`[history] ${removed} partie(s) de plus de 30 jours supprimée(s)`);
  }
  return removed;
}

function loadHistory() {
  try {
    if (existsSync(HISTORY_FILE)) {
      const parsed = JSON.parse(readFileSync(HISTORY_FILE, 'utf8'));
      if (Array.isArray(parsed)) history = parsed;
    }
  } catch (e) {
    log('[history] historique illisible, démarrage à vide :', e);
  }
  if (purgeHistory() > 0) saveHistory();
  log(`[history] ${history.length} partie(s) dans l'historique`);
}

/**
 * Archive (ou met à jour) une partie terminée. Appelé à chaque changement d'une
 * salle 'complete', pour que les corrections de l'hôte après la fin soient prises en compte.
 */
function archiveGame(room: Room) {
  const id = `${room.code}-${room.created_at}`;
  const existing = history.find(e => e.id === id);
  const entry: HistoryEntry = {
    id,
    finishedAt: existing?.finishedAt ?? now(),
    room: structuredClone(room),
    bids: structuredClone(roomBids.get(room.code) ?? []),
    results: structuredClone(roomResults.get(room.code) ?? []),
    shameLog: structuredClone(roomShameLog.get(room.code) ?? []),
    thumbs: structuredClone(roomThumbs.get(room.code) ?? []),
  };
  if (existing) Object.assign(existing, entry);
  else {
    history.push(entry);
    log(`[history] partie ${room.code} archivée`);
  }
  historyDirty = true;
}

/** Résumé léger pour la liste (évite d'envoyer tous les paris et résultats). */
function summarizeHistory(e: HistoryEntry) {
  const totalFor = (pid: string) =>
    e.results.filter(r => r.player_id === pid && r.is_done).reduce((s, r) => s + r.score, 0)
    + e.shameLog.filter(x => x.playerId === pid).reduce((s, x) => s + x.amount, 0);
  const players = e.room.players
    .map(p => ({ id: p.id, name: p.name, surrendered: !!p.surrendered, total: totalFor(p.id) }))
    .sort((a, b) => b.total - a.total);
  return { id: e.id, code: e.room.code, finishedAt: e.finishedAt, totalRounds: e.room.total_rounds, players };
}

/** Au démarrage : recharge la dernière sauvegarde si elle existe. */
function loadSnapshot() {
  try {
    if (!existsSync(SNAPSHOT_FILE)) {
      log('[load] aucune sauvegarde — démarrage à vide');
      return;
    }
    const snap = JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf8'));
    for (const [k, v] of snap.rooms ?? [])        rooms.set(k, v);
    for (const [k, v] of snap.roomBids ?? [])     roomBids.set(k, v);
    for (const [k, v] of snap.roomResults ?? [])  roomResults.set(k, v);
    for (const [k, v] of snap.roomShameLog ?? []) roomShameLog.set(k, v);
    for (const [k, v] of snap.roomThumbs ?? [])   roomThumbs.set(k, v);
    for (const [k, v] of snap.roomSpectators ?? []) roomSpectators.set(k, v);
    for (const [k, v] of snap.playerToRoom ?? []) playerToRoom.set(k, v);
    // Garantit que chaque salle a ses structures annexes (évite tout crash sur .get(code)!)
    for (const code of rooms.keys()) {
      if (!roomBids.has(code))     roomBids.set(code, []);
      if (!roomResults.has(code))  roomResults.set(code, []);
      if (!roomShameLog.has(code)) roomShameLog.set(code, []);
      if (!roomThumbs.has(code))   roomThumbs.set(code, []);
      if (!roomSpectators.has(code)) roomSpectators.set(code, []);
    }
    log(`[load] sauvegarde du ${snap.savedAt ?? '?'} rechargée : ${rooms.size} salle(s)`);
  } catch (e) {
    log('[load] sauvegarde illisible, démarrage à vide :', e);
  }
}

function sendTo(playerId: string, msg: unknown) {
  const ws = playerToWs.get(playerId);
  if (!ws) return;
  try { ws.send(JSON.stringify(msg)); } catch {}
}

function sendError(ws: any, message: string) {
  try { ws.send(JSON.stringify({ type: 'error', message })); } catch {}
}

/**
 * Broadcast the full room state to every player in the room.
 * During the 'bidding' phase, each player's bid value is hidden from
 * the other players (only is_ready is visible).
 */
function broadcastState(roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const bids    = roomBids.get(roomCode)    ?? [];
  const results = roomResults.get(roomCode) ?? [];

  // Expose per-player connection status (l'hôte peut voir qui est déconnecté)
  const roomForSend = {
    ...room,
    players: room.players.map(p => ({ ...p, connected: playerToWs.has(p.id) })),
  };

  const shameLog   = roomShameLog.get(roomCode) ?? [];
  const thumbs     = roomThumbs.get(roomCode) ?? [];
  const spectators = roomSpectators.get(roomCode) ?? [];

  for (const player of room.players) {
    let filteredBids = bids;

    if (room.status === 'bidding') {
      // Mask bid values only for the current round (past rounds stay visible for ScoreOverview editing)
      // Le joker est masqué aussi : il n'est révélé qu'à la phase de révélation.
      filteredBids = bids.map(b =>
        b.round_number === room.current_round && b.player_id !== player.id
          ? { ...b, bid: null, joker: false }
          : b
      );
    }

    sendTo(player.id, { type: 'state', room: roomForSend, bids: filteredBids, results, shameLog, thumbs, spectators });
  }

  // Spectateurs : mêmes infos, mais TOUS les paris de la manche en cours sont
  // masqués pendant le bidding (un spectateur peut être assis à côté d'un joueur).
  if (spectators.length > 0) {
    const spectatorBids = room.status === 'bidding'
      ? bids.map(b => b.round_number === room.current_round ? { ...b, bid: null, joker: false } : b)
      : bids;
    for (const s of spectators) {
      sendTo(s.id, { type: 'state', room: roomForSend, bids: spectatorBids, results, shameLog, thumbs, spectators });
    }
  }

  // Partie terminée → archivée dans l'historique (mise à jour si l'hôte corrige après la fin)
  if (room.status === 'complete') archiveGame(room);

  // L'état du jeu vient de changer → on programme une sauvegarde sur disque.
  scheduleSave();
}

// ─── Message handler ──────────────────────────────────────────────────────────

/** Rend le contrôle à un joueur dont l'hôte avait pris la main (déconnexion). */
function releaseAutoControl(playerId: string) {
  const code = playerToRoom.get(playerId);
  if (!code) return;
  const room = rooms.get(code);
  const p = room?.players.find(x => x.id === playerId);
  if (p?.autoManaged) {
    p.managedByHost = false;
    p.autoManaged = false;
    log(`[room] ${code} ${p.name} est de retour — contrôle rendu`);
  }
}

function handleMessage(ws: any, raw: string) {
  let msg: any;
  try { msg = JSON.parse(raw); } catch { return; }

  // Heartbeat — répond avant toute validation (pas besoin de playerId)
  if (msg.type === 'ping') {
    if (msg.playerId) playerToWs.set(msg.playerId, ws);
    try { ws.send('{"type":"pong"}'); } catch {}
    return;
  }

  const playerId: string | undefined = msg.playerId;
  if (!playerId) return;

  // Always update the ws reference for this player (handles reconnects)
  const wasDisconnected = !playerToWs.has(playerId);
  playerToWs.set(playerId, ws);

  // Si le joueur revient et que l'hôte avait pris le contrôle → on le lui rend
  if (wasDisconnected) releaseAutoControl(playerId);

  switch (msg.type as string) {

    // ── Create a new room ────────────────────────────────────────────────────
    case 'create-room': {
      const code = generateCode();
      const players: RoomPlayer[] = Array.isArray(msg.players) && msg.players.length > 0
        ? msg.players
        : [{ id: playerId, name: msg.playerName ?? 'Hôte', isHost: true }];

      const room: Room = {
        id: code,
        code,
        host_player_id: playerId,
        status: 'lobby',
        total_rounds: Number(msg.totalRounds) || 10,
        current_round: 1,
        scoring_preset_id: msg.scoringPresetId ?? 'standard',
        players,
        created_at: now(),
        updated_at: now(),
      };

      rooms.set(code, room);
      roomBids.set(code, []);
      roomResults.set(code, []);
      roomShameLog.set(code, []);
      roomThumbs.set(code, []);

      for (const p of players) playerToRoom.set(p.id, code);

      // Nettoyage automatique après 12h
      setTimeout(() => {
        const r = rooms.get(code);
        if (!r) return;
        for (const p of r.players) { playerToRoom.delete(p.id); playerToWs.delete(p.id); }
        rooms.delete(code);
        roomBids.delete(code);
        roomResults.delete(code);
      roomShameLog.delete(code);
      roomThumbs.delete(code);
      dropSpectators(code);
        scheduleSave();
        log(`[room] ${code} supprimée automatiquement après 12h`);
      }, 12 * 60 * 60 * 1000);

      log(`[room] créée ${code} par ${playerId} (${players[0]?.name})`);
      broadcastState(code);
      break;
    }

    // ── Join an existing room ────────────────────────────────────────────────
    case 'join-room': {
      const code = (msg.code as string)?.toUpperCase();
      const room = rooms.get(code);

      if (!room)                  { sendError(ws, 'Salle introuvable'); return; }
      if (room.status !== 'lobby'){ sendError(ws, 'Partie déjà en cours'); return; }
      if (room.players.length >= 10) { sendError(ws, 'Salle pleine (max 10 joueurs)'); return; }

      const name = (msg.playerName as string)?.trim() || 'Joueur';
      const nameTaken = room.players.some(
        p => p.name.toLowerCase() === name.toLowerCase() && p.id !== playerId
      );
      if (nameTaken) { sendError(ws, 'Ce nom est déjà pris dans cette salle'); return; }

      if (!room.players.some(p => p.id === playerId)) {
        room.players.push({ id: playerId, name, isHost: false });
        room.updated_at = now();
      }

      playerToRoom.set(playerId, code);
      log(`[room] ${playerId} (${name}) a rejoint ${code}`);
      broadcastState(code);
      break;
    }

    // ── Historique des parties terminées (30 derniers jours) ────────────────
    case 'get-history': {
      const entries = [...history]
        .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))
        .map(summarizeHistory);
      try { ws.send(JSON.stringify({ type: 'history-list', entries })); } catch {}
      break;
    }

    case 'get-history-game': {
      const entry = history.find(e => e.id === msg.gameId) ?? null;
      try { ws.send(JSON.stringify({ type: 'history-game', gameId: msg.gameId, entry })); } catch {}
      break;
    }

    // ── Join as spectator (lecture seule, même en cours de partie) ───────────
    case 'spectate-room': {
      const code = (msg.code as string)?.toUpperCase();
      const room = rooms.get(code);
      if (!room) { sendError(ws, 'Salle introuvable'); return; }
      if (room.players.some(p => p.id === playerId)) {
        sendError(ws, 'Vous êtes déjà joueur dans cette salle'); return;
      }

      const name = (msg.playerName as string)?.trim() || 'Spectateur';
      const spectators = roomSpectators.get(code) ?? [];
      if (!spectators.some(s => s.id === playerId)) {
        spectators.push({ id: playerId, name });
      }
      roomSpectators.set(code, spectators);
      playerToRoom.set(playerId, code);
      log(`[room] ${playerId} (${name}) regarde ${code} en spectateur`);
      broadcastState(code);
      break;
    }

    // ── Load room state (used after page refresh / navigation) ───────────────
    case 'load-room': {
      const code = (msg.code as string)?.toUpperCase();
      const room = rooms.get(code);
      if (!room) { sendError(ws, 'Salle introuvable'); return; }
      playerToRoom.set(playerId, code);
      broadcastState(code);
      break;
    }

    // ── Reconnect (after WS drop / page navigation) ──────────────────────────
    case 'reconnect': {
      const code = playerToRoom.get(playerId);
      if (code && rooms.has(code)) broadcastState(code);
      // If player has no room, just ignore — no error
      break;
    }

    // ── Player voluntarily leaves the room ──────────────────────────────────
    case 'leave-room': {
      const code = playerToRoom.get(playerId);
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;

      // Spectateur qui part : simple retrait du registre, la salle continue
      const specs = roomSpectators.get(code) ?? [];
      if (specs.some(s => s.id === playerId)) {
        roomSpectators.set(code, specs.filter(s => s.id !== playerId));
        playerToRoom.delete(playerId);
        playerToWs.delete(playerId);
        log(`[room] spectateur ${playerId} a quitté ${code}`);
        broadcastState(code);
        break;
      }

      const isHost = room.host_player_id === playerId;

      // Remove the player
      room.players = room.players.filter(p => p.id !== playerId);
      playerToRoom.delete(playerId);
      playerToWs.delete(playerId);

      // If host left or room is now empty → delete the room entirely
      if (isHost || room.players.length === 0) {
        // Notify remaining players
        for (const p of room.players) {
          sendTo(p.id, { type: 'room-deleted' });
          playerToRoom.delete(p.id);
          playerToWs.delete(p.id);
        }
        rooms.delete(code);
        roomBids.delete(code);
        roomResults.delete(code);
      roomShameLog.delete(code);
      roomThumbs.delete(code);
      dropSpectators(code);
        scheduleSave();
        log(`[room] ${code} supprimée (hôte/dernier joueur parti)`);
      } else {
        // Otherwise broadcast updated player list
        room.updated_at = now();
        log(`[room] ${playerId} a quitté ${code}`);
        broadcastState(code);
      }
      break;
    }

    // ── Host kicks a player ──────────────────────────────────────────────────
    case 'kick-player': {
      const code = playerToRoom.get(playerId);
      if (!code) return;
      const room = rooms.get(code);
      if (!room || room.host_player_id !== playerId || room.status !== 'lobby') return;

      const targetId = msg.targetPlayerId as string;
      if (!targetId || targetId === playerId) return;

      // Notify kicked player
      sendTo(targetId, { type: 'kicked' });

      // Remove from room
      room.players = room.players.filter(p => p.id !== targetId);
      playerToRoom.delete(targetId);
      playerToWs.delete(targetId);
      room.updated_at = now();

      log(`[room] ${targetId} expulsé de ${code}`);
      broadcastState(code);
      break;
    }

    // ── Host shuffles player order ───────────────────────────────────────────
    case 'shuffle-players': {
      const code = playerToRoom.get(playerId);
      if (!code) return;
      const room = rooms.get(code);
      if (!room || room.host_player_id !== playerId || room.status !== 'lobby') return;

      for (let i = room.players.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [room.players[i], room.players[j]] = [room.players[j], room.players[i]];
      }
      room.updated_at = now();
      broadcastState(code);
      break;
    }

    // ── Host starts the game ─────────────────────────────────────────────────
    case 'start-game': {
      const code = playerToRoom.get(playerId);
      if (!code) return;
      const room = rooms.get(code);
      if (!room || room.host_player_id !== playerId) return;
      if (room.players.length < 2) { sendError(ws, 'Il faut au moins 2 joueurs'); return; }

      // Tirage au sort : à 9 joueurs ou plus, le jeu ne suit plus — on exclut
      // aléatoirement (hôte compris) pour redescendre à 8 joueurs.
      const MAX_GAME_PLAYERS = 8;
      if (room.players.length >= 9) {
        const excluded: RoomPlayer[] = [];
        while (room.players.length > MAX_GAME_PLAYERS) {
          // On garde toujours au moins un joueur "avec téléphone" (futur hôte possible)
          const pool = room.players.filter(p =>
            room.players.some(x => x.id !== p.id && !x.managedByHost)
          );
          const pick = pool[Math.floor(Math.random() * pool.length)] ?? room.players[0];
          excluded.push(pick);
          room.players = room.players.filter(p => p.id !== pick.id);
        }

        // Notifier les exclus AVANT de couper leurs connexions
        for (const p of excluded) {
          sendTo(p.id, { type: 'excluded' });
          playerToRoom.delete(p.id);
          playerToWs.delete(p.id);
        }

        // Si l'hôte a été tiré au sort → transfert automatique à un joueur restant
        if (!room.players.some(p => p.id === room.host_player_id)) {
          const candidates = room.players.filter(p => !p.managedByHost);
          const newHost = candidates[Math.floor(Math.random() * candidates.length)] ?? room.players[0];
          room.host_player_id = newHost.id;
          for (const p of room.players) p.isHost = (p.id === newHost.id);
          log(`[room] ${code} hôte exclu par tirage → nouveau : ${newHost.name}`);
        }

        log(`[room] ${code} tirage au sort : ${excluded.map(p => p.name).join(', ')} exclu(s) (${room.players.length} restants)`);
      }

      room.status = 'bidding';
      room.current_round = 1;
      room.updated_at = now();
      roomBids.set(code, []);
      roomResults.set(code, []);
      roomThumbs.set(code, []);

      log(`[room] ${code} démarrée`);
      broadcastState(code);
      break;
    }

    // ── Player submits their bid ─────────────────────────────────────────────
    case 'submit-bid': {
      const code = playerToRoom.get(playerId);
      if (!code) return;
      const room = rooms.get(code);
      if (!room || room.status !== 'bidding') return;

      // Host can submit on behalf of a managed player
      const targetId: string = msg.targetPlayerId ?? playerId;
      if (targetId !== playerId) {
        if (room.host_player_id !== playerId) return;
        const target = room.players.find(p => p.id === targetId);
        if (!target?.managedByHost) return;
        if (target.surrendered) return;
      } else {
        const me = room.players.find(p => p.id === playerId);
        if (!me || me.surrendered) return; // inconnu (spectateur) ou abandonné → refusé
      }

      const bids = roomBids.get(code)!;
      const existing = bids.find(
        b => b.player_id === targetId && b.round_number === room.current_round
      );

      if (existing) {
        existing.bid = msg.bid ?? null;
        existing.harry_adjustment = Number(msg.harryAdjustment) || 0;
        existing.joker = !!msg.joker;
        existing.is_ready = false;
      } else {
        bids.push({
          id: uid(),
          room_id: code,
          round_number: room.current_round,
          player_id: targetId,
          bid: msg.bid ?? null,
          harry_adjustment: Number(msg.harryAdjustment) || 0,
          joker: !!msg.joker,
          is_ready: false,
          ready_at: null,
        });
      }

      broadcastState(code);
      break;
    }

    // ── Player marks themselves ready (bid locked in) ────────────────────────
    case 'mark-bid-ready': {
      const code = playerToRoom.get(playerId);
      if (!code) return;
      const room = rooms.get(code);
      if (!room || room.status !== 'bidding') return;

      // Host can mark a managed player ready
      const targetId: string = msg.targetPlayerId ?? playerId;
      if (targetId !== playerId) {
        if (room.host_player_id !== playerId) return;
        const target = room.players.find(p => p.id === targetId);
        if (!target?.managedByHost) return;
        if (target.surrendered) return;
      } else {
        const me = room.players.find(p => p.id === playerId);
        if (!me || me.surrendered) return; // inconnu (spectateur) ou abandonné → refusé
      }

      const bids = roomBids.get(code)!;
      const bid = bids.find(
        b => b.player_id === targetId && b.round_number === room.current_round
      );
      if (!bid) { sendError(ws, 'Soumettez d\'abord votre pari'); return; }
      bid.is_ready = true;
      bid.ready_at = now();

      // Auto-reveal when all players are ready
      const currentBids = bids.filter(b => b.round_number === room.current_round);
      const allReady = room.players.every(
        p => p.surrendered || currentBids.find(b => b.player_id === p.id)?.is_ready
      );
      if (allReady) {
        room.status = 'revealing';
        room.updated_at = now();
        log(`[room] ${code} manche ${room.current_round} — tous prêts, révélation`);
      }

      broadcastState(code);
      break;
    }

    // ── Host resets bid for a single player ─────────────────────────────────
    case 'reset-my-bid': {
      const code = playerToRoom.get(playerId);
      if (!code) return;
      const room = rooms.get(code);
      if (!room || room.status !== 'bidding') return;
      const bids = roomBids.get(code)!;
      roomBids.set(code, bids.filter(b => !(b.player_id === playerId && b.round_number === room.current_round)));
      room.updated_at = now();
      log(`[room] ${code} ${playerId} a annulé son pari (manche ${room.current_round})`);
      broadcastState(code);
      break;
    }

    case 'reset-bid-for-player': {
      const code = playerToRoom.get(playerId);
      if (!code) return;
      const room = rooms.get(code);
      if (!room || room.host_player_id !== playerId) return;
      if (room.status !== 'bidding' && room.status !== 'revealing') return;

      const targetId = msg.targetPlayerId as string;
      if (!targetId) return;

      const bids = roomBids.get(code)!;
      roomBids.set(code, bids.filter(b => !(b.player_id === targetId && b.round_number === room.current_round)));

      room.status = 'bidding';
      room.updated_at = now();
      log(`[room] ${code} pari de ${targetId} réinitialisé (manche ${room.current_round})`);
      broadcastState(code);
      break;
    }

    // ── Host resets bids for the current round (rollback) ───────────────────
    case 'reset-bids': {
      const code = playerToRoom.get(playerId);
      if (!code) return;
      const room = rooms.get(code);
      if (!room || room.host_player_id !== playerId) return;
      if (room.status !== 'bidding' && room.status !== 'revealing') return;

      // Remove all bids for the current round
      const bids = roomBids.get(code)!;
      roomBids.set(code, bids.filter(b => b.round_number !== room.current_round));

      room.status = 'bidding';
      room.updated_at = now();
      log(`[room] ${code} paris réinitialisés (manche ${room.current_round})`);
      broadcastState(code);
      break;
    }

    // ── Host advances from revealing → scoring ───────────────────────────────
    case 'advance-to-scoring': {
      const code = playerToRoom.get(playerId);
      if (!code) return;
      const room = rooms.get(code);
      if (!room || room.host_player_id !== playerId || room.status !== 'revealing') return;

      room.status = 'scoring';
      room.updated_at = now();
      broadcastState(code);
      break;
    }

    // ── Player submits their result ──────────────────────────────────────────
    case 'submit-result': {
      const code = playerToRoom.get(playerId);
      if (!code) return;
      const room = rooms.get(code);
      if (!room || room.status !== 'scoring') return;

      // Host can submit on behalf of a managed player
      const targetId: string = msg.targetPlayerId ?? playerId;
      if (targetId !== playerId) {
        if (room.host_player_id !== playerId) return;
        const target = room.players.find(p => p.id === targetId);
        if (!target?.managedByHost) return;
        if (target.surrendered) return;
      } else {
        const me = room.players.find(p => p.id === playerId);
        if (!me || me.surrendered) return; // inconnu (spectateur) ou abandonné → refusé
      }

      const results = roomResults.get(code)!;
      const existing = results.find(
        r => r.player_id === targetId && r.round_number === room.current_round
      );

      const entry = {
        tricks : Number(msg.tricks)  || 0,
        bonus  : Number(msg.bonus)   || 0,
        bonus_details: cleanBonusDetails(msg.bonusDetails),
        specials: msg.specials ?? {},
        score  : Number(msg.score)   || 0,
        joker_success: !!msg.jokerSuccess,
        is_done: false,
      };

      if (existing) {
        Object.assign(existing, entry);
      } else {
        results.push({
          id       : uid(),
          room_id  : code,
          round_number: room.current_round,
          player_id: targetId,
          ...entry,
        });
      }

      broadcastState(code);
      break;
    }

    // ── Host overrides a player's result ─────────────────────────────────────
    case 'host-override-result': {
      const code = playerToRoom.get(playerId);
      if (!code) return;
      const room = rooms.get(code);
      if (!room || room.host_player_id !== playerId) return;

      const targetId = msg.targetPlayerId as string;
      if (!room.players.some(p => p.id === targetId)) return;

      // Accept past rounds, and the current round during scoring/round-complete/complete
      const roundNum: number = msg.roundNumber ?? room.current_round;
      const isPast = roundNum < room.current_round;
      const isCurrent = roundNum === room.current_round &&
        (room.status === 'scoring' || room.status === 'round-complete' || room.status === 'complete');
      if (!isPast && !isCurrent) return;

      // Pendant la saisie (scoring), on ne corrige que les résultats déjà validés :
      // jamais créer/écraser le résultat d'un joueur encore en train de saisir.
      if (roundNum === room.current_round && room.status === 'scoring') {
        const existingDone = (roomResults.get(code) ?? []).find(
          r => r.player_id === targetId && r.round_number === roundNum
        )?.is_done;
        if (!existingDone) return;
      }

      // Update harry adjustment in bid if provided
      if (msg.harryAdjustment !== undefined) {
        const bids = roomBids.get(code)!;
        const bid = bids.find(b => b.player_id === targetId && b.round_number === roundNum);
        if (bid) bid.harry_adjustment = Number(msg.harryAdjustment);
      }

      const results = roomResults.get(code)!;
      const existing = results.find(
        r => r.player_id === targetId && r.round_number === roundNum
      );

      const entry = {
        tricks:  Number(msg.tricks)  || 0,
        bonus:   Number(msg.bonus)   || 0,
        bonus_details: cleanBonusDetails(msg.bonusDetails),
        specials: msg.specials ?? {},
        score:   Number(msg.score)   || 0,
        joker_success: !!msg.jokerSuccess,
        is_done: true,
      };

      if (existing) {
        Object.assign(existing, entry);
      } else {
        results.push({ id: uid(), room_id: code, round_number: roundNum, player_id: targetId, ...entry });
      }

      log(`[room] ${code} résultat modifié — ${targetId} manche ${roundNum}`);
      broadcastState(code);
      break;
    }

    // ── Player marks their result as done ────────────────────────────────────
    case 'mark-result-done': {
      const code = playerToRoom.get(playerId);
      if (!code) return;
      const room = rooms.get(code);
      if (!room || room.status !== 'scoring') return;

      // Host can mark a managed player done
      const targetId: string = msg.targetPlayerId ?? playerId;
      if (targetId !== playerId) {
        if (room.host_player_id !== playerId) return;
        const target = room.players.find(p => p.id === targetId);
        if (!target?.managedByHost) return;
        if (target.surrendered) return;
      } else {
        const me = room.players.find(p => p.id === playerId);
        if (!me || me.surrendered) return; // inconnu (spectateur) ou abandonné → refusé
      }

      const results = roomResults.get(code)!;
      const result = results.find(
        r => r.player_id === targetId && r.round_number === room.current_round
      );
      if (!result) { sendError(ws, 'Soumettez d\'abord vos résultats'); return; }
      result.is_done = true;

      // Auto-complete round when all players are done
      const currentResults = results.filter(r => r.round_number === room.current_round);
      const allDone = room.players.every(
        p => p.surrendered || currentResults.find(r => r.player_id === p.id)?.is_done
      );
      if (allDone) {
        room.status = 'round-complete';
        room.updated_at = now();
        log(`[room] ${code} manche ${room.current_round} terminée`);
      }

      broadcastState(code);
      break;
    }

    // ── Host advances to the next round ─────────────────────────────────────
    case 'next-round': {
      const code = playerToRoom.get(playerId);
      if (!code) return;
      const room = rooms.get(code);
      if (!room || room.host_player_id !== playerId) return;

      room.current_round++;
      room.status = 'bidding';
      room.updated_at = now();
      log(`[room] ${code} → manche ${room.current_round}`);
      broadcastState(code);
      break;
    }

    // ── Host directly sets a player's score for any completed round ─────────
    case 'set-score': {
      const code = playerToRoom.get(playerId);
      if (!code) return;
      const room = rooms.get(code);
      if (!room || room.host_player_id !== playerId) return;
      if (room.status === 'lobby' || room.status === 'bidding' || room.status === 'revealing') return;

      const targetId = msg.targetPlayerId as string;
      const roundNum = Number(msg.roundNumber);
      const score = Number(msg.score);

      if (!room.players.some(p => p.id === targetId)) return;

      // Only allow editing completed rounds
      const isCurrent = roundNum === room.current_round;
      const isPast = roundNum < room.current_round;
      const currentDone = room.status === 'round-complete' || room.status === 'complete';
      if (!isPast && !(isCurrent && currentDone)) return;

      const results = roomResults.get(code)!;
      const existing = results.find(r => r.player_id === targetId && r.round_number === roundNum);
      const tricks = msg.tricks !== undefined ? Number(msg.tricks) : undefined;
      const harryAdj = msg.harryAdjustment !== undefined ? Number(msg.harryAdjustment) : undefined;

      if (existing) {
        existing.score = score;
        if (tricks !== undefined) existing.tricks = tricks;
      } else {
        results.push({ id: uid(), room_id: code, round_number: roundNum, player_id: targetId, tricks: tricks ?? 0, bonus: 0, specials: {}, score, is_done: true });
      }

      // Update harry adjustment in the bid entry
      if (harryAdj !== undefined) {
        const bids = roomBids.get(code)!;
        const bid = bids.find(b => b.player_id === targetId && b.round_number === roundNum);
        if (bid) bid.harry_adjustment = harryAdj;
      }

      log(`[room] ${code} score modifié — ${targetId} manche ${roundNum} → ${score}`);
      broadcastState(code);
      break;
    }

    // ── Player gives a thumb up/down to another player (per round) ──────────
    case 'set-thumb': {
      const code = playerToRoom.get(playerId);
      if (!code) return;
      const room = rooms.get(code);
      if (!room || room.status === 'lobby') return;

      const targetId = msg.targetPlayerId as string;
      const dir = Number(msg.dir); // 1 = 👍, -1 = 👎, 0 = retirer
      if (!room.players.some(p => p.id === playerId)) return; // spectateurs : lecture seule
      if (!room.players.some(p => p.id === targetId)) return;
      if (dir !== 1 && dir !== -1 && dir !== 0) return;

      const thumbs = roomThumbs.get(code) ?? [];
      // Un seul pouce par joueur et par manche, toutes cibles confondues :
      // choisir un joueur retire automatiquement le pouce mis sur un autre.
      const filtered = thumbs.filter(
        t => !(t.round === room.current_round && t.fromId === playerId)
      );
      if (dir !== 0) {
        filtered.push({ id: uid(), round: room.current_round, fromId: playerId, toId: targetId, dir: dir as 1 | -1 });
      }
      roomThumbs.set(code, filtered);
      broadcastState(code);
      break;
    }

    // ── Host applies shame penalty ───────────────────────────────────────────
    case 'shame-penalty': {
      const code = playerToRoom.get(playerId);
      if (!code) return;
      const room = rooms.get(code);
      if (!room || room.host_player_id !== playerId) return;

      const targetId = msg.targetPlayerId as string;
      const amount = Number(msg.amount); // -10 or -20
      if (amount !== -10 && amount !== -20) return;
      if (!room.players.some(p => p.id === targetId)) return;

      const playerName = room.players.find(p => p.id === targetId)?.name ?? targetId;

      // Only track in shame log — never modify round scores
      const shameLog = roomShameLog.get(code)!;
      shameLog.push({ id: uid(), playerId: targetId, playerName, amount, round: room.current_round });
      log(`[room] ${code} sac de la honte — ${playerName} ${amount} pts (manche ${room.current_round})`);

      broadcastState(code);
      break;
    }

    // ── Host removes a shame entry ───────────────────────────────────────────
    case 'remove-shame': {
      const code = playerToRoom.get(playerId);
      if (!code) return;
      const room = rooms.get(code);
      if (!room || room.host_player_id !== playerId) return;

      const entryId = msg.entryId as string;
      const shameLog = roomShameLog.get(code)!;
      const idx = shameLog.findIndex(e => e.id === entryId);
      if (idx === -1) return;

      const removed = shameLog[idx];
      shameLog.splice(idx, 1);
      log(`[room] ${code} pénalité annulée — ${removed.playerName} ${removed.amount} pts`);

      broadcastState(code);
      break;
    }

    // ── Host ends the game ───────────────────────────────────────────────────
    case 'end-game': {
      const code = playerToRoom.get(playerId);
      if (!code) return;
      const room = rooms.get(code);
      if (!room || room.host_player_id !== playerId) return;

      room.status = 'complete';
      room.updated_at = now();
      log(`[room] ${code} terminée`);
      broadcastState(code);
      break;
    }

    // ── Host transfers their role to another player ──────────────────────────
    case 'transfer-host': {
      const code = playerToRoom.get(playerId);
      if (!code) return;
      const room = rooms.get(code);
      if (!room || room.host_player_id !== playerId) return;

      const targetId = msg.targetPlayerId as string;
      if (!targetId || targetId === playerId) { sendError(ws, 'Cible invalide'); return; }
      const target = room.players.find(p => p.id === targetId);
      if (!target) { sendError(ws, 'Joueur introuvable'); return; }
      if (target.surrendered) { sendError(ws, 'Impossible : ce joueur a abandonné'); return; }
      if (target.managedByHost) { sendError(ws, 'Impossible : joueur géré par l\'hôte'); return; }

      // Update host references
      room.host_player_id = targetId;
      for (const p of room.players) {
        p.isHost = (p.id === targetId);
      }
      room.updated_at = now();
      log(`[room] ${code} hôte transféré : ${playerId} → ${targetId}`);
      broadcastState(code);
      break;
    }

    // ── Host takes control of a disconnected player ──────────────────────────
    case 'take-control': {
      const code = playerToRoom.get(playerId);
      if (!code) return;
      const room = rooms.get(code);
      if (!room || room.host_player_id !== playerId) { sendError(ws, 'Non autorisé'); return; }
      if (room.status === 'lobby' || room.status === 'complete') { sendError(ws, 'Indisponible dans cette phase'); return; }

      const targetId = msg.targetPlayerId as string;
      if (!targetId || targetId === playerId) { sendError(ws, 'Cible invalide'); return; }
      const target = room.players.find(p => p.id === targetId);
      if (!target) { sendError(ws, 'Joueur introuvable'); return; }
      if (target.surrendered) { sendError(ws, 'Ce joueur a abandonné'); return; }
      if (target.managedByHost) { sendError(ws, 'Déjà contrôlé'); return; }
      if (playerToWs.has(targetId)) { sendError(ws, 'Ce joueur est encore connecté'); return; }

      target.managedByHost = true;
      target.autoManaged = true; // sera rendu automatiquement à sa reconnexion
      room.updated_at = now();
      log(`[room] ${code} l'hôte prend le contrôle de ${target.name}`);
      broadcastState(code);
      break;
    }

    // ── Player surrenders (leaves game but keeps score history) ──────────────
    case 'surrender': {
      const code = playerToRoom.get(playerId);
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;

      // Surrender only makes sense during an active game, not in lobby
      if (room.status === 'lobby') { sendError(ws, 'Utilisez "Quitter" en lobby'); return; }

      // Host can surrender a managed player on their behalf
      const targetId: string = msg.targetPlayerId ?? playerId;
      const isManagedSurrender = targetId !== playerId;
      if (isManagedSurrender) {
        if (room.host_player_id !== playerId) { sendError(ws, 'Non autorisé'); return; }
        const target = room.players.find(p => p.id === targetId);
        if (!target?.managedByHost) { sendError(ws, 'Joueur invalide'); return; }
      }

      const me = room.players.find(p => p.id === targetId);
      if (!me) return;
      if (me.surrendered) return; // already surrendered

      const targetIsHost = room.host_player_id === targetId;

      // If the host is surrendering themselves: must transfer the role first
      if (targetIsHost) {
        const newHostId = msg.newHostId as string | undefined;
        const candidates = room.players.filter(p => p.id !== targetId && !p.surrendered && !p.managedByHost);

        if (candidates.length === 0) {
          // No one to transfer to → delete the room entirely
          for (const p of room.players) {
            sendTo(p.id, { type: 'room-deleted' });
            playerToRoom.delete(p.id);
            playerToWs.delete(p.id);
          }
          rooms.delete(code);
          roomBids.delete(code);
          roomResults.delete(code);
          roomShameLog.delete(code);
      roomThumbs.delete(code);
      dropSpectators(code);
          scheduleSave();
          log(`[room] ${code} supprimée (hôte abandonne sans successeur)`);
          break;
        }

        if (!newHostId) { sendError(ws, 'Choisissez un nouvel hôte'); return; }
        const newHost = room.players.find(p => p.id === newHostId);
        if (!newHost || newHost.surrendered || newHost.managedByHost || newHost.id === targetId) {
          sendError(ws, 'Nouvel hôte invalide'); return;
        }

        // Transfer host
        room.host_player_id = newHostId;
        for (const p of room.players) p.isHost = (p.id === newHostId);
        log(`[room] ${code} hôte transféré (avant abandon) : ${targetId} → ${newHostId}`);
      }

      // Mark as surrendered (keep in players list to preserve score history)
      me.surrendered = true;
      me.surrenderedAt = now();

      // For self-surrender (not managed): disconnect player from the room
      if (!isManagedSurrender) {
        playerToRoom.delete(targetId);
        playerToWs.delete(targetId);
        // Notify the surrendering player so their UI redirects home
        sendTo(targetId, { type: 'surrendered' });
      }

      room.updated_at = now();
      log(`[room] ${code} ${targetId} a abandonné${isManagedSurrender ? ' (par hôte)' : ''}`);

      // Auto-advance phase if remaining players are now all ready/done
      const activePlayers = room.players.filter(p => !p.surrendered);

      if (room.status === 'bidding') {
        const currentBids = (roomBids.get(code) ?? []).filter(b => b.round_number === room.current_round);
        const allReady = activePlayers.every(p => currentBids.find(b => b.player_id === p.id)?.is_ready);
        if (allReady && activePlayers.length > 0) {
          room.status = 'revealing';
          log(`[room] ${code} manche ${room.current_round} — révélation auto (abandon)`);
        }
      } else if (room.status === 'scoring') {
        const currentResults = (roomResults.get(code) ?? []).filter(r => r.round_number === room.current_round);
        const allDone = activePlayers.every(p => currentResults.find(r => r.player_id === p.id)?.is_done);
        if (allDone && activePlayers.length > 0) {
          room.status = 'round-complete';
          log(`[room] ${code} manche ${room.current_round} terminée auto (abandon)`);
        }
      }

      broadcastState(code);
      break;
    }

    // ── Host deletes the room ────────────────────────────────────────────────
    case 'delete-room': {
      const code = playerToRoom.get(playerId);
      if (!code) return;
      const room = rooms.get(code);
      if (!room || room.host_player_id !== playerId) return;

      // Notify all players before deleting
      for (const p of room.players) {
        sendTo(p.id, { type: 'room-deleted' });
        playerToRoom.delete(p.id);
        playerToWs.delete(p.id);
      }

      rooms.delete(code);
      roomBids.delete(code);
      roomResults.delete(code);
      roomShameLog.delete(code);
      roomThumbs.delete(code);
      dropSpectators(code);
      scheduleSave();
      log(`[room] ${code} supprimée`);
      break;
    }
  }
}

// ─── Bun HTTP + WebSocket server ─────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '2456');
const DIST  = './dist';

// Auto-detect the base path from index.html so the server works regardless of
// how the app was built (base '/' for local, '/sk-tracking/' for GitHub Pages).
async function detectBase(): Promise<string> {
  try {
    const html = await Bun.file(DIST + '/index.html').text();
    const m = html.match(/src="([^"]*\/assets\/[^"]+)"/);
    if (m) {
      const assetPath = m[1]; // e.g. "/sk-tracking/assets/index-xxx.js"
      const assetsIdx = assetPath.indexOf('/assets/');
      if (assetsIdx > 0) return assetPath.slice(0, assetsIdx); // e.g. "/sk-tracking"
    }
  } catch {}
  return '';
}

const BASE = await detectBase();
if (BASE) log(`[server] base détectée : "${BASE}"`);

// Recharge les parties en cours depuis le disque (reprise après coupure/redémarrage).
loadSnapshot();

// Historique : chargement + purge des parties de plus de 30 jours, puis une fois par jour.
loadHistory();
setInterval(() => { if (purgeHistory() > 0) saveHistory(); }, 24 * 60 * 60 * 1000);

// ─── Filets de sécurité process ─────────────────────────────────────────────
// Une exception imprévue ne doit pas tuer le serveur (les parties resteraient en RAM).
process.on('uncaughtException', (e) => log('[fatal] exception non gérée :', e));
process.on('unhandledRejection', (e) => log('[fatal] promesse rejetée :', e));
// Arrêt propre (Ctrl+C / kill) : on sauvegarde une dernière fois avant de quitter.
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    log(`[exit] ${sig} reçu — sauvegarde finale...`);
    saveSnapshot();
    saveHistory();
    process.exit(0);
  });
}

Bun.serve({
  port: PORT,

  async fetch(req, server) {
    const url = new URL(req.url);

    // Health check — open http://192.168.x.x:2456/ping from the phone to test connectivity
    if (url.pathname === '/ping') {
      return new Response('pong — le serveur est joignable ✓', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    // Stats — état de la RAM du serveur
    if (url.pathname === '/api/stats') {
      const mem = process.memoryUsage();
      const roomList = [...rooms.values()].map(r => ({
        code: r.code,
        status: r.status,
        players: r.players.length,
        created_at: r.created_at,
      }));
      return new Response(JSON.stringify({
        rooms: rooms.size,
        players_tracked: playerToRoom.size,
        ws_connections: playerToWs.size,
        room_list: roomList,
        memory_mb: {
          rss: (mem.rss / 1024 / 1024).toFixed(1),
          heap_used: (mem.heapUsed / 1024 / 1024).toFixed(1),
          heap_total: (mem.heapTotal / 1024 / 1024).toFixed(1),
        },
      }, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }

    // Cleanup — supprime les salons sans connexions actives
    if (url.pathname === '/api/cleanup') {
      let deleted = 0;
      for (const [code, room] of rooms.entries()) {
        const hasActive = room.players.some(p => playerToWs.has(p.id));
        if (!hasActive) {
          for (const p of room.players) { playerToRoom.delete(p.id); }
          rooms.delete(code);
          roomBids.delete(code);
          roomResults.delete(code);
      roomShameLog.delete(code);
      roomThumbs.delete(code);
      dropSpectators(code);
          scheduleSave();
          deleted++;
        }
      }
      return new Response(JSON.stringify({ deleted, remaining: rooms.size }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }

    // Server info — returns local network IPs so the client can build the correct QR code URL
    if (url.pathname === '/api/server-info') {
      const ips: string[] = [];
      for (const ifaces of Object.values(networkInterfaces())) {
        for (const iface of ifaces ?? []) {
          if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
        }
      }
      return new Response(JSON.stringify({ ips, port: PORT }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // WebSocket upgrade
    if (url.pathname === '/ws') {
      log(`[ws] tentative de connexion depuis ${req.headers.get('origin') || 'unknown'}`);
      if (server.upgrade(req)) return undefined;
      return new Response('WebSocket upgrade failed', { status: 400 });
    }

    // Redirect root to the base path so React Router's basename matches
    if (BASE && (url.pathname === '/' || url.pathname === '')) {
      return Response.redirect(new URL(BASE + '/', url.origin).href, 302);
    }

    // Strip the base prefix so dist/ paths always resolve correctly
    let pathname = url.pathname;
    if (BASE && pathname.startsWith(BASE)) {
      pathname = pathname.slice(BASE.length) || '/';
    }

    // Static file serving
    let filePath = pathname === '/' ? '/index.html' : pathname;

    try {
      const file = Bun.file(DIST + filePath);
      if (await file.exists()) {
        // Assets avec hash dans le nom (ex: index-AbCdEf.js) → cache long terme OK
        const isHashed = /\/assets\/[^/]+-[a-zA-Z0-9]{8}\.[a-z]+$/.test(filePath);
        // SW, HTML, manifest → jamais en cache
        const isNoCache = filePath.endsWith('.html') || filePath.endsWith('sw.js') || filePath.endsWith('.webmanifest');

        const headers: Record<string, string> = {};
        if (isNoCache) {
          headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
        } else if (isHashed) {
          headers['Cache-Control'] = 'public, max-age=31536000, immutable';
        }
        if (filePath.endsWith('.pdf')) {
          headers['Content-Type'] = 'application/pdf';
          headers['Content-Disposition'] = 'inline';
        }

        return new Response(file, { headers });
      }
    } catch {}

    // SPA fallback — serve index.html for all unknown paths
    try {
      return new Response(Bun.file(DIST + '/index.html'), {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      });
    } catch {
      return new Response('Lancez "bun run build" avant "bun server.ts"', { status: 503 });
    }
  },

  websocket: {
    open(ws)  { log('[ws] client connecté'); },
    message(ws, data) {
      // try/catch global : une erreur sur UN message ne doit jamais tuer le serveur
      try {
        handleMessage(ws, typeof data === 'string' ? data : new TextDecoder().decode(data as ArrayBuffer));
      } catch (e) {
        log('[ws] erreur de traitement message :', e);
      }
    },
    close(ws) {
      let disconnectedPlayerId: string | null = null;
      for (const [pid, s] of playerToWs.entries()) {
        if (s === ws) { playerToWs.delete(pid); disconnectedPlayerId = pid; break; }
      }

      // Suppression instantanée si plus personne de connecté dans la salle
      if (disconnectedPlayerId) {
        const code = playerToRoom.get(disconnectedPlayerId);
        if (code) {
          const room = rooms.get(code);
          if (room) {
            // Prévenir les autres qu'un joueur s'est déconnecté (statut 📵 + bouton contrôle)
            broadcastState(code);
            const allGone = room.players.every(p => !playerToWs.has(p.id));
            if (allGone) {
              // Délai de grâce : 60s en lobby, 10 min si partie en cours
              const isActiveGame = room.status !== 'lobby' && room.status !== 'complete';
              const grace = isActiveGame ? 60 * 60_000 : 20 * 60_000; // 1h en jeu, 20min en lobby
              setTimeout(() => {
                const r = rooms.get(code);
                if (!r) return;
                const stillGone = r.players.every(p => !playerToWs.has(p.id));
                if (stillGone) {
                  for (const p of r.players) { playerToRoom.delete(p.id); }
                  rooms.delete(code);
                  roomBids.delete(code);
                  roomResults.delete(code);
      roomShameLog.delete(code);
      roomThumbs.delete(code);
      dropSpectators(code);
                  scheduleSave();
                  log(`[room] ${code} supprimée (inactivité)`);
                }
              }, grace);
            }
          }
        }
      }
    },
  },
});

// ─── Display network addresses ────────────────────────────────────────────────

log('\n🏴‍☠️  Skull King — Serveur multijoueur local\n');
log(`   📡 http://localhost:${PORT}\n`);

const nets = networkInterfaces();
let found = false;
for (const ifaces of Object.values(nets)) {
  for (const iface of ifaces ?? []) {
    if (iface.family === 'IPv4' && !iface.internal) {
      log(`   📱 http://${iface.address}:${PORT}  ← partagez cette adresse`);
      found = true;
    }
  }
}
if (!found) log('   (aucune interface réseau trouvée)');
log('\n   Ctrl+C pour arrêter\n');
