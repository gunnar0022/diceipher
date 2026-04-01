import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, Reorder } from 'framer-motion';
import { useTemplateStore } from '../stores/templateStore';
import type { GameTemplate } from '../types';
import { TEMPLATE_COLORS } from '../constants';

export default function TemplateEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { templates, save } = useTemplateStore();

  const isNew = id === 'new';
  const existing = !isNew ? templates.find(t => t.id === id) : null;

  const [name, setName] = useState(existing?.name ?? '');
  const [color, setColor] = useState(existing?.color ?? TEMPLATE_COLORS[Math.floor(Math.random() * TEMPLATE_COLORS.length)]);
  const [phrases, setPhrases] = useState<{ id: string; text: string; theme: string }[]>(
    existing?.phrases.map(p => ({ id: crypto.randomUUID(), text: p.text, theme: p.theme ?? '' }))
      ?? [{ id: crypto.randomUUID(), text: '', theme: '' }]
  );
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');

  const markDirty = useCallback(() => setDirty(true), []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  function handleSave() {
    const trimmedName = name.trim();
    const validPhrases = phrases
      .filter(p => p.text.trim())
      .map(p => ({
        text: p.text.trim(),
        theme: p.theme.trim() || undefined,
      }));
    if (!trimmedName) { setError('Template needs a name.'); return; }
    if (validPhrases.length === 0) { setError('Add at least one phrase.'); return; }

    const template: GameTemplate = {
      id: existing?.id ?? crypto.randomUUID(),
      name: trimmedName,
      color,
      phrases: validPhrases,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      lastUsedAt: existing?.lastUsedAt ?? '',
    };
    save(template);
    setDirty(false);
    navigate('/');
  }

  function handleBack() {
    if (dirty && !window.confirm('You have unsaved changes. Leave anyway?')) return;
    navigate('/');
  }

  function addPhrase() {
    setPhrases([...phrases, { id: crypto.randomUUID(), text: '', theme: '' }]);
    markDirty();
  }

  function removePhrase(pid: string) {
    setPhrases(phrases.filter(p => p.id !== pid));
    markDirty();
  }

  function updatePhrase(pid: string, text: string) {
    setPhrases(phrases.map(p => p.id === pid ? { ...p, text } : p));
    markDirty();
  }

  function updateTheme(pid: string, theme: string) {
    setPhrases(phrases.map(p => p.id === pid ? { ...p, theme } : p));
    markDirty();
  }

  function handleBulkAdd() {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const newPhrases = lines.map(text => ({ id: crypto.randomUUID(), text, theme: '' }));
    setPhrases([...phrases.filter(p => p.text.trim()), ...newPhrases]);
    setBulkText('');
    setBulkMode(false);
    markDirty();
  }

  return (
    <div style={{ minHeight: '100vh', background: '#ECFDF5' }}>
      {/* Top Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '16px 32px', background: '#F0FDF4', borderBottom: '1px solid #A7F3D0',
        boxShadow: '0 1px 3px rgba(5,150,105,0.08)',
      }}>
        <button onClick={handleBack} style={{
          background: 'none', border: 'none', fontSize: 22, color: '#059669', padding: '4px 8px',
        }}>←</button>
        <h1 style={{ fontSize: 20, fontWeight: 700, flex: 1, color: '#064E3B' }}>
          {isNew ? 'New Template' : 'Edit Template'}
        </h1>
        <button onClick={handleSave} style={{
          background: '#059669', color: '#F0FDF4', border: 'none', borderRadius: 10,
          padding: '10px 24px', fontSize: 15, fontWeight: 600,
        }}>Save</button>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
              padding: '12px 16px', marginBottom: 20, color: '#DC2626', fontSize: 14,
            }}
          >{error}</motion.div>
        )}

        {/* Name & Color */}
        <div style={{
          background: '#F0FDF4', borderRadius: 12, padding: 24, marginBottom: 20,
          border: '1px solid #A7F3D0',
        }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6, color: '#064E3B' }}>
            Template Name
          </label>
          <input
            value={name}
            onChange={e => { setName(e.target.value); markDirty(); setError(''); }}
            placeholder="e.g., Unit 5 Vocabulary"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #A7F3D0',
              fontSize: 16, outline: 'none', background: 'white', color: '#1E293B',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = '#059669')}
            onBlur={e => (e.currentTarget.style.borderColor = '#A7F3D0')}
          />
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginTop: 20, marginBottom: 10, color: '#064E3B' }}>
            Color
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TEMPLATE_COLORS.map(c => (
              <button
                key={c}
                onClick={() => { setColor(c); markDirty(); }}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  border: color === c ? '3px solid #064E3B' : '3px solid transparent',
                  background: c, cursor: 'pointer',
                  outline: color === c ? '2px solid white' : 'none', outlineOffset: '-5px',
                }}
              />
            ))}
          </div>
        </div>

        {/* Phrases */}
        <div style={{
          background: '#F0FDF4', borderRadius: 12, padding: 24,
          border: '1px solid #A7F3D0',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#064E3B' }}>
              Phrases ({phrases.filter(p => p.text.trim()).length})
            </h2>
            <button
              onClick={() => setBulkMode(!bulkMode)}
              style={{
                background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, padding: '6px 14px',
                fontSize: 13, fontWeight: 600, color: '#059669',
              }}
            >{bulkMode ? 'Cancel Bulk' : 'Bulk Add'}</button>
          </div>

          {bulkMode ? (
            <div>
              <textarea
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder="Paste phrases here, one per line (themes can be added individually after)..."
                rows={8}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #A7F3D0',
                  fontSize: 15, resize: 'vertical', outline: 'none', background: 'white', color: '#1E293B',
                }}
              />
              <button onClick={handleBulkAdd} style={{
                marginTop: 10, background: '#059669', color: '#F0FDF4', border: 'none',
                borderRadius: 8, padding: '8px 20px', fontSize: 14, fontWeight: 600,
              }}>Add Lines as Phrases</button>
            </div>
          ) : (
            <>
              <Reorder.Group
                axis="y"
                values={phrases}
                onReorder={(newOrder) => { setPhrases(newOrder); markDirty(); }}
                style={{ listStyle: 'none' }}
              >
                {phrases.map((p, i) => (
                  <Reorder.Item
                    key={p.id}
                    value={p}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8,
                      background: 'white', borderRadius: 8, padding: '8px 10px',
                      border: '1px solid #A7F3D0',
                    }}
                  >
                    <span style={{ cursor: 'grab', color: '#6B7280', fontSize: 16, userSelect: 'none', marginTop: 8 }}>⠿</span>
                    <span style={{ color: '#6B7280', fontSize: 13, fontWeight: 600, minWidth: 24, marginTop: 8 }}>{i + 1}.</span>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <input
                        value={p.text}
                        onChange={e => { updatePhrase(p.id, e.target.value); setError(''); }}
                        placeholder="Enter a phrase..."
                        style={{
                          width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #A7F3D0',
                          fontSize: 15, outline: 'none', background: '#ECFDF5', color: '#1E293B',
                        }}
                        onFocus={e => (e.currentTarget.style.borderColor = '#059669')}
                        onBlur={e => (e.currentTarget.style.borderColor = '#A7F3D0')}
                      />
                      <input
                        value={p.theme}
                        onChange={e => { updateTheme(p.id, e.target.value); }}
                        placeholder="Optional hint (e.g. 'Biology', 'Movie quote')"
                        style={{
                          width: '100%', padding: '6px 12px', borderRadius: 6, border: '1px solid #D1FAE5',
                          fontSize: 13, outline: 'none', background: '#F0FDF4', color: '#6B7280',
                        }}
                        onFocus={e => (e.currentTarget.style.borderColor = '#059669')}
                        onBlur={e => (e.currentTarget.style.borderColor = '#D1FAE5')}
                      />
                    </div>
                    <button
                      onClick={() => removePhrase(p.id)}
                      style={{
                        background: 'none', border: 'none', fontSize: 18, color: '#A7F3D0', padding: '4px 8px',
                        marginTop: 4,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#DC2626')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#A7F3D0')}
                    >✕</button>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
              <button
                onClick={addPhrase}
                style={{
                  marginTop: 8, background: 'none', border: '2px dashed #A7F3D0',
                  borderRadius: 8, padding: '10px', width: '100%', fontSize: 14,
                  fontWeight: 600, color: '#059669', cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#059669')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#A7F3D0')}
              >+ Add Phrase</button>
            </>
          )}
        </div>

        <button onClick={handleSave} style={{
          marginTop: 24, width: '100%', background: '#059669', color: '#F0FDF4', border: 'none',
          borderRadius: 12, padding: '14px', fontSize: 16, fontWeight: 700,
          boxShadow: '0 2px 8px rgba(5,150,105,0.25)',
        }}>Save & Return to Library</button>
      </div>
    </div>
  );
}
