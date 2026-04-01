import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Team } from '../types';
import { TEAM_COLORS } from '../constants';

interface Props {
  teams: Team[];
  onUpdateName: (teamId: string, name: string) => void;
  onEndGame: () => void;
  onClose: () => void;
}

export default function SettingsModal({ teams, onUpdateName, onEndGame, onClose }: Props) {
  const [confirmEnd, setConfirmEnd] = useState(false);

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
          maxHeight: '80vh', overflowY: 'auto', border: '1px solid #A7F3D0',
        }}
      >
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#064E3B' }}>Settings</h3>

        <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#064E3B' }}>Edit Team Names</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {teams.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: TEAM_COLORS[t.colorIndex], flexShrink: 0,
              }} />
              <input
                value={t.name}
                onChange={e => onUpdateName(t.id, e.target.value)}
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid #A7F3D0',
                  fontSize: 14, outline: 'none', color: '#1E293B',
                }}
              />
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid #A7F3D0', paddingTop: 16 }}>
          {!confirmEnd ? (
            <button onClick={() => setConfirmEnd(true)} style={{
              width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #DC2626',
              background: 'white', color: '#DC2626', fontSize: 14, fontWeight: 600,
            }}>End Game Early</button>
          ) : (
            <div>
              <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 12 }}>
                This will skip remaining rounds and go to the Finale. Are you sure?
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setConfirmEnd(false)} style={{
                  flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #A7F3D0',
                  background: 'white', fontSize: 14, fontWeight: 600, color: '#1E293B',
                }}>Cancel</button>
                <button onClick={onEndGame} style={{
                  flex: 1, padding: '8px', borderRadius: 8, border: 'none',
                  background: '#DC2626', color: 'white', fontSize: 14, fontWeight: 600,
                }}>End Game</button>
              </div>
            </div>
          )}
        </div>

        <button onClick={onClose} style={{
          marginTop: 16, width: '100%', padding: '8px', borderRadius: 8,
          border: '1px solid #A7F3D0', background: '#F0FDF4', fontSize: 14, fontWeight: 600, color: '#064E3B',
        }}>Close</button>
      </motion.div>
    </div>
  );
}
