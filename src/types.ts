export interface PhraseEntry {
  text: string;
  theme?: string;
}

export interface GameTemplate {
  id: string;
  name: string;
  color: string;
  phrases: PhraseEntry[];
  createdAt: string;
  lastUsedAt: string;
}

export interface PenaltyRoll {
  die1: number | null;
  die2: number | null;
  total: number | null;
}

export interface TeamRoundResult {
  teamId: string;
  roundIndex: number;
  tier: 'gold' | 'silver' | 'bronze' | null; // null if unsolved
  revealPercentage: number;
  wrongGuessCount: number;
  die1: number | null;
  die2: number | null;
  total: number | null;
  penaltyRolls: PenaltyRoll[];
}

export interface Team {
  id: string;
  name: string;
  colorIndex: number;
}

export interface RoundState {
  phrase: string;
  theme?: string;
  revealedIndices: number[];
  teamResults: Record<string, 'pending' | 'solved'>;
  startedAt: number;
}

export interface GameState {
  templateId: string;
  teams: Team[];
  currentRoundIndex: number;
  rounds: RoundState[];
  roundResults: TeamRoundResult[];
  rerollPool: Record<string, number>;
  rerollsUsed: Record<string, number>;
  gameStatus: 'playing' | 'finale';
}
