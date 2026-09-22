import { create } from 'zustand';
import { wsClient } from '../lib/ws';
import { RoomRow, RoomBidRow, RoomResultRow, RoomPlayer, ShameEntry, ThumbEntry, SpectatorInfo, HistorySummary, HistoryEntry } from '../lib/supabase';
import { calculateScore } from '../lib/score';
import { presets } from '../config/scoringConfig';
import { uid } from '../lib/utils';

const PLAYER_ID_KEY = 'skullking-player-id';
const PLAYER_NAME_KEY = 'skullking-player-name';

function getOrCreatePlayerId(): string {
  let id = localStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = uid();
    localStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

const ADMIN_KEY = 'skullking-admin';

/** Jeton admin en cours, ou null s'il est absent/expiré (l'expiration est aussi vérifiée côté serveur). */
function loadAdminSession(): { token: string; expiresAt: number } | null {
  try {
    const raw = localStorage.getItem(ADMIN_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s?.token || typeof s.expiresAt !== 'number' || s.expiresAt <= Date.now()) {
      localStorage.removeItem(ADMIN_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

function clearAdminSession() {
  try { localStorage.removeItem(ADMIN_KEY); } catch {}
}

function getWsUrl(): string {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL as string;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

interface RoomState {
  myPlayerId: string;
  myPlayerName: string;
  room: RoomRow | null;
  bids: RoomBidRow[];
  results: RoomResultRow[];
  shameLog: ShameEntry[];
  thumbs: ThumbEntry[];
  spectators: SpectatorInfo[];
  history: HistorySummary[] | null;   // null = pas encore chargé
  historyDetails: Record<string, HistoryEntry | null>;   // absent = pas chargé, null = introuvable
  isAdmin: boolean;
  adminPending: boolean;
  adminError: string | null;
  loadHistory: () => void;
  loadHistoryGame: (gameId: string) => void;
  adminLogin: (password: string) => void;
  adminLogout: () => void;
  deleteHistoryGame: (gameId: string) => void;
  loading: boolean;
  error: string | null;
  kicked: boolean;
  excluded: boolean;

  init: () => void;
  setMyPlayerName: (name: string) => void;
  createRoom: (config: { totalRounds: number; scoringPresetId: string; players: RoomPlayer[] }) => Promise<string>;
  joinRoom: (code: string, playerName: string) => Promise<void>;
  spectateRoom: (code: string, playerName: string) => Promise<void>;
  loadRoomByCode: (code: string) => Promise<RoomRow | null>;
  resetMyBid: () => void;
  resetBids: () => void;
  resetBidForPlayer: (targetPlayerId: string) => void;
  shufflePlayers: () => void;
  kickPlayer: (targetPlayerId: string) => void;
  startGame: () => Promise<void>;
  submitBid: (bid: number, harryAdjustment?: number, joker?: boolean) => Promise<void>;
  submitBidForPlayer: (targetPlayerId: string, bid: number, harryAdjustment?: number, joker?: boolean) => void;
  markBidReadyForPlayer: (targetPlayerId: string) => void;
  submitResultForPlayer: (targetPlayerId: string, data: { tricks: number; bonusDetails: number[]; harryAdjustment?: number; jokerSuccess?: boolean; specials: Record<string, { positive: number; negative: number }> }) => void;
  markResultDoneForPlayer: (targetPlayerId: string) => void;
  markBidReady: () => Promise<void>;
  advanceToScoring: () => Promise<void>;
  submitResult: (data: { tricks: number; bonusDetails: number[]; harryAdjustment?: number; jokerSuccess?: boolean; specials: Record<string, { positive: number; negative: number }> }) => Promise<void>;
  markResultDone: () => Promise<void>;
  advanceToNextRound: () => Promise<void>;
  endGame: () => Promise<void>;
  hostOverrideResult: (targetPlayerId: string, data: { tricks: number; bonusDetails: number[]; harryAdjustment?: number; jokerSuccess?: boolean; specials: Record<string, { positive: number; negative: number }> }, roundNumber?: number) => void;
  setScore: (targetPlayerId: string, roundNumber: number, score: number, tricks?: number, harryAdjustment?: number) => void;
  shamePenalty: (targetPlayerId: string, amount: -10 | -20) => void;
  removeShame: (entryId: string) => void;
  surrender: (newHostId?: string) => void;
  surrenderManaged: (targetPlayerId: string) => void;
  transferHost: (targetPlayerId: string) => void;
  takeControl: (targetPlayerId: string) => void;
  setThumb: (targetPlayerId: string, dir: 1 | -1 | 0) => void;
  deleteRoom: () => void;
  subscribeToRoom: (roomId: string) => void;
  unsubscribeFromRoom: () => void;
  clearRoom: () => void;
}

export const useRoomStore = create<RoomState>((set, get) => {
  // Pending promise resolvers for async actions
  let pendingResolve: (() => void) | null = null;
  let pendingReject: ((e: Error) => void) | null = null;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;

  function waitForState(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (pendingTimer) clearTimeout(pendingTimer);
      pendingResolve = resolve;
      pendingReject = reject;
      pendingTimer = setTimeout(() => {
        pendingResolve = null;
        pendingReject = null;
        reject(new Error('Timeout — serveur non disponible'));
      }, 10000);
    });
  }

  function resolvePending() {
    if (pendingTimer) clearTimeout(pendingTimer);
    const r = pendingResolve;
    pendingResolve = null;
    pendingReject = null;
    r?.();
  }

  function rejectPending(msg: string) {
    if (pendingTimer) clearTimeout(pendingTimer);
    const r = pendingReject;
    pendingResolve = null;
    pendingReject = null;
    r?.(new Error(msg));
  }

  // WS event listeners (registered once at store creation)
  wsClient.on('state', (msg) => {
    set({ room: msg.room, bids: msg.bids ?? [], results: msg.results ?? [], shameLog: msg.shameLog ?? [], thumbs: msg.thumbs ?? [], spectators: msg.spectators ?? [], loading: false, error: null });
    if (msg.room?.code) localStorage.setItem('skullking-active-room', msg.room.code);
    resolvePending();
  });

  wsClient.on('error', (msg) => {
    set({ loading: false, error: msg.message });
    rejectPending(msg.message);
  });

  wsClient.on('room-deleted', () => {
    wsClient.disconnect();
    localStorage.removeItem('skullking-active-room');
    set({ room: null, bids: [], results: [], shameLog: [], thumbs: [], spectators: [], error: null });
  });

  wsClient.on('kicked', () => {
    wsClient.disconnect();
    localStorage.removeItem('skullking-active-room');
    set({ room: null, bids: [], results: [], shameLog: [], thumbs: [], spectators: [], error: null, kicked: true });
  });

  // Historique des parties terminées
  wsClient.on('history-list', (msg) => set({ history: msg.entries ?? [] }));
  wsClient.on('history-game', (msg) =>
    set(s => ({ historyDetails: { ...s.historyDetails, [msg.gameId]: msg.entry ?? null } }))
  );

  // Accès admin
  wsClient.on('admin-session', (msg) => {
    try {
      localStorage.setItem(ADMIN_KEY, JSON.stringify({ token: msg.token, expiresAt: msg.expiresAt }));
    } catch {}
    set({ isAdmin: true, adminPending: false, adminError: null });
  });

  // Refus (mauvais mot de passe, session expirée, trop de tentatives) → on repart propre
  wsClient.on('admin-denied', (msg) => {
    clearAdminSession();
    set({ isAdmin: false, adminPending: false, adminError: msg.message ?? 'Accès refusé' });
  });

  wsClient.on('admin-logged-out', () => {
    clearAdminSession();
    set({ isAdmin: false, adminPending: false, adminError: null });
  });

  // Exclu par tirage au sort (plus de 8 joueurs au démarrage)
  wsClient.on('excluded', () => {
    wsClient.disconnect();
    localStorage.removeItem('skullking-active-room');
    set({ room: null, bids: [], results: [], shameLog: [], thumbs: [], spectators: [], error: null, excluded: true });
  });

  wsClient.on('surrendered', () => {
    wsClient.disconnect();
    localStorage.removeItem('skullking-active-room');
    set({ room: null, bids: [], results: [], shameLog: [], thumbs: [], spectators: [], error: null });
  });

  // Resynchronisation complète de l'état depuis le serveur.
  // Toujours resynchroniser (même si `room` est déjà rempli) : après une mise en
  // veille du téléphone, l'état local peut être périmé (page/manche en retard).
  function resyncFromServer() {
    const activeCode = localStorage.getItem('skullking-active-room');
    if (activeCode) {
      wsClient.send({ type: 'reconnect', playerId: getOrCreatePlayerId() });
    }
  }

  // Auto-reconnect si une room active existe dans localStorage
  // (permet de rester dans la partie au refresh ET de rattraper l'état raté)
  wsClient.on('_connected', resyncFromServer);

  // Retour au premier plan (déverrouillage tel) → rattraper les broadcasts ratés
  wsClient.on('_resync', resyncFromServer);

  function ensureConnected() {
    if (!wsClient.connected) {
      wsClient.connect(getWsUrl());
    }
  }

  // Connexion eagerly au démarrage du module
  wsClient.connect(getWsUrl());

  return {
    myPlayerId: getOrCreatePlayerId(),
    myPlayerName: localStorage.getItem(PLAYER_NAME_KEY) ?? '',
    room: null,
    bids: [],
    results: [],
    shameLog: [],
    thumbs: [],
    spectators: [],
    history: null,
    historyDetails: {},
    isAdmin: !!loadAdminSession(),
    adminPending: false,
    adminError: null,
    loading: false,
    error: null,
    kicked: false,
    excluded: false,

    init() {
      set({
        myPlayerId: getOrCreatePlayerId(),
        myPlayerName: localStorage.getItem(PLAYER_NAME_KEY) ?? '',
      });
    },

    setMyPlayerName(name) {
      localStorage.setItem(PLAYER_NAME_KEY, name);
      set({ myPlayerName: name });
    },

    async createRoom({ totalRounds, scoringPresetId, players }) {
      set({ loading: true, error: null, kicked: false, excluded: false });
      ensureConnected();
      try {
        await wsClient.waitForConnection();
        wsClient.send({
          type: 'create-room',
          playerId: get().myPlayerId,
          totalRounds,
          scoringPresetId,
          players,
        });
        await waitForState();
        return get().room!.code;
      } catch (e: any) {
        set({ loading: false, error: e.message });
        throw e;
      }
    },

    async joinRoom(code, playerName) {
      set({ loading: true, error: null, kicked: false, excluded: false });
      ensureConnected();
      try {
        await wsClient.waitForConnection();
        wsClient.send({
          type: 'join-room',
          playerId: get().myPlayerId,
          playerName,
          code: code.toUpperCase(),
        });
        await waitForState();
        get().setMyPlayerName(playerName);
      } catch (e: any) {
        set({ loading: false, error: e.message });
        throw e;
      }
    },

    async spectateRoom(code, playerName) {
      set({ loading: true, error: null, kicked: false, excluded: false });
      ensureConnected();
      try {
        await wsClient.waitForConnection();
        wsClient.send({
          type: 'spectate-room',
          playerId: get().myPlayerId,
          playerName,
          code: code.toUpperCase(),
        });
        await waitForState();
        get().setMyPlayerName(playerName);
      } catch (e: any) {
        set({ loading: false, error: e.message });
        throw e;
      }
    },

    loadHistory() {
      // Si la connexion est coupée, le message part dès la reconnexion (file d'attente du client WS)
      ensureConnected();
      // Détails vidés à chaque ouverture de la page : l'hôte a pu corriger une partie entre-temps
      set({ historyDetails: {} });
      wsClient.send({ type: 'get-history', playerId: get().myPlayerId });
    },

    loadHistoryGame(gameId) {
      if (gameId in get().historyDetails) return; // déjà chargée
      ensureConnected();
      wsClient.send({ type: 'get-history-game', playerId: get().myPlayerId, gameId });
    },

    adminLogin(password) {
      if (!password) return;
      set({ adminPending: true, adminError: null });
      ensureConnected();
      // Le mot de passe n'est ni stocké ni journalisé côté client : seul le jeton reçu l'est
      wsClient.send({ type: 'admin-login', playerId: get().myPlayerId, password });
    },

    adminLogout() {
      const session = loadAdminSession();
      clearAdminSession();
      set({ isAdmin: false, adminError: null, adminPending: false });
      if (session) wsClient.send({ type: 'admin-logout', playerId: get().myPlayerId, token: session.token });
    },

    deleteHistoryGame(gameId) {
      const session = loadAdminSession();
      if (!session) {
        set({ isAdmin: false, adminError: 'Session admin expirée — reconnectez-vous' });
        return;
      }
      ensureConnected();
      wsClient.send({ type: 'admin-delete-history-game', playerId: get().myPlayerId, token: session.token, gameId });
    },

    async loadRoomByCode(code) {
      ensureConnected();
      // If already in this room, return current state
      const current = get().room;
      if (current && current.code === code.toUpperCase()) return current;
      try {
        await wsClient.waitForConnection();
        wsClient.send({ type: 'load-room', playerId: get().myPlayerId, code: code.toUpperCase() });
        await waitForState();
        return get().room;
      } catch {
        return null;
      }
    },

    resetMyBid() {
      wsClient.send({ type: 'reset-my-bid', playerId: get().myPlayerId });
    },

    resetBids() {
      wsClient.send({ type: 'reset-bids', playerId: get().myPlayerId });
    },

    resetBidForPlayer(targetPlayerId) {
      wsClient.send({ type: 'reset-bid-for-player', playerId: get().myPlayerId, targetPlayerId });
    },

    shufflePlayers() {
      wsClient.send({ type: 'shuffle-players', playerId: get().myPlayerId });
    },

    kickPlayer(targetPlayerId) {
      wsClient.send({ type: 'kick-player', playerId: get().myPlayerId, targetPlayerId });
    },

    async startGame() {
      wsClient.send({ type: 'start-game', playerId: get().myPlayerId });
    },

    async submitBid(bid, harryAdjustment = 0, joker = false) {
      wsClient.send({ type: 'submit-bid', playerId: get().myPlayerId, bid, harryAdjustment, joker });
    },

    async markBidReady() {
      wsClient.send({ type: 'mark-bid-ready', playerId: get().myPlayerId });
    },

    submitBidForPlayer(targetPlayerId, bid, harryAdjustment = 0, joker = false) {
      wsClient.send({ type: 'submit-bid', playerId: get().myPlayerId, targetPlayerId, bid, harryAdjustment, joker });
    },

    markBidReadyForPlayer(targetPlayerId) {
      wsClient.send({ type: 'mark-bid-ready', playerId: get().myPlayerId, targetPlayerId });
    },

    submitResultForPlayer(targetPlayerId, { tricks, bonusDetails, harryAdjustment = 0, jokerSuccess = false, specials }) {
      const room = get().room;
      if (!room) return;
      const targetBid = get().bids.find(b => b.player_id === targetPlayerId && b.round_number === room.current_round);
      const bidVal = targetBid?.bid ?? 0;
      const bonus = bonusDetails.reduce((s, n) => s + n, 0);
      const config = presets[room.scoring_preset_id as keyof typeof presets] ?? presets.standard;
      const score = calculateScore(bidVal + harryAdjustment, tricks, room.current_round, bonus, config, jokerSuccess);
      wsClient.send({ type: 'submit-result', playerId: get().myPlayerId, targetPlayerId, tricks, bonus, bonusDetails, specials, score, jokerSuccess, harryAdjustment });
    },

    markResultDoneForPlayer(targetPlayerId) {
      wsClient.send({ type: 'mark-result-done', playerId: get().myPlayerId, targetPlayerId });
    },

    async advanceToScoring() {
      wsClient.send({ type: 'advance-to-scoring', playerId: get().myPlayerId });
    },

    async submitResult({ tricks, bonusDetails, harryAdjustment = 0, jokerSuccess = false, specials }) {
      const room = get().room;
      if (!room) return;
      const myId = get().myPlayerId;
      const myBid = get().bids.find(
        b => b.player_id === myId && b.round_number === room.current_round
      );
      const bidVal = myBid?.bid ?? 0;
      const bonus = bonusDetails.reduce((s, n) => s + n, 0);
      const config = presets[room.scoring_preset_id as keyof typeof presets] ?? presets.standard;
      const score = calculateScore(bidVal + harryAdjustment, tricks, room.current_round, bonus, config, jokerSuccess);

      wsClient.send({
        type: 'submit-result',
        playerId: myId,
        tricks,
        bonus,
        bonusDetails,
        specials,
        score,
        jokerSuccess,
        harryAdjustment,
      });
    },

    async markResultDone() {
      wsClient.send({ type: 'mark-result-done', playerId: get().myPlayerId });
    },

    async advanceToNextRound() {
      const room = get().room;
      if (!room) return;
      if (room.current_round >= room.total_rounds) {
        wsClient.send({ type: 'end-game', playerId: get().myPlayerId });
      } else {
        wsClient.send({ type: 'next-round', playerId: get().myPlayerId });
      }
    },

    async endGame() {
      wsClient.send({ type: 'end-game', playerId: get().myPlayerId });
    },

    hostOverrideResult(targetPlayerId, { tricks, bonusDetails, harryAdjustment = 0, jokerSuccess = false, specials }, roundNumber) {
      const room = get().room;
      if (!room) return;
      const rNum = roundNumber ?? room.current_round;
      const targetBid = get().bids.find(b => b.player_id === targetPlayerId && b.round_number === rNum);
      const bidVal = targetBid?.bid ?? 0;
      const bonus = bonusDetails.reduce((s, n) => s + n, 0);
      const config = presets[room.scoring_preset_id as keyof typeof presets] ?? presets.standard;
      const score = calculateScore(bidVal + harryAdjustment, tricks, rNum, bonus, config, jokerSuccess);
      wsClient.send({
        type: 'host-override-result',
        playerId: get().myPlayerId,
        targetPlayerId,
        roundNumber: rNum,
        tricks,
        bonus,
        bonusDetails,
        harryAdjustment,
        specials,
        score,
        jokerSuccess,
      });
    },

    setScore(targetPlayerId, roundNumber, score, tricks, harryAdjustment) {
      wsClient.send({ type: 'set-score', playerId: get().myPlayerId, targetPlayerId, roundNumber, score, tricks, harryAdjustment });
    },

    shamePenalty(targetPlayerId, amount) {
      wsClient.send({ type: 'shame-penalty', playerId: get().myPlayerId, targetPlayerId, amount });
    },

    removeShame(entryId) {
      wsClient.send({ type: 'remove-shame', playerId: get().myPlayerId, entryId });
    },

    surrender(newHostId?: string) {
      const payload: any = { type: 'surrender', playerId: get().myPlayerId };
      if (newHostId) payload.newHostId = newHostId;
      wsClient.send(payload);
    },

    surrenderManaged(targetPlayerId: string) {
      wsClient.send({ type: 'surrender', playerId: get().myPlayerId, targetPlayerId });
    },

    transferHost(targetPlayerId: string) {
      wsClient.send({ type: 'transfer-host', playerId: get().myPlayerId, targetPlayerId });
    },

    takeControl(targetPlayerId: string) {
      wsClient.send({ type: 'take-control', playerId: get().myPlayerId, targetPlayerId });
    },

    setThumb(targetPlayerId: string, dir: 1 | -1 | 0) {
      wsClient.send({ type: 'set-thumb', playerId: get().myPlayerId, targetPlayerId, dir });
    },

    deleteRoom() {
      wsClient.send({ type: 'delete-room', playerId: get().myPlayerId });
    },

    subscribeToRoom(_roomId: string) {
      ensureConnected();
      // Envoie reconnect uniquement ici, pas au connect automatique
      const send = () => wsClient.send({ type: 'reconnect', playerId: get().myPlayerId });
      if (wsClient.connected) send();
      else {
        // handler à usage unique (évite d'accumuler un handler par montage de page)
        const off = wsClient.on('_connected', () => { send(); off(); });
      }
    },

    unsubscribeFromRoom() {
      // Keep the WS connection alive — navigation between routes should stay connected
    },

    clearRoom() {
      // Notify server immediately so it cleans up without waiting for WS close
      if (get().room) {
        wsClient.send({ type: 'leave-room', playerId: get().myPlayerId });
      }
      wsClient.disconnect();
      localStorage.removeItem('skullking-active-room');
      set({ room: null, bids: [], results: [], shameLog: [], thumbs: [], spectators: [], error: null, kicked: false, excluded: false });
    },
  };
});
