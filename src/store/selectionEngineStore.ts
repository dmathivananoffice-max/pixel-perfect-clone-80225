import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mockCandidates } from '@/lib/mockData';

/* ────────────────────────────────────────────────────────────
   Selection Engine — single source of truth for
   Layer 1 (Mandatory Gates) and Layer 2 (Weighted Criteria).
   Consumed by:
     • src/pages/ScoringConfig.tsx  (edits)
     • src/pages/Dashboard.tsx      (KPIs)
     • src/pages/STIAssessment.tsx  (readiness pills)
   ──────────────────────────────────────────────────────────── */

export type ProgramKey = 'professional_nurses' | 'ausbildung';

export interface Gate {
  id: string;
  label: string;
  hint?: string;
  enabled: boolean;
  locked?: boolean;
}

export interface Criterion {
  id: string;
  label: string;
  weight: number; // 0–100
}

export interface ProgramConfig {
  key: ProgramKey;
  label: string;
  emoji: string;
  gates: Gate[];
  criteria: Criterion[];
}

export const DEFAULT_CONFIGS: Record<ProgramKey, ProgramConfig> = {
  professional_nurses: {
    key: 'professional_nurses',
    label: 'Professional Nurses',
    emoji: '👩‍⚕️',
    gates: [
      { id: 'passport', label: 'Valid Passport uploaded', enabled: true, locked: true },
      { id: 'no_doc_deficiencies', label: 'No major document deficiencies', enabled: true },
      { id: 'b2_german', label: 'German Language Level: B2', hint: 'Mandatory — no exceptions', enabled: true, locked: true },
      { id: 'modules', label: 'All required German language modules completed', enabled: true },
      { id: 'lang_cert', label: 'Valid German language certificate uploaded', enabled: true },
      { id: 'lang_cert_verified', label: 'Certificate verified (Goethe / TELC / ÖSD)', enabled: true },
      { id: 'bsc_nursing', label: 'B.Sc. Nursing degree completed', enabled: true, locked: true },
      { id: 'nursing_reg', label: 'Nursing Registration Certificate uploaded', enabled: true },
      { id: 'medical_docs', label: 'Required medical documents uploaded', enabled: true },
      { id: 'age', label: 'Age within employer requirements', enabled: false },
    ],
    criteria: [
      { id: 'clinical_experience', label: 'Clinical Experience', weight: 35 },
      { id: 'bsc_marks', label: 'B.Sc. Nursing Marks / GPA', weight: 30 },
      { id: 'german_b2', label: 'German B2 Performance', weight: 20 },
      { id: 'dept_experience', label: 'Hospital Department Experience', weight: 10 },
      { id: 'certifications', label: 'Professional Certifications / CPD', weight: 5 },
    ],
  },
  ausbildung: {
    key: 'ausbildung',
    label: 'Ausbildung Nursing',
    emoji: '🎓',
    gates: [
      { id: 'passport', label: 'Valid Passport uploaded', enabled: true, locked: true },
      { id: 'no_doc_deficiencies', label: 'No major document deficiencies', enabled: true },
      { id: 'b2_german', label: 'German Language Level: B2', hint: 'Mandatory — no exceptions', enabled: true, locked: true },
      { id: 'modules', label: 'All required German language modules completed', enabled: true },
      { id: 'lang_cert', label: 'Valid German language certificate uploaded', enabled: true },
      { id: 'lang_cert_verified', label: 'Certificate verified (Goethe / TELC / ÖSD)', enabled: true },
      { id: 'twelfth', label: '12th Standard completed', enabled: true, locked: true },
      { id: 'edu_certs', label: 'Required educational certificates uploaded', enabled: true },
      { id: 'medical_docs', label: 'Required medical documents uploaded', enabled: true },
      { id: 'age', label: 'Age within employer requirements', enabled: false },
    ],
    criteria: [
      { id: 'twelfth_marks', label: '12th Grade Marks', weight: 40 },
      { id: 'german_b2', label: 'German B2 Performance', weight: 25 },
      { id: 'internship', label: 'Internship / Hospital Exposure', weight: 15 },
      { id: 'social_service', label: 'Social Service', weight: 15 },
      { id: 'tenth_marks', label: '10th Grade Marks', weight: 5 },
    ],
  },
};

interface SelectionEngineState {
  configs: Record<ProgramKey, ProgramConfig>;
  setGate: (program: ProgramKey, gateId: string, enabled: boolean) => void;
  setWeight: (program: ProgramKey, criterionId: string, weight: number) => void;
  resetProgram: (program: ProgramKey) => void;
}

export const useSelectionEngine = create<SelectionEngineState>()(
  persist(
    (set) => ({
      configs: structuredClone(DEFAULT_CONFIGS),
      setGate: (program, gateId, enabled) =>
        set((state) => ({
          configs: {
            ...state.configs,
            [program]: {
              ...state.configs[program],
              gates: state.configs[program].gates.map((g) =>
                g.id === gateId ? { ...g, enabled } : g,
              ),
            },
          },
        })),
      setWeight: (program, criterionId, weight) =>
        set((state) => ({
          configs: {
            ...state.configs,
            [program]: {
              ...state.configs[program],
              criteria: state.configs[program].criteria.map((c) =>
                c.id === criterionId
                  ? { ...c, weight: Math.max(0, Math.min(100, Math.round(weight))) }
                  : c,
              ),
            },
          },
        })),
      resetProgram: (program) =>
        set((state) => ({
          configs: { ...state.configs, [program]: structuredClone(DEFAULT_CONFIGS[program]) },
        })),
    }),
    { name: 'workforce-selection-engine', version: 1 },
  ),
);

/* ────────────────────────────────────────────────────────────
   Readiness computation
   ──────────────────────────────────────────────────────────── */

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Deterministic pseudo-random raw score for a (candidate, criterion) pair. */
export function rawCriterionScore(candidateId: string, criterionId: string): number {
  return 45 + (hash(candidateId + ':' + criterionId) % 55); // 45–99
}

/** Deterministic per-candidate gate pass/fail (matches candidate.gate_status when set). */
export function gatePasses(candidateId: string, gateId: string, fallbackEligible: boolean): boolean {
  // Locked/critical gates almost always pass when candidate is broadly eligible.
  if (fallbackEligible && (gateId === 'passport' || gateId === 'b2_german' || gateId === 'bsc_nursing' || gateId === 'twelfth')) {
    return true;
  }
  const n = hash(candidateId + '|' + gateId) % 10;
  return fallbackEligible ? n > 0 : n > 6;
}

export interface Readiness {
  eligible: boolean;
  failedGates: string[];
  score: number;              // 0–100 weighted
  band: 'ready' | 'progressing' | 'at_risk' | 'ineligible';
}

export function computeReadiness(
  candidateId: string,
  program: ProgramConfig,
  candidateEligible: boolean,
): Readiness {
  const enforced = program.gates.filter((g) => g.enabled);
  const failedGates = enforced
    .filter((g) => !gatePasses(candidateId, g.id, candidateEligible))
    .map((g) => g.label);
  const eligible = failedGates.length === 0;

  const totalWeight = program.criteria.reduce((s, c) => s + c.weight, 0) || 1;
  const weighted = program.criteria.reduce(
    (sum, c) => sum + rawCriterionScore(candidateId, c.id) * (c.weight / totalWeight),
    0,
  );
  const score = Math.round(weighted);

  let band: Readiness['band'];
  if (!eligible) band = 'ineligible';
  else if (score >= 80) band = 'ready';
  else if (score >= 65) band = 'progressing';
  else band = 'at_risk';

  return { eligible, failedGates, score, band };
}

/** Map a candidate's program_name to a ProgramKey the Selection Engine understands. */
export function inferProgramKey(programName?: string): ProgramKey | null {
  const p = (programName || '').toLowerCase();
  if (p.includes('ausbildung')) return 'ausbildung';
  if (p.includes('nurs') || p.includes('pflege')) return 'professional_nurses';
  return null;
}

/** Aggregate KPI numbers for the Dashboard, driven by the current config. */
export interface EngineKpis {
  program: ProgramKey;
  total: number;
  eligible: number;
  ready: number;         // eligible & score ≥ 80
  progressing: number;   // eligible & 65–79
  atRisk: number;        // eligible & < 65
  ineligible: number;
  avgScore: number;
  gatesEnforced: number;
  gatesTotal: number;
  weightBalanced: boolean;
}

export function useEngineKpis(program: ProgramKey): EngineKpis {
  const cfg = useSelectionEngine((s) => s.configs[program]);
  const candidates = mockCandidates.filter((c) => inferProgramKey(c.program_name) === program);

  let eligible = 0, ready = 0, progressing = 0, atRisk = 0, ineligible = 0, scoreSum = 0;
  for (const c of candidates) {
    const r = computeReadiness(c.candidate_id, cfg, c.gate_status !== 'not_placement_ready');
    scoreSum += r.score;
    if (r.band === 'ineligible') ineligible++;
    else {
      eligible++;
      if (r.band === 'ready') ready++;
      else if (r.band === 'progressing') progressing++;
      else atRisk++;
    }
  }

  const totalWeight = cfg.criteria.reduce((s, c) => s + c.weight, 0);
  return {
    program,
    total: candidates.length,
    eligible, ready, progressing, atRisk, ineligible,
    avgScore: candidates.length ? Math.round(scoreSum / candidates.length) : 0,
    gatesEnforced: cfg.gates.filter((g) => g.enabled).length,
    gatesTotal: cfg.gates.length,
    weightBalanced: totalWeight === 100,
  };
}
