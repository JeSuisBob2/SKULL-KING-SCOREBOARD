import { create } from 'zustand';
import { wsClient } from '../lib/ws';
import { RoomRow, RoomBidRow, RoomResultRow, RoomPlayer, ShameEntry } from '../lib/supabase';
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
  loading: boolean;
  error: string | null;
  kicked: boolean;

  init: () => void;
  setMyPlayerName: (name: string) => void;
  createRoom: (config: { totalRounds: number; scoringPresetId: string; players: RoomPlayer[] }) => Promise<string>;
  joinRoom: (code: string, playerName: string) => Promise<void>;
  loadRoomByCode: (code: string) => Promise<RoomRow | null>;
  resetMyBid: () => void;
  resetBids: () => void;
  resetBidForPlayer: (targetPlayerId: string) => void;
  shufflePlayers: () => void;
  kickPlayer: (targetPlayerId: string) => void;
  startGame: () => Promise<void>;
  submitBid: (bid: number, harryAdjustment?: number) => Promise<void>;
  submitBidForPlayer: (targetPlayerId: string, bid: number, harryAdjustment?: number) => void;
  markBidReadyForPlayer: (targetPlayerId: string) => void;
  submitResultForPlayer: (targetPlayerId: string, data: { tricks: number; bonus: number; harryAdjustment?: number; specials: Record<string, { positive: number; negative: number }> }) => void;
  markResultDoneForPlayer: (targetPlayerId: string) => void;
  markBidReady: () => Promise<void>;
  advanceToScoring: () => Promise<void>;
  submitResult: (data: { tricks: number; bonus: number; harryAdjustment?: number; specials: Record<string, { positive: number; negative: number }> }) => Promise<void>;
  markResultDone: () => Promise<void>;
  advanceToNextRound: () => Promise<void>;
  endGame: () => Promise<void>;
  hostOverrideResult: (targetPlayerId: string, data: { tricks: number; bonus: number; harryAdjustment?: number; specials: Record<string, { positive: number; negative: number }> }, roundNumber?: number) => void;
  setScore: (targetPlayerId: string, roundNumber: number, score: number, tricks?: number, harryAdjustment?: number) => void;
  shamePenalty: (targetPlayerId: string, amount: -10 | -20) => void;
  removeShame: (entryId: string) => void;
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
    set({ room: msg.room, bids: msg.bids ?? [], results: msg.results ?? [], shameLog: msg.shameLog ?? [], loading: false, error: null });
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
    set({ room: null, bids: [], results: [], shameLog: [], error: null });
  });

  wsClient.on('kicked', () => {
    wsClient.disconnect();
    localStorage.removeItem('skullking-active-room');
    set({ room: null, bids: [], results: [], shameLog: [], error: null, kicked: true });
  });

  // NOTE: on n'envoie plus reconnect automatiquement au connect
  // pour éviter que des états périmés écrasent une nouvelle salle en cours de création.
  // Le reconnect est envoyé explicitement depuis subscribeToRoom().

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
    loading: false,
    error: null,
    kicked: false,

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
      set({ loading: true, error: null });
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
      set({ loading: true, error: null });
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

    async submitBid(bid, harryAdjustment = 0) {
      wsClient.send({ type: 'submit-bid', playerId: get().myPlayerId, bid, harryAdjustment });
    },

    async markBidReady() {
      wsClient.send({ type: 'mark-bid-ready', playerId: get().myPlayerId });
    },

    submitBidForPlayer(targetPlayerId, bid, harryAdjustment = 0) {
      wsClient.send({ type: 'submit-bid', playerId: get().myPlayerId, targetPlayerId, bid, harryAdjustment });
    },

    markBidReadyForPlayer(targetPlayerId) {
      wsClient.send({ type: 'mark-bid-ready', playerId: get().myPlayerId, targetPlayerId });
    },

    submitResultForPlayer(targetPlayerId, { tricks, bonus, harryAdjustment = 0, specials }) {
      const room = get().room;
      if (!room) return;
      const targetBid = get().bids.find(b => b.player_id === targetPlayerId && b.round_number === room.current_round);
      const bidVal = targetBid?.bid ?? 0;
      const config = presets[room.scoring_preset_id as keyof typeof presets] ?? presets.standard;
      const score = calculateScore(bidVal + harryAdjustment, tricks, room.current_round, bonus, config);
      wsClient.send({ type: 'submit-result', playerId: get().myPlayerId, targetPlayerId, tricks, bonus, specials, score });
    },

    markResultDoneForPlayer(targetPlayerId) {
      wsClient.send({ type: 'mark-result-done', playerId: get().myPlayerId, targetPlayerId });
    },

    async advanceToScoring() {
      wsClient.send({ type: 'advance-to-scoring', playerId: get().myPlayerId });
    },

    async submitResult({ tricks, bonus, harryAdjustment = 0, specials }) {
      const room = get().room;
      if (!room) return;
      const myId = get().myPlayerId;
      const myBid = get().bids.find(
        b => b.player_id === myId && b.round_number === room.current_round
      );
      const bidVal = myBid?.bid ?? 0;
      const config = presets[room.scoring_preset_id as keyof typeof presets] ?? presets.standard;
      const score = calculateScore(bidVal + harryAdjustment, tricks, room.current_round, bonus, config);

      wsClient.send({
        type: 'submit-result',
        playerId: myId,
        tricks,
        bonus,
        specials,
        score,
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

    hostOverrideResult(targetPlayerId, { tricks, bonus, harryAdjustment = 0, specials }, roundNumber) {
      const room = get().room;
      if (!room) return;
      const rNum = roundNumber ?? room.current_round;
      const targetBid = get().bids.find(b => b.player_id === targetPlayerId && b.round_number === rNum);
      const bidVal = targetBid?.bid ?? 0;
      const config = presets[room.scoring_preset_id as keyof typeof presets] ?? presets.standard;
      const score = calculateScore(bidVal + harryAdjustment, tricks, rNum, bonus, config);
      wsClient.send({
        type: 'host-override-result',
        playerId: get().myPlayerId,
        targetPlayerId,
        roundNumber: rNum,
        tricks,
        bonus,
        harryAdjustment,
        specials,
        score,
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

    deleteRoom() {
      wsClient.send({ type: 'delete-room', playerId: get().myPlayerId });
    },

    subscribeToRoom(_roomId: string) {
      ensureConnected();
      // Envoie reconnect uniquement ici, pas au connect automatique
      const send = () => wsClient.send({ type: 'reconnect', playerId: get().myPlayerId });
      if (wsClient.connected) send();
      else wsClient.on('_connected', () => send());
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
      set({ room: null, bids: [], results: [], shameLog: [], error: null, kicked: false });
    },
  };
});
