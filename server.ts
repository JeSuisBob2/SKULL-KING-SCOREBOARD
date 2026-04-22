// server.ts — Skull King Multiplayer Server (Bun)
// Lance avec : bun server.ts
// Sert les fichiers statiques (dist/) ET gère les WebSockets sur le même port.

import { networkInterfaces } from 'os';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoomPlayer {
  id: string;
  name: string;
  isHost: boolean;
  managedByHost?: boolean;
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
  specials: Record<string, unknown>;
  score: number;
  is_done: boolean;
}

// ─── State ────────────────────────────────────────────────────────────────────

const rooms        = new Map<string, Room>();
const roomBids     = new Map<string, Bid[]>();
const roomResults  = new Map<string, Result[]>();
const roomShameLog = new Map<string, Array<{ id: string; playerId: string; playerName: string; amount: number; round: number }>>();

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

  for (const player of room.players) {
    let filteredBids = bids;

    if (room.status === 'bidding') {
      // Mask bid values only for the current round (past rounds stay visible for ScoreOverview editing)
      filteredBids = bids.map(b =>
        b.round_number === room.current_round && b.player_id !== player.id
          ? { ...b, bid: null }
          : b
      );
    }

    const shameLog = roomShameLog.get(roomCode) ?? [];
    sendTo(player.id, { type: 'state', room, bids: filteredBids, results, shameLog });
  }
}

// ─── Message handler ──────────────────────────────────────────────────────────

function handleMessage(ws: any, raw: string) {
  let msg: any;
  try { msg = JSON.parse(raw); } catch { return; }

  const playerId: string | undefined = msg.playerId;
  if (!playerId) return;

  // Always update the ws reference for this player (handles reconnects)
  playerToWs.set(playerId, ws);

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

      room.status = 'bidding';
      room.current_round = 1;
      room.updated_at = now();
      roomBids.set(code, []);
      roomResults.set(code, []);

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
      }

      const bids = roomBids.get(code)!;
      const existing = bids.find(
        b => b.player_id === targetId && b.round_number === room.current_round
      );

      if (existing) {
        existing.bid = msg.bid ?? null;
        existing.harry_adjustment = Number(msg.harryAdjustment) || 0;
        existing.is_ready = false;
      } else {
        bids.push({
          id: uid(),
          room_id: code,
          round_number: room.current_round,
          player_id: targetId,
          bid: msg.bid ?? null,
          harry_adjustment: Number(msg.harryAdjustment) || 0,
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
        p => currentBids.find(b => b.player_id === p.id)?.is_ready
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
      }

      const results = roomResults.get(code)!;
      const existing = results.find(
        r => r.player_id === targetId && r.round_number === room.current_round
      );

      const entry = {
        tricks : Number(msg.tricks)  || 0,
        bonus  : Number(msg.bonus)   || 0,
        specials: msg.specials ?? {},
        score  : Number(msg.score)   || 0,
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

      // Accept any completed round (past or current if round-complete/complete)
      const roundNum: number = msg.roundNumber ?? room.current_round;
      const isPast = roundNum < room.current_round;
      const isCurrent = roundNum === room.current_round &&
        (room.status === 'round-complete' || room.status === 'complete');
      if (!isPast && !isCurrent) return;

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
        specials: msg.specials ?? {},
        score:   Number(msg.score)   || 0,
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
        p => currentResults.find(r => r.player_id === p.id)?.is_done
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
      handleMessage(ws, typeof data === 'string' ? data : new TextDecoder().decode(data as ArrayBuffer));
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
