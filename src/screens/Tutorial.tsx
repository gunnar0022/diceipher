import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import PhraseDisplay from '../components/PhraseDisplay';
import { TEAM_COLORS } from '../constants';
import { TIER_RANGES } from '../stores/gameStore';
import type { Tier } from '../stores/gameStore';
import type { Team, TeamRoundResult } from '../types';

// ─── Hardcoded tutorial data ───

const TUTORIAL_TEAMS: Team[] = [
  { id: 'melon-pan', name: 'Melon Pan', colorIndex: 0 },   // Blue
  { id: 'onigiri',   name: 'Onigiri',   colorIndex: 1 },   // Red
  { id: 'mugicha',   name: 'Mugicha',   colorIndex: 2 },   // Green
  { id: 'mochi',     name: 'Mochi',     colorIndex: 3 },    // Amber
  { id: 'udon',      name: 'Udon',      colorIndex: 4 },    // Purple
];

const PHRASES = ['Good morning', 'Thank you very much'];

// Letter indices for "Good morning" (only letters, no space)
// G=0 o=1 o=2 d=3 ' '=4 m=5 o=6 r=7 n=8 i=9 n=10 g=11
function getLetterIndicesFor(phrase: string): number[] {
  const indices: number[] = [];
  for (let i = 0; i < phrase.length; i++) {
    if (/[a-zA-Z0-9]/.test(phrase[i])) indices.push(i);
  }
  return indices;
}

// ─── Beat definitions ───
// Each beat describes what happens and whether to pause

interface Beat {
  id: string;
  act: 'gameplay' | 'finale';
  caption?: string;
  pause: boolean;
  delay?: number; // auto-advance delay if not pause (ms)
}

const BEATS: Beat[] = [
  // ── Act 1: The Puzzle ──
  { id: '1.1-phrase',       act: 'gameplay', caption: 'A hidden phrase! Solve it to earn points.',           pause: true },
  { id: '1.2-reveal',       act: 'gameplay', caption: undefined,                                            pause: false, delay: 2000 },
  { id: '1.2b-reveal-cap',  act: 'gameplay', caption: 'Letters are revealed one at a time.',                 pause: true },
  { id: '1.3-theme',        act: 'gameplay', caption: 'A hint can be revealed to help.',                     pause: true },
  { id: '1.4-wrong',        act: 'gameplay', caption: 'Wrong guess! That earns a penalty die.',              pause: true },
  { id: '1.6a-gold',        act: 'gameplay', caption: 'Solved early \u2014 Gold tier! (40-100 points)',      pause: true },
  { id: '1.6b-silver',      act: 'gameplay', caption: 'Solved in the middle \u2014 Silver tier! (20-80 points)', pause: true },
  { id: '1.6c-bronze',      act: 'gameplay', caption: 'Solved late \u2014 Bronze tier. (0-60 points)',       pause: true },
  { id: '1.7-round2',       act: 'gameplay', caption: undefined,                                            pause: false, delay: 4000 },
  { id: '1.7b-round2-done', act: 'gameplay', caption: 'After all rounds \u2014 time for the finale!',       pause: true },

  // ── Act 2: Finale — Success Rolls ──
  { id: '2.0-intro',        act: 'finale', caption: 'Each team has 1 re-roll. (Total rounds \u00f7 2 = 1)', pause: true },
  { id: '2.1-r1-roll',      act: 'finale', caption: undefined,                                              pause: false, delay: 2000 },
  { id: '2.1b-r1-rolled',   act: 'finale', caption: undefined,                                              pause: true },
  { id: '2.2a-melon-pre',   act: 'finale', caption: 'Melon Pan rolled low for Gold. Re-roll both dice?',    pause: true },
  { id: '2.2b-melon-post',  act: 'finale', caption: 'Much better! 42 \u2192 78.',                           pause: true },
  { id: '2.3a-onigiri-pre', act: 'finale', caption: 'Onigiri has a decent 65. Re-roll both?',               pause: true },
  { id: '2.3b-onigiri-post',act: 'finale', caption: 'Ouch! 65 \u2192 38. Must take the new result!',        pause: true },
  { id: '2.4a-mugicha-pre', act: 'finale', caption: "Mugicha's Bronze 28 is low. Worth a re-roll.",         pause: true },
  { id: '2.4b-mugicha-post',act: 'finale', caption: '28 \u2192 52. A solid recovery.',                      pause: true },
  { id: '2.5a-mochi-pre',   act: 'finale', caption: "Mochi's Die 1 is only 22, but Die 2 is 48. Re-roll just Die 1?", pause: true },
  { id: '2.5b-mochi-post',  act: 'finale', caption: 'Smart! Kept the 48, improved the 22 \u2192 41. Total: 89!', pause: true },
  { id: '2.6-udon-hold',    act: 'finale', caption: 'Udon has 72 \u2014 a strong Silver. They hold.',       pause: true },
  { id: '2.7-absorb',       act: 'finale', caption: 'All re-rolls used! On to Round 2.',                    pause: true },
  { id: '2.8-r2-roll',      act: 'finale', caption: undefined,                                              pause: false, delay: 2000 },
  { id: '2.8b-r2-rolled',   act: 'finale', caption: 'No re-rolls left! These results are final.',           pause: true },
  { id: '2.9-standings',    act: 'finale', caption: 'Current standings... but penalties are coming.',        pause: true },

  // ── Act 3: Penalties ──
  { id: '3.1-splash',       act: 'finale', caption: undefined,                                              pause: false, delay: 2500 },
  { id: '3.2a-onigiri-pen', act: 'finale', caption: 'Onigiri: -19 penalty!',                                pause: false, delay: 2500 },
  { id: '3.2b-mugicha-pen1',act: 'finale', caption: undefined,                                              pause: false, delay: 2500 },
  { id: '3.2c-mugicha-pen2',act: 'finale', caption: 'Mugicha: TWO penalties! -41 total! From 3rd to last!', pause: true },
  { id: '3.2d-mochi-pen',   act: 'finale', caption: 'Mochi drops to 2nd! One mistake cost them the lead.',  pause: true },

  // ── Act 4: Results ──
  { id: '4.1-final',        act: 'finale', caption: 'Final standings! Melon Pan wins with smart play and zero penalties!', pause: true },
  { id: '4.2-awards',       act: 'finale', caption: undefined,                                              pause: false, delay: 8000 },
  { id: '4.3-end',          act: 'finale', caption: "That's Diceipher! Ready to play?",                     pause: true },
];

// ─── Hardcoded dice results ───

// Round 1 initial rolls
const R1_ROLLS: Record<string, { tier: Tier; d1: number; d2: number }> = {
  'melon-pan': { tier: 'gold',   d1: 22, d2: 20 },   // 42
  'onigiri':   { tier: 'silver', d1: 35, d2: 30 },    // 65
  'mugicha':   { tier: 'bronze', d1: 12, d2: 16 },    // 28
  'mochi':     { tier: 'gold',   d1: 22, d2: 48 },    // 70
  'udon':      { tier: 'silver', d1: 38, d2: 34 },    // 72
};

// Round 1 re-rolls
const R1_REROLLS: Record<string, { d1: number; d2: number }> = {
  'melon-pan': { d1: 38, d2: 40 },  // 78
  'onigiri':   { d1: 15, d2: 23 },  // 38
  'mugicha':   { d1: 25, d2: 27 },  // 52
  'mochi':     { d1: 41, d2: 48 },  // 89 (only die1 re-rolled)
};

// Round 2 rolls (no re-rolls)
const R2_ROLLS: Record<string, { tier: Tier; d1: number; d2: number }> = {
  'melon-pan': { tier: 'silver', d1: 28, d2: 27 },   // 55
  'onigiri':   { tier: 'gold',   d1: 43, d2: 39 },    // 82
  'mugicha':   { tier: 'gold',   d1: 35, d2: 36 },    // 71
  'mochi':     { tier: 'silver', d1: 20, d2: 25 },     // 45
  'udon':      { tier: 'bronze', d1:  5, d2: 10 },     // 15
};

// Penalties
const PENALTIES: Record<string, { d1: number; d2: number }[]> = {
  'onigiri':   [{ d1: 8, d2: 11 }],                     // -19
  'mugicha':   [{ d1: 6, d2: 9 }, { d1: 12, d2: 14 }], // -15, -26
  'mochi':     [{ d1: 7, d2: 8 }],                       // -15
};

// ─── Tutorial state snapshots for each beat ───

function getTierColor(tier: Tier | null): string {
  if (!tier) return '#6B7280';
  return TIER_RANGES[tier].color;
}

// ─── Component ───

export default function Tutorial() {
  const navigate = useNavigate();
  const [beatIndex, setBeatIndex] = useState(0);
  const beatIndexRef = useRef(0);
  const [waiting, setWaiting] = useState(true); // waiting for click to start

  // Gameplay state
  const [revealedIndices, setRevealedIndices] = useState<number[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [themeVisible, setThemeVisible] = useState(false);
  const [teamSolved, setTeamSolved] = useState<Record<string, Tier | null>>({});
  const [teamWrong, setTeamWrong] = useState<Record<string, number>>({});
  const [flashTeam, setFlashTeam] = useState<{ id: string; color: string } | null>(null);

  // Finale state
  const [finaleRound, setFinaleRound] = useState(0); // which round we're rolling for
  const [rollResults, setRollResults] = useState<Record<string, { tier: Tier; d1: number; d2: number; total: number }[]>>({});
  const [rollingAnims, setRollingAnims] = useState<Record<string, { d1: number; d2: number } | null>>({});
  const [rerollsLeft, setRerollsLeft] = useState<Record<string, number>>({});
  const [showPenaltySplash, setShowPenaltySplash] = useState(false);
  const [penaltyFrozen, setPenaltyFrozen] = useState<Record<string, number>>({});
  const [penaltyAnimating, setPenaltyAnimating] = useState<Set<string>>(new Set());
  const [penaltyAnimValues, setPenaltyAnimValues] = useState<Record<string, { d1: number; d2: number }>>({});
  const [penaltyDeducted, setPenaltyDeducted] = useState<Record<string, number>>({}); // cumulative deducted
  const [showAwards, setShowAwards] = useState(false);
  const [awardIndex, setAwardIndex] = useState(-1);
  const [showFinalButtons, setShowFinalButtons] = useState(false);
  const [showPenaltyPhase, setShowPenaltyPhase] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval>[]>([]);

  // Cleanup
  useEffect(() => {
    return () => {
      timerRef.current.forEach(clearTimeout);
      intervalRef.current.forEach(clearInterval);
    };
  }, []);

  const beat = BEATS[beatIndex];
  const isFinale = beat?.act === 'finale';

  // ─── Score calculation ───
  const getTeamScore = useCallback((teamId: string) => {
    const rounds = rollResults[teamId] ?? [];
    let score = rounds.reduce((s, r) => s + r.total, 0);
    score -= (penaltyDeducted[teamId] ?? 0);
    return score;
  }, [rollResults, penaltyDeducted]);

  // ─── Tier counts for team cards ───
  const getTeamTierCounts = useCallback((teamId: string) => {
    const rounds = rollResults[teamId] ?? [];
    return {
      gold: rounds.filter(r => r.tier === 'gold').length,
      silver: rounds.filter(r => r.tier === 'silver').length,
      bronze: rounds.filter(r => r.tier === 'bronze').length,
    };
  }, [rollResults]);

  // ─── Run a scramble animation then freeze ───
  const runScramble = useCallback((
    teamId: string,
    tier: Tier,
    finalD1: number,
    finalD2: number,
    onDone: () => void,
    duration = 1200,
  ) => {
    const range = TIER_RANGES[tier];
    setRollingAnims(prev => ({ ...prev, [teamId]: null }));

    let frame = 0;
    const interval = setInterval(() => {
      frame++;
      setRollingAnims(prev => ({
        ...prev,
        [teamId]: {
          d1: range.min + Math.floor(Math.random() * (range.max - range.min + 1)),
          d2: range.min + Math.floor(Math.random() * (range.max - range.min + 1)),
        },
      }));
      if (frame >= Math.floor(duration / 80)) {
        clearInterval(interval);
        setRollingAnims(prev => {
          const next = { ...prev };
          delete next[teamId];
          return next;
        });
        onDone();
      }
    }, 80);
    intervalRef.current.push(interval);
  }, []);

  // ─── Run a penalty scramble ───
  const runPenaltyScramble = useCallback((
    teamId: string,
    finalD1: number,
    finalD2: number,
    onDone: () => void,
  ) => {
    setPenaltyAnimating(prev => new Set([...prev, teamId]));
    let frame = 0;
    const interval = setInterval(() => {
      frame++;
      setPenaltyAnimValues(prev => ({
        ...prev,
        [teamId]: {
          d1: 5 + Math.floor(Math.random() * 11),
          d2: 5 + Math.floor(Math.random() * 11),
        },
      }));
      if (frame >= 18) {
        clearInterval(interval);
        setPenaltyAnimating(prev => {
          const next = new Set(prev);
          next.delete(teamId);
          return next;
        });
        setPenaltyAnimValues(prev => {
          const next = { ...prev };
          delete next[teamId];
          return next;
        });
        const total = finalD1 + finalD2;
        setPenaltyFrozen(prev => ({ ...prev, [teamId]: total }));
        setPenaltyDeducted(prev => ({ ...prev, [teamId]: (prev[teamId] ?? 0) + total }));
        onDone();
      }
    }, 80);
    intervalRef.current.push(interval);
  }, []);

  // ─── Execute a beat ───
  const executeBeat = useCallback((idx: number) => {
    const b = BEATS[idx];
    if (!b) return;

    switch (b.id) {
      // ── Act 1 ──
      case '1.1-phrase':
        setCurrentRound(0);
        setRevealedIndices([]);
        setThemeVisible(false);
        setTeamSolved({});
        setTeamWrong({});
        break;

      case '1.2-reveal': {
        // Auto-reveal 3 letters: G(0), o(6), m(5) with staggered timing
        const indices = [0, 6, 5];
        indices.forEach((idx, i) => {
          const t = setTimeout(() => {
            setRevealedIndices(prev => [...prev, idx]);
          }, i * 500);
          timerRef.current.push(t);
        });
        break;
      }

      case '1.2b-reveal-cap':
        // Already revealed 3 letters, just show caption
        break;

      case '1.3-theme':
        setThemeVisible(true);
        break;

      case '1.4-wrong':
        setTeamWrong(prev => ({ ...prev, 'mugicha': 1 }));
        setFlashTeam({ id: 'mugicha', color: '#DC2626' });
        const t1 = setTimeout(() => setFlashTeam(null), 600);
        timerRef.current.push(t1);
        break;

      case '1.6a-gold': {
        // Reveal a couple more letters (~35% revealed = ~4 of 11 letters)
        setRevealedIndices(prev => [...new Set([...prev, 0, 6, 5, 1])]);
        // Mochi solves gold
        setTeamSolved(prev => ({ ...prev, 'mochi': 'gold' }));
        setFlashTeam({ id: 'mochi', color: TIER_RANGES.gold.color });
        const t = setTimeout(() => setFlashTeam(null), 600);
        timerRef.current.push(t);
        break;
      }

      case '1.6b-silver': {
        // More letters revealed (~55%)
        setRevealedIndices(prev => [...new Set([...prev, 0, 1, 2, 5, 6, 7])]);
        // Onigiri wrong guess first
        setTeamWrong(prev => ({ ...prev, 'onigiri': 1 }));
        // Melon Pan gold, Onigiri + Udon silver
        setTeamSolved(prev => ({
          ...prev,
          'melon-pan': 'gold',
          'onigiri': 'silver',
          'udon': 'silver',
        }));
        setFlashTeam({ id: 'melon-pan', color: TIER_RANGES.gold.color });
        const t = setTimeout(() => setFlashTeam(null), 600);
        timerRef.current.push(t);
        break;
      }

      case '1.6c-bronze': {
        // All letters revealed
        const allIndices = getLetterIndicesFor(PHRASES[0]);
        setRevealedIndices(allIndices);
        setTeamSolved(prev => ({ ...prev, 'mugicha': 'bronze' }));
        setFlashTeam({ id: 'mugicha', color: TIER_RANGES.bronze.color });
        const t = setTimeout(() => setFlashTeam(null), 600);
        timerRef.current.push(t);
        break;
      }

      case '1.7-round2': {
        // Quick Round 2 setup
        setCurrentRound(1);
        setRevealedIndices([]);
        setThemeVisible(false);
        setTeamSolved({});
        setTeamWrong({});

        // Stagger events for Round 2
        const events = [
          { delay: 500, fn: () => setRevealedIndices([0, 6, 10]) },
          { delay: 1000, fn: () => {
            setTeamWrong(prev => ({ ...prev, 'mugicha': 1 }));
            setFlashTeam({ id: 'mugicha', color: '#DC2626' });
          }},
          { delay: 1300, fn: () => setFlashTeam(null) },
          { delay: 1500, fn: () => setRevealedIndices([0, 6, 10, 1, 14, 18]) },
          { delay: 2000, fn: () => {
            setTeamSolved(prev => ({ ...prev, 'mugicha': 'gold', 'onigiri': 'gold' }));
            setFlashTeam({ id: 'onigiri', color: TIER_RANGES.gold.color });
          }},
          { delay: 2300, fn: () => setFlashTeam(null) },
          { delay: 2500, fn: () => {
            setTeamWrong(prev => ({ ...prev, 'mochi': 1 }));
            setRevealedIndices(prev => [...new Set([...prev, 2, 3, 7, 8, 11, 12, 15])]);
          }},
          { delay: 2800, fn: () => {
            setTeamSolved(prev => ({ ...prev, 'mochi': 'silver', 'melon-pan': 'silver' }));
          }},
          { delay: 3200, fn: () => {
            const allIdx = getLetterIndicesFor(PHRASES[1]);
            setRevealedIndices(allIdx);
            setTeamSolved(prev => ({ ...prev, 'udon': 'bronze' }));
          }},
        ];
        events.forEach(e => {
          const t = setTimeout(e.fn, e.delay);
          timerRef.current.push(t);
        });
        break;
      }

      case '1.7b-round2-done':
        break;

      // ── Act 2: Finale ──
      case '2.0-intro':
        setFinaleRound(0);
        setRollResults({});
        setRerollsLeft(Object.fromEntries(TUTORIAL_TEAMS.map(t => [t.id, 1])));
        setPenaltyDeducted({});
        setPenaltyFrozen({});
        setShowPenaltySplash(false);
        setShowAwards(false);
        setShowFinalButtons(false);
        setShowPenaltyPhase(false);
        break;

      case '2.1-r1-roll': {
        // Scramble all teams for Round 1
        setFinaleRound(0);
        let done = 0;
        const total = TUTORIAL_TEAMS.length;
        TUTORIAL_TEAMS.forEach(team => {
          const r = R1_ROLLS[team.id];
          runScramble(team.id, r.tier, r.d1, r.d2, () => {
            setRollResults(prev => ({
              ...prev,
              [team.id]: [...(prev[team.id] ?? []), { tier: r.tier, d1: r.d1, d2: r.d2, total: r.d1 + r.d2 }],
            }));
            done++;
          });
        });
        break;
      }

      case '2.1b-r1-rolled':
        break;

      case '2.2a-melon-pre':
        break;

      case '2.2b-melon-post': {
        const rr = R1_REROLLS['melon-pan'];
        runScramble('melon-pan', 'gold', rr.d1, rr.d2, () => {
          setRollResults(prev => {
            const rounds = [...(prev['melon-pan'] ?? [])];
            rounds[0] = { tier: 'gold', d1: rr.d1, d2: rr.d2, total: rr.d1 + rr.d2 };
            return { ...prev, 'melon-pan': rounds };
          });
          setRerollsLeft(prev => ({ ...prev, 'melon-pan': 0 }));
        });
        break;
      }

      case '2.3a-onigiri-pre':
        break;

      case '2.3b-onigiri-post': {
        const rr = R1_REROLLS['onigiri'];
        runScramble('onigiri', 'silver', rr.d1, rr.d2, () => {
          setRollResults(prev => {
            const rounds = [...(prev['onigiri'] ?? [])];
            rounds[0] = { tier: 'silver', d1: rr.d1, d2: rr.d2, total: rr.d1 + rr.d2 };
            return { ...prev, 'onigiri': rounds };
          });
          setRerollsLeft(prev => ({ ...prev, 'onigiri': 0 }));
        });
        break;
      }

      case '2.4a-mugicha-pre':
        break;

      case '2.4b-mugicha-post': {
        const rr = R1_REROLLS['mugicha'];
        runScramble('mugicha', 'bronze', rr.d1, rr.d2, () => {
          setRollResults(prev => {
            const rounds = [...(prev['mugicha'] ?? [])];
            rounds[0] = { tier: 'bronze', d1: rr.d1, d2: rr.d2, total: rr.d1 + rr.d2 };
            return { ...prev, 'mugicha': rounds };
          });
          setRerollsLeft(prev => ({ ...prev, 'mugicha': 0 }));
        });
        break;
      }

      case '2.5a-mochi-pre':
        break;

      case '2.5b-mochi-post': {
        const rr = R1_REROLLS['mochi'];
        runScramble('mochi', 'gold', rr.d1, rr.d2, () => {
          setRollResults(prev => {
            const rounds = [...(prev['mochi'] ?? [])];
            rounds[0] = { tier: 'gold', d1: rr.d1, d2: rr.d2, total: rr.d1 + rr.d2 };
            return { ...prev, 'mochi': rounds };
          });
          setRerollsLeft(prev => ({ ...prev, 'mochi': 0 }));
        });
        break;
      }

      case '2.6-udon-hold':
        // Udon holds, use up reroll for consistency
        setRerollsLeft(prev => ({ ...prev, 'udon': 0 }));
        break;

      case '2.7-absorb':
        break;

      case '2.8-r2-roll': {
        setFinaleRound(1);
        TUTORIAL_TEAMS.forEach(team => {
          const r = R2_ROLLS[team.id];
          runScramble(team.id, r.tier, r.d1, r.d2, () => {
            setRollResults(prev => ({
              ...prev,
              [team.id]: [...(prev[team.id] ?? []), { tier: r.tier, d1: r.d1, d2: r.d2, total: r.d1 + r.d2 }],
            }));
          });
        });
        break;
      }

      case '2.8b-r2-rolled':
        break;

      case '2.9-standings':
        break;

      // ── Act 3: Penalties ──
      case '3.1-splash':
        setShowPenaltySplash(true);
        setShowPenaltyPhase(true);
        const splashT = setTimeout(() => setShowPenaltySplash(false), 2000);
        timerRef.current.push(splashT);
        break;

      case '3.2a-onigiri-pen': {
        const pen = PENALTIES['onigiri'][0];
        runPenaltyScramble('onigiri', pen.d1, pen.d2, () => {});
        break;
      }

      case '3.2b-mugicha-pen1': {
        const pen = PENALTIES['mugicha'][0];
        runPenaltyScramble('mugicha', pen.d1, pen.d2, () => {});
        break;
      }

      case '3.2c-mugicha-pen2': {
        // Clear frozen for mugicha before second penalty
        setPenaltyFrozen(prev => {
          const next = { ...prev };
          delete next['mugicha'];
          return next;
        });
        const pen = PENALTIES['mugicha'][1];
        runPenaltyScramble('mugicha', pen.d1, pen.d2, () => {});
        break;
      }

      case '3.2d-mochi-pen': {
        const pen = PENALTIES['mochi'][0];
        runPenaltyScramble('mochi', pen.d1, pen.d2, () => {});
        break;
      }

      // ── Act 4: Results ──
      case '4.1-final':
        // Clear frozen penalties for clean display
        setPenaltyFrozen({});
        break;

      case '4.2-awards': {
        setShowAwards(true);
        const awards = [
          { icon: '\u{1F3CE}\uFE0F', title: 'Fastest Solver', team: 'Mochi' },
          { icon: '\u{1F9F9}', title: 'Clean Run', team: 'Melon Pan' },
          { icon: '\u{1F6E1}\uFE0F', title: 'Fewest Penalties', team: 'Melon Pan & Udon' },
          { icon: '\u{1F340}', title: 'Lucky Roller', team: 'Mochi' },
        ];
        awards.forEach((_, i) => {
          const t = setTimeout(() => setAwardIndex(i), 1500 + i * 1500);
          timerRef.current.push(t);
        });
        break;
      }

      case '4.3-end':
        setShowFinalButtons(true);
        break;
    }
  }, [runScramble, runPenaltyScramble]);

  // ─── Advance to next beat ───
  // Uses ref to avoid stale closure in setTimeout chains
  const advance = useCallback(() => {
    const nextIdx = beatIndexRef.current + 1;
    if (nextIdx >= BEATS.length) return;

    beatIndexRef.current = nextIdx;
    setBeatIndex(nextIdx);
    setWaiting(false);

    // Execute the beat
    executeBeat(nextIdx);

    const nextBeat = BEATS[nextIdx];
    if (nextBeat.pause) {
      setWaiting(true);
    } else if (nextBeat.delay) {
      const t = setTimeout(() => advance(), nextBeat.delay);
      timerRef.current.push(t);
    }
  }, [executeBeat]);

  // Initial beat execution
  useEffect(() => {
    executeBeat(0);
    setWaiting(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = () => {
    if (!waiting) return;
    advance();
  };

  // ─── Computed scores for finale bars ───
  const teamScores = TUTORIAL_TEAMS.map(t => ({
    team: t,
    score: getTeamScore(t.id),
  }));
  const sortedScores = [...teamScores].sort((a, b) => a.score - b.score);
  const maxScore = Math.max(20, ...teamScores.map(s => Math.abs(s.score)));

  // ─── Current round data for display ───
  const currentPhrase = PHRASES[currentRound] ?? '';

  // Awards data
  const AWARDS = [
    { icon: '\u{1F3CE}\uFE0F', title: 'Fastest Solver', team: 'Mochi', detail: 'Solved Round 1 first!' },
    { icon: '\u{1F9F9}', title: 'Clean Run', team: 'Melon Pan', detail: '2 rounds, 0 penalties!' },
    { icon: '\u{1F6E1}\uFE0F', title: 'Fewest Penalties', team: 'Melon Pan & Udon', detail: '0 penalty dice!' },
    { icon: '\u{1F340}', title: 'Lucky Roller', team: 'Mochi', detail: 'Rolled 89 in one round!' },
  ];

  // ─── RENDER ───

  return (
    <div
      onClick={handleClick}
      style={{
        minHeight: '100vh',
        background: isFinale ? '#064E3B' : '#ECFDF5',
        color: isFinale ? 'white' : '#064E3B',
        display: 'flex', flexDirection: 'column',
        cursor: waiting ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      {/* Skip button */}
      <button
        onClick={(e) => { e.stopPropagation(); navigate('/'); }}
        style={{
          position: 'fixed', top: 16, right: 16, zIndex: 100,
          background: isFinale ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)',
          color: isFinale ? 'rgba(255,255,255,0.7)' : '#6B7280',
          border: 'none', borderRadius: 8, padding: '8px 16px',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}
      >
        Skip Tutorial
      </button>

      {/* Caption overlay */}
      <AnimatePresence mode="wait">
        {beat?.caption && (
          <motion.div
            key={beat.id}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, zIndex: 90,
              display: 'flex', justifyContent: 'center', padding: '16px 24px',
              pointerEvents: 'none',
            }}
          >
            <div style={{
              background: isFinale ? 'rgba(0,0,0,0.8)' : 'rgba(6,78,59,0.9)',
              color: 'white', borderRadius: 12, padding: '14px 28px',
              fontSize: 22, fontWeight: 700, maxWidth: 700, textAlign: 'center',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }}>
              {beat.caption}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Continue indicator */}
      {waiting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ repeat: Infinity, duration: 2 }}
          style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            zIndex: 90, fontSize: 16, fontWeight: 600,
            color: isFinale ? 'rgba(255,255,255,0.6)' : '#6B7280',
            pointerEvents: 'none',
          }}
        >
          Click anywhere to continue
        </motion.div>
      )}

      {/* Penalty Splash overlay */}
      <AnimatePresence>
        {showPenaltySplash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 80,
            }}
          >
            <motion.div
              initial={{ scale: 0.3, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 8, stiffness: 200 }}
            >
              <motion.h1
                animate={{ scale: [1, 1.05, 1], x: [-2, 2, -2, 0] }}
                transition={{ repeat: 3, duration: 0.2 }}
                style={{
                  fontSize: 80, fontWeight: 900, color: '#DC2626',
                  textShadow: '0 0 40px rgba(220,38,38,0.6)', textAlign: 'center',
                }}
              >PENALTY TIME</motion.h1>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════ */}
      {/* GAMEPLAY VIEW (Act 1) */}
      {/* ═══════════════════════════════════════ */}
      {!isFinale && (
        <>
          {/* Top Bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 24px', background: '#F0FDF4', borderBottom: '1px solid #A7F3D0',
            boxShadow: '0 1px 3px rgba(5,150,105,0.08)', flexShrink: 0,
          }}>
            <span style={{ fontSize: 16, color: '#059669', fontWeight: 600 }}>Tutorial</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#064E3B' }}>
              Round {currentRound + 1} / 2
            </span>
            <div style={{ width: 80 }} /> {/* spacer */}
          </div>

          {/* Theme area */}
          {themeVisible && (
            <div style={{ minHeight: 56, display: 'flex', justifyContent: 'center', padding: '10px 24px 0' }}>
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: '#D1FAE5', color: '#065F46', borderRadius: 24,
                  padding: '10px 32px', fontSize: 32, fontWeight: 600,
                  border: '1px solid #A7F3D0',
                }}
              >
                Greetings
              </motion.div>
            </div>
          )}

          {/* Phrase area */}
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', minHeight: 300,
          }}>
            <PhraseDisplay
              phrase={currentPhrase}
              revealedIndices={revealedIndices}
              onReveal={() => {}} // No manual reveal in tutorial
            />
          </div>

          {/* Team Panel */}
          <div style={{
            padding: '20px 24px', background: '#F0FDF4', borderTop: '1px solid #6EE7B7',
            boxShadow: '0 -2px 8px rgba(5,150,105,0.08)',
          }}>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center',
            }}>
              {TUTORIAL_TEAMS.map(team => {
                const solved = teamSolved[team.id];
                const wrong = teamWrong[team.id] ?? 0;
                const isFlashing = flashTeam?.id === team.id;
                const flashColor = flashTeam?.color;
                const color = TEAM_COLORS[team.colorIndex];

                return (
                  <motion.div
                    key={team.id}
                    animate={{
                      borderColor: isFlashing ? flashColor : '#A7F3D0',
                      boxShadow: isFlashing
                        ? `0 0 20px ${flashColor}66`
                        : '0 2px 6px rgba(5,150,105,0.08)',
                    }}
                    transition={{ duration: 0.3 }}
                    style={{
                      background: '#F0FDF4', borderRadius: 14, padding: '18px 20px',
                      border: '2px solid #A7F3D0', position: 'relative',
                      width: 200, flexShrink: 0, flexGrow: 0,
                    }}
                  >
                    {/* Team name + color */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, height: 24 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', background: color, flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 18, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#064E3B', flex: 1, minWidth: 0 }}>
                        {team.name}
                      </span>
                      {solved && <span style={{ fontSize: 20, flexShrink: 0, color: '#22C55E' }}>{'\u2713'}</span>}
                    </div>

                    {/* Tier display */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: 4, marginBottom: 14, textAlign: 'center', minHeight: 30, alignItems: 'center',
                    }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: solved === 'gold' ? TIER_RANGES.gold.color : '#D1D5DB' }}>
                        {'\u{1F947}'}{solved === 'gold' ? 1 : 0}
                      </span>
                      <span style={{ fontSize: 20, fontWeight: 800, color: solved === 'silver' ? '#94A3B8' : '#D1D5DB' }}>
                        {'\u{1F948}'}{solved === 'silver' ? 1 : 0}
                      </span>
                      <span style={{ fontSize: 20, fontWeight: 800, color: solved === 'bronze' ? TIER_RANGES.bronze.color : '#D1D5DB' }}>
                        {'\u{1F949}'}{solved === 'bronze' ? 1 : 0}
                      </span>
                      <span style={{ fontSize: 20, fontWeight: 800, color: wrong > 0 ? '#DC2626' : '#D1D5DB' }}>
                        {'\u274C'}{wrong}
                      </span>
                    </div>

                    {/* Buttons (disabled in tutorial) */}
                    {!solved && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button style={{
                          flex: 1, padding: '10px 12px', borderRadius: 8, border: 'none',
                          background: '#22C55E', color: 'white', fontSize: 16, fontWeight: 700,
                          opacity: 0.5,
                        }}>{'\u2713'} Correct</button>
                        <button style={{
                          flex: 1, padding: '10px 12px', borderRadius: 8, border: 'none',
                          background: '#DC2626', color: 'white', fontSize: 16, fontWeight: 700,
                          opacity: 0.5,
                        }}>{'\u2717'} Wrong</button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* FINALE VIEW (Acts 2-4) */}
      {/* ═══════════════════════════════════════ */}
      {isFinale && (
        <>
          {/* Header */}
          <div style={{
            padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid rgba(167,243,208,0.2)', flexShrink: 0,
          }}>
            <h1 style={{ fontSize: 22, fontWeight: 800 }}>
              {showAwards ? '\u{1F3C6} Final Results'
                : showPenaltyPhase ? '\u{1F534} Penalty Round'
                : `Round ${finaleRound + 1}`}
            </h1>
            <div style={{ display: 'flex', gap: 24, fontSize: 22, fontWeight: 700,
              background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 28px',
            }}>
              <span style={{ color: TIER_RANGES.gold.color }}>{'\u{1F947}'} 40{'\u2013'}100</span>
              <span style={{ color: '#E2E8F0' }}>{'\u{1F948}'} 20{'\u2013'}80</span>
              <span style={{ color: TIER_RANGES.bronze.color }}>{'\u{1F949}'} 0{'\u2013'}60</span>
            </div>
          </div>

          {/* Round phrase display */}
          {!showAwards && !showPenaltyPhase && (
            <div style={{ textAlign: 'center', padding: '16px 40px 0', flexShrink: 0 }}>
              <div style={{
                fontSize: 52, fontWeight: 800, color: 'rgba(240,253,244,0.85)',
                letterSpacing: '1px',
              }}>
                {PHRASES[finaleRound] ?? ''}
              </div>
            </div>
          )}

          {/* Bar Graph */}
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px 40px 16px',
          }}>
            <div style={{
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              gap: 24, width: '100%', maxWidth: 1300,
            }}>
              {sortedScores.map(({ team, score }) => {
                const barHeight = maxScore > 0 ? Math.max(8, (Math.abs(score) / maxScore) * 312) : 8;
                const isNegative = score < 0;
                const color = TEAM_COLORS[team.colorIndex];
                const anim = rollingAnims[team.id];

                // Current round result for this team
                const rounds = rollResults[team.id] ?? [];
                const curRound = rounds[finaleRound];

                // Penalty state
                const isPenAnim = penaltyAnimating.has(team.id);
                const penAnim = penaltyAnimValues[team.id];
                const frozenPen = penaltyFrozen[team.id];
                const hasFrozenPen = frozenPen !== undefined && frozenPen > 0;

                return (
                  <motion.div
                    key={team.id}
                    layout
                    transition={{ duration: 0.5, ease: 'easeInOut' }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      width: `${Math.max(84, Math.min(168, 1200 / TUTORIAL_TEAMS.length))}px`,
                    }}
                  >
                    {/* Roll result display */}
                    <AnimatePresence mode="wait">
                      {/* Rolling animation */}
                      {anim && (
                        <motion.div
                          key="anim"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          style={{
                            fontSize: 22, fontWeight: 800, marginBottom: 5,
                            color: getTierColor(curRound?.tier ?? null),
                            textAlign: 'center', minHeight: 53,
                          }}
                        >
                          <div>{anim.d1} + {anim.d2}</div>
                          <div style={{ fontSize: 34 }}>= {anim.d1 + anim.d2}</div>
                        </motion.div>
                      )}
                      {/* Frozen round result */}
                      {!anim && !isPenAnim && !hasFrozenPen && curRound && !showAwards && !showPenaltyPhase && (
                        <motion.div
                          key="result"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          style={{
                            fontSize: 22, fontWeight: 800, marginBottom: 5,
                            color: getTierColor(curRound.tier),
                            textAlign: 'center', minHeight: 53,
                          }}
                        >
                          <div>{curRound.d1} + {curRound.d2}</div>
                          <div style={{ fontSize: 34 }}>= {curRound.total}</div>
                        </motion.div>
                      )}
                      {/* Penalty scramble */}
                      {isPenAnim && penAnim && (
                        <motion.div
                          key="pen-scramble"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          style={{
                            fontSize: 22, fontWeight: 800, marginBottom: 5,
                            color: '#DC2626', textAlign: 'center', minHeight: 53,
                          }}
                        >
                          <div style={{ fontSize: 34 }}>{'\u2212'}{penAnim.d1 + penAnim.d2}</div>
                        </motion.div>
                      )}
                      {/* Penalty frozen */}
                      {!isPenAnim && hasFrozenPen && (
                        <motion.div
                          key="pen-frozen"
                          initial={{ opacity: 0, scale: 1.2 }}
                          animate={{ opacity: 1, scale: 1 }}
                          style={{
                            fontSize: 22, fontWeight: 900, marginBottom: 5,
                            color: '#FCA5A5', textAlign: 'center', minHeight: 53,
                            textShadow: '0 0 20px rgba(220,38,38,0.5)',
                          }}
                        >
                          <div style={{ fontSize: 38 }}>{'\u2212'}{frozenPen}</div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Score */}
                    <div style={{
                      fontSize: 38, fontWeight: 900, marginBottom: 7,
                      color: isNegative ? '#FCA5A5' : '#F0FDF4',
                    }}>{score}</div>

                    {/* Bar */}
                    <motion.div
                      animate={{ height: barHeight }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      style={{
                        width: '100%', borderRadius: '10px 10px 0 0',
                        background: isNegative
                          ? `linear-gradient(to top, #DC2626, ${color})`
                          : `linear-gradient(to top, ${color}cc, ${color})`,
                        boxShadow: `0 0 24px ${color}40`,
                      }}
                    />

                    {/* Re-roll indicator */}
                    <div style={{ minHeight: 35, marginTop: 7, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                      {!showAwards && !showPenaltyPhase && (rerollsLeft[team.id] ?? 0) > 0 && (
                        <div style={{
                          background: '#D97706', color: 'white', borderRadius: 7,
                          padding: '6px 14px', fontSize: 14, fontWeight: 700,
                          opacity: 0.6,
                        }}>
                          {'\u{1F504}'} Re-roll ({rerollsLeft[team.id]})
                        </div>
                      )}
                    </div>

                    {/* Team name */}
                    <div style={{
                      marginTop: 12, fontSize: 28, fontWeight: 700, textAlign: 'center',
                      color: 'rgba(240,253,244,0.85)', maxWidth: '100%',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{team.name}</div>

                    {/* Position in awards */}
                    {showAwards && (
                      <div style={{
                        marginTop: 5, fontSize: 17, fontWeight: 800,
                        color: sortedScores.indexOf(sortedScores.find(s => s.team.id === team.id)!) === sortedScores.length - 1 ? '#FBBF24' : 'rgba(255,255,255,0.5)',
                      }}>
                        {(() => {
                          const pos = sortedScores.length - sortedScores.findIndex(s => s.team.id === team.id);
                          const suffix = pos === 1 ? 'st' : pos === 2 ? 'nd' : pos === 3 ? 'rd' : 'th';
                          return `${pos}${suffix}`;
                        })()}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Awards display */}
          {showAwards && (
            <div style={{ padding: '24px 40px', flexShrink: 0 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center', marginBottom: 20 }}>
                <AnimatePresence>
                  {AWARDS.slice(0, awardIndex + 1).map(award => (
                    <motion.div
                      key={award.title}
                      initial={{ opacity: 0, y: 30, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                      style={{
                        background: 'rgba(167,243,208,0.1)', borderRadius: 12, padding: '16px 20px',
                        minWidth: 200, textAlign: 'center', border: '1px solid rgba(167,243,208,0.2)',
                      }}
                    >
                      <div style={{ fontSize: 32, marginBottom: 4 }}>{award.icon}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#FBBF24', marginBottom: 4 }}>{award.title}</div>
                      <div style={{ fontSize: 16, fontWeight: 800 }}>{award.team}</div>
                      <div style={{ fontSize: 12, color: 'rgba(240,253,244,0.6)', marginTop: 4 }}>{award.detail}</div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Final buttons */}
              <AnimatePresence>
                {showFinalButtons && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ display: 'flex', justifyContent: 'center', gap: 12 }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Reset tutorial
                        beatIndexRef.current = 0;
                        setBeatIndex(0);
                        setWaiting(true);
                        setRevealedIndices([]);
                        setCurrentRound(0);
                        setThemeVisible(false);
                        setTeamSolved({});
                        setTeamWrong({});
                        setFlashTeam(null);
                        setRollResults({});
                        setRollingAnims({});
                        setRerollsLeft({});
                        setPenaltyDeducted({});
                        setPenaltyFrozen({});
                        setPenaltyAnimating(new Set());
                        setPenaltyAnimValues({});
                        setShowPenaltySplash(false);
                        setShowAwards(false);
                        setAwardIndex(-1);
                        setShowFinalButtons(false);
                        setShowPenaltyPhase(false);
                        executeBeat(0);
                      }}
                      style={{
                        background: 'rgba(167,243,208,0.15)', color: '#A7F3D0',
                        border: '1px solid rgba(167,243,208,0.3)', borderRadius: 10,
                        padding: '12px 24px', fontSize: 16, fontWeight: 700,
                      }}
                    >Play Again</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate('/'); }}
                      style={{
                        background: '#059669', color: '#F0FDF4', border: 'none', borderRadius: 10,
                        padding: '12px 32px', fontSize: 16, fontWeight: 700,
                      }}
                    >Back to Library</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </div>
  );
}
