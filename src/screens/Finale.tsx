import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, TIER_RANGES } from '../stores/gameStore';
import type { Team, TeamRoundResult } from '../types';
import { TEAM_COLORS } from '../constants';

type FinalePhase =
  | 'pre-finale'
  | 'round-roll'
  | 'round-reroll'
  | 'round-absorb'
  | 'penalty-splash'
  | 'penalty-roll'
  | 'penalty-deduct'
  | 'awards';

const SPARKLE_CSS = `
@keyframes sparkle {
  0%, 100% { filter: brightness(1) drop-shadow(0 0 0px transparent); }
  25% { filter: brightness(1.4) drop-shadow(0 0 12px rgba(255,215,0,0.8)); }
  50% { filter: brightness(1.1) drop-shadow(0 0 6px rgba(255,215,0,0.4)); }
  75% { filter: brightness(1.3) drop-shadow(0 0 10px rgba(255,215,0,0.6)); }
}`;

function getTierColor(tier: 'gold' | 'silver' | 'bronze' | null): string {
  if (!tier) return '#6B7280';
  return TIER_RANGES[tier].color;
}

export default function Finale() {
  const navigate = useNavigate();
  const game = useGameStore(s => s.game);
  const {
    rollRoundDice, rerollDice, rollPenalty, clearGame, initFinale,
  } = useGameStore();

  const [phase, setPhase] = useState<FinalePhase>('pre-finale');
  const [currentRoundIdx, setCurrentRoundIdx] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [rollingAnims, setRollingAnims] = useState<Record<string, { d1: number; d2: number } | null>>({});
  const [showRerollFor, setShowRerollFor] = useState<string | null>(null); // teamId
  const [absorbingRound, setAbsorbingRound] = useState<number | null>(null);

  // Penalty phase state — sliding window with up to 3 concurrent animations
  const [penaltyAnimatingTeams, setPenaltyAnimatingTeams] = useState<Set<string>>(new Set());
  const [penaltyAnimValues, setPenaltyAnimValues] = useState<Record<string, { d1: number; d2: number }>>({});
  const [penaltyFrozenTotals, setPenaltyFrozenTotals] = useState<Record<string, number>>({});
  const [penaltyFadingOut, setPenaltyFadingOut] = useState(false);
  const [frozenTeamOrder, setFrozenTeamOrder] = useState<string[] | null>(null);
  const penaltyCleanupRef = useRef<{ intervals: ReturnType<typeof setInterval>[]; timeouts: ReturnType<typeof setTimeout>[] }>({ intervals: [], timeouts: [] });

  // Awards
  const [awardIndex, setAwardIndex] = useState(-1);
  const [showBackButton, setShowBackButton] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const initDone = useRef(false);

  // Cleanup penalty timers on unmount
  useEffect(() => {
    return () => {
      penaltyCleanupRef.current.intervals.forEach(clearInterval);
      penaltyCleanupRef.current.timeouts.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (!game || game.gameStatus !== 'finale') {
      if (!game) navigate('/');
      return;
    }
    if (!initDone.current) {
      initDone.current = true;
      initFinale();
    }
  }, [game, navigate, initFinale]);

  if (!game || game.gameStatus !== 'finale') {
    return null;
  }

  const teams = game.teams;
  const roundsPlayed = game.currentRoundIndex + 1;
  const rerollPoolSize = Math.ceil(roundsPlayed / 2);

  // ─── Score calculation ───
  const getTeamScore = useCallback((team: Team, upToRound?: number) => {
    const results = game.roundResults.filter(r => r.teamId === team.id);
    let score = 0;
    for (const r of results) {
      if (upToRound !== undefined && r.roundIndex > upToRound) continue;
      if (r.total !== null) score += r.total;
      for (const p of r.penaltyRolls) {
        if (p.total !== null) score -= p.total;
      }
    }
    return score;
  }, [game.roundResults]);

  // Score including only absorbed rounds (for visual ordering during rolling)
  const getAbsorbedScore = useCallback((team: Team) => {
    if (absorbingRound !== null) return getTeamScore(team, absorbingRound);
    if (phase === 'round-roll' || phase === 'round-reroll') {
      return getTeamScore(team, currentRoundIdx);
    }
    return getTeamScore(team);
  }, [getTeamScore, absorbingRound, phase, currentRoundIdx]);

  const sortedTeams = useMemo(() => {
    return [...teams].sort((a, b) => getAbsorbedScore(a) - getAbsorbedScore(b));
  }, [teams, getAbsorbedScore]);

  // During penalties, freeze bar order so they don't reorder mid-cascade
  const displayTeams = useMemo(() => {
    if (frozenTeamOrder) {
      return frozenTeamOrder.map(id => teams.find(t => t.id === id)!).filter(Boolean);
    }
    return sortedTeams;
  }, [frozenTeamOrder, teams, sortedTeams]);

  const maxScore = useMemo(() => {
    const scores = teams.map(t => getTeamScore(t));
    return Math.max(20, ...scores.map(Math.abs), ...scores);
  }, [teams, getTeamScore]);

  // ─── Segments per team (for stacked bar) ───
  const getSegments = useCallback((team: Team) => {
    const results = game.roundResults
      .filter(r => r.teamId === team.id && r.total !== null)
      .sort((a, b) => a.roundIndex - b.roundIndex);

    return results.map(r => ({
      roundIndex: r.roundIndex,
      value: r.total!,
      tier: r.tier,
      absorbed: absorbingRound === null || r.roundIndex < currentRoundIdx,
    }));
  }, [game.roundResults, absorbingRound, currentRoundIdx]);

  // ─── Rounds with results ───
  const roundsWithResults = useMemo(() => {
    const rounds: number[] = [];
    for (let i = 0; i < roundsPlayed; i++) {
      const hasResults = teams.some(t =>
        game.roundResults.some(r => r.teamId === t.id && r.roundIndex === i && r.tier !== null)
      );
      if (hasResults) rounds.push(i);
    }
    return rounds;
  }, [roundsPlayed, teams, game.roundResults]);

  // Current round index within roundsWithResults
  const currentFinaleRoundArrayIdx = roundsWithResults.indexOf(currentRoundIdx);

  // ─── Penalty teams (sorted by score, lowest first) ───
  const penaltyTeams = useMemo(() => {
    const teamsWithPenalties = teams.filter(t =>
      game.roundResults.some(r => r.teamId === t.id && r.penaltyRolls.length > 0)
    );
    return [...teamsWithPenalties].sort((a, b) => getTeamScore(a) - getTeamScore(b));
  }, [teams, game.roundResults, getTeamScore]);

  // All penalties for a team (flat list)
  const getTeamPenalties = useCallback((teamId: string) => {
    return game.roundResults
      .filter(r => r.teamId === teamId)
      .flatMap(r => r.penaltyRolls.map((p, i) => ({ roundIndex: r.roundIndex, penaltyIdx: i, ...p })));
  }, [game.roundResults]);

  // ─── Awards ───
  const awards = useMemo(() => {
    const list: { icon: string; title: string; team: string; detail: string }[] = [];

    // Fastest solver
    const solves = game.roundResults.filter(r => r.tier !== null);
    if (solves.length > 0) {
      const fastest = solves.reduce((a, b) => a.revealPercentage < b.revealPercentage ? a : b);
      const teamName = teams.find(t => t.id === fastest.teamId)?.name ?? '?';
      list.push({ icon: '🏎️', title: 'Fastest Solver', team: teamName, detail: `Solved at ${Math.round(fastest.revealPercentage)}% revealed!` });
    }

    // Clean run (longest streak without penalty)
    let bestStreak = 0;
    let bestStreakTeam = '';
    for (const t of teams) {
      let streak = 0;
      let maxStreak = 0;
      for (let i = 0; i < roundsPlayed; i++) {
        const r = game.roundResults.find(rr => rr.teamId === t.id && rr.roundIndex === i);
        if (r && r.wrongGuessCount === 0 && r.tier !== null) {
          streak++;
          maxStreak = Math.max(maxStreak, streak);
        } else {
          streak = 0;
        }
      }
      if (maxStreak > bestStreak) {
        bestStreak = maxStreak;
        bestStreakTeam = t.name;
      }
    }
    if (bestStreak > 0) {
      list.push({ icon: '🧹', title: 'Clean Run', team: bestStreakTeam, detail: `${bestStreak} correct in a row without penalty!` });
    }

    // Fewest penalties
    const penaltyCounts = teams.map(t => ({
      name: t.name,
      count: game.roundResults.filter(r => r.teamId === t.id).reduce((s, r) => s + r.wrongGuessCount, 0),
    }));
    const minPen = Math.min(...penaltyCounts.map(p => p.count));
    const fewest = penaltyCounts.filter(p => p.count === minPen);
    if (fewest.length < teams.length) {
      list.push({ icon: '🛡️', title: 'Fewest Penalties', team: fewest.map(f => f.name).join(', '), detail: `Only ${minPen} penalty dice!` });
    }

    // Lucky roller (highest single round total)
    const rolled = game.roundResults.filter(r => r.total !== null);
    if (rolled.length > 0) {
      const luckiest = rolled.reduce((a, b) => (a.total ?? 0) > (b.total ?? 0) ? a : b);
      const teamName = teams.find(t => t.id === luckiest.teamId)?.name ?? '?';
      list.push({ icon: '🍀', title: 'Lucky Roller', team: teamName, detail: `Rolled ${luckiest.total} in one round!` });
    }

    // Gambling addict (most re-rolls used)
    const rerollEntries = Object.entries(game.rerollsUsed).filter(([, v]) => v > 0);
    if (rerollEntries.length > 0) {
      const most = rerollEntries.reduce((a, b) => a[1] > b[1] ? a : b);
      const teamName = teams.find(t => t.id === most[0])?.name ?? '?';
      list.push({ icon: '🎰', title: 'Gambling Addict', team: teamName, detail: `Used ${most[1]} re-rolls!` });
    }

    return list;
  }, [teams, game.roundResults, game.rerollsUsed, roundsPlayed]);

  // ─── Auto-play awards ───
  useEffect(() => {
    if (phase !== 'awards') return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (awards.length === 0) {
      timers.push(setTimeout(() => setShowBackButton(true), 1000));
    } else {
      for (let i = 0; i < awards.length; i++) {
        timers.push(setTimeout(() => setAwardIndex(i), 1000 + i * 2000));
      }
      timers.push(setTimeout(() => setShowBackButton(true), 1000 + awards.length * 2000));
    }
    return () => timers.forEach(clearTimeout);
  }, [phase, awards.length]);

  // ─── Actions ───
  const handleStartRolling = () => {
    if (roundsWithResults.length === 0) {
      // No results at all, skip to penalties or awards
      goToPenaltiesOrAwards();
      return;
    }
    setCurrentRoundIdx(roundsWithResults[0]);
    setPhase('round-roll');
  };

  const handleRollRound = () => {
    if (isAnimating) return;
    setIsAnimating(true);

    // Start rolling animation
    const anims: Record<string, { d1: number; d2: number } | null> = {};
    teams.forEach(t => {
      const r = game.roundResults.find(rr => rr.teamId === t.id && rr.roundIndex === currentRoundIdx);
      if (r && r.tier !== null && r.die1 === null) {
        anims[t.id] = null;
      }
    });

    if (Object.keys(anims).length === 0) {
      setIsAnimating(false);
      setPhase('round-reroll');
      return;
    }

    setRollingAnims(anims);
    let frame = 0;
    const interval = setInterval(() => {
      frame++;
      const newAnims: Record<string, { d1: number; d2: number } | null> = {};
      Object.keys(anims).forEach(teamId => {
        const r = game.roundResults.find(rr => rr.teamId === teamId && rr.roundIndex === currentRoundIdx);
        const tier = r?.tier ?? 'bronze';
        const range = TIER_RANGES[tier];
        newAnims[teamId] = {
          d1: range.min + Math.floor(Math.random() * (range.max - range.min + 1)),
          d2: range.min + Math.floor(Math.random() * (range.max - range.min + 1)),
        };
      });
      setRollingAnims(newAnims);

      if (frame >= 14) {
        clearInterval(interval);
        rollRoundDice(currentRoundIdx);
        setTimeout(() => {
          setRollingAnims({});
          setIsAnimating(false);
          setPhase('round-reroll');
        }, 50);
      }
    }, 80);
  };

  const handleReroll = (teamId: string, which: 'die1' | 'die2' | 'both') => {
    if (isAnimating) return;
    setIsAnimating(true);
    setShowRerollFor(null);

    const r = game.roundResults.find(rr => rr.teamId === teamId && rr.roundIndex === currentRoundIdx);
    const tier = r?.tier ?? 'bronze';
    const range = TIER_RANGES[tier];

    setRollingAnims({ [teamId]: null });
    let frame = 0;
    const interval = setInterval(() => {
      frame++;
      setRollingAnims({
        [teamId]: {
          d1: range.min + Math.floor(Math.random() * (range.max - range.min + 1)),
          d2: range.min + Math.floor(Math.random() * (range.max - range.min + 1)),
        },
      });
      if (frame >= 10) {
        clearInterval(interval);
        rerollDice(teamId, currentRoundIdx, which);
        setTimeout(() => {
          setRollingAnims({});
          setIsAnimating(false);
        }, 50);
      }
    }, 80);
  };

  const handleContinueToNextRound = () => {
    // Absorb animation
    setAbsorbingRound(currentRoundIdx);
    setPhase('round-absorb');
    setTimeout(() => {
      setAbsorbingRound(null);
      const nextArrayIdx = currentFinaleRoundArrayIdx + 1;
      if (nextArrayIdx < roundsWithResults.length) {
        setCurrentRoundIdx(roundsWithResults[nextArrayIdx]);
        setPhase('round-roll');
      } else {
        goToPenaltiesOrAwards();
      }
    }, 1200);
  };

  const goToPenaltiesOrAwards = () => {
    if (penaltyTeams.length > 0) {
      // Freeze bar order before penalties begin
      setFrozenTeamOrder(sortedTeams.map(t => t.id));
      setPhase('penalty-splash');
    } else {
      setPhase('awards');
    }
  };

  const handlePenaltySplashDone = () => {
    setPhase('penalty-roll');
    startPenaltyCascade();
  };

  const startPenaltyCascade = () => {
    // Build per-team penalty lists
    const teamPenaltyMap: Record<string, { teamId: string; roundIndex: number; penaltyIdx: number }[]> = {};
    for (const t of penaltyTeams) {
      const penalties = getTeamPenalties(t.id).filter(p => p.total === null);
      teamPenaltyMap[t.id] = penalties.map(p => ({
        teamId: t.id,
        roundIndex: p.roundIndex,
        penaltyIdx: p.penaltyIdx,
      }));
    }

    // Round-robin interleave: T1-P1, T2-P1, T3-P1, T1-P2, T2-P2, ...
    const queue: { teamId: string; roundIndex: number; penaltyIdx: number }[] = [];
    const maxPenalties = Math.max(0, ...Object.values(teamPenaltyMap).map(l => l.length));
    for (let round = 0; round < maxPenalties; round++) {
      for (const t of penaltyTeams) {
        if (round < (teamPenaltyMap[t.id]?.length ?? 0)) {
          queue.push(teamPenaltyMap[t.id][round]);
        }
      }
    }

    if (queue.length === 0) {
      setPhase('awards');
      return;
    }

    // Scheduler state — tracked in closure, not React state
    const remaining = [...queue];
    let activeCount = 0;
    const activeTeamSet = new Set<string>();
    const teamLastEndTime: Record<string, number> = {};
    const MAX_SLOTS = 3;
    const SAME_TEAM_BUFFER = 2000; // ms before same team can be penalized again
    const SCRAMBLE_DURATION = 1500; // ms of dice scramble
    const CHECK_INTERVAL = 1000; // ms between scheduler ticks
    const cleanup = penaltyCleanupRef.current;

    const tryStartNext = (): boolean => {
      if (remaining.length === 0 || activeCount >= MAX_SLOTS) return false;

      const now = Date.now();
      // Find first eligible penalty (team not active, not on cooldown)
      const eligibleIdx = remaining.findIndex(item => {
        if (activeTeamSet.has(item.teamId)) return false;
        const lastEnd = teamLastEndTime[item.teamId] ?? 0;
        return (now - lastEnd) >= SAME_TEAM_BUFFER;
      });

      if (eligibleIdx === -1) return false;

      const item = remaining.splice(eligibleIdx, 1)[0];
      activeCount++;
      activeTeamSet.add(item.teamId);

      // Clear frozen value for this team — new penalty replaces old display
      setPenaltyFrozenTotals(prev => {
        const next = { ...prev };
        delete next[item.teamId];
        return next;
      });

      // Start scramble animation
      setPenaltyAnimatingTeams(prev => new Set([...prev, item.teamId]));
      const scrambleInterval = setInterval(() => {
        setPenaltyAnimValues(prev => ({
          ...prev,
          [item.teamId]: {
            d1: 5 + Math.floor(Math.random() * 11),
            d2: 5 + Math.floor(Math.random() * 11),
          },
        }));
      }, 70);
      cleanup.intervals.push(scrambleInterval);

      // After scramble: freeze result and shrink bar
      const freezeTimeout = setTimeout(() => {
        clearInterval(scrambleInterval);

        // Roll this single penalty in the store
        rollPenalty(item.teamId, item.roundIndex, item.penaltyIdx);

        // Read the rolled value and freeze it above the bar
        const readTimeout = setTimeout(() => {
          const g = useGameStore.getState().game;
          if (g) {
            const rr = g.roundResults.find(r => r.teamId === item.teamId && r.roundIndex === item.roundIndex);
            const roll = rr?.penaltyRolls[item.penaltyIdx];
            if (roll?.total) {
              setPenaltyFrozenTotals(prev => ({ ...prev, [item.teamId]: roll.total! }));
            }
          }

          // Clear animating state
          setPenaltyAnimatingTeams(prev => {
            const next = new Set(prev);
            next.delete(item.teamId);
            return next;
          });
          setPenaltyAnimValues(prev => {
            const next = { ...prev };
            delete next[item.teamId];
            return next;
          });

          // Free slot and record cooldown time
          activeCount--;
          activeTeamSet.delete(item.teamId);
          teamLastEndTime[item.teamId] = Date.now();
        }, 30);
        cleanup.timeouts.push(readTimeout);
      }, SCRAMBLE_DURATION);
      cleanup.timeouts.push(freezeTimeout);

      return true;
    };

    // Staggered ramp-up: first penalty immediately, then 1s apart ("round" entry)
    const RAMP_STAGGER = 1000;
    const rampCount = Math.min(MAX_SLOTS, remaining.length);

    // Launch the first one immediately
    tryStartNext();

    // Stagger the 2nd and 3rd slots, then start the steady-state scheduler
    for (let i = 1; i < rampCount; i++) {
      const rampTimeout = setTimeout(() => {
        tryStartNext();

        // After the last ramp slot launches, start the steady-state scheduler
        if (i === rampCount - 1) {
          startScheduler();
        }
      }, i * RAMP_STAGGER);
      cleanup.timeouts.push(rampTimeout);
    }

    // If only 1 penalty total, start scheduler right away
    if (rampCount <= 1) {
      startScheduler();
    }

    function startScheduler() {
      const scheduler = setInterval(() => {
        let started = true;
        while (started && activeCount < MAX_SLOTS && remaining.length > 0) {
          started = tryStartNext();
        }

        // All penalties done?
        if (remaining.length === 0 && activeCount === 0) {
          clearInterval(scheduler);

          // Endgame: 3s hold → 0.5s fade frozen values → unfreeze sort (reorder) → awards
          const holdTimeout = setTimeout(() => {
            setPenaltyFadingOut(true);

            const fadeTimeout = setTimeout(() => {
              setPenaltyFrozenTotals({});
              setPenaltyFadingOut(false);
              // Unfreeze sort order — bars reorder with layout animation
              setFrozenTeamOrder(null);
              setPhase('penalty-deduct');

              const reorderTimeout = setTimeout(() => {
                setPhase('awards');
              }, 1200);
              cleanup.timeouts.push(reorderTimeout);
            }, 500);
            cleanup.timeouts.push(fadeTimeout);
          }, 3000);
          cleanup.timeouts.push(holdTimeout);
        }
      }, CHECK_INTERVAL);
      cleanup.intervals.push(scheduler);
    }
  };

  const handleBackToLibrary = () => {
    clearGame();
    navigate('/');
  };

  // ─── Current round info ───
  const currentRoundPhrase = game.rounds[currentRoundIdx]?.phrase ?? '';

  // ─── Phase label ───
  const phaseLabel = (() => {
    if (phase === 'pre-finale') return '🎲 Diceipher Finale';
    if (phase === 'awards') return '🏆 Final Results';
    if (phase === 'penalty-splash' || phase === 'penalty-roll' || phase === 'penalty-deduct') return '🔴 Penalty Round';
    return `Round ${currentRoundIdx + 1}`;
  })();

  return (
    <div style={{
      minHeight: '100vh', background: '#064E3B', color: 'white',
      display: 'flex', flexDirection: 'column',
    }}>
      <style>{SPARKLE_CSS}</style>

      {/* Penalty Splash */}
      <AnimatePresence>
        {phase === 'penalty-splash' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 50, cursor: 'pointer',
            }}
            onClick={handlePenaltySplashDone}
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

      {/* Header */}
      <div style={{
        padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(167,243,208,0.2)', flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>{phaseLabel}</h1>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Tier reference card */}
          {(phase === 'round-roll' || phase === 'round-reroll') && (
            <div style={{
              display: 'flex', gap: 24, fontSize: 22, fontWeight: 700,
              background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 28px',
            }}>
              <span style={{ color: TIER_RANGES.gold.color }}>🥇 40–100</span>
              <span style={{ color: '#E2E8F0' }}>🥈 20–80</span>
              <span style={{ color: TIER_RANGES.bronze.color }}>🥉 0–60</span>
            </div>
          )}

          {/* Pre-finale start button */}
          {phase === 'pre-finale' && (
            <button onClick={handleStartRolling} style={{
              background: '#059669', color: '#F0FDF4', border: 'none', borderRadius: 10,
              padding: '10px 24px', fontSize: 16, fontWeight: 700,
            }}>Start Rolling</button>
          )}

          {/* Roll button */}
          {phase === 'round-roll' && (
            <button onClick={handleRollRound} disabled={isAnimating} style={{
              background: '#059669', color: '#F0FDF4', border: 'none', borderRadius: 10,
              padding: '10px 24px', fontSize: 16, fontWeight: 700,
              opacity: isAnimating ? 0.6 : 1,
            }}>
              🎲 Roll Round {currentRoundIdx + 1}
            </button>
          )}

          {/* Continue after reroll */}
          {phase === 'round-reroll' && !isAnimating && (
            <button onClick={handleContinueToNextRound} style={{
              background: '#059669', color: '#F0FDF4', border: 'none', borderRadius: 10,
              padding: '10px 24px', fontSize: 16, fontWeight: 700,
            }}>Continue →</button>
          )}

          {/* Report button (finale) */}
          {phase === 'awards' && (
            <button onClick={() => setShowReport(true)} style={{
              background: 'rgba(167,243,208,0.15)', color: '#A7F3D0', border: '1px solid rgba(167,243,208,0.3)',
              borderRadius: 10, padding: '8px 16px', fontSize: 14, fontWeight: 600,
            }}>📊 Game Report</button>
          )}
        </div>
      </div>

      {/* Pre-finale info */}
      {phase === 'pre-finale' && (
        <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          <div style={{
            background: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: '24px 40px',
            textAlign: 'center', border: '1px solid rgba(167,243,208,0.2)',
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Finale Setup</h2>
            <div style={{ fontSize: 16, marginBottom: 12 }}>
              <span style={{ color: '#A7F3D0' }}>{roundsPlayed}</span> rounds played
              &nbsp;·&nbsp;
              <span style={{ color: '#A7F3D0' }}>🔄 {rerollPoolSize}</span> re-rolls per team
            </div>
            <div style={{
              display: 'flex', gap: 20, justifyContent: 'center', fontSize: 15, fontWeight: 600,
            }}>
              <span style={{ color: TIER_RANGES.gold.color }}>🥇 Gold: 40 – 100</span>
              <span style={{ color: '#E2E8F0' }}>🥈 Silver: 20 – 80</span>
              <span style={{ color: TIER_RANGES.bronze.color }}>🥉 Bronze: 0 – 60</span>
            </div>
          </div>
        </div>
      )}

      {/* Round phrase display — large, centered under header */}
      {(phase === 'round-roll' || phase === 'round-reroll' || phase === 'round-absorb') && (
        <div style={{
          textAlign: 'center', padding: '16px 40px 0', flexShrink: 0,
        }}>
          <div style={{
            fontSize: 52, fontWeight: 800, color: 'rgba(240,253,244,0.85)',
            letterSpacing: '1px',
          }}>
            {currentRoundPhrase}
          </div>
        </div>
      )}

      {/* Bar Graph */}
      {phase !== 'pre-finale' && (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px 40px 16px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            gap: 24, width: '100%', maxWidth: 1300,
          }}>
            {displayTeams.map((team) => {
              const score = getAbsorbedScore(team);
              const barHeight = maxScore > 0 ? Math.max(8, (Math.abs(score) / maxScore) * 312) : 8;
              const isNegative = score < 0;
              const color = TEAM_COLORS[team.colorIndex];
              const anim = rollingAnims[team.id];

              // Penalty cascade state for this team
              const isPenaltyAnimating = penaltyAnimatingTeams.has(team.id);
              const penaltyAnim = penaltyAnimValues[team.id];
              const frozenPenalty = penaltyFrozenTotals[team.id];
              const hasFrozenPenalty = frozenPenalty !== undefined && frozenPenalty > 0;

              // Current round result
              const curResult = game.roundResults.find(
                r => r.teamId === team.id && r.roundIndex === currentRoundIdx
              );

              // Re-roll available?
              const canReroll = phase === 'round-reroll'
                && curResult?.die1 !== null
                && (game.rerollPool[team.id] ?? 0) > 0
                && !isAnimating;

              return (
                <motion.div
                  key={team.id}
                  layout
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    width: `${Math.max(84, Math.min(168, 1200 / teams.length))}px`,
                  }}
                >
                  {/* Roll result display */}
                  <AnimatePresence mode="wait">
                    {/* Success round: rolling animation */}
                    {anim && (
                      <motion.div
                        key="anim"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                          fontSize: 22, fontWeight: 800, marginBottom: 5,
                          color: getTierColor(curResult?.tier ?? null),
                          textAlign: 'center', minHeight: 53,
                        }}
                      >
                        <div>{anim.d1} + {anim.d2}</div>
                        <div style={{ fontSize: 34 }}>= {anim.d1 + anim.d2}</div>
                      </motion.div>
                    )}
                    {/* Success round: frozen result */}
                    {!anim && !isPenaltyAnimating && !hasFrozenPenalty
                      && curResult?.die1 !== null && curResult?.die1 !== undefined
                      && (phase === 'round-reroll' || phase === 'round-roll') && (
                      <motion.div
                        key="result"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{
                          fontSize: 22, fontWeight: 800, marginBottom: 5,
                          color: getTierColor(curResult.tier),
                          textAlign: 'center', minHeight: 53,
                        }}
                      >
                        <div>{curResult.die1} + {curResult.die2}</div>
                        <div style={{ fontSize: 34 }}>= {curResult.total}</div>
                      </motion.div>
                    )}
                    {/* Penalty: scrambling animation */}
                    {isPenaltyAnimating && penaltyAnim && (
                      <motion.div
                        key="penalty-scramble"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{
                          fontSize: 22, fontWeight: 800, marginBottom: 5,
                          color: '#DC2626', textAlign: 'center', minHeight: 53,
                        }}
                      >
                        <div style={{ fontSize: 34 }}>−{penaltyAnim.d1 + penaltyAnim.d2}</div>
                      </motion.div>
                    )}
                    {/* Penalty: frozen value (stays until next penalty or final fade) */}
                    {!isPenaltyAnimating && hasFrozenPenalty && (
                      <motion.div
                        key="penalty-frozen"
                        initial={{ opacity: 0, scale: 1.2 }}
                        animate={{ opacity: penaltyFadingOut ? 0 : 1, scale: 1 }}
                        transition={{ duration: penaltyFadingOut ? 0.5 : 0.3 }}
                        style={{
                          fontSize: 22, fontWeight: 900, marginBottom: 5,
                          color: '#FCA5A5', textAlign: 'center', minHeight: 53,
                          textShadow: '0 0 20px rgba(220,38,38,0.5)',
                        }}
                      >
                        <div style={{ fontSize: 38 }}>−{frozenPenalty}</div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Cumulative score */}
                  <div style={{
                    fontSize: 38, fontWeight: 900, marginBottom: 7,
                    color: isNegative ? '#FCA5A5' : '#F0FDF4',
                  }}>{score}</div>

                  {/* Stacked bar */}
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

                  {/* Re-roll button — fixed-height slot so bar doesn't shift */}
                  <div style={{ minHeight: 35, marginTop: 7, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                  {canReroll && (
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={() => setShowRerollFor(showRerollFor === team.id ? null : team.id)}
                        style={{
                          background: '#D97706', color: 'white', border: 'none',
                          borderRadius: 7, padding: '6px 14px', fontSize: 14, fontWeight: 700,
                        }}
                      >🔄 Re-roll ({game.rerollPool[team.id]})</button>

                      {/* Re-roll options dropdown */}
                      {showRerollFor === team.id && (
                        <div style={{
                          position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                          background: 'white', borderRadius: 10, padding: 8, marginTop: 5,
                          boxShadow: '0 4px 16px rgba(0,0,0,0.3)', zIndex: 20, minWidth: 192,
                        }}>
                          <button
                            onClick={() => handleReroll(team.id, 'die1')}
                            style={{
                              display: 'block', width: '100%', padding: '10px 14px', border: 'none',
                              background: 'none', textAlign: 'left', fontSize: 16, fontWeight: 600,
                              color: '#1E293B', borderRadius: 5, cursor: 'pointer',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#ECFDF5')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                          >🎲 Die 1 ({curResult?.die1})</button>
                          <button
                            onClick={() => handleReroll(team.id, 'die2')}
                            style={{
                              display: 'block', width: '100%', padding: '10px 14px', border: 'none',
                              background: 'none', textAlign: 'left', fontSize: 16, fontWeight: 600,
                              color: '#1E293B', borderRadius: 5, cursor: 'pointer',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#ECFDF5')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                          >🎲 Die 2 ({curResult?.die2})</button>
                          <button
                            onClick={() => handleReroll(team.id, 'both')}
                            style={{
                              display: 'block', width: '100%', padding: '10px 14px', border: 'none',
                              background: 'none', textAlign: 'left', fontSize: 16, fontWeight: 600,
                              color: '#D97706', borderRadius: 5, cursor: 'pointer',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#FEF3C7')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                          >🎲🎲 Both Dice</button>
                        </div>
                      )}
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
                  {phase === 'awards' && (
                    <div style={{
                      marginTop: 5, fontSize: 17, fontWeight: 800,
                      color: sortedTeams.indexOf(team) === sortedTeams.length - 1 ? '#FBBF24' : 'rgba(255,255,255,0.5)',
                    }}>
                      {(() => {
                        const pos = sortedTeams.length - sortedTeams.indexOf(team);
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
      )}

      {/* Awards auto-play area */}
      {phase === 'awards' && (
        <div style={{ padding: '24px 40px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center', marginBottom: 20 }}>
            <AnimatePresence>
              {awards.slice(0, awardIndex + 1).map((award) => (
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

          <AnimatePresence>
            {showBackButton && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', justifyContent: 'center', gap: 12 }}
              >
                <button
                  onClick={() => setShowReport(true)}
                  style={{
                    background: 'rgba(167,243,208,0.15)', color: '#A7F3D0',
                    border: '1px solid rgba(167,243,208,0.3)', borderRadius: 10,
                    padding: '12px 24px', fontSize: 16, fontWeight: 700,
                  }}
                >📊 Game Report</button>
                <button
                  onClick={handleBackToLibrary}
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

      {/* Analytics Report Drawer */}
      <AnimatePresence>
        {showReport && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, background: 'black', zIndex: 60 }}
              onClick={() => setShowReport(false)}
            />
            <motion.div
              initial={{ x: 420 }}
              animate={{ x: 0 }}
              exit={{ x: 420 }}
              transition={{ type: 'spring', damping: 24, stiffness: 300 }}
              style={{
                position: 'fixed', top: 0, right: 0, bottom: 0, width: 400,
                background: '#F0FDF4', borderLeft: '1px solid #A7F3D0',
                zIndex: 70, overflowY: 'auto', color: '#1E293B',
              }}
            >
              <AnalyticsDrawer
                game={game}
                teams={teams}
                onClose={() => setShowReport(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Analytics Drawer ───
function AnalyticsDrawer({ game, teams, onClose }: {
  game: NonNullable<ReturnType<typeof useGameStore>['game']>;
  teams: Team[];
  onClose: () => void;
}) {
  const [openSection, setOpenSection] = useState<string | null>('questions');
  const roundsPlayed = game.currentRoundIndex + 1;

  const toggle = (s: string) => setOpenSection(openSection === s ? null : s);

  // ─── Section 1: Question Analysis ───
  const questionRows = useMemo(() => {
    const rows = [];
    for (let i = 0; i < roundsPlayed; i++) {
      const round = game.rounds[i];
      const results = game.roundResults.filter(r => r.roundIndex === i);
      const solved = results.filter(r => r.tier !== null);
      const solveRate = solved.length / teams.length;
      const avgReveal = solved.length > 0
        ? solved.reduce((s, r) => s + r.revealPercentage, 0) / solved.length
        : 100;
      const totalWrong = results.reduce((s, r) => s + r.wrongGuessCount, 0);
      const diffScore = (1 - solveRate) * 0.5 + (avgReveal / 100) * 0.5;
      const difficulty = diffScore < 0.33 ? 'Easy' : diffScore < 0.66 ? 'Medium' : 'Hard';
      const diffColor = difficulty === 'Easy' ? '#22C55E' : difficulty === 'Medium' ? '#F59E0B' : '#DC2626';

      rows.push({
        roundIndex: i,
        phrase: round.phrase,
        theme: round.theme,
        solveRate: `${solved.length} / ${teams.length}`,
        avgReveal: Math.round(avgReveal),
        totalWrong,
        difficulty,
        diffColor,
        diffScore,
      });
    }
    return rows;
  }, [roundsPlayed, game.rounds, game.roundResults, teams.length]);

  const easiestIdx = questionRows.length > 0
    ? questionRows.reduce((a, b) => a.diffScore < b.diffScore ? a : b).roundIndex
    : -1;
  const hardestIdx = questionRows.length > 0
    ? questionRows.reduce((a, b) => a.diffScore > b.diffScore ? a : b).roundIndex
    : -1;

  // ─── Section 2: Normalized Rankings ───
  const normalizedData = useMemo(() => {
    const actual: { name: string; score: number; rank: number }[] = [];
    const normalized: { name: string; score: number; rank: number }[] = [];

    for (const t of teams) {
      const results = game.roundResults.filter(r => r.teamId === t.id);
      let actualScore = 0;
      let normScore = 0;

      for (const r of results) {
        if (r.total !== null) actualScore += r.total;
        // Normalized: use tier average
        if (r.tier === 'gold') normScore += 70;
        else if (r.tier === 'silver') normScore += 50;
        else if (r.tier === 'bronze') normScore += 30;

        for (const p of r.penaltyRolls) {
          if (p.total !== null) actualScore -= p.total;
          normScore -= 20; // avg penalty
        }
      }

      actual.push({ name: t.name, score: actualScore, rank: 0 });
      normalized.push({ name: t.name, score: normScore, rank: 0 });
    }

    actual.sort((a, b) => b.score - a.score);
    normalized.sort((a, b) => b.score - a.score);
    actual.forEach((a, i) => (a.rank = i + 1));
    normalized.forEach((a, i) => (a.rank = i + 1));

    return { actual, normalized };
  }, [teams, game.roundResults]);

  // ─── Section 3: Team Risk Profiles ───
  const teamProfiles = useMemo(() => {
    const profiles: {
      name: string;
      color: string;
      avgReveal: number;
      wrongRate: number;
      rerollUsage: string;
      rerollPct: number;
      label: string;
      labelEmoji: string;
      isHighRoller: boolean;
    }[] = [];

    const allAvgReveals: number[] = [];
    const allWrongRates: number[] = [];

    // First pass: compute raw metrics
    const raw: { name: string; color: string; avgReveal: number; wrongRate: number; rerollUsed: number; rerollTotal: number }[] = [];
    for (const t of teams) {
      const results = game.roundResults.filter(r => r.teamId === t.id);
      const solved = results.filter(r => r.tier !== null);
      const avgReveal = solved.length > 0
        ? solved.reduce((s, r) => s + r.revealPercentage, 0) / solved.length
        : 100;
      const totalWrong = results.reduce((s, r) => s + r.wrongGuessCount, 0);
      const wrongRate = roundsPlayed > 0 ? totalWrong / roundsPlayed : 0;
      const rerollUsed = game.rerollsUsed[t.id] ?? 0;
      const rerollTotal = Math.ceil(roundsPlayed / 2);

      allAvgReveals.push(avgReveal);
      allWrongRates.push(wrongRate);
      raw.push({ name: t.name, color: TEAM_COLORS[t.colorIndex], avgReveal, wrongRate, rerollUsed, rerollTotal });
    }

    const medianReveal = allAvgReveals.sort((a, b) => a - b)[Math.floor(allAvgReveals.length / 2)] ?? 50;
    const medianWrong = allWrongRates.sort((a, b) => a - b)[Math.floor(allWrongRates.length / 2)] ?? 0.5;

    for (const r of raw) {
      const earlyGuesser = r.avgReveal <= medianReveal;
      const accurate = r.wrongRate <= medianWrong;
      let label: string;
      let labelEmoji: string;

      if (earlyGuesser && accurate) { label = 'Sharpshooter'; labelEmoji = '🎯'; }
      else if (earlyGuesser && !accurate) { label = 'Daredevil'; labelEmoji = '🎲'; }
      else if (!earlyGuesser && accurate) { label = 'Fortress'; labelEmoji = '🛡️'; }
      else { label = 'Wildcard'; labelEmoji = '🌪️'; }

      const rerollPct = r.rerollTotal > 0 ? r.rerollUsed / r.rerollTotal : 0;
      profiles.push({
        name: r.name,
        color: r.color,
        avgReveal: Math.round(r.avgReveal),
        wrongRate: Math.round(r.wrongRate * 100) / 100,
        rerollUsage: `${r.rerollUsed}/${r.rerollTotal}`,
        rerollPct,
        label,
        labelEmoji,
        isHighRoller: rerollPct > 0.75,
      });
    }
    return profiles;
  }, [teams, game.roundResults, game.rerollsUsed, roundsPlayed]);

  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#064E3B' }}>📊 Game Report</h2>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', fontSize: 20, color: '#6B7280', cursor: 'pointer',
        }}>✕</button>
      </div>

      {/* Section 1: Question Analysis */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => toggle('questions')}
          style={{
            width: '100%', textAlign: 'left', background: '#ECFDF5', border: '1px solid #A7F3D0',
            borderRadius: 8, padding: '10px 14px', fontSize: 14, fontWeight: 700, color: '#064E3B',
            cursor: 'pointer',
          }}
        >
          {openSection === 'questions' ? '▼' : '▶'} Question Analysis
        </button>
        {openSection === 'questions' && (
          <div style={{ marginTop: 8 }}>
            {questionRows.map(row => (
              <div
                key={row.roundIndex}
                style={{
                  padding: '10px 12px', borderRadius: 8, marginBottom: 6,
                  background: 'white', border: `1px solid ${
                    row.roundIndex === easiestIdx ? '#22C55E'
                      : row.roundIndex === hardestIdx ? '#DC2626'
                      : '#E5E7EB'
                  }`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#064E3B' }}>
                    R{row.roundIndex + 1}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                    background: `${row.diffColor}20`, color: row.diffColor,
                  }}>{row.difficulty}</span>
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={row.phrase}
                >{row.phrase}</div>
                {row.theme && (
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>Theme: {row.theme}</div>
                )}
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#6B7280' }}>
                  <span>Solved: {row.solveRate}</span>
                  <span>Avg reveal: {row.avgReveal}%</span>
                  <span>Wrong: {row.totalWrong}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Normalized Rankings */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => toggle('normalized')}
          style={{
            width: '100%', textAlign: 'left', background: '#ECFDF5', border: '1px solid #A7F3D0',
            borderRadius: 8, padding: '10px 14px', fontSize: 14, fontWeight: 700, color: '#064E3B',
            cursor: 'pointer',
          }}
        >
          {openSection === 'normalized' ? '▼' : '▶'} Skill vs Luck Rankings
        </button>
        {openSection === 'normalized' && (
          <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#064E3B', marginBottom: 6, textAlign: 'center' }}>
                Actual
              </div>
              {normalizedData.actual.map(a => (
                <div key={a.name} style={{
                  padding: '6px 10px', background: 'white', borderRadius: 6, marginBottom: 4,
                  border: '1px solid #E5E7EB', fontSize: 12,
                }}>
                  <span style={{ fontWeight: 700 }}>#{a.rank}</span> {a.name}
                  <span style={{ float: 'right', fontWeight: 600, color: '#064E3B' }}>{a.score}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#064E3B', marginBottom: 6, textAlign: 'center' }}>
                Skill (luck-adjusted)
              </div>
              {normalizedData.normalized.map(n => {
                const actualEntry = normalizedData.actual.find(a => a.name === n.name);
                const diff = actualEntry ? actualEntry.rank - n.rank : 0;
                return (
                  <div key={n.name} style={{
                    padding: '6px 10px', background: 'white', borderRadius: 6, marginBottom: 4,
                    border: '1px solid #E5E7EB', fontSize: 12,
                  }}>
                    <span style={{ fontWeight: 700 }}>#{n.rank}</span> {n.name}
                    <span style={{ float: 'right', fontWeight: 600 }}>
                      <span style={{ color: '#064E3B' }}>{n.score}</span>
                      {diff !== 0 && (
                        <span style={{
                          marginLeft: 6, fontSize: 11, fontWeight: 700,
                          color: diff > 0 ? '#22C55E' : '#DC2626',
                        }}>
                          {diff > 0 ? `↑${diff}` : `↓${Math.abs(diff)}`}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Section 3: Team Risk Profiles */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => toggle('profiles')}
          style={{
            width: '100%', textAlign: 'left', background: '#ECFDF5', border: '1px solid #A7F3D0',
            borderRadius: 8, padding: '10px 14px', fontSize: 14, fontWeight: 700, color: '#064E3B',
            cursor: 'pointer',
          }}
        >
          {openSection === 'profiles' ? '▼' : '▶'} Team Profiles
        </button>
        {openSection === 'profiles' && (
          <div style={{ marginTop: 8 }}>
            {teamProfiles.map(p => (
              <div key={p.name} style={{
                padding: '12px', background: 'white', borderRadius: 8, marginBottom: 6,
                border: '1px solid #E5E7EB',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: p.color }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#064E3B' }}>{p.name}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 10,
                    background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46',
                  }}>
                    {p.labelEmoji} {p.label}
                  </span>
                  {p.isHighRoller && (
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 10,
                      background: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E',
                    }}>
                      🎰 High Roller
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#6B7280' }}>
                  <span>Avg reveal: {p.avgReveal}%</span>
                  <span>Wrong/round: {p.wrongRate}</span>
                  <span>Re-rolls: {p.rerollUsage}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
