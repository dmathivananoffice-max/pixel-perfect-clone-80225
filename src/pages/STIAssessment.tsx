import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { mockCandidates, mockEmployers } from '@/lib/mockData';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScoreBar } from '@/components/ScoreBar';
import {
  Search, Save, Send, Mic, Target, Brain, Briefcase, Sparkles,
  CheckCircle2, Clock, AlertTriangle, TrendingUp, CalendarClock,
  ChevronRight, PlayCircle, FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import {
  useSelectionEngine,
  computeReadiness,
  inferProgramKey,
  type Readiness,
} from '@/store/selectionEngineStore';

/* ────────────────────────────────────────────────────────────
   Stage model — four independent evaluation modules
   ──────────────────────────────────────────────────────────── */

type StageKey = 'speaking' | 'interview_training' | 'sti' | 'employer_interview';
type StageStatus = 'not_started' | 'scheduled' | 'in_progress' | 'passed' | 'failed';

const STAGES: { key: StageKey; label: string; icon: React.ReactNode; tint: string }[] = [
  { key: 'speaking',           label: 'Speaking Assessment', icon: <Mic className="size-4" />,      tint: 'sky' },
  { key: 'interview_training', label: 'Interview Training',  icon: <Target className="size-4" />,   tint: 'violet' },
  { key: 'sti',                label: 'STI Assessment',      icon: <Brain className="size-4" />,    tint: 'amber' },
  { key: 'employer_interview', label: 'Employer Interview',  icon: <Briefcase className="size-4" />, tint: 'emerald' },
];

const STATUS_META: Record<StageStatus, { label: string; className: string; dot: string }> = {
  not_started: { label: 'Not started', className: 'bg-muted text-muted-foreground border-border',                 dot: 'bg-muted-foreground/40' },
  scheduled:   { label: 'Scheduled',   className: 'bg-blue-50 text-blue-800 border-blue-200',                     dot: 'bg-blue-500' },
  in_progress: { label: 'In progress', className: 'bg-amber-50 text-amber-900 border-amber-200',                  dot: 'bg-amber-500' },
  passed:      { label: 'Passed',      className: 'bg-emerald-50 text-emerald-800 border-emerald-200',            dot: 'bg-emerald-500' },
  failed:      { label: 'On hold',     className: 'bg-red-50 text-red-800 border-red-200',                        dot: 'bg-red-500' },
};

/* deterministic pseudo-random per candidate for demo data */
function hash(s: string) {
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pickStatus(id: string, stage: StageKey): StageStatus {
  const n = hash(id + stage) % 10;
  if (n < 3) return 'not_started';
  if (n < 5) return 'scheduled';
  if (n < 7) return 'in_progress';
  if (n < 9) return 'passed';
  return 'failed';
}
function progressFor(statuses: Record<StageKey, StageStatus>) {
  const done = STAGES.filter((s) => statuses[s.key] === 'passed').length;
  const partial = STAGES.filter((s) => statuses[s.key] === 'in_progress' || statuses[s.key] === 'scheduled').length;
  return Math.round(((done + partial * 0.4) / STAGES.length) * 100);
}
function nextAction(statuses: Record<StageKey, StageStatus>) {
  for (const s of STAGES) {
    const st = statuses[s.key];
    if (st === 'not_started') return `Start ${s.label}`;
    if (st === 'scheduled')   return `Conduct ${s.label}`;
    if (st === 'in_progress') return `Complete ${s.label}`;
    if (st === 'failed')      return `Review ${s.label}`;
  }
  return 'Ready for Offer';
}

/* ────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────── */

export default function CandidateEvaluationCenter() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const [selected, setSelected] = useState<string>(candidateId || '');
  const [query, setQuery] = useState('');
  const [assignOpen, setAssignOpen] = useState<false | StageKey>(false);

  // Pool of candidates in the evaluation phase
  const pool = useMemo(
    () => mockCandidates.filter((c) =>
      ['shortlisted', 'interview1', 'interview2', 'waiting'].includes(c.status),
    ),
    [],
  );

  // Selection Engine config drives per-candidate readiness
  const configs = useSelectionEngine((s) => s.configs);

  // Compute per-candidate stage matrix + readiness (memoized)
  const matrix = useMemo(() => {
    return pool.map((c) => {
      const statuses = {
        speaking:           pickStatus(c.candidate_id, 'speaking'),
        interview_training: pickStatus(c.candidate_id, 'interview_training'),
        sti:                pickStatus(c.candidate_id, 'sti'),
        employer_interview: pickStatus(c.candidate_id, 'employer_interview'),
      } as Record<StageKey, StageStatus>;
      const programKey = inferProgramKey(c.program_name);
      const readiness: Readiness | null = programKey
        ? computeReadiness(c.candidate_id, configs[programKey], c.gate_status !== 'not_placement_ready')
        : null;
      return {
        candidate: c,
        statuses,
        progress: progressFor(statuses),
        next: nextAction(statuses),
        readiness,
      };
    });
  }, [pool, configs]);


  const filtered = matrix.filter(({ candidate }) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      candidate.first_name.toLowerCase().includes(q) ||
      candidate.last_name.toLowerCase().includes(q) ||
      (candidate.program_name ?? '').toLowerCase().includes(q)
    );
  });

  // KPIs
  const kpis = useMemo(() => {
    const count = (stage: StageKey, sts: StageStatus[]) =>
      matrix.filter((m) => sts.includes(m.statuses[stage])).length;
    const passedAll = matrix.filter((m) =>
      STAGES.every((s) => m.statuses[s.key] === 'passed'),
    ).length;
    return {
      speakingPending:   count('speaking', ['not_started', 'scheduled', 'in_progress']),
      trainingPending:   count('interview_training', ['not_started', 'scheduled', 'in_progress']),
      stiPending:        count('sti', ['not_started', 'scheduled', 'in_progress']),
      employerScheduled: count('employer_interview', ['scheduled', 'in_progress']),
      completedToday:    Math.min(6, Math.floor(matrix.length / 3)),
      successRate:       matrix.length ? Math.round((passedAll / matrix.length) * 100) + 40 : 0,
    };
  }, [matrix]);

  const currentRow = matrix.find((m) => m.candidate.candidate_id === selected);

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Candidate Evaluation Center</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Operational hub for the four independent placement-readiness modules —
            Speaking, Interview Training, STI, and Employer Interview.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <CalendarClock className="size-4" /> Schedule session
          </Button>
          <Button size="sm" className="gap-1.5">
            <Sparkles className="size-4" /> AI suggestions
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard tint="sky"     icon={<Mic className="size-4" />}         label="Speaking pending"       value={kpis.speakingPending} />
        <KpiCard tint="violet"  icon={<Target className="size-4" />}      label="Interview training"     value={kpis.trainingPending} />
        <KpiCard tint="amber"   icon={<Brain className="size-4" />}       label="STI pending"            value={kpis.stiPending} />
        <KpiCard tint="emerald" icon={<Briefcase className="size-4" />}   label="Employer interviews"    value={kpis.employerScheduled} />
        <KpiCard tint="slate"   icon={<CheckCircle2 className="size-4" />} label="Completed today"       value={kpis.completedToday} />
        <KpiCard tint="rose"    icon={<TrendingUp className="size-4" />}  label="Success rate"           value={`${kpis.successRate}%`} />
      </div>

      {/* Pipeline diagram */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {['Shortlisted', ...STAGES.map((s) => s.label), 'Offer', 'Visa'].map((step, i, arr) => (
              <div key={step} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'rounded-full px-2.5 py-1 font-medium ring-1 ring-inset',
                    i === 0 || i === arr.length - 1 || i === arr.length - 2
                      ? 'bg-background text-foreground/70 ring-border'
                      : 'bg-sky-50 text-sky-800 ring-sky-200',
                  )}
                >
                  {step}
                </span>
                {i < arr.length - 1 && <ChevronRight className="size-3 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Candidate table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Evaluation queue</CardTitle>
              <CardDescription>All four modules progress independently per candidate.</CardDescription>
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search candidate or program…"
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Candidate</th>
                  <th className="px-3 py-2 text-left font-medium">Program</th>
                  {STAGES.map((s) => (
                    <th key={s.key} className="px-3 py-2 text-left font-medium">{s.label}</th>
                  ))}
                  <th className="px-3 py-2 text-left font-medium">Readiness</th>
                  <th className="px-3 py-2 text-left font-medium">Progress</th>
                  <th className="px-3 py-2 text-left font-medium">Next action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(({ candidate, statuses, progress, next, readiness }) => {
                  const isActive = candidate.candidate_id === selected;
                  return (
                    <tr
                      key={candidate.candidate_id}
                      onClick={() => setSelected(candidate.candidate_id)}
                      className={cn(
                        'cursor-pointer transition-colors hover:bg-muted/40',
                        isActive && 'bg-sky-50/60',
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{candidate.first_name} {candidate.last_name}</div>
                        <div className="text-xs text-muted-foreground">{candidate.country}</div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{candidate.program_name}</td>
                      {STAGES.map((s) => (
                        <td key={s.key} className="px-3 py-3">
                          <StagePill status={statuses[s.key]} />
                        </td>
                      ))}
                      <td className="px-3 py-3">
                        <ReadinessPill readiness={readiness} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Progress value={progress} className="h-1.5 w-20" />
                          <span className="w-8 text-xs tabular-nums text-muted-foreground">{progress}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-sky-700">
                          <PlayCircle className="size-3.5" /> {next}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={STAGES.length + 5} className="px-4 py-8 text-center text-sm text-muted-foreground">

                      No candidates match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Candidate detail — four independent modules */}
      {currentRow && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  {currentRow.candidate.first_name} {currentRow.candidate.last_name}
                  <Badge variant="outline" className="ml-1 text-[11px]">
                    {currentRow.candidate.program_name}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Overall readiness {currentRow.progress}% · Next: {currentRow.next}
                </CardDescription>
              </div>
              <AiSuggestions statuses={currentRow.statuses} />
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="speaking">
              <TabsList className="grid w-full max-w-2xl grid-cols-4">
                <TabsTrigger value="speaking" className="gap-1.5"><Mic className="size-4" /> Speaking</TabsTrigger>
                <TabsTrigger value="interview_training" className="gap-1.5"><Target className="size-4" /> Interview Training</TabsTrigger>
                <TabsTrigger value="sti" className="gap-1.5"><Brain className="size-4" /> STI</TabsTrigger>
                <TabsTrigger value="employer_interview" className="gap-1.5"><Briefcase className="size-4" /> Employer</TabsTrigger>
              </TabsList>

              <TabsContent value="speaking" className="mt-4">
                <SpeakingModule status={currentRow.statuses.speaking} onAssign={() => setAssignOpen('speaking')} />
              </TabsContent>
              <TabsContent value="interview_training" className="mt-4">
                <InterviewTrainingModule status={currentRow.statuses.interview_training} onAssign={() => setAssignOpen('interview_training')} />
              </TabsContent>
              <TabsContent value="sti" className="mt-4">
                <STIModule status={currentRow.statuses.sti} onAssign={() => setAssignOpen('sti')} />
              </TabsContent>
              <TabsContent value="employer_interview" className="mt-4">
                <EmployerInterviewModule status={currentRow.statuses.employer_interview} onAssign={() => setAssignOpen('employer_interview')} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Assign dialog */}
      <Dialog open={!!assignOpen} onOpenChange={(o) => !o && setAssignOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign {assignOpen && STAGES.find((s) => s.key === assignOpen)?.label}</DialogTitle>
            <DialogDescription>Pick an assessor and date. This is a demo action.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Assessor</Label>
              <Input placeholder="e.g. Anna Bauer" className="mt-1" />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={() => { setAssignOpen(false); toast.success('Assignment scheduled'); }}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Sub-components
   ──────────────────────────────────────────────────────────── */

function KpiCard({
  tint, icon, label, value,
}: { tint: string; icon: React.ReactNode; label: string; value: number | string }) {
  const tintMap: Record<string, string> = {
    sky: 'bg-sky-50 text-sky-700 ring-sky-200',
    violet: 'bg-violet-50 text-violet-700 ring-violet-200',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    slate: 'bg-slate-50 text-slate-700 ring-slate-200',
    rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3">
        <div className={cn('flex size-9 items-center justify-center rounded-md ring-1 ring-inset', tintMap[tint])}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-lg font-semibold tabular-nums">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function StagePill({ status }: { status: StageStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium', m.className)}>
      <span className={cn('size-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  );
}

function AiSuggestions({ statuses }: { statuses: Record<StageKey, StageStatus> }) {
  const tips: string[] = [];
  if (statuses.speaking === 'passed') tips.push('Speaking ready');
  if (statuses.interview_training !== 'passed') tips.push('Interview Training required');
  if (statuses.sti === 'passed') tips.push('Strong STI profile');
  if (statuses.employer_interview === 'not_started') tips.push('Suggested date: next Tuesday');
  if (!tips.length) tips.push('Recommend for Offer');
  return (
    <div className="flex flex-wrap gap-1.5">
      {tips.slice(0, 3).map((t) => (
        <Badge key={t} variant="outline" className="gap-1 border-violet-200 bg-violet-50 text-violet-800">
          <Sparkles className="size-3" /> {t}
        </Badge>
      ))}
    </div>
  );
}

/* ── Module: Speaking ─────────────────────────────────────── */
function SpeakingModule({ status, onAssign }: { status: StageStatus; onAssign: () => void }) {
  const [scores, setScores] = useState({ pronunciation: 72, grammar: 68, vocabulary: 74, fluency: 70 });
  const overall = Math.round((scores.pronunciation + scores.grammar + scores.vocabulary + scores.fluency) / 4);
  const cefr = overall >= 85 ? 'C1' : overall >= 70 ? 'B2' : overall >= 55 ? 'B1' : 'A2';
  return (
    <ModuleShell
      status={status}
      onAssign={onAssign}
      title="Speaking Assessment"
      description="Evaluate real spoken German communication with a live assessor."
      leftFields={[
        { label: 'Assessor', input: <Input placeholder="Anna Bauer" /> },
        { label: 'Recording', input: <Input type="file" accept="audio/*" /> },
      ]}
    >
      <div className="grid gap-4 md:grid-cols-2">
        {(['pronunciation', 'grammar', 'vocabulary', 'fluency'] as const).map((k) => (
          <SliderRow key={k} label={k[0].toUpperCase() + k.slice(1)} value={scores[k]} onChange={(v) => setScores({ ...scores, [k]: v })} />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 p-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Overall</div>
          <div className="text-xl font-semibold tabular-nums">{overall}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">CEFR recommendation</div>
          <Badge className="mt-0.5 bg-sky-600">{cefr}</Badge>
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs">Feedback</Label>
          <Input placeholder="Clear pronunciation; needs more workplace vocabulary." className="mt-1" />
        </div>
      </div>
    </ModuleShell>
  );
}

/* ── Module: Interview Training ───────────────────────────── */
function InterviewTrainingModule({ status, onAssign }: { status: StageStatus; onAssign: () => void }) {
  const [scores, setScores] = useState({ confidence: 65, comms: 70, etiquette: 72, hrReadiness: 68 });
  return (
    <ModuleShell
      status={status}
      onAssign={onAssign}
      title="Interview Training"
      description="Coaching sessions run by Workforce Europe to prepare candidates before the employer interview. This is not language training."
      leftFields={[
        { label: 'Trainer', input: <Input placeholder="Markus Weber" /> },
        { label: 'Mock sessions completed', input: <Input type="number" min={0} max={10} defaultValue={2} /> },
      ]}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <SliderRow label="Confidence"                value={scores.confidence}  onChange={(v) => setScores({ ...scores, confidence: v })} />
        <SliderRow label="Professional communication" value={scores.comms}       onChange={(v) => setScores({ ...scores, comms: v })} />
        <SliderRow label="German workplace etiquette" value={scores.etiquette}   onChange={(v) => setScores({ ...scores, etiquette: v })} />
        <SliderRow label="HR readiness"              value={scores.hrReadiness} onChange={(v) => setScores({ ...scores, hrReadiness: v })} />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <Label>Interview feedback</Label>
          <Input placeholder="Strong story-telling; work on concise answers." className="mt-1" />
        </div>
        <div>
          <Label>Final recommendation</Label>
          <Select defaultValue="ready">
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ready">Ready for employer interview</SelectItem>
              <SelectItem value="more_sessions">Needs more sessions</SelectItem>
              <SelectItem value="hold">Hold</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </ModuleShell>
  );
}

/* ── Module: STI ──────────────────────────────────────────── */
function STIModule({ status, onAssign }: { status: StageStatus; onAssign: () => void }) {
  const [scores, setScores] = useState({ behaviour: 74, workReadiness: 78, adaptability: 70, learning: 72 });
  const final = Math.round((scores.behaviour + scores.workReadiness + scores.adaptability + scores.learning) / 4);
  return (
    <ModuleShell
      status={status}
      onAssign={onAssign}
      title="STI Assessment"
      description="Internal Workforce Europe suitability assessment — behaviour, work readiness, adaptability and learning ability."
      leftFields={[
        { label: 'Assessor', input: <Input placeholder="Julia Klein" /> },
        { label: 'Assessment date', input: <Input type="date" /> },
      ]}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <SliderRow label="Behaviour"       value={scores.behaviour}      onChange={(v) => setScores({ ...scores, behaviour: v })} />
        <SliderRow label="Work readiness"  value={scores.workReadiness}  onChange={(v) => setScores({ ...scores, workReadiness: v })} />
        <SliderRow label="Adaptability"    value={scores.adaptability}   onChange={(v) => setScores({ ...scores, adaptability: v })} />
        <SliderRow label="Learning ability" value={scores.learning}      onChange={(v) => setScores({ ...scores, learning: v })} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 p-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Final score</div>
          <div className="text-xl font-semibold tabular-nums">{final}</div>
        </div>
        <div className="flex-1 min-w-[220px]">
          <Label className="text-xs">Recruiter recommendation</Label>
          <Select defaultValue="proceed">
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="proceed">Proceed to employer interview</SelectItem>
              <SelectItem value="hold">Hold for review</SelectItem>
              <SelectItem value="reject">Not suitable</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </ModuleShell>
  );
}

/* ── Module: Employer Interview ───────────────────────────── */
function EmployerInterviewModule({ status, onAssign }: { status: StageStatus; onAssign: () => void }) {
  return (
    <ModuleShell
      status={status}
      onAssign={onAssign}
      title="Employer Interview"
      description="Actual interview with the hiring employer. Captures technical, HR and final employer decision."
      leftFields={[
        { label: 'Employer', input: (
          <Select>
            <SelectTrigger><SelectValue placeholder="Select employer" /></SelectTrigger>
            <SelectContent>
              {mockEmployers.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) },
        { label: 'Date', input: <Input type="date" /> },
        { label: 'Round', input: (
          <Select defaultValue="1">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Round 1</SelectItem>
              <SelectItem value="2">Round 2</SelectItem>
              <SelectItem value="final">Final</SelectItem>
            </SelectContent>
          </Select>
        ) },
        { label: 'Interview panel', input: <Input placeholder="Dr. Mueller, HR — Ms. Schmidt" /> },
      ]}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <SliderRow label="Technical evaluation" value={72} onChange={() => {}} />
        <SliderRow label="HR evaluation"        value={78} onChange={() => {}} />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <Label>Employer comments</Label>
          <Input placeholder="Confident, warm; good fit for elderly-care ward." className="mt-1" />
        </div>
        <div>
          <Label>Decision</Label>
          <Select defaultValue="selected">
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="selected">Selected — send offer</SelectItem>
              <SelectItem value="hold">Hold</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </ModuleShell>
  );
}

/* ── Reusable module shell ────────────────────────────────── */
function ModuleShell({
  status, onAssign, title, description, leftFields, children,
}: {
  status: StageStatus;
  onAssign: () => void;
  title: string;
  description: string;
  leftFields: { label: string; input: React.ReactNode }[];
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{title}</h3>
            <StagePill status={status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onAssign} className="gap-1.5">
            <CalendarClock className="size-4" /> Assign
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5">
            <FileText className="size-4" /> Report
          </Button>
        </div>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-3">
        <div className="space-y-3 md:col-span-1">
          {leftFields.map((f) => (
            <div key={f.label}>
              <Label className="text-xs">{f.label}</Label>
              <div className="mt-1">{f.input}</div>
            </div>
          ))}
        </div>
        <div className="md:col-span-2">{children}</div>
      </div>
      <Separator />
      <div className="flex justify-end gap-2 p-3">
        <Button variant="outline" size="sm" onClick={() => toast.success('Draft saved')} className="gap-1.5">
          <Save className="size-4" /> Save draft
        </Button>
        <Button size="sm" onClick={() => toast.success('Submitted')} className="gap-1.5">
          <Send className="size-4" /> Submit
        </Button>
      </div>
    </div>
  );
}

function SliderRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs font-medium tabular-nums">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
      />
      <ScoreBar score={value} maxScore={100} size="sm" showLabel={false} />
    </div>
  );
}

/* keep an inline AlertTriangle import used only in this file if needed */
void AlertTriangle;
void Clock;
