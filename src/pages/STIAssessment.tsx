import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScoreBar } from "@/components/ScoreBar";
import {
  Search,
  Save,
  Send,
  Mic,
  Target,
  Brain,
  Briefcase,
  CheckCircle2,
  TrendingUp,
  CalendarClock,
  ChevronRight,
  PlayCircle,
  FileText,
} from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { computeReadiness, type Readiness } from "@/store/selectionEngineStore";
import type { Candidate } from "@/types";

/* ────────────────────────────────────────────────────────────
   Stage model — four evaluation modules, backed by real rows:
     speaking / interview_training / sti → public.assessments
     employer_interview                  → public.interviews
   ──────────────────────────────────────────────────────────── */

type StageKey = "speaking" | "interview_training" | "sti" | "employer_interview";
type StageStatus = "not_started" | "scheduled" | "in_progress" | "passed" | "failed";

const STAGES: { key: StageKey; label: string; icon: React.ReactNode; tint: string }[] = [
  { key: "speaking", label: "Speaking Assessment", icon: <Mic className="size-4" />, tint: "sky" },
  {
    key: "interview_training",
    label: "Interview Training",
    icon: <Target className="size-4" />,
    tint: "violet",
  },
  { key: "sti", label: "STI Assessment", icon: <Brain className="size-4" />, tint: "amber" },
  {
    key: "employer_interview",
    label: "Employer Interview",
    icon: <Briefcase className="size-4" />,
    tint: "emerald",
  },
];

const STATUS_META: Record<StageStatus, { label: string; className: string; dot: string }> = {
  not_started: {
    label: "Not started",
    className: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground/40",
  },
  scheduled: {
    label: "Scheduled",
    className: "bg-blue-50 text-blue-800 border-blue-200",
    dot: "bg-blue-500",
  },
  in_progress: {
    label: "In progress",
    className: "bg-amber-50 text-amber-900 border-amber-200",
    dot: "bg-amber-500",
  },
  passed: {
    label: "Passed",
    className: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  failed: {
    label: "On hold",
    className: "bg-red-50 text-red-800 border-red-200",
    dot: "bg-red-500",
  },
};

/** assessments.kind stored in the database for each module (employer uses interviews). */
const KIND_BY_STAGE: Partial<Record<StageKey, string>> = {
  speaking: "speaking",
  interview_training: "training",
  sti: "sti",
};

interface StageRecord {
  status: StageStatus;
  scores: Record<string, number>;
  overall: number | null;
  recommendation: string | null;
  notes: string | null;
  assessor: string | null;
  date: string | null;
  /** interviews-only fields */
  employerId?: string | null;
  employerName?: string | null;
  round?: string | null;
  decision?: string | null;
}

const EMPTY_RECORD: StageRecord = {
  status: "not_started",
  scores: {},
  overall: null,
  recommendation: null,
  notes: null,
  assessor: null,
  date: null,
};

interface AssessmentRow {
  id: string;
  candidate_id: string;
  kind: string;
  scores: Record<string, number>;
  overall_score: number | null;
  recommendation: string | null;
  notes: string | null;
  assessor_name: string | null;
  assessed_at: string | null;
}

interface InterviewRow {
  id: string;
  candidate_id: string;
  round: string;
  employer_id: string | null;
  employer_name: string | null;
  rating: number | null;
  decision: string | null;
  notes: string | null;
  scheduled_at: string | null;
}

function assessmentToRecord(row: AssessmentRow | undefined): StageRecord {
  if (!row) return { ...EMPTY_RECORD };
  let status: StageStatus;
  if (row.recommendation === "reject" || row.recommendation === "not_suitable") status = "failed";
  else if (row.overall_score != null) status = "passed";
  else status = "in_progress";
  return {
    status,
    scores: row.scores ?? {},
    overall: row.overall_score,
    recommendation: row.recommendation,
    notes: row.notes,
    assessor: row.assessor_name,
    date: row.assessed_at,
  };
}

function interviewToRecord(row: InterviewRow | undefined): StageRecord {
  if (!row) return { ...EMPTY_RECORD };
  let status: StageStatus;
  if (row.decision === "selected") status = "passed";
  else if (row.decision === "rejected") status = "failed";
  else if (row.decision === "hold") status = "in_progress";
  else status = row.scheduled_at ? "scheduled" : "in_progress";
  return {
    status,
    scores: {},
    overall: row.rating,
    recommendation: row.decision,
    notes: row.notes,
    assessor: null,
    date: row.scheduled_at,
    employerId: row.employer_id,
    employerName: row.employer_name,
    round: row.round,
    decision: row.decision,
  };
}

function progressFor(statuses: Record<StageKey, StageStatus>) {
  const done = STAGES.filter((s) => statuses[s.key] === "passed").length;
  const partial = STAGES.filter(
    (s) => statuses[s.key] === "in_progress" || statuses[s.key] === "scheduled",
  ).length;
  return Math.round(((done + partial * 0.4) / STAGES.length) * 100);
}
function nextAction(statuses: Record<StageKey, StageStatus>) {
  for (const s of STAGES) {
    const st = statuses[s.key];
    if (st === "not_started") return `Start ${s.label}`;
    if (st === "scheduled") return `Conduct ${s.label}`;
    if (st === "in_progress") return `Complete ${s.label}`;
    if (st === "failed") return `Review ${s.label}`;
  }
  return "Ready for Offer";
}

interface EmployerOption {
  id: string;
  name: string;
}

/* ────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────── */

export default function CandidateEvaluationCenter() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const [selected, setSelected] = useState<string>(candidateId || "");
  const [query, setQuery] = useState("");

  const [pool, setPool] = useState<Candidate[]>([]);
  const [records, setRecords] = useState<Map<string, Record<StageKey, StageRecord>>>(new Map());
  const [employers, setEmployers] = useState<EmployerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data: cands, error: cErr } = await supabase
      .from("candidates")
      .select("*")
      .in("status", ["shortlisted", "interview1", "interview2", "waiting"])
      .order("created_at", { ascending: false });
    if (cErr) {
      setLoadError(cErr.message);
      setLoading(false);
      return;
    }
    const candidateList = (cands ?? []) as unknown as Candidate[];
    const ids = candidateList.map((c) => c.candidate_id);

    const [aRes, iRes, eRes] = await Promise.all([
      ids.length
        ? supabase.from("assessments").select("*").in("candidate_id", ids)
        : Promise.resolve({ data: [] }),
      ids.length
        ? supabase.from("interviews").select("*").in("candidate_id", ids)
        : Promise.resolve({ data: [] }),
      supabase.from("employers").select("id, name").eq("active", true).order("name"),
    ]);

    const next = new Map<string, Record<StageKey, StageRecord>>();
    for (const c of candidateList) {
      const aRows = ((aRes.data ?? []) as AssessmentRow[]).filter(
        (r) => r.candidate_id === c.candidate_id,
      );
      const iRows = ((iRes.data ?? []) as InterviewRow[]).filter(
        (r) => r.candidate_id === c.candidate_id,
      );
      const employerRow =
        iRows.find((r) => r.round === "interview2" || r.round === "final") ?? iRows[0];
      next.set(c.candidate_id, {
        speaking: assessmentToRecord(aRows.find((r) => r.kind === "speaking")),
        interview_training: assessmentToRecord(aRows.find((r) => r.kind === "training")),
        sti: assessmentToRecord(aRows.find((r) => r.kind === "sti")),
        employer_interview: interviewToRecord(employerRow),
      });
    }

    setPool(candidateList);
    setRecords(next);
    setEmployers((eRes.data ?? []) as EmployerOption[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Per-candidate stage matrix + readiness (from real rows only)
  const matrix = useMemo(() => {
    return pool.map((c) => {
      const recs = records.get(c.candidate_id) ?? {
        speaking: { ...EMPTY_RECORD },
        interview_training: { ...EMPTY_RECORD },
        sti: { ...EMPTY_RECORD },
        employer_interview: { ...EMPTY_RECORD },
      };
      const statuses = {
        speaking: recs.speaking.status,
        interview_training: recs.interview_training.status,
        sti: recs.sti.status,
        employer_interview: recs.employer_interview.status,
      } as Record<StageKey, StageStatus>;
      const readiness: Readiness = computeReadiness(c.total_score ?? null, c.gate_status);
      return {
        candidate: c,
        recs,
        statuses,
        progress: progressFor(statuses),
        next: nextAction(statuses),
        readiness,
      };
    });
  }, [pool, records]);

  const filtered = matrix.filter(({ candidate }) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      candidate.first_name.toLowerCase().includes(q) ||
      candidate.last_name.toLowerCase().includes(q) ||
      (candidate.program_name ?? "").toLowerCase().includes(q)
    );
  });

  // KPIs — all derived from real statuses
  const kpis = useMemo(() => {
    const count = (stage: StageKey, sts: StageStatus[]) =>
      matrix.filter((m) => sts.includes(m.statuses[stage])).length;
    const passedAll = matrix.filter((m) =>
      STAGES.every((s) => m.statuses[s.key] === "passed"),
    ).length;
    const today = new Date().toDateString();
    const completedToday = matrix.filter((m) =>
      STAGES.some((s) => {
        const d = m.recs[s.key].date;
        return d && new Date(d).toDateString() === today && m.statuses[s.key] === "passed";
      }),
    ).length;
    return {
      speakingPending: count("speaking", ["not_started", "scheduled", "in_progress"]),
      trainingPending: count("interview_training", ["not_started", "scheduled", "in_progress"]),
      stiPending: count("sti", ["not_started", "scheduled", "in_progress"]),
      employerScheduled: count("employer_interview", ["scheduled", "in_progress"]),
      completedToday,
      successRate: matrix.length ? Math.round((passedAll / matrix.length) * 100) : 0,
    };
  }, [matrix]);

  const currentRow = matrix.find((m) => m.candidate.candidate_id === selected);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
          Loading evaluation data…
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold tracking-tight">Could not load evaluation data</h1>
          <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
          <Button className="mt-4" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Candidate Evaluation Center</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Operational hub for the four placement-readiness modules — Speaking, Interview Training,
            STI, and Employer Interview.
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          tint="sky"
          icon={<Mic className="size-4" />}
          label="Speaking pending"
          value={kpis.speakingPending}
        />
        <KpiCard
          tint="violet"
          icon={<Target className="size-4" />}
          label="Interview training"
          value={kpis.trainingPending}
        />
        <KpiCard
          tint="amber"
          icon={<Brain className="size-4" />}
          label="STI pending"
          value={kpis.stiPending}
        />
        <KpiCard
          tint="emerald"
          icon={<Briefcase className="size-4" />}
          label="Employer interviews"
          value={kpis.employerScheduled}
        />
        <KpiCard
          tint="slate"
          icon={<CheckCircle2 className="size-4" />}
          label="Completed today"
          value={kpis.completedToday}
        />
        <KpiCard
          tint="rose"
          icon={<TrendingUp className="size-4" />}
          label="Fully cleared"
          value={`${kpis.successRate}%`}
        />
      </div>

      {/* Pipeline diagram */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {["Shortlisted", ...STAGES.map((s) => s.label), "Offer", "Visa"].map((step, i, arr) => (
              <div key={step} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 font-medium ring-1 ring-inset",
                    i === 0 || i === arr.length - 1 || i === arr.length - 2
                      ? "bg-background text-foreground/70 ring-border"
                      : "bg-sky-50 text-sky-800 ring-sky-200",
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
              <CardDescription>
                All four modules progress independently per candidate.
              </CardDescription>
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
                    <th key={s.key} className="px-3 py-2 text-left font-medium">
                      {s.label}
                    </th>
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
                        "cursor-pointer transition-colors hover:bg-muted/40",
                        isActive && "bg-sky-50/60",
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {candidate.first_name} {candidate.last_name}
                        </div>
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
                          <span className="w-8 text-xs tabular-nums text-muted-foreground">
                            {progress}%
                          </span>
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
                    <td
                      colSpan={STAGES.length + 5}
                      className="px-4 py-8 text-center text-sm text-muted-foreground"
                    >
                      {pool.length === 0
                        ? "No candidates are in the evaluation phase yet. Approve candidates through Verification first."
                        : "No candidates match your search."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Candidate detail — four modules */}
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
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="speaking">
              <TabsList className="grid w-full max-w-2xl grid-cols-4">
                <TabsTrigger value="speaking" className="gap-1.5">
                  <Mic className="size-4" /> Speaking
                </TabsTrigger>
                <TabsTrigger value="interview_training" className="gap-1.5">
                  <Target className="size-4" /> Interview Training
                </TabsTrigger>
                <TabsTrigger value="sti" className="gap-1.5">
                  <Brain className="size-4" /> STI
                </TabsTrigger>
                <TabsTrigger value="employer_interview" className="gap-1.5">
                  <Briefcase className="size-4" /> Employer
                </TabsTrigger>
              </TabsList>

              <TabsContent value="speaking" className="mt-4">
                <SpeakingModule
                  candidateId={currentRow.candidate.candidate_id}
                  record={currentRow.recs.speaking}
                  onSaved={load}
                />
              </TabsContent>
              <TabsContent value="interview_training" className="mt-4">
                <TrainingModule
                  candidateId={currentRow.candidate.candidate_id}
                  record={currentRow.recs.interview_training}
                  onSaved={load}
                />
              </TabsContent>
              <TabsContent value="sti" className="mt-4">
                <STIModule
                  candidateId={currentRow.candidate.candidate_id}
                  record={currentRow.recs.sti}
                  onSaved={load}
                />
              </TabsContent>
              <TabsContent value="employer_interview" className="mt-4">
                <EmployerInterviewModule
                  candidateId={currentRow.candidate.candidate_id}
                  record={currentRow.recs.employer_interview}
                  employers={employers}
                  onSaved={load}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Persistence helper — one row per (candidate, kind)
   ──────────────────────────────────────────────────────────── */

async function saveAssessment(params: {
  candidateId: string;
  kind: string;
  scores: Record<string, number>;
  overall: number;
  recommendation?: string;
  notes?: string;
  assessor?: string;
}): Promise<void> {
  const { candidateId, kind, scores, overall, recommendation, notes, assessor } = params;
  const { data: existing } = await supabase
    .from("assessments")
    .select("id")
    .eq("candidate_id", candidateId)
    .eq("kind", kind)
    .maybeSingle();

  const payload = {
    candidate_id: candidateId,
    kind,
    scores,
    overall_score: overall,
    recommendation: recommendation ?? null,
    notes: notes ?? null,
    assessor_name: assessor ?? null,
    assessed_at: new Date().toISOString(),
  };

  const { error } = existing
    ? await supabase.from("assessments").update(payload).eq("id", existing.id)
    : await supabase.from("assessments").insert(payload);
  if (error) throw new Error(error.message);
}

/* ── Shared module props ──────────────────────────────────── */
interface ModuleProps {
  candidateId: string;
  record: StageRecord;
  onSaved: () => void;
}

/* ── Module: Speaking ─────────────────────────────────────── */
function SpeakingModule({ candidateId, record, onSaved }: ModuleProps) {
  const [scores, setScores] = useState({
    pronunciation: record.scores.pronunciation ?? 0,
    grammar: record.scores.grammar ?? 0,
    vocabulary: record.scores.vocabulary ?? 0,
    fluency: record.scores.fluency ?? 0,
  });
  const [assessor, setAssessor] = useState(record.assessor ?? "");
  const [feedback, setFeedback] = useState(record.notes ?? "");
  const [saving, setSaving] = useState(false);
  const overall = Math.round(
    (scores.pronunciation + scores.grammar + scores.vocabulary + scores.fluency) / 4,
  );
  const cefr = overall >= 85 ? "C1" : overall >= 70 ? "B2" : overall >= 55 ? "B1" : "A2";

  const submit = async () => {
    setSaving(true);
    try {
      await saveAssessment({
        candidateId,
        kind: "speaking",
        scores,
        overall,
        notes: feedback,
        assessor,
      });
      toast.success("Speaking assessment saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModuleShell
      status={record.status}
      title="Speaking Assessment"
      description="Evaluate real spoken German communication with a live assessor."
      saving={saving}
      onSubmit={submit}
      leftFields={[
        {
          label: "Assessor",
          input: (
            <Input
              value={assessor}
              onChange={(e) => setAssessor(e.target.value)}
              placeholder="Assessor name"
            />
          ),
        },
      ]}
    >
      <div className="grid gap-4 md:grid-cols-2">
        {(["pronunciation", "grammar", "vocabulary", "fluency"] as const).map((k) => (
          <SliderRow
            key={k}
            label={k[0].toUpperCase() + k.slice(1)}
            value={scores[k]}
            onChange={(v) => setScores({ ...scores, [k]: v })}
          />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 p-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Overall</div>
          <div className="text-xl font-semibold tabular-nums">{overall}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            CEFR recommendation
          </div>
          <Badge className="mt-0.5 bg-sky-600">{cefr}</Badge>
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs">Feedback</Label>
          <Input
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g. Clear pronunciation; needs more workplace vocabulary."
            className="mt-1"
          />
        </div>
      </div>
    </ModuleShell>
  );
}

/* ── Module: Interview Training ───────────────────────────── */
function TrainingModule({ candidateId, record, onSaved }: ModuleProps) {
  const [scores, setScores] = useState({
    confidence: record.scores.confidence ?? 0,
    comms: record.scores.comms ?? 0,
    etiquette: record.scores.etiquette ?? 0,
    hrReadiness: record.scores.hrReadiness ?? 0,
  });
  const [trainer, setTrainer] = useState(record.assessor ?? "");
  const [feedback, setFeedback] = useState(record.notes ?? "");
  const [recommendation, setRecommendation] = useState(record.recommendation ?? "ready");
  const [saving, setSaving] = useState(false);
  const overall = Math.round(
    (scores.confidence + scores.comms + scores.etiquette + scores.hrReadiness) / 4,
  );

  const submit = async () => {
    setSaving(true);
    try {
      await saveAssessment({
        candidateId,
        kind: "training",
        scores,
        overall,
        recommendation,
        notes: feedback,
        assessor: trainer,
      });
      toast.success("Interview training saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModuleShell
      status={record.status}
      title="Interview Training"
      description="Coaching sessions run by Workforce Europe to prepare candidates before the employer interview. This is not language training."
      saving={saving}
      onSubmit={submit}
      leftFields={[
        {
          label: "Trainer",
          input: (
            <Input
              value={trainer}
              onChange={(e) => setTrainer(e.target.value)}
              placeholder="Trainer name"
            />
          ),
        },
      ]}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <SliderRow
          label="Confidence"
          value={scores.confidence}
          onChange={(v) => setScores({ ...scores, confidence: v })}
        />
        <SliderRow
          label="Professional communication"
          value={scores.comms}
          onChange={(v) => setScores({ ...scores, comms: v })}
        />
        <SliderRow
          label="German workplace etiquette"
          value={scores.etiquette}
          onChange={(v) => setScores({ ...scores, etiquette: v })}
        />
        <SliderRow
          label="HR readiness"
          value={scores.hrReadiness}
          onChange={(v) => setScores({ ...scores, hrReadiness: v })}
        />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <Label>Interview feedback</Label>
          <Input
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g. Strong story-telling; work on concise answers."
            className="mt-1"
          />
        </div>
        <div>
          <Label>Final recommendation</Label>
          <Select value={recommendation} onValueChange={setRecommendation}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
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
function STIModule({ candidateId, record, onSaved }: ModuleProps) {
  const [scores, setScores] = useState({
    behaviour: record.scores.behaviour ?? 0,
    workReadiness: record.scores.workReadiness ?? 0,
    adaptability: record.scores.adaptability ?? 0,
    learning: record.scores.learning ?? 0,
  });
  const [assessor, setAssessor] = useState(record.assessor ?? "");
  const [recommendation, setRecommendation] = useState(record.recommendation ?? "proceed");
  const [saving, setSaving] = useState(false);
  const final = Math.round(
    (scores.behaviour + scores.workReadiness + scores.adaptability + scores.learning) / 4,
  );

  const submit = async () => {
    setSaving(true);
    try {
      await saveAssessment({
        candidateId,
        kind: "sti",
        scores,
        overall: final,
        recommendation,
        assessor,
      });
      toast.success("STI assessment saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModuleShell
      status={record.status}
      title="STI Assessment"
      description="Internal Workforce Europe suitability assessment — behaviour, work readiness, adaptability and learning ability."
      saving={saving}
      onSubmit={submit}
      leftFields={[
        {
          label: "Assessor",
          input: (
            <Input
              value={assessor}
              onChange={(e) => setAssessor(e.target.value)}
              placeholder="Assessor name"
            />
          ),
        },
      ]}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <SliderRow
          label="Behaviour"
          value={scores.behaviour}
          onChange={(v) => setScores({ ...scores, behaviour: v })}
        />
        <SliderRow
          label="Work readiness"
          value={scores.workReadiness}
          onChange={(v) => setScores({ ...scores, workReadiness: v })}
        />
        <SliderRow
          label="Adaptability"
          value={scores.adaptability}
          onChange={(v) => setScores({ ...scores, adaptability: v })}
        />
        <SliderRow
          label="Learning ability"
          value={scores.learning}
          onChange={(v) => setScores({ ...scores, learning: v })}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 p-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Final score
          </div>
          <div className="text-xl font-semibold tabular-nums">{final}</div>
        </div>
        <div className="flex-1 min-w-[220px]">
          <Label className="text-xs">Recruiter recommendation</Label>
          <Select value={recommendation} onValueChange={setRecommendation}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="proceed">Proceed to employer interview</SelectItem>
              <SelectItem value="hold">Hold for review</SelectItem>
              <SelectItem value="not_suitable">Not suitable</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </ModuleShell>
  );
}

/* ── Module: Employer Interview ───────────────────────────── */
function EmployerInterviewModule({
  candidateId,
  record,
  employers,
  onSaved,
}: ModuleProps & { employers: EmployerOption[] }) {
  const [employerId, setEmployerId] = useState(record.employerId ?? "");
  const [round, setRound] = useState(record.round ?? "interview2");
  const [date, setDate] = useState(record.date ? record.date.slice(0, 10) : "");
  const [rating, setRating] = useState(record.overall ?? 0);
  const [comments, setComments] = useState(record.notes ?? "");
  const [decision, setDecision] = useState(record.decision ?? "selected");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const employerName = employers.find((e) => e.id === employerId)?.name ?? null;
      const payload = {
        candidate_id: candidateId,
        round,
        employer_id: employerId || null,
        employer_name: employerName,
        rating,
        decision,
        notes: comments || null,
        scheduled_at: date ? new Date(date).toISOString() : null,
      };
      const { data: existing } = await supabase
        .from("interviews")
        .select("id")
        .eq("candidate_id", candidateId)
        .eq("round", round)
        .maybeSingle();
      const { error } = existing
        ? await supabase.from("interviews").update(payload).eq("id", existing.id)
        : await supabase.from("interviews").insert(payload);
      if (error) throw new Error(error.message);
      toast.success("Employer interview saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModuleShell
      status={record.status}
      title="Employer Interview"
      description="Actual interview with the hiring employer. Captures technical, HR and final employer decision."
      saving={saving}
      onSubmit={submit}
      leftFields={[
        {
          label: "Employer",
          input: (
            <Select value={employerId} onValueChange={setEmployerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select employer" />
              </SelectTrigger>
              <SelectContent>
                {employers.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ),
        },
        {
          label: "Date",
          input: <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />,
        },
        {
          label: "Round",
          input: (
            <Select value={round} onValueChange={setRound}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="interview1">Round 1</SelectItem>
                <SelectItem value="interview2">Round 2</SelectItem>
                <SelectItem value="final">Final</SelectItem>
              </SelectContent>
            </Select>
          ),
        },
      ]}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <SliderRow label="Overall employer rating" value={rating} onChange={setRating} />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <Label>Employer comments</Label>
          <Input
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="e.g. Confident, warm; good fit for elderly-care ward."
            className="mt-1"
          />
        </div>
        <div>
          <Label>Decision</Label>
          <Select value={decision} onValueChange={setDecision}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
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
  status,
  title,
  description,
  leftFields,
  children,
  saving,
  onSubmit,
}: {
  status: StageStatus;
  title: string;
  description: string;
  leftFields: { label: string; input: React.ReactNode }[];
  children: React.ReactNode;
  saving: boolean;
  onSubmit: () => void;
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
        <Button size="sm" onClick={onSubmit} disabled={saving} className="gap-1.5">
          {saving ? <Save className="size-4 animate-pulse" /> : <Send className="size-4" />}
          {saving ? "Saving…" : "Save assessment"}
        </Button>
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
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

/* ────────────────────────────────────────────────────────────
   Sub-components
   ──────────────────────────────────────────────────────────── */

function KpiCard({
  tint,
  icon,
  label,
  value,
}: {
  tint: string;
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  const tintMap: Record<string, string> = {
    sky: "bg-sky-50 text-sky-700 ring-sky-200",
    violet: "bg-violet-50 text-violet-700 ring-violet-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    slate: "bg-slate-50 text-slate-700 ring-slate-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3">
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-md ring-1 ring-inset",
            tintMap[tint],
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="text-lg font-semibold tabular-nums">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function StagePill({ status }: { status: StageStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        m.className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

function ReadinessPill({ readiness }: { readiness: Readiness | null }) {
  if (!readiness) {
    return <span className="text-[11px] text-muted-foreground">—</span>;
  }
  const meta: Record<Readiness["band"], { label: string; className: string; dot: string }> = {
    ready: {
      label: "Ready",
      className: "bg-emerald-50 text-emerald-800 border-emerald-200",
      dot: "bg-emerald-500",
    },
    progressing: {
      label: "Progressing",
      className: "bg-sky-50 text-sky-800 border-sky-200",
      dot: "bg-sky-500",
    },
    at_risk: {
      label: "At risk",
      className: "bg-amber-50 text-amber-900 border-amber-200",
      dot: "bg-amber-500",
    },
    ineligible: {
      label: "Ineligible",
      className: "bg-red-50 text-red-800 border-red-200",
      dot: "bg-red-500",
    },
  };
  const m = meta[readiness.band];
  return (
    <span
      title={`Score ${readiness.score}/100`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        m.className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", m.dot)} />
      {m.label}
      {readiness.eligible && <span className="tabular-nums opacity-80">· {readiness.score}</span>}
    </span>
  );
}
