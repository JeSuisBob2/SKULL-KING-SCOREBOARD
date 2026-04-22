export interface SpecialRule {
  id: string;
  icon: string;
  label: string;
  points?: number;
}

export interface ScoringConfig {
  pointsPerSuccessfulTrick: number;
  failedBidPenaltyPerTrick: number;
  zeroBidMultiplier: number;
  zeroBidFailMultiplier: number;
  allowHarryAdjustment: boolean;
  specials: Record<string, SpecialRule>;
}

export const standardScoring: ScoringConfig = {
  pointsPerSuccessfulTrick: 20,
  failedBidPenaltyPerTrick: 10,
  zeroBidMultiplier: 10,
  zeroBidFailMultiplier: 10,
  allowHarryAdjustment: true,
  specials: {
    skullKing: { id: 'skullKing', icon: '👑', label: 'Skull King' },
    second: { id: 'second', icon: '🦜', label: 'Second' },
    pirates: { id: 'pirates', icon: '🏴‍☠️', label: 'Pirate' },
    mermaids: { id: 'mermaids', icon: '🧜‍♀️', label: 'Sirène' },
    babyPirates: { id: 'babyPirates', icon: '👶', label: 'Baby Pirate' },
    coins: { id: 'coins', icon: '🪙', label: 'Pièce', points: 10 },
    beasts: { id: 'beasts', icon: '🦑', label: 'Monstre' },
    rascalGamble: { id: 'rascalGamble', icon: '🎰', label: 'Rascal Pari' },
    jokerBonus: { id: 'jokerBonus', icon: '🃏', label: 'Bonus Joker' },
    punishment: { id: 'punishment', icon: '🚩', label: 'Punition' },
  },
};

export const presets: Record<string, ScoringConfig> = {
  standard: standardScoring,
};
