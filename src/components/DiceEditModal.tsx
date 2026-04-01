import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Team, TeamRoundResult } from '../types';
import { TIER_RANGES } from '../stores/gameStore';
import type { Tier } from '../stores/gameStore';

interface Props {
  team: Team;
  roundResults: TeamRoundResult[];
  currentRoundIndex: number;
  onSave: (roundIndex: number, tier: Tier | null, wrongCount: number) => void;
  onClose: () => void;
}

const TIERS: (Tier | null)[] = ['gold', 'silver', 'bronze', null];

export default function DiceEditModal({ team, roundResults, currentRoundIndex, onSave, onClose }: Props) {
  const [selectedRound, setSelectedRound] = useState(currentRoundIndex);

  const result = roundResults.find(r => r.roundIndex === selectedRound);
  const [tier, setTier] = useState<Tier | null>(result?.tier ?? null);
  const [wrongCount, setWrongCount] = useState(result?.wrongGuessCount ?? 0);

  const handleSelectRound = (idx: number) => {
    setSelectedRound(idx);
    const r = roundResults.find(rr => rr.roundIndex === idx);
    setTier(r?.tier ?? null);
    setWrongCount(r?.wrongGuessCount ?? 0);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }} onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 16, padding: 28, width: 400,
          border: '1px solid #A7F3D0', maxHeight: '80vh', overflow: 'auto',
        }}
      >
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#064E3B' }}>
          Edit — {team.name}
        </h3>

        {/* Round selector */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', marginBottom: 6, display: 'block' }}>
            Round
          </label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {Array.from({ length: currentRoundIndex + 1 }, (_, i) => {
              const r = roundResults.find(rr => rr.roundIndex === i);
              const tierColor = r?.tier ? TIER_RANGES[r.tier].color : '#D1D5DB';
              return (
                <button
                  key={i}
                  onClick={() => handleSelectRound(i)}
                  style={{
                    width: 36, height: 36, borderRadius: 8, fontSize: 14, fontWeight: 700,
                    border: selectedRound === i ? '2px solid #064E3B' : '1px solid #A7F3D0',
                    background: selectedRound === i ? '#ECFDF5' : 'white',
                    color: '#064E3B', position: 'relative',
                  }}
                >
                  {i + 1}
                  <div style={{
                    position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)',
                    width: 8, height: 3, borderRadius: 2, background: tierColor,
                  }} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Tier selector */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', marginBottom: 6, display: 'block' }}>
            Tier for Round {selectedRound + 1}
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            {TIERS.map(t => {
              const label = t ? `${TIER_RANGES[t].icon} ${TIER_RANGES[t].label}` : '— None';
              const bg = t ? TIER_RANGES[t].color : '#E5E7EB';
              const isActive = tier === t;
              return (
                <button
                  key={t ?? 'none'}
                  onClick={() => setTier(t)}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                    border: isActive ? '2px solid #064E3B' : '1px solid #D1D5DB',
                    background: isActive ? bg : 'white',
                    color: isActive ? (t ? 'white' : '#6B7280') : '#6B7280',
                  }}
                >{label}</button>
              );
            })}
          </div>
        </div>

        {/* Wrong guess count */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', marginBottom: 6, display: 'block' }}>
            Wrong Guesses (Round {selectedRound + 1})
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setWrongCount(Math.max(0, wrongCount - 1))}
              disabled={wrongCount <= 0}
              style={{
                width: 34, height: 34, borderRadius: 8, border: '1px solid #A7F3D0',
                background: '#F0FDF4', fontSize: 18, fontWeight: 700,
                color: wrongCount <= 0 ? '#A7F3D0' : '#DC2626',
              }}
            >−</button>
            <span style={{ width: 32, textAlign: 'center', fontSize: 18, fontWeight: 700, color: '#064E3B' }}>
              {wrongCount}
            </span>
            <button
              onClick={() => setWrongCount(wrongCount + 1)}
              style={{
                width: 34, height: 34, borderRadius: 8, border: '1px solid #A7F3D0',
                background: '#F0FDF4', fontSize: 18, fontWeight: 700, color: '#DC2626',
              }}
            >+</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 20px', borderRadius: 8, border: '1px solid #A7F3D0',
            background: 'white', fontSize: 14, fontWeight: 600, color: '#1E293B',
          }}>Cancel</button>
          <button onClick={() => onSave(selectedRound, tier, wrongCount)} style={{
            padding: '8px 20px', borderRadius: 8, border: 'none',
            background: '#059669', color: '#F0FDF4', fontSize: 14, fontWeight: 600,
          }}>Save</button>
        </div>
      </motion.div>
    </div>
  );
}
