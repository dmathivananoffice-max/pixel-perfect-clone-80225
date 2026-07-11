import type { CandidateStatus } from '@/types';

export interface StageMeta {
  id: CandidateStatus;
  label: string;
  tone: 'neutral' | 'blue' | 'amber' | 'violet' | 'emerald' | 'rose' | 'zinc';
  terminal?: boolean;
}

export const STAGES: StageMeta[] = [
  { id: 'waiting',     label: 'Registered',       tone: 'neutral' },
  { id: 'shortlisted', label: 'Shortlisted',      tone: 'blue' },
  { id: 'interview1',  label: 'Interview Round 1', tone: 'violet' },
  { id: 'interview2',  label: 'Interview Round 2', tone: 'violet' },
  { id: 'contract',    label: 'Offer / Contract', tone: 'amber' },
  { id: 'visa',        label: 'Visa',             tone: 'blue' },
  { id: 'placed',      label: 'Placed',           tone: 'emerald', terminal: true },
  { id: 'rejected',    label: 'Rejected',         tone: 'rose', terminal: true },
  { id: 'withdrawn',   label: 'Withdrawn',        tone: 'zinc', terminal: true },
];

// Allowed forward transitions. Anything else is technically a manual override.
const TRANSITIONS: Record<CandidateStatus, CandidateStatus[]> = {
  waiting:     ['shortlisted', 'rejected', 'withdrawn'],
  shortlisted: ['interview1', 'rejected', 'withdrawn'],
  interview1:  ['interview2', 'rejected', 'withdrawn'],
  interview2:  ['contract', 'rejected', 'withdrawn'],
  contract:    ['visa', 'withdrawn'],
  visa:        ['placed', 'withdrawn'],
  placed:      [],
  rejected:    [],
  withdrawn:   [],
};

export function stageMeta(id: CandidateStatus): StageMeta {
  return STAGES.find((s) => s.id === id) ?? STAGES[0];
}

export function nextStages(current: CandidateStatus): StageMeta[] {
  const allowed = new Set(TRANSITIONS[current] ?? []);
  return STAGES.filter((s) => allowed.has(s.id));
}

export const TONE_CLASSES: Record<StageMeta['tone'], string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  blue:    'bg-blue-50 text-blue-700 ring-blue-200',
  amber:   'bg-amber-50 text-amber-800 ring-amber-200',
  violet:  'bg-violet-50 text-violet-700 ring-violet-200',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rose:    'bg-rose-50 text-rose-700 ring-rose-200',
  zinc:    'bg-zinc-100 text-zinc-600 ring-zinc-200',
};

// Language levels
export const LANG_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
export type LangLevel = typeof LANG_LEVELS[number];

// Deterministic pseudo-random derivations for mock enrichment
function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}
export function deriveLanguageLevel(candidateId: string): LangLevel {
  return LANG_LEVELS[hash(candidateId) % LANG_LEVELS.length];
}
export function deriveSpeakingScore(candidateId: string): number | null {
  const h = hash(candidateId + 's');
  if (h % 5 === 0) return null;
  return 55 + (h % 45);
}
export function deriveTrainingScore(candidateId: string): number | null {
  const h = hash(candidateId + 't');
  if (h % 4 === 0) return null;
  return 50 + (h % 50);
}
export function deriveInterviewScore(candidateId: string): number | null {
  const h = hash(candidateId + 'i');
  if (h % 3 === 0) return null;
  return 60 + (h % 40);
}
export function deriveLastActivity(candidateId: string): Date {
  const days = hash(candidateId + 'a') % 30;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}
