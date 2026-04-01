import { create } from 'zustand';
import type { GameTemplate, PhraseEntry } from '../types';

const STORAGE_KEY = 'diceipher-templates';
const LEGACY_KEY = 'word-reveal-templates';

/** Migrate old string[] phrases to PhraseEntry[] */
function migrateTemplate(raw: GameTemplate & { phrases: (string | PhraseEntry)[] }): GameTemplate {
  return {
    ...raw,
    phrases: raw.phrases.map(p =>
      typeof p === 'string' ? { text: p } : p
    ),
  };
}

function loadTemplates(): GameTemplate[] {
  try {
    // Try new key first, fall back to legacy
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_KEY);
      if (raw) {
        // Migrate to new key
        localStorage.setItem(STORAGE_KEY, raw);
        localStorage.removeItem(LEGACY_KEY);
      }
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw) as (GameTemplate & { phrases: (string | PhraseEntry)[] })[];
    return parsed.map(migrateTemplate);
  } catch {
    return [];
  }
}

function saveTemplates(templates: GameTemplate[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch {
    alert('Could not save — localStorage may be full. Try deleting old templates.');
  }
}

interface TemplateStore {
  templates: GameTemplate[];
  load: () => void;
  save: (template: GameTemplate) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  markUsed: (id: string) => void;
}

export const useTemplateStore = create<TemplateStore>((set, get) => ({
  templates: loadTemplates(),
  load: () => set({ templates: loadTemplates() }),
  save: (template) => {
    const templates = get().templates;
    const idx = templates.findIndex(t => t.id === template.id);
    const next = idx >= 0
      ? templates.map(t => t.id === template.id ? template : t)
      : [...templates, template];
    saveTemplates(next);
    set({ templates: next });
  },
  remove: (id) => {
    const next = get().templates.filter(t => t.id !== id);
    saveTemplates(next);
    set({ templates: next });
  },
  duplicate: (id) => {
    const source = get().templates.find(t => t.id === id);
    if (!source) return;
    const copy: GameTemplate = {
      ...source,
      id: crypto.randomUUID(),
      name: `${source.name} (copy)`,
      createdAt: new Date().toISOString(),
      lastUsedAt: '',
    };
    const next = [...get().templates, copy];
    saveTemplates(next);
    set({ templates: next });
  },
  markUsed: (id) => {
    const next = get().templates.map(t =>
      t.id === id ? { ...t, lastUsedAt: new Date().toISOString() } : t
    );
    saveTemplates(next);
    set({ templates: next });
  },
}));
