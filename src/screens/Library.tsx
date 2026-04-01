import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTemplateStore } from '../stores/templateStore';
import type { GameTemplate } from '../types';

export default function Library() {
  const navigate = useNavigate();
  const { templates, remove, duplicate } = useTemplateStore();
  const [deleteTarget, setDeleteTarget] = useState<GameTemplate | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const sorted = [...templates].sort((a, b) => {
    if (!a.lastUsedAt && !b.lastUsedAt) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (!a.lastUsedAt) return 1;
    if (!b.lastUsedAt) return -1;
    return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
  });

  return (
    <div style={{ minHeight: '100vh', background: '#ECFDF5' }}>
      {/* Top Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 32px', background: '#F0FDF4', borderBottom: '1px solid #A7F3D0',
        boxShadow: '0 1px 3px rgba(5,150,105,0.08)',
      }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', color: '#064E3B' }}>
          🎲 Diceipher
        </h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => navigate('/tutorial')} style={{
            background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', borderRadius: 10,
            padding: '10px 20px', fontSize: 15, fontWeight: 600,
          }}>
            ? How to Play
          </button>
          <button onClick={() => navigate('/edit/new')} style={{
            background: '#059669', color: '#F0FDF4', border: 'none', borderRadius: 10,
            padding: '10px 20px', fontSize: 15, fontWeight: 600,
            boxShadow: '0 2px 8px rgba(5,150,105,0.25)',
          }}>
            + New Template
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto' }}>
        {sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📝</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: '#064E3B' }}>No templates yet</h2>
            <p style={{ color: '#6B7280', marginBottom: 24, fontSize: 16 }}>
              Create your first template to start playing!
            </p>
            <button onClick={() => navigate('/edit/new')} style={{
              background: '#059669', color: '#F0FDF4', border: 'none', borderRadius: 10,
              padding: '14px 28px', fontSize: 17, fontWeight: 600,
              boxShadow: '0 2px 8px rgba(5,150,105,0.25)',
            }}>
              Create Your First Template
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 20,
          }}>
            <AnimatePresence>
              {sorted.map(t => (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ y: -4, boxShadow: '0 8px 24px rgba(5,150,105,0.12)' }}
                  style={{
                    background: '#F0FDF4', borderRadius: 12, overflow: 'hidden',
                    border: '1px solid #A7F3D0',
                    boxShadow: '0 2px 8px rgba(5,150,105,0.06)', position: 'relative',
                    cursor: 'pointer',
                  }}
                  onClick={() => navigate(`/setup/${t.id}`)}
                >
                  <div style={{ height: 6, background: t.color }} />
                  <div style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: '#064E3B' }}>{t.name}</h3>
                        <p style={{ color: '#6B7280', fontSize: 14 }}>
                          {t.phrases.length} phrase{t.phrases.length !== 1 ? 's' : ''}
                        </p>
                        {t.lastUsedAt && (
                          <p style={{ color: '#6B7280', fontSize: 12, marginTop: 4 }}>
                            Last played {new Date(t.lastUsedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === t.id ? null : t.id); }}
                          style={{
                            background: 'none', border: 'none', fontSize: 20, color: '#6B7280',
                            padding: '4px 8px', borderRadius: 6,
                          }}
                        >⋮</button>
                        {openMenu === t.id && (
                          <div style={{
                            position: 'absolute', right: 0, top: '100%', background: 'white',
                            borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                            zIndex: 10, minWidth: 140, overflow: 'hidden', border: '1px solid #A7F3D0',
                          }}>
                            {[
                              { label: '▶ Play', action: () => navigate(`/setup/${t.id}`) },
                              { label: '✏️ Edit', action: () => navigate(`/edit/${t.id}`) },
                              { label: '📋 Duplicate', action: () => { duplicate(t.id); setOpenMenu(null); } },
                              { label: '🗑️ Delete', action: () => { setDeleteTarget(t); setOpenMenu(null); }, color: '#DC2626' },
                            ].map(item => (
                              <button
                                key={item.label}
                                onClick={(e) => { e.stopPropagation(); item.action(); }}
                                style={{
                                  display: 'block', width: '100%', padding: '10px 16px', border: 'none',
                                  background: 'none', textAlign: 'left', fontSize: 14, cursor: 'pointer',
                                  color: item.color || '#1E293B',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#ECFDF5')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                              >{item.label}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/setup/${t.id}`); }}
                      style={{
                        marginTop: 12, width: '100%', background: '#059669', color: '#F0FDF4',
                        border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600,
                      }}
                    >Play</button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {openMenu && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 5 }} onClick={() => setOpenMenu(null)} />
      )}

      {deleteTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{
              background: 'white', borderRadius: 16, padding: 32, maxWidth: 400, width: '90%',
              textAlign: 'center', border: '1px solid #A7F3D0',
            }}
          >
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#064E3B' }}>Delete Template?</h3>
            <p style={{ color: '#6B7280', marginBottom: 24 }}>
              "{deleteTarget.name}" will be permanently deleted.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => setDeleteTarget(null)} style={{
                padding: '10px 24px', borderRadius: 8, border: '1px solid #A7F3D0',
                background: 'white', fontSize: 14, fontWeight: 600, color: '#1E293B',
              }}>Cancel</button>
              <button onClick={() => { remove(deleteTarget.id); setDeleteTarget(null); }} style={{
                padding: '10px 24px', borderRadius: 8, border: 'none',
                background: '#DC2626', color: 'white', fontSize: 14, fontWeight: 600,
              }}>Delete</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
