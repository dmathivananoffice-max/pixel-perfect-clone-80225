import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, ArrowRight, Check, ChevronRight, FileText, Save, Sparkles,
  ShieldCheck, X, Search as SearchIcon, ZoomIn, ZoomOut, RotateCw,
  AlertTriangle, CheckCircle2, Info, Upload, Keyboard, Cloud, Gauge,
  PanelRightOpen, PanelRightClose,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { allCountries } from '@/lib/countries';
import { mockCandidates } from '@/lib/mockData';

import imgNurses from '@/assets/product-nurses.jpg';
import imgAusbildung from '@/assets/product-ausbildung.jpg';
import imgPreBachelor from '@/assets/product-pre-bachelor.jpg';
import imgPreMasters from '@/assets/product-pre-masters.jpg';
import imgMba from '@/assets/product-mba.jpg';

// ─────────────────────────────────────────────────────────────
// Product definitions (module-local — the intake decides workflow)
// ─────────────────────────────────────────────────────────────
type IntakeProductId = 'nurses' | 'ausbildung' | 'pre_bachelor' | 'pre_masters' | 'mba';
interface ProductDef {
  id: IntakeProductId;
  label: string;
  tagline: string;
  image: string;
  ring: string;
  halo: string;
}
const INTAKE_PRODUCTS: ProductDef[] = [
  { id: 'nurses',       label: 'Professional Nurses', tagline: 'Approbation, B2, hospital placement', image: imgNurses,      ring: 'ring-rose-200',    halo: 'shadow-rose-200/50' },
  { id: 'ausbildung',   label: 'Ausbildung',          tagline: 'Vocational training in Germany',      image: imgAusbildung,  ring: 'ring-indigo-200',  halo: 'shadow-indigo-200/50' },
  { id: 'pre_bachelor', label: 'Pre-Bachelor',        tagline: 'Studienkolleg & undergraduate track', image: imgPreBachelor, ring: 'ring-emerald-200', halo: 'shadow-emerald-200/50' },
  { id: 'pre_masters',  label: 'Pre-Masters',         tagline: 'Master intake preparation',           image: imgPreMasters,  ring: 'ring-violet-200',  halo: 'shadow-violet-200/50' },
  { id: 'mba',          label: 'MBA',                 tagline: 'Executive & business schools',        image: imgMba,         ring: 'ring-amber-200',   halo: 'shadow-amber-200/50' },
];

// ─────────────────────────────────────────────────────────────
// Sections
// ─────────────────────────────────────────────────────────────
type SectionId =
  | 'personal' | 'passport' | 'contact' | 'education' | 'language'
  | 'employment' | 'internship' | 'social' | 'medical' | 'driving' | 'documents';

interface SectionDef {
  id: SectionId;
  number: number;
  label: string;
  doc: string;         // mock reference document name shown in viewer
  hint: string;
}
const SECTIONS: SectionDef[] = [
  { id: 'personal',    number: 2,  label: 'Personal Information', doc: 'Passport bio page',           hint: 'Confirm legal name, DOB, gender, nationality.' },
  { id: 'passport',    number: 3,  label: 'Passport',             doc: 'Passport bio page',           hint: 'Passport number, issue, expiry.' },
  { id: 'contact',     number: 4,  label: 'Contact',              doc: 'Address proof',               hint: 'Reachability — check spelling of address & city.' },
  { id: 'education',   number: 5,  label: 'Education',            doc: 'Highest degree certificate',  hint: 'Institution, field, dates, GPA if present.' },
  { id: 'language',    number: 6,  label: 'German Language',      doc: 'Sprachzertifikat',            hint: 'Provider, level, exam & certificate dates.' },
  { id: 'employment',  number: 7,  label: 'Employment',           doc: 'Employer letter / payslip',   hint: 'Most recent role & tenure.' },
  { id: 'internship',  number: 8,  label: 'Internship',           doc: 'Internship certificate',      hint: 'Optional — relevant for Ausbildung.' },
  { id: 'social',      number: 9,  label: 'Social Service',       doc: 'Social service certificate',  hint: 'Optional — country-specific.' },
  { id: 'medical',     number: 10, label: 'Medical',              doc: 'Fitness / vaccination proof', hint: 'Fitness certificate, vaccinations.' },
  { id: 'driving',     number: 11, label: 'Driving Licence',      doc: 'Driving licence (front/back)',hint: 'Licence number, country, category, expiry.' },
  { id: 'documents',   number: 12, label: 'Documents',            doc: 'All uploads',                 hint: 'Check every upload is present and readable.' },
];

// ─────────────────────────────────────────────────────────────
// Field schema per section — kept intentionally compact
// ─────────────────────────────────────────────────────────────
interface FieldDef {
  key: string;
  label: string;
  type?: 'text' | 'email' | 'date' | 'select' | 'textarea';
  options?: string[];
  aiValue?: string;
  confidence?: number; // 0..1
  required?: boolean;
  half?: boolean;
}
const FIELDS: Record<SectionId, FieldDef[]> = {
  personal: [
    { key: 'first_name', label: 'First name', aiValue: 'Deeban',       confidence: 0.98, required: true, half: true },
    { key: 'last_name',  label: 'Last name',  aiValue: 'Rajendran',    confidence: 0.97, required: true, half: true },
    { key: 'dob',        label: 'Date of birth', type: 'date', aiValue: '1996-04-12', confidence: 0.94, required: true, half: true },
    { key: 'gender',     label: 'Gender', type: 'select', options: ['Female', 'Male', 'Other', 'Prefer not to say'], aiValue: 'Male', confidence: 0.9, half: true },
    { key: 'nationality',label: 'Nationality', aiValue: 'Indian', confidence: 0.96, required: true },
  ],
  passport: [
    { key: 'passport_no', label: 'Passport number', aiValue: 'M8842711', confidence: 0.99, required: true, half: true },
    { key: 'issue_date',  label: 'Issue date',  type: 'date', aiValue: '2019-06-04', confidence: 0.95, half: true },
    { key: 'expiry_date', label: 'Expiry date', type: 'date', aiValue: '2029-06-03', confidence: 0.96, required: true, half: true },
    { key: 'place_issue', label: 'Place of issue', aiValue: 'Chennai', confidence: 0.9, half: true },
  ],
  contact: [
    { key: 'email',   label: 'Email', type: 'email', aiValue: 'deeban.r@example.com', confidence: 0.99, required: true, half: true },
    { key: 'phone',   label: 'Phone', aiValue: '+91 98407 12345', confidence: 0.92, required: true, half: true },
    { key: 'country', label: 'Country', type: 'select', options: allCountries().map((c) => c.name), aiValue: 'India', confidence: 0.98, half: true },
    { key: 'city',    label: 'City',    aiValue: 'Chennai', confidence: 0.93, half: true },
    { key: 'address', label: 'Address', type: 'textarea', aiValue: '12 Nungambakkam High Rd,\nChennai 600034', confidence: 0.86 },
  ],
  education: [
    { key: 'qualification', label: 'Highest qualification', aiValue: 'B.Sc. Nursing', confidence: 0.94, required: true, half: true },
    { key: 'institution',   label: 'Institution', aiValue: 'Madras Medical College', confidence: 0.9, half: true },
    { key: 'year',          label: 'Year of completion', aiValue: '2018', confidence: 0.95, half: true },
    { key: 'gpa',           label: 'GPA / Grade', aiValue: '7.8 / 10', confidence: 0.72, half: true },
  ],
  language: [
    { key: 'provider',  label: 'Provider', type: 'select', options: ['Goethe', 'TELC', 'ÖSD', 'TestDaF', 'Other'], aiValue: 'Goethe', confidence: 0.97, half: true },
    { key: 'level',     label: 'Level', type: 'select', options: ['A1','A2','B1','B2','C1','C2'], aiValue: 'B2', confidence: 0.98, required: true, half: true },
    { key: 'exam_date', label: 'Examination date', type: 'date', aiValue: '2025-11-14', confidence: 0.95, half: true },
    { key: 'cert_date', label: 'Certificate date', type: 'date', aiValue: '2025-11-28', confidence: 0.9, half: true },
  ],
  employment: [
    { key: 'employer', label: 'Most recent employer', aiValue: 'Apollo Hospitals', confidence: 0.9, half: true },
    { key: 'role',     label: 'Role / title', aiValue: 'Staff Nurse', confidence: 0.93, half: true },
    { key: 'from',     label: 'From', type: 'date', aiValue: '2020-08-01', confidence: 0.85, half: true },
    { key: 'to',       label: 'To',   type: 'date', aiValue: '2025-10-30', confidence: 0.82, half: true },
  ],
  internship: [
    { key: 'org',      label: 'Organisation', aiValue: '—', confidence: 0.4, half: true },
    { key: 'duration', label: 'Duration', aiValue: '—', confidence: 0.4, half: true },
  ],
  social: [
    { key: 'org',      label: 'Organisation', aiValue: '—', confidence: 0.4, half: true },
    { key: 'duration', label: 'Duration', aiValue: '—', confidence: 0.4, half: true },
  ],
  medical: [
    { key: 'fitness',      label: 'Fitness certificate on file', type: 'select', options: ['Yes','No'], aiValue: 'Yes', confidence: 0.9, half: true },
    { key: 'vaccinations', label: 'Vaccinations recorded', type: 'select', options: ['Yes','Partial','No'], aiValue: 'Yes', confidence: 0.88, half: true },
    { key: 'notes',        label: 'Notes', type: 'textarea', aiValue: '', confidence: 0.5 },
  ],
  driving: [
    { key: 'licence_no', label: 'Licence number', aiValue: 'TN01 20180023456', confidence: 0.88, half: true },
    { key: 'country',    label: 'Issuing country', type: 'select', options: allCountries().map((c) => c.name), aiValue: 'India', confidence: 0.95, half: true },
    { key: 'category',   label: 'Category', aiValue: 'LMV', confidence: 0.9, half: true },
    { key: 'expiry',     label: 'Expiry', type: 'date', aiValue: '2038-04-11', confidence: 0.92, half: true },
  ],
  documents: [],
};

const REQUIRED_UPLOADS = [
  { key: 'passport',     label: 'Passport',          german: 'reisepass' },
  { key: 'photo',        label: 'Photo',             german: 'lichtbild' },
  { key: 'degree',       label: 'Highest degree',    german: 'bachelorzeugnis' },
  { key: 'sprach',       label: 'Language certificate', german: 'sprachzertifikat' },
  { key: 'cv',           label: 'CV',                german: 'lebenslauf' },
  { key: 'police',       label: 'Police clearance',  german: 'fuehrungszeugnis' },
  { key: 'medical',      label: 'Medical fitness',   german: 'gesundheitszeugnis' },
  { key: 'driving',      label: 'Driving licence',   german: 'fuehrerschein' },
];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function confidenceMeta(c?: number) {
  if (c == null) return { label: '—', tone: 'bg-slate-100 text-slate-600' };
  if (c >= 0.95) return { label: `${Math.round(c * 100)}%`, tone: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' };
  if (c >= 0.8)  return { label: `${Math.round(c * 100)}%`, tone: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200' };
  return                    { label: `${Math.round(c * 100)}%`, tone: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' };
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
type Stage = 'product' | 'section' | 'review';

export default function CandidateIntake() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('product');
  const [product, setProduct] = useState<IntakeProductId | null>(null);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const [edited, setEdited] = useState<Record<string, Set<string>>>({});
  const [verified, setVerified] = useState<Set<SectionId>>(new Set());
  const [uploads, setUploads] = useState<Record<string, boolean>>({});
  const [declarations, setDeclarations] = useState({ reviewed: false, matches: false, complete: false });
  const [zoom, setZoom] = useState(100);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Continuous autosave — debounce on any state change
  useEffect(() => {
    if (stage === 'product' && !product) return;
    const t = setTimeout(() => setSavedAt(new Date()), 700);
    return () => clearTimeout(t);
  }, [stage, product, values, edited, uploads, verified, sectionIndex]);

  const current = SECTIONS[sectionIndex];
  const totalSteps = SECTIONS.length + 1; // + review
  const completedCount = verified.size + (stage === 'review' ? 1 : 0);
  const progress = Math.round((completedCount / totalSteps) * 100);

  // Auto-seed AI values on first entry per section
  useEffect(() => {
    if (stage !== 'section' || !current) return;
    setValues((prev) => {
      if (prev[current.id]) return prev;
      const seed: Record<string, string> = {};
      FIELDS[current.id].forEach((f) => { seed[f.key] = f.aiValue ?? ''; });
      return { ...prev, [current.id]: seed };
    });
  }, [stage, current]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement)?.tagName;
      const inField = t === 'INPUT' || t === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if (e.key === 'Escape' && !inField) exit();
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); verifyAndContinue(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveDraft(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, sectionIndex, product, declarations]);

  function exit() {
    if (verified.size > 0 || product) {
      if (!confirm('Leave verification? Progress is saved as draft.')) return;
    }
    navigate('/candidates');
  }

  function saveDraft() {
    toast.success('Draft saved', { description: 'You can resume from Candidates → Drafts.' });
  }

  function setFieldValue(section: SectionId, key: string, v: string) {
    setValues((prev) => ({ ...prev, [section]: { ...(prev[section] ?? {}), [key]: v } }));
    setEdited((prev) => {
      const next = new Set(prev[section] ?? []);
      next.add(key);
      return { ...prev, [section]: next };
    });
  }

  function verifyAndContinue() {
    if (stage === 'product') {
      if (!product) { toast.error('Choose a product to begin'); return; }
      setStage('section');
      return;
    }
    if (stage === 'section' && current) {
      // required check
      const missing = FIELDS[current.id]
        .filter((f) => f.required && !(values[current.id]?.[f.key] ?? '').trim())
        .map((f) => f.label);
      if (missing.length) {
        toast.error('Missing required fields', { description: missing.join(', ') });
        return;
      }
      setVerified((s) => new Set(s).add(current.id));
      if (sectionIndex < SECTIONS.length - 1) {
        setSectionIndex((i) => i + 1);
        toast.success(`${current.label} verified`, { description: `Next: ${SECTIONS[sectionIndex + 1].label}` });
      } else {
        setStage('review');
        toast.success('All sections verified. Final review.');
      }
    }
  }

  function goBack() {
    if (stage === 'review') { setStage('section'); return; }
    if (stage === 'section') {
      if (sectionIndex === 0) { setStage('product'); return; }
      setSectionIndex((i) => i - 1);
    }
  }

  function approve() {
    if (!declarations.reviewed || !declarations.matches || !declarations.complete) {
      toast.error('Confirm all three declarations to approve.');
      return;
    }
    toast.success('Candidate approved', { description: 'Record is now active in the workflow.' });
    setTimeout(() => navigate('/candidates'), 500);
  }

  // ─── Layout ──────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-border/60 bg-background/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={exit} className="rounded-md p-1.5 hover:bg-muted" aria-label="Close intake">
            <X className="size-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
              <Sparkles className="size-3" /> Intake · Verification Studio
            </div>
            <h1 className="font-display truncate text-[15px] font-semibold text-foreground">
              {stage === 'product'  && 'Step 1 · Choose product'}
              {stage === 'section'  && `Step ${current.number} · ${current.label}`}
              {stage === 'review'   && 'Final review'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-[11px] text-muted-foreground">
            <Keyboard className="size-3.5" />
            <span className="rounded border bg-muted px-1.5 py-0.5">⌘↵</span> verify
            <span className="rounded border bg-muted px-1.5 py-0.5">⌘S</span> save
            <span className="rounded border bg-muted px-1.5 py-0.5">Esc</span> exit
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Cloud className="size-3.5 text-emerald-600" />
            {savedAt ? <>Saved · {savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</> : 'Autosave on'}
          </div>
          <div className="w-44">
            <Progress value={progress} className="h-1.5" />
            <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
              <span>{progress}%</span>
              <span>{completedCount} / {totalSteps} verified</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={saveDraft} className="gap-1.5">
            <Save className="size-3.5" /> Save draft
          </Button>
        </div>
      </header>

      {/* Body */}
      {stage === 'product' && (
        <ProductStep product={product} setProduct={setProduct} onContinue={verifyAndContinue} />
      )}

      {stage === 'section' && (
        <div className="grid flex-1 min-h-0 grid-cols-1 lg:grid-cols-[3fr_2fr]">
          {/* Left: master data + section nav */}
          <div className="flex min-h-0 flex-col border-r border-border/60">
            <SectionNav
              currentIndex={sectionIndex}
              verified={verified}
              onJump={(i) => setSectionIndex(i)}
            />
            <div key={current.id} className="animate-section-in flex-1 min-h-0 overflow-y-auto">
              <SectionForm
                section={current}
                fields={FIELDS[current.id]}
                values={values[current.id] ?? {}}
                edited={edited[current.id] ?? new Set()}
                onChange={(k, v) => setFieldValue(current.id, k, v)}
                uploads={uploads}
                setUploads={setUploads}
              />
            </div>
            <div className="flex items-center justify-between border-t border-border/60 bg-background/95 px-6 py-3">
              <Button variant="ghost" size="sm" onClick={goBack} className="gap-1.5">
                <ArrowLeft className="size-4" /> Back
              </Button>
              <Button size="sm" onClick={verifyAndContinue} className="gap-1.5 shadow-sm">
                <Check className="size-4" /> Verify &amp; continue
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
          {/* Right: doc viewer */}
          <DocumentViewer section={current} zoom={zoom} setZoom={setZoom} />
        </div>
      )}

      {stage === 'review' && (
        <ReviewStep
          product={product!}
          values={values}
          uploads={uploads}
          declarations={declarations}
          setDeclarations={setDeclarations}
          onEditSection={(id) => {
            const idx = SECTIONS.findIndex((s) => s.id === id);
            if (idx >= 0) { setSectionIndex(idx); setStage('section'); }
          }}
          onBack={goBack}
          onApprove={approve}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Product step
// ─────────────────────────────────────────────────────────────
function ProductStep({
  product, setProduct, onContinue,
}: {
  product: IntakeProductId | null;
  setProduct: (id: IntakeProductId) => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-10 text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Step 1 of 13</p>
          <h2 className="font-display mt-3 text-4xl font-semibold tracking-tight">Which Workforce Europe product?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This determines the workflow, required documents, validation rules, and downstream automation.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {INTAKE_PRODUCTS.map((p) => {
            const selected = product === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setProduct(p.id)}
                className={cn(
                  'group relative flex flex-col items-center gap-4 rounded-2xl border bg-background p-6 text-center transition',
                  selected
                    ? 'border-primary shadow-lg ring-2 ring-primary/30 -translate-y-0.5'
                    : 'border-border/60 hover:border-border hover:-translate-y-0.5 hover:shadow-md',
                )}
              >
                <div className={cn(
                  'relative size-24 shrink-0 overflow-hidden rounded-full ring-4 shadow-lg transition-transform group-hover:scale-105',
                  p.ring, p.halo,
                )}>
                  <img
                    src={p.image}
                    alt={p.label}
                    width={512}
                    height={512}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-base font-semibold tracking-tight">{p.label}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{p.tagline}</p>
                </div>
                {selected && (
                  <div className="absolute right-3 top-3 rounded-full bg-primary p-1 text-primary-foreground shadow">
                    <Check className="size-3" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-10 flex items-center justify-center">
          <Button size="lg" onClick={onContinue} disabled={!product} className="gap-2">
            Begin verification <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section navigation strip
// ─────────────────────────────────────────────────────────────
function SectionNav({
  currentIndex, verified, onJump,
}: {
  currentIndex: number;
  verified: Set<SectionId>;
  onJump: (i: number) => void;
}) {
  return (
    <div className="border-b border-border/60 bg-muted/30 px-6 py-3">
      <div className="flex items-center gap-1 overflow-x-auto">
        {SECTIONS.map((s, i) => {
          const done = verified.has(s.id);
          const active = i === currentIndex;
          return (
            <button
              key={s.id}
              onClick={() => onJump(i)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition',
                active && 'bg-primary text-primary-foreground shadow-sm',
                !active && done && 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100',
                !active && !done && 'text-muted-foreground hover:bg-background',
              )}
            >
              {done ? <CheckCircle2 className="size-3" /> : <span className="tabular-nums opacity-70">{s.number}</span>}
              <span>{s.label}</span>
              {i < SECTIONS.length - 1 && <ChevronRight className="size-3 opacity-30" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section form
// ─────────────────────────────────────────────────────────────
function SectionForm({
  section, fields, values, edited, onChange, uploads, setUploads,
}: {
  section: SectionDef;
  fields: FieldDef[];
  values: Record<string, string>;
  edited: Set<string>;
  onChange: (k: string, v: string) => void;
  uploads: Record<string, boolean>;
  setUploads: (u: Record<string, boolean>) => void;
}) {
  // Contextual, section-specific banners
  const duplicate = useMemo(() => {
    if (section.id !== 'contact') return null;
    const email = (values['email'] ?? '').trim().toLowerCase();
    if (!email) return null;
    return mockCandidates.find((c) => c.email.toLowerCase() === email) ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.id, values['email']]);

  const langWarn = useMemo(() => {
    if (section.id !== 'language') return null;
    const exam = values['exam_date'];
    if (!exam) return null;
    const days = Math.round((Date.now() - new Date(exam).getTime()) / 86_400_000);
    if (days > 365) return { days };
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.id, values['exam_date']]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
          Section {section.number} of 12
        </p>
        <h2 className="font-display mt-2 text-[26px] font-semibold tracking-tight">{section.label}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{section.hint}</p>
      </div>

      {duplicate && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Possible duplicate</p>
            <p>{duplicate.first_name} {duplicate.last_name} — {duplicate.email} · {duplicate.country}</p>
          </div>
        </div>
      )}

      {langWarn && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">German language certificate may require renewal</p>
            <p>Days since examination: <span className="tabular-nums">{langWarn.days}</span> · Recommend new Sprachnachweis. Validity thresholds are configurable per product / visa type.</p>
          </div>
        </div>
      )}

      {section.id === 'documents' ? (
        <DocumentsSection uploads={uploads} setUploads={setUploads} />
      ) : section.id === 'driving' ? (
        <>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            {fields.map((f) => (
              <FieldRow
                key={f.key}
                field={f}
                value={values[f.key] ?? ''}
                edited={edited.has(f.key)}
                onChange={(v) => onChange(f.key, v)}
              />
            ))}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {(['front', 'back'] as const).map((side) => {
              const key = `driving_${side}`;
              const done = !!uploads[key];
              return (
                <button
                  key={side}
                  type="button"
                  onClick={() => setUploads({ ...uploads, [key]: !done })}
                  className={cn(
                    'flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-xs transition',
                    done ? 'border-emerald-300 bg-emerald-50/50 text-emerald-800' : 'border-border/60 text-muted-foreground hover:bg-muted/40',
                  )}
                >
                  {done ? <CheckCircle2 className="mb-1 size-5 text-emerald-600" /> : <Upload className="mb-1 size-5" />}
                  <span className="font-medium capitalize">Licence {side}</span>
                  <span className="mt-0.5 font-mono text-[10px]">DEEBAN fuehrerschein {side} oU.pdf</span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-5">
          {fields.map((f) => (
            <FieldRow
              key={f.key}
              field={f}
              value={values[f.key] ?? ''}
              edited={edited.has(f.key)}
              onChange={(v) => onChange(f.key, v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FieldRow({
  field, value, edited, onChange,
}: {
  field: FieldDef;
  value: string;
  edited: boolean;
  onChange: (v: string) => void;
}) {
  const conf = confidenceMeta(field.confidence);
  const isEmpty = !value.trim();
  return (
    <div className={cn(field.half ? 'col-span-1' : 'col-span-2')}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <Label className="text-xs">
          {field.label}
          {field.required && <span className="ml-0.5 text-rose-500">*</span>}
        </Label>
        <div className="flex items-center gap-1.5">
          {edited ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-blue-200">
              <ShieldCheck className="size-3" /> Human
            </span>
          ) : (
            <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium', conf.tone)}>
              <Sparkles className="size-3" /> AI · {conf.label}
            </span>
          )}
        </div>
      </div>

      {field.type === 'textarea' ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={cn(!edited && !isEmpty && 'bg-muted/30')}
        />
      ) : field.type === 'select' ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className={cn(!edited && !isEmpty && 'bg-muted/30')}>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <Input
          type={field.type ?? 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(!edited && !isEmpty && 'bg-muted/30')}
        />
      )}

      {isEmpty && field.required && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-rose-600">
          <AlertTriangle className="size-3" /> Required
        </p>
      )}
    </div>
  );
}

function DocumentsSection({
  uploads, setUploads,
}: {
  uploads: Record<string, boolean>;
  setUploads: (u: Record<string, boolean>) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="mb-3 text-xs text-muted-foreground">
        Files are auto-renamed on upload:
        <span className="ml-1 rounded bg-muted px-1.5 py-0.5 font-mono">FIRSTNAME dokumentname oU.pdf</span>
      </p>
      {REQUIRED_UPLOADS.map((u) => {
        const done = !!uploads[u.key];
        return (
          <div
            key={u.key}
            className={cn(
              'flex items-center justify-between rounded-lg border p-3 transition',
              done ? 'border-emerald-200 bg-emerald-50/40' : 'border-border/60 bg-background hover:bg-muted/40',
            )}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileText className="size-4 text-muted-foreground" />
                {u.label}
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  DEEBAN {u.german} oU.pdf
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {done ? 'Uploaded · AI extracted · awaiting section review' : 'Not uploaded'}
              </p>
            </div>
            <Button
              variant={done ? 'ghost' : 'outline'}
              size="sm"
              className="gap-1.5"
              onClick={() => setUploads({ ...uploads, [u.key]: !done })}
            >
              {done ? <><CheckCircle2 className="size-3.5 text-emerald-600" /> Uploaded</> : <><Upload className="size-3.5" /> Upload</>}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Document Viewer (mock)
// ─────────────────────────────────────────────────────────────
function DocumentViewer({
  section, zoom, setZoom,
}: {
  section: SectionDef;
  zoom: number;
  setZoom: (n: number) => void;
}) {
  return (
    <aside className="flex min-h-0 flex-col bg-muted/40">
      <div className="flex items-center justify-between border-b border-border/60 bg-background/70 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-2 text-xs">
          <FileText className="size-3.5 text-muted-foreground" />
          <span className="font-medium">{section.doc}</span>
          <span className="text-muted-foreground">· page 1 / 2</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setZoom(Math.max(50, zoom - 10))}>
            <ZoomOut className="size-3.5" />
          </Button>
          <span className="w-10 text-center text-[11px] tabular-nums text-muted-foreground">{zoom}%</span>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setZoom(Math.min(200, zoom + 10))}>
            <ZoomIn className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7"><RotateCw className="size-3.5" /></Button>
          <Button variant="ghost" size="icon" className="size-7"><SearchIcon className="size-3.5" /></Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-6">
        <div
          className="mx-auto rounded-md bg-white shadow-md ring-1 ring-border/60"
          style={{ width: `${(zoom / 100) * 460}px`, aspectRatio: '1 / 1.414' }}
        >
          <div className="flex h-full flex-col p-8 text-slate-800">
            <div className="mb-6 flex items-center justify-between border-b pb-3">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">Source document</div>
              <div className="text-[10px] text-slate-400">{section.doc}</div>
            </div>
            <div className="space-y-3 text-[11px] leading-relaxed">
              <div className="h-3 w-3/4 rounded bg-slate-200" />
              <div className="h-3 w-2/3 rounded bg-slate-200" />
              <div className="mt-4 h-2 w-1/2 rounded bg-slate-100" />
              <div className="h-2 w-4/5 rounded bg-slate-100" />
              <div className="h-2 w-3/5 rounded bg-slate-100" />
              <div className="mt-6 rounded-md border border-primary/30 bg-primary/5 p-3">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  AI extracted from this region
                </div>
                <div className="space-y-1">
                  {FIELDS[section.id]?.slice(0, 3).map((f) => (
                    <div key={f.key} className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">{f.label}</span>
                      <span className="font-medium tabular-nums">{f.aiValue}</span>
                    </div>
                  ))}
                  {section.id === 'documents' && <div className="text-[11px] text-slate-500">All uploaded documents.</div>}
                </div>
              </div>
              <div className="mt-4 h-2 w-2/3 rounded bg-slate-100" />
              <div className="h-2 w-3/4 rounded bg-slate-100" />
              <div className="h-2 w-1/2 rounded bg-slate-100" />
            </div>
            <div className="mt-auto pt-6 text-[9px] text-slate-400">
              <Info className="mr-1 inline size-3" />
              Preview is a rendered placeholder. Live document rendering with highlight-to-source is powered by the intake pipeline.
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────
// Review step
// ─────────────────────────────────────────────────────────────
function ReviewStep({
  product, values, uploads, declarations, setDeclarations, onEditSection, onBack, onApprove,
}: {
  product: IntakeProductId;
  values: Record<string, Record<string, string>>;
  uploads: Record<string, boolean>;
  declarations: { reviewed: boolean; matches: boolean; complete: boolean };
  setDeclarations: (d: { reviewed: boolean; matches: boolean; complete: boolean }) => void;
  onEditSection: (id: SectionId) => void;
  onBack: () => void;
  onApprove: () => void;
}) {
  const productDef = INTAKE_PRODUCTS.find((p) => p.id === product)!;
  const uploadedCount = Object.values(uploads).filter(Boolean).length;

  // Simple issues surface
  const issues = useMemo(() => {
    const out: { label: string; section?: SectionId }[] = [];
    SECTIONS.forEach((s) => {
      FIELDS[s.id].forEach((f) => {
        if (f.required && !(values[s.id]?.[f.key] ?? '').trim()) {
          out.push({ label: `${s.label} · ${f.label} missing`, section: s.id });
        }
      });
    });
    if (uploadedCount < REQUIRED_UPLOADS.length) {
      out.push({ label: `${REQUIRED_UPLOADS.length - uploadedCount} document(s) not uploaded`, section: 'documents' });
    }
    return out;
  }, [values, uploadedCount]);

  const allDeclared = declarations.reviewed && declarations.matches && declarations.complete;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Final review</p>
          <h2 className="font-display mt-2 text-4xl font-semibold tracking-tight">Confirm and approve</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything below has been AI-extracted and section-verified. Fix any issues before approving.
          </p>
        </div>

        {issues.length > 0 && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-900">
              <AlertTriangle className="size-4" /> {issues.length} item(s) need attention
            </div>
            <ul className="grid gap-1 text-sm text-amber-900 sm:grid-cols-2">
              {issues.map((i, idx) => (
                <li key={idx} className="flex items-center justify-between gap-2">
                  <span>· {i.label}</span>
                  {i.section && (
                    <button
                      onClick={() => onEditSection(i.section!)}
                      className="text-xs font-medium underline hover:no-underline"
                    >
                      Fix
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mb-8 grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{productDef.emoji}</span>
              <div>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Product</div>
                <div className="text-sm font-medium">{productDef.label}</div>
              </div>
            </div>
          </div>
          {(() => {
            const readiness = Math.max(0, Math.min(100, Math.round(100 - (issues.length / 12) * 100)));
            const label = readiness >= 95 ? 'Ready for approval' : readiness >= 75 ? 'Almost ready' : 'Needs attention';
            const tone = readiness >= 95 ? 'text-emerald-700' : readiness >= 75 ? 'text-amber-700' : 'text-rose-700';
            return (
              <div className="rounded-lg border border-border/60 bg-background p-4 md:min-w-64">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                  <Gauge className="size-3.5" /> Candidate readiness
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className={cn('font-display text-3xl font-semibold tabular-nums', tone)}>{readiness}%</span>
                  <span className={cn('text-xs font-medium', tone)}>{label}</span>
                </div>
                <Progress value={readiness} className="mt-2 h-1.5" />
              </div>
            );
          })()}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {SECTIONS.filter((s) => s.id !== 'documents').map((s) => {
            const rows = FIELDS[s.id].slice(0, 4);
            return (
              <div key={s.id} className="rounded-lg border border-border/60 bg-background p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] tabular-nums text-muted-foreground">{s.number}</span>
                    <h3 className="text-sm font-medium">{s.label}</h3>
                  </div>
                  <button
                    onClick={() => onEditSection(s.id)}
                    className="text-xs text-muted-foreground underline hover:text-foreground"
                  >
                    Edit
                  </button>
                </div>
                <dl className="grid gap-1.5">
                  {rows.map((f) => (
                    <div key={f.key} className="flex items-baseline justify-between gap-3 text-xs">
                      <dt className="text-muted-foreground">{f.label}</dt>
                      <dd className="truncate text-right font-medium">
                        {values[s.id]?.[f.key]?.trim() || <span className="text-rose-600">Missing</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}

          <div className="rounded-lg border border-border/60 bg-background p-4 md:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium">Documents · {uploadedCount} / {REQUIRED_UPLOADS.length}</h3>
              <button
                onClick={() => onEditSection('documents')}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Edit
              </button>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {REQUIRED_UPLOADS.map((u) => (
                <div key={u.key} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    {uploads[u.key]
                      ? <CheckCircle2 className="size-3 text-emerald-600" />
                      : <AlertTriangle className="size-3 text-rose-500" />}
                    {u.label}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">DEEBAN {u.german} oU.pdf</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Declaration */}
        <div className="mt-10 rounded-xl border border-border/60 bg-background p-6">
          <h3 className="text-base font-semibold">Final manual verification declaration</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            This declaration is the reviewer's own accountability confirmation — not an employer signature.
          </p>
          <div className="mt-4 space-y-3">
            {[
              { key: 'reviewed', text: 'I have manually reviewed every uploaded document.' },
              { key: 'matches',  text: 'I confirm the extracted information matches the source documents.' },
              { key: 'complete', text: 'I confirm this candidate record is complete to the best of my knowledge.' },
            ].map((d) => (
              <label key={d.key} className="flex cursor-pointer items-start gap-3 rounded-md border border-transparent p-2 hover:bg-muted/40">
                <Checkbox
                  checked={(declarations as any)[d.key]}
                  onCheckedChange={(v) => setDeclarations({ ...declarations, [d.key]: !!v })}
                  className="mt-0.5"
                />
                <span className="text-sm">{d.text}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" onClick={onBack} className="gap-1.5">
            <ArrowLeft className="size-4" /> Back to sections
          </Button>
          <Button size="lg" onClick={onApprove} disabled={!allDeclared} className="gap-2">
            <ShieldCheck className="size-4" /> Approve candidate
          </Button>
        </div>
      </div>
    </div>
  );
}
