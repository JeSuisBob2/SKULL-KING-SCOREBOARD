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
  autoManaged?: boolean;   // contrôle pris par l'hôte suite à une déconnexion
  surrendered?: boolean;
  surrenderedAt?: string;
  connected?: boolean;     // statut de connexion (fourni par le serveur)
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
  joker?: boolean;
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

export interface ThumbEntry {
  id: string;
  round: number;
  fromId: string;
  toId: string;
  dir: 1 | -1;
}

export interface RoomResultRow {
  id: string;
  room_id: string;
  round_number: number;
  player_id: string;
  tricks: number;
  bonus: number;
  bonus_details?: number[];
  specials: Record<string, { positive: number; negative: number }>;
  score: number;
  joker_success?: boolean;
  is_done: boolean;
}
