import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTemplateStore } from '../stores/templateStore';
import { useGameStore } from '../stores/gameStore';
import { TEAM_COLORS, getRandomTeamName } from '../constants';
import type { Team } from '../types';

function createTeam(index: number, takenNames: string[]): Team {
  return {
    id: crypto.randomUUID(),
    name: getRandomTeamName(takenNames),
    colorIndex: index,
  };
}

export default function GameSetup() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { templates, markUsed } = useTemplateStore();
  const { startGame } = useGameStore();
  const template = templates.find(t => t.id === id);

  const [teamCount, setTeamCount] = useState(4);
  const [teams, setTeams] = useState<Team[]>(() => {
    const t: Team[] = [];
    for (let i = 0; i < 4; i++) {
      t.push(createTeam(i, t.map(x => x.name)));
    }
    return t;
  });

  const adjustTeams = (count: number) => {
    const clamped = Math.max(2, Math.min(9, count));
    setTeamCount(clamped);
    setTeams(prev => {
      if (clamped > prev.length) {
        const added = [...prev];
        for (let i = prev.length; i < clamped; i++) {
          added.push(createTeam(i, added.map(x => x.name)));
        }
        return added;
      }
      return prev.slice(0, clamped);
    });
  };

  const rerollName = (teamId: string) => {
    setTeams(prev =>
      prev.map(t => t.id === teamId
        ? { ...t, name: getRandomTeamName(prev.filter(x => x.id !== teamId).map(x => x.name)) }
        : t
      )
    );
  };

  const updateName = (teamId: string, name: string) => {
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, name } : t));
  };

  const allNamed = teams.every(t => t.name.trim().length > 0);

  const handleStart = () => {
    if (!template || !allNamed) return;
    markUsed(template.id);
    startGame(template.id, teams, template.phrases);
    navigate('/play');
  };

  if (!template) {
    return (
      <div style={{ padding: 40, textAlign: 'center', background: '#ECFDF5', minHeight: '100vh' }}>
        <p style={{ color: '#064E3B' }}>Template not found.</p>
        <button onClick={() => navigate('/')} style={{
          marginTop: 16, padding: '10px 20px', background: '#059669', color: '#F0FDF4',
          border: 'none', borderRadius: 8, fontWeight: 600,
        }}>
          Back to Library
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#ECFDF5', display: 'flex', flexDirection: 'column' }}>
      {/* Top Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '16px 32px', background: '#F0FDF4', borderBottom: '1px solid #A7F3D0',
        boxShadow: '0 1px 3px rgba(5,150,105,0.08)',
      }}>
        <button onClick={() => navigate('/')} style={{
          background: 'none', border: 'none', fontSize: 22, color: '#059669', padding: '4px 8px',
        }}>
          ←
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#064E3B' }}>Game Setup</h1>
          <p style={{ fontSize: 14, color: '#047857' }}>
            {template.name} — {template.phrases.length} round{template.phrases.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 700, width: '100%', margin: '0 auto', padding: '32px 24px' }}>
        <div style={{
          background: '#F0FDF4', borderRadius: 14, padding: 28, flex: 1,
          border: '1px solid #A7F3D0',
          boxShadow: '0 2px 8px rgba(5,150,105,0.06)',
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24, color: '#064E3B' }}>Teams</h2>

          {/* Team count stepper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#064E3B' }}>Number of Teams</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => adjustTeams(teamCount - 1)}
                disabled={teamCount <= 2}
                style={{
                  width: 40, height: 40, borderRadius: 10, border: '1px solid #A7F3D0',
                  background: '#F0FDF4', fontSize: 20, fontWeight: 700,
                  color: teamCount <= 2 ? '#A7F3D0' : '#059669',
                }}
              >−</button>
              <span style={{
                width: 44, textAlign: 'center', fontSize: 24, fontWeight: 800, color: '#064E3B',
              }}>{teamCount}</span>
              <button
                onClick={() => adjustTeams(teamCount + 1)}
                disabled={teamCount >= 9}
                style={{
                  width: 40, height: 40, borderRadius: 10, border: '1px solid #A7F3D0',
                  background: '#F0FDF4', fontSize: 20, fontWeight: 700,
                  color: teamCount >= 9 ? '#A7F3D0' : '#059669',
                }}
              >+</button>
            </div>
          </div>

          {/* Team list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {teams.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 12, background: 'white',
                  border: '1px solid #A7F3D0',
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: TEAM_COLORS[t.colorIndex], flexShrink: 0,
                }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#6B7280', minWidth: 60 }}>
                  Team {i + 1}
                </span>
                <input
                  value={t.name}
                  onChange={e => updateName(t.id, e.target.value)}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #A7F3D0',
                    fontSize: 16, outline: 'none', background: '#ECFDF5', color: '#1E293B',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#059669')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#A7F3D0')}
                />
                <button
                  onClick={() => rerollName(t.id)}
                  title="Random name"
                  style={{
                    background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10,
                    padding: '8px 12px', fontSize: 18, cursor: 'pointer',
                  }}
                >
                  🎲
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div style={{
        padding: '16px 32px', background: '#F0FDF4', borderTop: '1px solid #A7F3D0',
        display: 'flex', justifyContent: 'center',
      }}>
        <button
          onClick={handleStart}
          disabled={!allNamed}
          style={{
            background: allNamed ? '#059669' : '#A7F3D0',
            color: '#F0FDF4', border: 'none', borderRadius: 14,
            padding: '18px 56px', fontSize: 20, fontWeight: 800,
            boxShadow: allNamed ? '0 4px 16px rgba(5,150,105,0.3)' : 'none',
            cursor: allNamed ? 'pointer' : 'not-allowed',
          }}
        >
          Start Game
        </button>
      </div>
    </div>
  );
}
