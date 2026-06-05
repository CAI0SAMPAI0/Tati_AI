/**
 * Fonte única de verdade para os níveis CEFR.
 * Usado por frontend, hub-site e tipagens do hub-core.
 */

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export const CEFR_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const LEVEL_OPTIONS: { value: CEFRLevel; label: string }[] = [
  { value: 'A1', label: 'A1 – Beginner' },
  { value: 'A2', label: 'A2 – Pre-Intermediate' },
  { value: 'B1', label: 'B1 – Intermediate' },
  { value: 'B2', label: 'B2 – Upper-Intermediate' },
  { value: 'C1', label: 'C1 – Advanced' },
  { value: 'C2', label: 'C2 – Mastery / Proficiency' },
];

export const LEVEL_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Levels' },
  ...LEVEL_OPTIONS,
];

export const CEFR_LABEL_MAP: Record<CEFRLevel, string> = {
  A1: 'A1 – Beginner',
  A2: 'A2 – Pre-Intermediate',
  B1: 'B1 – Intermediate',
  B2: 'B2 – Upper-Intermediate',
  C1: 'C1 – Advanced',
  C2: 'C2 – Mastery / Proficiency',
};

const LEVEL_ALIAS_MAP: Record<string, CEFRLevel> = {
  a1: 'A1', beginner: 'A1', iniciante: 'A1',
  a2: 'A2', 'pre-intermediate': 'A2', 'pre intermediate': 'A2',
  b1: 'B1', intermediate: 'B1', intermediario: 'B1',
  b2: 'B2', 'upper-intermediate': 'B2', 'upper intermediate': 'B2',
  c1: 'C1', advanced: 'C1', avancado: 'C1',
  'business english': 'C1', business: 'C1',
  c2: 'C2', mastery: 'C2', proficiency: 'C2',
};

export function normalizeLevel(raw: string | null | undefined): CEFRLevel {
  if (!raw) return 'A1';
  const lower = raw.trim().toLowerCase();
  const mapped = LEVEL_ALIAS_MAP[lower];
  if (mapped) return mapped;
  const upper = raw.trim().toUpperCase() as CEFRLevel;
  return CEFR_LEVELS.includes(upper) ? upper : 'A1';
}

export function levelLabel(raw: string | null | undefined): string {
  const code = normalizeLevel(raw);
  return CEFR_LABEL_MAP[code] ?? code;
}
