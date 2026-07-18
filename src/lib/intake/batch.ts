// ─────────────────────────────────────────────────────────────
// Intake batch model — mock data shape for the AI Review Dashboard
// ─────────────────────────────────────────────────────────────

export type IntakeMode = 'single' | 'bulk';

export type BatchStatus =
  | 'ready'
  | 'duplicate'
  | 'missing_docs'
  | 'manual_review'
  | 'low_confidence'
  | 'approved';

export interface BatchDocument {
  key: string;              // e.g. 'passport'
  label: string;            // e.g. 'Passport'
  german: string;           // e.g. 'reisepass'
  present: boolean;
  confidence?: number;      // 0..1
  issue?: 'unreadable' | 'low_confidence' | null;
}

export interface FieldFocus {
  section:
    | 'personal' | 'passport' | 'contact' | 'education' | 'language'
    | 'employment' | 'internship' | 'social' | 'medical' | 'driving' | 'documents';
  fieldKey: string;
  reason?: string;
}

export interface BatchCandidate {
  id: string;
  firstName: string;
  lastName: string;
  country: string;
  email: string;
  status: BatchStatus;
  extractionConfidence: number;   // 0..1
  documents: BatchDocument[];
  duplicateOf?: string;
  similarity?: number;             // 0..1
  focus?: FieldFocus;              // where the dashboard should land you
}

export interface IntakeBatch {
  id: string;
  name: string;
  mode: IntakeMode;
  product: string;
  productLabel: string;
  createdAt: Date;
  candidates: BatchCandidate[];
}

// Reference doc set — kept in sync with CandidateIntake's REQUIRED_UPLOADS
const DOC_SET: Omit<BatchDocument, 'present' | 'confidence' | 'issue'>[] = [
  { key: 'passport', label: 'Passport',              german: 'reisepass' },
  { key: 'photo',    label: 'Photo',                 german: 'lichtbild' },
  { key: 'degree',   label: 'Highest degree',        german: 'bachelorzeugnis' },
  { key: 'sprach',   label: 'Language certificate',  german: 'sprachzertifikat' },
  { key: 'cv',       label: 'CV',                    german: 'lebenslauf' },
  { key: 'police',   label: 'Police clearance',      german: 'fuehrungszeugnis' },
  { key: 'medical',  label: 'Medical fitness',       german: 'gesundheitszeugnis' },
  { key: 'driving',  label: 'Driving licence',       german: 'fuehrerschein' },
];

function seededDocs(seed: number): { docs: BatchDocument[]; missing: number; low: number } {
  let missing = 0, low = 0;
  const docs: BatchDocument[] = DOC_SET.map((d, i) => {
    const s = (seed * 13 + i * 7) % 11;
    const present = s !== 0;
    if (!present) missing += 1;
    const rawConf = present ? 0.65 + ((seed + i * 3) % 35) / 100 : undefined;
    const lowConf = present && rawConf! < 0.8;
    if (lowConf) low += 1;
    return {
      ...d,
      present,
      confidence: rawConf,
      issue: !present ? null : lowConf ? 'low_confidence' : null,
    };
  });
  return { docs, missing, low };
}

/**
 * Build the initial batch shell for a real intake run.
 * Every candidate is a blank placeholder — no names, no country, no email.
 * The persistence layer wires these to real DB rows, and the Document
 * Intelligence pipeline (Qwen OCR + AI extraction) fills in the identity
 * fields from the uploaded documents.
 */
export function makeIntakeBatchShell(
  mode: IntakeMode,
  product: string,
  productLabel: string,
  count?: number,
  batchToken?: string,
): IntakeBatch {
  const size = Math.max(1, count ?? (mode === 'single' ? 1 : 1));
  const token = batchToken ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const candidates: BatchCandidate[] = [];

  for (let i = 0; i < size; i++) {
    const { docs } = seededDocs(i + 1);
    candidates.push({
      id: `cand-${i}`,
      firstName: 'Pending',
      lastName: `Candidate ${i + 1}`,
      country: '',
      email: `pending+${token}-${i + 1}@intake.local`,
      status: 'ready',
      extractionConfidence: 0,
      documents: docs.map((d) => ({ ...d, present: false, confidence: undefined, issue: null })),
    });
  }

  return {
    id: `batch-${Date.now()}`,
    name: mode === 'single' ? 'Single candidate intake' : nextBatchName(),
    mode,
    product,
    productLabel,
    createdAt: new Date(),
    candidates,
  };
}

/** @deprecated Kept as an alias for backwards compatibility — produces a real intake shell, not mock data. */
export const makeMockBatch = makeIntakeBatchShell;

function nextBatchName(): string {
  const d = new Date();
  const month = d.toLocaleString('en-US', { month: 'long' });
  return `${month} intake`;
}

export function statusMeta(s: BatchStatus) {
  switch (s) {
    case 'ready':          return { label: 'Ready',          tone: 'text-emerald-700 bg-emerald-50 ring-emerald-200' };
    case 'duplicate':      return { label: 'Duplicate',      tone: 'text-amber-800 bg-amber-50 ring-amber-200' };
    case 'missing_docs':   return { label: 'Missing docs',   tone: 'text-rose-700 bg-rose-50 ring-rose-200' };
    case 'manual_review':  return { label: 'Manual review',  tone: 'text-violet-700 bg-violet-50 ring-violet-200' };
    case 'low_confidence': return { label: 'Low confidence', tone: 'text-orange-700 bg-orange-50 ring-orange-200' };
    case 'approved':       return { label: 'Approved',       tone: 'text-emerald-800 bg-emerald-100 ring-emerald-300' };
  }
}
