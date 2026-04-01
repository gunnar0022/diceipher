import { create } from 'zustand';
import type { GameState, Team, RoundState, TeamRoundResult, PenaltyRoll, PhraseEntry } from '../types';

// ─── Tier config ───
export const TIER_RANGES = {
  gold:   { min: 20, max: 50, color: '#FBBF24', label: 'Gold',   icon: '\u{1F947}' },
  silver: { min: 10, max: 40, color: '#E2E8F0', label: 'Silver', icon: '\u{1F948}' },
  bronze: { min:  0, max: 30, color: '#CD7F32', label: 'Bronze', icon: '\u{1F949}' },
} as const;

export const PENALTY_RANGE = { min: 5, max: 15 } as const;

export type Tier = 'gold' | 'silver' | 'bronze';

function randInRange(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function getLetterIndices(phrase: string): number[] {
  const indices: number[] = [];
  for (let i = 0; i < phrase.length; i++) {
    if (/[a-zA-Z0-9]/.test(phrase[i])) indices.push(i);
  }
  return indices;
}

function getRevealPercentage(round: RoundState): number {
  const total = getLetterIndices(round.phrase).length;
  if (total === 0) return 100;
  return (round.revealedIndices.length / total) * 100;
}

function determineTier(revealPct: number): Tier {
  const hidden = 100 - revealPct;
  if (hidden >= 65) return 'gold';
  if (hidden >= 35) return 'silver';
  return 'bronze';
}

function getResult(results: TeamRoundResult[], teamId: string, roundIndex: number): TeamRoundResult | undefined {
  return results.find(r => r.teamId === teamId && r.roundIndex === roundIndex);
}

function ensureResult(results: TeamRoundResult[], teamId: string, roundIndex: number): TeamRoundResult[] {
  const existing = getResult(results, teamId, roundIndex);
  if (existing) return results;
  return [...results, {
    teamId,
    roundIndex,
    tier: null,
    revealPercentage: 0,
    wrongGuessCount: 0,
    die1: null,
    die2: null,
    total: null,
    penaltyRolls: [],
  }];
}

function updateResult(
  results: TeamRoundResult[],
  teamId: string,
  roundIndex: number,
  updater: (r: TeamRoundResult) => TeamRoundResult,
): TeamRoundResult[] {
  return results.map(r =>
    r.teamId === teamId && r.roundIndex === roundIndex ? updater(r) : r
  );
}

// ─── Store interface ───
interface GameStore {
  game: GameState | null;
  startGame: (templateId: string, teams: Team[], phrases: PhraseEntry[]) => void;
  clearGame: () => void;

  revealLetter: (index: number) => void;
  revealAll: () => void;
  nextRound: () => void;
  goToFinale: () => void;

  awardCorrect: (teamId: string) => void;
  awardWrong: (teamId: string) => void;
  updateTeamName: (teamId: string, name: string) => void;

  // Edit modal: set tier for a round, set wrong count, remove a round result
  setRoundTier: (teamId: string, roundIndex: number, tier: Tier | null) => void;
  setRoundWrongCount: (teamId: string, roundIndex: number, count: number) => void;
  removeRoundResult: (teamId: string, roundIndex: number) => void;
  addRoundResult: (teamId: string, roundIndex: number, tier: Tier) => void;

  // Finale actions
  initFinale: () => void;
  rollRoundDice: (roundIndex: number) => void;
  rerollDice: (teamId: string, roundIndex: number, which: 'die1' | 'die2' | 'both') => void;
  rollPenalty: (teamId: string, roundIndex: number, penaltyIdx: number) => void;
  rollAllPenaltiesForTeam: (teamId: string) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,

  startGame: (templateId, teams, phrases) => {
    const rounds: RoundState[] = phrases.map(p => ({
      phrase: p.text,
      theme: p.theme,
      revealedIndices: [],
      teamResults: Object.fromEntries(teams.map(t => [t.id, 'pending' as const])),
      startedAt: Date.now(),
    }));
    // Initialize round results for round 0
    const roundResults: TeamRoundResult[] = teams.map(t => ({
      teamId: t.id,
      roundIndex: 0,
      tier: null,
      revealPercentage: 0,
      wrongGuessCount: 0,
      die1: null,
      die2: null,
      total: null,
      penaltyRolls: [],
    }));
    set({
      game: {
        templateId,
        teams,
        currentRoundIndex: 0,
        rounds,
        roundResults,
        rerollPool: {},
        rerollsUsed: {},
        gameStatus: 'playing',
      },
    });
  },

  clearGame: () => set({ game: null }),

  revealLetter: (index) => {
    const g = get().game;
    if (!g) return;
    const round = g.rounds[g.currentRoundIndex];
    if (round.revealedIndices.includes(index)) return;
    const newRounds = [...g.rounds];
    newRounds[g.currentRoundIndex] = {
      ...round,
      revealedIndices: [...round.revealedIndices, index],
    };
    set({ game: { ...g, rounds: newRounds } });
  },

  revealAll: () => {
    const g = get().game;
    if (!g) return;
    const round = g.rounds[g.currentRoundIndex];
    const allIndices = getLetterIndices(round.phrase);
    const newRounds = [...g.rounds];
    newRounds[g.currentRoundIndex] = { ...round, revealedIndices: allIndices };
    set({ game: { ...g, rounds: newRounds } });
  },

  nextRound: () => {
    const g = get().game;
    if (!g) return;
    if (g.currentRoundIndex >= g.rounds.length - 1) {
      set({ game: { ...g, gameStatus: 'finale' } });
    } else {
      const nextIdx = g.currentRoundIndex + 1;
      // Initialize round results for next round
      const newResults = [...g.roundResults];
      for (const t of g.teams) {
        if (!getResult(newResults, t.id, nextIdx)) {
          newResults.push({
            teamId: t.id,
            roundIndex: nextIdx,
            tier: null,
            revealPercentage: 0,
            wrongGuessCount: 0,
            die1: null,
            die2: null,
            total: null,
            penaltyRolls: [],
          });
        }
      }
      // Update round startedAt
      const newRounds = [...g.rounds];
      newRounds[nextIdx] = { ...newRounds[nextIdx], startedAt: Date.now() };
      set({ game: { ...g, currentRoundIndex: nextIdx, roundResults: newResults, rounds: newRounds } });
    }
  },

  goToFinale: () => {
    const g = get().game;
    if (!g) return;
    set({ game: { ...g, gameStatus: 'finale' } });
  },

  awardCorrect: (teamId) => {
    const g = get().game;
    if (!g) return;
    const round = g.rounds[g.currentRoundIndex];
    const pct = getRevealPercentage(round);
    const tier = determineTier(pct);

    let results = ensureResult(g.roundResults, teamId, g.currentRoundIndex);
    results = updateResult(results, teamId, g.currentRoundIndex, r => ({
      ...r,
      tier,
      revealPercentage: pct,
    }));

    const newRounds = [...g.rounds];
    newRounds[g.currentRoundIndex] = {
      ...round,
      teamResults: { ...round.teamResults, [teamId]: 'solved' },
    };

    set({ game: { ...g, roundResults: results, rounds: newRounds } });
  },

  awardWrong: (teamId) => {
    const g = get().game;
    if (!g) return;

    let results = ensureResult(g.roundResults, teamId, g.currentRoundIndex);
    results = updateResult(results, teamId, g.currentRoundIndex, r => ({
      ...r,
      wrongGuessCount: r.wrongGuessCount + 1,
      penaltyRolls: [...r.penaltyRolls, { die1: null, die2: null, total: null }],
    }));

    set({ game: { ...g, roundResults: results } });
  },

  updateTeamName: (teamId, name) => {
    const g = get().game;
    if (!g) return;
    const teams = g.teams.map(t => t.id === teamId ? { ...t, name } : t);
    set({ game: { ...g, teams } });
  },

  // ─── Edit modal actions ───
  setRoundTier: (teamId, roundIndex, tier) => {
    const g = get().game;
    if (!g) return;
    let results = ensureResult(g.roundResults, teamId, roundIndex);
    results = updateResult(results, teamId, roundIndex, r => ({ ...r, tier }));
    // Also update round teamResults
    const newRounds = [...g.rounds];
    if (tier !== null) {
      newRounds[roundIndex] = {
        ...newRounds[roundIndex],
        teamResults: { ...newRounds[roundIndex].teamResults, [teamId]: 'solved' },
      };
    } else {
      newRounds[roundIndex] = {
        ...newRounds[roundIndex],
        teamResults: { ...newRounds[roundIndex].teamResults, [teamId]: 'pending' },
      };
    }
    set({ game: { ...g, roundResults: results, rounds: newRounds } });
  },

  setRoundWrongCount: (teamId, roundIndex, count) => {
    const g = get().game;
    if (!g) return;
    let results = ensureResult(g.roundResults, teamId, roundIndex);
    results = updateResult(results, teamId, roundIndex, r => {
      const penaltyRolls = [...r.penaltyRolls];
      while (penaltyRolls.length < count) {
        penaltyRolls.push({ die1: null, die2: null, total: null });
      }
      while (penaltyRolls.length > count) {
        penaltyRolls.pop();
      }
      return { ...r, wrongGuessCount: count, penaltyRolls };
    });
    set({ game: { ...g, roundResults: results } });
  },

  removeRoundResult: (teamId, roundIndex) => {
    const g = get().game;
    if (!g) return;
    const results = g.roundResults.filter(
      r => !(r.teamId === teamId && r.roundIndex === roundIndex)
    );
    const newRounds = [...g.rounds];
    newRounds[roundIndex] = {
      ...newRounds[roundIndex],
      teamResults: { ...newRounds[roundIndex].teamResults, [teamId]: 'pending' },
    };
    set({ game: { ...g, roundResults: results, rounds: newRounds } });
  },

  addRoundResult: (teamId, roundIndex, tier) => {
    const g = get().game;
    if (!g) return;
    let results = ensureResult(g.roundResults, teamId, roundIndex);
    results = updateResult(results, teamId, roundIndex, r => ({ ...r, tier }));
    const newRounds = [...g.rounds];
    newRounds[roundIndex] = {
      ...newRounds[roundIndex],
      teamResults: { ...newRounds[roundIndex].teamResults, [teamId]: 'solved' },
    };
    set({ game: { ...g, roundResults: results, rounds: newRounds } });
  },

  // ─── Finale actions ───
  initFinale: () => {
    const g = get().game;
    if (!g) return;
    // Re-roll pool = rounds played (up to currentRoundIndex+1) / 2, rounded up
    const roundsPlayed = g.currentRoundIndex + 1;
    const pool = Math.ceil(roundsPlayed / 2);
    const rerollPool: Record<string, number> = {};
    const rerollsUsed: Record<string, number> = {};
    for (const t of g.teams) {
      rerollPool[t.id] = pool;
      rerollsUsed[t.id] = 0;
    }
    set({ game: { ...g, rerollPool, rerollsUsed } });
  },

  rollRoundDice: (roundIndex) => {
    const g = get().game;
    if (!g) return;
    const results = g.roundResults.map(r => {
      if (r.roundIndex !== roundIndex || r.tier === null || r.die1 !== null) return r;
      const range = TIER_RANGES[r.tier];
      const d1 = randInRange(range.min, range.max);
      const d2 = randInRange(range.min, range.max);
      return { ...r, die1: d1, die2: d2, total: d1 + d2 };
    });
    set({ game: { ...g, roundResults: results } });
  },

  rerollDice: (teamId, roundIndex, which) => {
    const g = get().game;
    if (!g) return;
    const pool = g.rerollPool[teamId] ?? 0;
    if (pool <= 0) return;

    const results = g.roundResults.map(r => {
      if (r.teamId !== teamId || r.roundIndex !== roundIndex || r.tier === null) return r;
      const range = TIER_RANGES[r.tier];
      let d1 = r.die1!;
      let d2 = r.die2!;
      if (which === 'die1' || which === 'both') d1 = randInRange(range.min, range.max);
      if (which === 'die2' || which === 'both') d2 = randInRange(range.min, range.max);
      return { ...r, die1: d1, die2: d2, total: d1 + d2 };
    });

    set({
      game: {
        ...g,
        roundResults: results,
        rerollPool: { ...g.rerollPool, [teamId]: pool - 1 },
        rerollsUsed: { ...g.rerollsUsed, [teamId]: (g.rerollsUsed[teamId] ?? 0) + 1 },
      },
    });
  },

  rollPenalty: (teamId, roundIndex, penaltyIdx) => {
    const g = get().game;
    if (!g) return;
    const results = g.roundResults.map(r => {
      if (r.teamId !== teamId || r.roundIndex !== roundIndex) return r;
      const penaltyRolls = r.penaltyRolls.map((p, i) => {
        if (i !== penaltyIdx || p.total !== null) return p;
        const d1 = randInRange(PENALTY_RANGE.min, PENALTY_RANGE.max);
        const d2 = randInRange(PENALTY_RANGE.min, PENALTY_RANGE.max);
        return { die1: d1, die2: d2, total: d1 + d2 };
      });
      return { ...r, penaltyRolls };
    });
    set({ game: { ...g, roundResults: results } });
  },

  rollAllPenaltiesForTeam: (teamId) => {
    const g = get().game;
    if (!g) return;
    const results = g.roundResults.map(r => {
      if (r.teamId !== teamId) return r;
      const penaltyRolls = r.penaltyRolls.map(p => {
        if (p.total !== null) return p;
        const d1 = randInRange(PENALTY_RANGE.min, PENALTY_RANGE.max);
        const d2 = randInRange(PENALTY_RANGE.min, PENALTY_RANGE.max);
        return { die1: d1, die2: d2, total: d1 + d2 };
      });
      return { ...r, penaltyRolls };
    });
    set({ game: { ...g, roundResults: results } });
  },
}));
