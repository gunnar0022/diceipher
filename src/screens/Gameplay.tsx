import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';
import type { Tier } from '../stores/gameStore';
import PhraseDisplay from '../components/PhraseDisplay';
import TeamCard from '../components/TeamCard';
import SettingsModal from '../components/SettingsModal';

export default function Gameplay() {
  const navigate = useNavigate();
  const game = useGameStore(s => s.game);
  const {
    revealLetter, revealAll, nextRound, goToFinale,
    awardCorrect, awardWrong,
    updateTeamName, setRoundTier, setRoundWrongCount,
  } = useGameStore();

  const [showSettings, setShowSettings] = useState(false);
  const [themeRevealed, setThemeRevealed] = useState(false);

  // Redirect to finale when game status changes
  useEffect(() => {
    if (game?.gameStatus === 'finale') {
      navigate('/finale');
    }
  }, [game?.gameStatus, navigate]);

  // Reset theme visibility when round changes
  useEffect(() => {
    setThemeRevealed(false);
  }, [game?.currentRoundIndex]);

  if (!game || game.gameStatus !== 'playing') {
    return null;
  }

  const round = game.rounds[game.currentRoundIndex];
  const isLastRound = game.currentRoundIndex >= game.rounds.length - 1;

  const letterIndices: number[] = [];
  for (let i = 0; i < round.phrase.length; i++) {
    if (/[a-zA-Z0-9]/.test(round.phrase[i])) letterIndices.push(i);
  }
  const allRevealed = letterIndices.every(i => round.revealedIndices.includes(i));

  const handleNext = () => {
    if (isLastRound) {
      goToFinale();
    } else {
      nextRound();
    }
  };

  const handleEndGame = () => {
    setShowSettings(false);
    goToFinale();
  };

  const handleEditResult = (teamId: string, roundIndex: number, tier: Tier | null, wrongCount: number) => {
    setRoundTier(teamId, roundIndex, tier);
    setRoundWrongCount(teamId, roundIndex, wrongCount);
  };

  const hasTheme = !!round.theme;

  return (
    <div style={{
      minHeight: '100vh', background: '#ECFDF5', display: 'flex', flexDirection: 'column',
    }}>
      {/* Top Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px', background: '#F0FDF4', borderBottom: '1px solid #A7F3D0',
        boxShadow: '0 1px 3px rgba(5,150,105,0.08)', flexShrink: 0,
      }}>
        <button
          onClick={() => setShowSettings(true)}
          style={{
            background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8,
            padding: '8px 14px', fontSize: 16, color: '#059669',
          }}
        >⚙️ Settings</button>

        <span style={{ fontSize: 20, fontWeight: 800, color: '#064E3B' }}>
          Round {game.currentRoundIndex + 1} / {game.rounds.length}
        </span>

        <div style={{ display: 'flex', gap: 8 }}>
          {!allRevealed && (
            <button
              onClick={revealAll}
              style={{
                background: '#D97706', color: 'white', border: 'none', borderRadius: 8,
                padding: '8px 16px', fontSize: 14, fontWeight: 600,
              }}
            >Reveal All</button>
          )}
          <button
            onClick={handleNext}
            style={{
              background: '#059669', color: '#F0FDF4', border: 'none', borderRadius: 8,
              padding: '8px 20px', fontSize: 14, fontWeight: 700,
            }}
          >{isLastRound ? 'Finish Game' : 'Next Round →'}</button>
        </div>
      </div>

      {/* Theme display area */}
      {hasTheme && (
        <div style={{ minHeight: 56, display: 'flex', justifyContent: 'center', padding: '10px 24px 0' }}>
          {!themeRevealed ? (
            <button
              onClick={() => setThemeRevealed(true)}
              style={{
                background: '#D1FAE5', color: '#065F46', border: '1px solid #A7F3D0',
                borderRadius: 24, padding: '10px 32px', fontSize: 28, fontWeight: 600,
                cursor: 'pointer',
              }}
            >Show Theme</button>
          ) : (
            <AnimatePresence>
              {round.theme && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    background: '#D1FAE5', color: '#065F46', borderRadius: 24,
                    padding: '10px 32px', fontSize: 32, fontWeight: 600,
                    border: '1px solid #A7F3D0',
                  }}
                >
                  {round.theme}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* Phrase Area */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px', minHeight: 300,
      }}>
        <PhraseDisplay
          phrase={round.phrase}
          revealedIndices={round.revealedIndices}
          onReveal={revealLetter}
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
          {game.teams.map(team => (
            <TeamCard
              key={team.id}
              team={team}
              solved={round.teamResults[team.id] === 'solved'}
              roundResults={game.roundResults}
              currentRoundIndex={game.currentRoundIndex}
              onCorrect={() => awardCorrect(team.id)}
              onWrong={() => awardWrong(team.id)}
              onEditResult={(roundIdx, tier, wrongCount) =>
                handleEditResult(team.id, roundIdx, tier, wrongCount)
              }
            />
          ))}
        </div>
      </div>

      {showSettings && (
        <SettingsModal
          teams={game.teams}
          onUpdateName={updateTeamName}
          onEndGame={handleEndGame}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
