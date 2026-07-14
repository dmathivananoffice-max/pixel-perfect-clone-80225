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

const NAMES: [string, string, string][] = [
  ['Rahul',   'Sharma',    'India'],
  ['Maria',   'Fernandes', 'Philippines'],
  ['Ahmed',   'Khan',      'Pakistan'],
  ['Sunita',  'Devi',      'India'],
  ['Robert',  'Okoye',     'Nigeria'],
  ['Priya',   'Menon',     'India'],
  ['Carlos',  'Reyes',     'Mexico'],
  ['Linh',    'Nguyen',    'Vietnam'],
  ['Fatima',  'El Idrissi','Morocco'],
  ['Deeban',  'Rajendran', 'India'],
  ['Anh',     'Tran',      'Vietnam'],
  ['Grace',   'Adeyemi',   'Nigeria'],
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

/** Generate a realistic mock batch for the dashboard. */
export function makeMockBatch(mode: IntakeMode, product: string, productLabel: string): IntakeBatch {
  const size = mode === 'single' ? 1 : 42;
  const candidates: BatchCandidate[] = [];
  const takenNames = new Set<string>();

  for (let i = 0; i < size; i++) {
    const [fn, ln, country] = NAMES[i % NAMES.length];
    const suffix = i >= NAMES.length ? ` ${Math.floor(i / NAMES.length) + 1}` : '';
    const firstName = fn + suffix;
    const key = `${firstName} ${ln}`.toLowerCase();
    takenNames.add(key);

    const { docs, missing, low } = seededDocs(i + 1);
    const extractionConfidence = 0.82 + ((i * 17) % 18) / 100;

    let status: BatchStatus = 'ready';
    let duplicateOf: string | undefined;
    let similarity: number | undefined;
    let focus: FieldFocus | undefined;

    // Salt with duplicates + manual review deterministically for bulk
    if (mode === 'bulk') {
      if (i === 2)  { status = 'duplicate';      duplicateOf = 'cand-0'; similarity = 0.99; }
      else if (i === 7)  { status = 'duplicate'; duplicateOf = 'cand-1'; similarity = 0.94; }
      else if (i === 3)  { status = 'manual_review'; focus = { section: 'passport', fieldKey: 'passport_no', reason: 'Passport number unreadable' }; }
      else if (missing > 0) { status = 'missing_docs'; }
      else if (low >= 2)    { status = 'low_confidence'; focus = { section: 'contact', fieldKey: 'address', reason: 'Address low confidence' }; }
    } else if (missing > 0) {
      status = 'missing_docs';
    }

    candidates.push({
      id: `cand-${i}`,
      firstName,
      lastName: ln,
      country,
      email: `${fn.toLowerCase()}.${ln.toLowerCase().replace(/\s+/g,'')}@intake.local`,
      status,
      extractionConfidence,
      documents: docs,
      duplicateOf,
      similarity,
      focus,
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
