import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Team, TeamRoundResult } from '../types';
import { TEAM_COLORS } from '../constants';
import { TIER_RANGES } from '../stores/gameStore';
import type { Tier } from '../stores/gameStore';
import DiceEditModal from './DiceEditModal';

interface Props {
  team: Team;
  solved: boolean;
  roundResults: TeamRoundResult[];
  currentRoundIndex: number;
  onCorrect: () => void;
  onWrong: () => void;
  onEditResult: (roundIndex: number, tier: Tier | null, wrongCount: number) => void;
}

export default function TeamCard({ team, solved, roundResults, currentRoundIndex, onCorrect, onWrong, onEditResult }: Props) {
  const [flash, setFlash] = useState<'gold' | 'silver' | 'bronze' | 'red' | null>(null);
  const [showEdit, setShowEdit] = useState(false);

  const teamResults = roundResults.filter(r => r.teamId === team.id);
  const goldCount = teamResults.filter(r => r.tier === 'gold').length;
  const silverCount = teamResults.filter(r => r.tier === 'silver').length;
  const bronzeCount = teamResults.filter(r => r.tier === 'bronze').length;
  const penaltyCount = teamResults.reduce((sum, r) => sum + r.wrongGuessCount, 0);

  const handleCorrect = () => {
    onCorrect();
    // Determine tier for flash color (approximate — actual tier set in store)
    // We'll flash based on what was just awarded
    setTimeout(() => {
      const latestResults = roundResults.filter(r => r.teamId === team.id && r.roundIndex === currentRoundIndex);
      const latest = latestResults[0];
      if (latest?.tier) {
        setFlash(latest.tier);
      } else {
        setFlash('gold'); // fallback
      }
      setTimeout(() => setFlash(null), 600);
    }, 0);
  };

  const handleWrong = () => {
    setFlash('red');
    onWrong();
    setTimeout(() => setFlash(null), 400);
  };

  const flashColor = flash === 'gold' ? TIER_RANGES.gold.color
    : flash === 'silver' ? TIER_RANGES.silver.color
    : flash === 'bronze' ? TIER_RANGES.bronze.color
    : flash === 'red' ? '#DC2626'
    : '#A7F3D0';

  const color = TEAM_COLORS[team.colorIndex];

  return (
    <>
      <motion.div
        animate={{
          borderColor: flash ? flashColor : '#A7F3D0',
          boxShadow: flash
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
          {solved && <span style={{ fontSize: 20, flexShrink: 0, color: '#22C55E' }}>✓</span>}
        </div>

        {/* Stats — tier counts + penalties */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 4, marginBottom: 14, textAlign: 'center', minHeight: 30, alignItems: 'center',
        }}>
          <span title="Gold" style={{ fontSize: 20, fontWeight: 800, color: goldCount > 0 ? TIER_RANGES.gold.color : '#D1D5DB' }}>
            🥇{goldCount}
          </span>
          <span title="Silver" style={{ fontSize: 20, fontWeight: 800, color: silverCount > 0 ? '#94A3B8' : '#D1D5DB' }}>
            🥈{silverCount}
          </span>
          <span title="Bronze" style={{ fontSize: 20, fontWeight: 800, color: bronzeCount > 0 ? TIER_RANGES.bronze.color : '#D1D5DB' }}>
            🥉{bronzeCount}
          </span>
          <span title="Penalties" style={{ fontSize: 20, fontWeight: 800, color: penaltyCount > 0 ? '#DC2626' : '#D1D5DB' }}>
            ❌{penaltyCount}
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          {!solved && (
            <>
              <button
                onClick={handleCorrect}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 8, border: 'none',
                  background: '#22C55E', color: 'white', fontSize: 16, fontWeight: 700,
                }}
              >✓ Correct</button>
              <button
                onClick={handleWrong}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 8, border: 'none',
                  background: '#DC2626', color: 'white', fontSize: 16, fontWeight: 700,
                }}
              >✗ Wrong</button>
            </>
          )}
        </div>

        {/* Edit button */}
        <button
          onClick={() => setShowEdit(true)}
          style={{
            position: 'absolute', top: 8, right: 8, background: 'none',
            border: 'none', fontSize: 14, color: '#6B7280', padding: '2px 6px',
          }}
        >✏️</button>
      </motion.div>

      {showEdit && (
        <DiceEditModal
          team={team}
          roundResults={teamResults}
          currentRoundIndex={currentRoundIndex}
          onSave={(roundIdx, tier, wrongCount) => {
            onEditResult(roundIdx, tier, wrongCount);
            setShowEdit(false);
          }}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  );
}
