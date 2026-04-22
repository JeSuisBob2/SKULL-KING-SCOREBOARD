// Types for multiplayer rooms (no external dependency needed)

export type RoomStatus =
  | 'lobby'
  | 'bidding'
  | 'revealing'
  | 'scoring'
  | 'round-complete'
  | 'complete';

export interface RoomPlayer {
  id: string;
  name: string;
  isHost: boolean;
  managedByHost?: boolean;
}

export interface RoomRow {
  id: string;
  code: string;
  host_player_id: string;
  status: RoomStatus;
  total_rounds: number;
  current_round: number;
  scoring_preset_id: string;
  players: RoomPlayer[];
  created_at: string;
  updated_at: string;
}

export interface RoomBidRow {
  id: string;
  room_id: string;
  round_number: number;
  player_id: string;
  bid: number | null;
  harry_adjustment: number;
  is_ready: boolean;
  ready_at: string | null;
}

export interface ShameEntry {
  id: string;
  playerId: string;
  playerName: string;
  amount: number;
  round: number;
}

export interface RoomResultRow {
  id: string;
  room_id: string;
  round_number: number;
  player_id: string;
  tricks: number;
  bonus: number;
  specials: Record<string, { positive: number; negative: number }>;
  score: number;
  is_done: boolean;
}
