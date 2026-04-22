export type UUID = string;

export interface Player {
  id: UUID;
  name: string;
}

export type GameStatus = 'in-progress' | 'completed';

export interface Game {
  id: UUID;
  createdAt: number;
  updatedAt: number;
  status: GameStatus;
  players: Player[];
  totalRounds: number;
  currentRound: number;
  scoringPresetId: string;
  notes?: string;
  date?: string;
}

export interface RoundBid {
  playerId: UUID;
  bid: number;
  betAdjustedByHarry?: -2 | -1 | 0 | 1 | 2;
}

export interface RoundResultPerPlayer {
  tricks: number;
  bonus: number;
  specialCards: {
    skullKing: { positive: number; negative: number };
    second: { positive: number; negative: number };
    pirates: { positive: number; negative: number };
    mermaids: { positive: number; negative: number };
    babyPirates: { positive: number; negative: number };
    coins: { positive: number; negative: number };
    beasts: { positive: number; negative: number };
    rascalGamble: { positive: number; negative: number };
    jokerBonus: { positive: number };
    punishment: { negative: number };
    escapes?: number;
  };
  score: number;
}

export interface Round {
  id: UUID;
  gameId: UUID;
  roundNumber: number;
  bids: Record<UUID, RoundBid>;
  results: Record<UUID, RoundResultPerPlayer>;
  locked?: boolean;
}
