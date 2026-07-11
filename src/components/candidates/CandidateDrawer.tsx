import { useMemo } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  mockCandidates, mockDocuments, mockAuditEvents, mockSTISpeaking,
} from '@/lib/mockData';
import { getCountry } from '@/lib/countries';
import { stageMeta, TONE_CLASSES,
  deriveLanguageLevel, deriveSpeakingScore, deriveTrainingScore, deriveInterviewScore,
  deriveLastActivity,
} from '@/lib/workflow';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Mail, Phone, MapPin, GraduationCap, Sparkles, FileText, ShieldCheck, ShieldAlert,
  ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  candidateId: string | null;
  onClose: () => void;
}

export function CandidateDrawer({ candidateId, onClose }: Props) {
  const navigate = useNavigate();
  const candidate = useMemo(
    () => mockCandidates.find((c) => c.candidate_id === candidateId),
    [candidateId],
  );

  const open = !!candidate;

  if (!candidate) {
    return <Sheet open={open} onOpenChange={(v) => !v && onClose()}><SheetContent /></Sheet>;
  }

  const country = getCountry(candidate.country);
  const stage = stageMeta(candidate.status);
  const initials = `${candidate.first_name[0]}${candidate.last_name[0]}`;

  const langLevel = deriveLanguageLevel(candidate.candidate_id);
  const speaking = deriveSpeakingScore(candidate.candidate_id);
  const training = deriveTrainingScore(candidate.candidate_id);
  const interview = deriveInterviewScore(candidate.candidate_id);

  const docs = mockDocuments.filter((d) => d.candidate_id === candidate.candidate_id);
  const audits = mockAuditEvents.filter((a) => a.entity_id === candidate.candidate_id);
  const sti = mockSTISpeaking.find((s) => s.candidate_id === candidate.candidate_id);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-[560px]">
        {/* Header */}
        <div className="border-b bg-background px-6 py-5">
          <div className="flex items-start gap-4">
            <Avatar className="size-14 ring-2 ring-background">
              <AvatarFallback className="bg-gradient-to-br from-slate-800 to-slate-600 text-base font-semibold text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-lg font-semibold tracking-tight">
                  {candidate.first_name} {candidate.last_name}
                </h2>
                <span title={`${country.name}`} className="text-base leading-none">{country.flag}</span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {candidate.program_name} · Rank #{candidate.rank ?? '—'}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
                  TONE_CLASSES[stage.tone],
                )}>
                  <span className="size-1.5 rounded-full bg-current opacity-70" />
                  {stage.label}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
                  {langLevel}
                </span>
                {candidate.gate_status === 'eligible' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    <ShieldCheck className="size-3" /> Placement ready
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
                    <ShieldAlert className="size-3" /> Not ready
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => navigate(`/candidates/${candidate.candidate_id}`)}
            >
              Full profile <ExternalLink className="size-3.5" />
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            <ScorePill label="AI Score" value={candidate.total_score} />
            <ScorePill label="Speaking" value={speaking} />
            <ScorePill label="Training" value={training} />
            <ScorePill label="Interview" value={interview} />
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-6 mt-4 w-fit bg-transparent p-0 gap-1">
            {['overview','timeline','documents','assessments','ai'].map((v) => (
              <TabsTrigger
                key={v}
                value={v}
                className="capitalize rounded-md px-2.5 py-1 text-xs data-[state=active]:bg-accent"
              >
                {v}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-4">
            <TabsContent value="overview" className="mt-0 space-y-3">
              <Info icon={<Mail className="size-4" />} label="Email" value={candidate.email} />
              <Info icon={<Phone className="size-4" />} label="Phone" value={candidate.phone} />
              <Info icon={<MapPin className="size-4" />} label="Country" value={`${country.flag} ${candidate.country}`} />
              <Info icon={<GraduationCap className="size-4" />} label="Qualification" value={candidate.highest_qualification ?? '—'} />
              <Info icon={<FileText className="size-4" />} label="Source" value={`${candidate.source_type}${candidate.source_agency_name ? ` · ${candidate.source_agency_name}` : ''}`} />
              <Info icon={<Sparkles className="size-4" />} label="Assigned recruiter" value={candidate.assigned_recruiter_name ?? '—'} />
              <p className="pt-2 text-[11px] text-muted-foreground">
                Last activity {formatDistanceToNow(deriveLastActivity(candidate.candidate_id), { addSuffix: true })}
              </p>
            </TabsContent>

            <TabsContent value="timeline" className="mt-0 space-y-3">
              {audits.length === 0 && <Empty>No history yet.</Empty>}
              {audits.map((a) => (
                <div key={a.id} className="rounded-md border-l-2 border-primary/40 pl-3">
                  <p className="text-sm font-medium">{a.event_type}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.actor_name ?? 'System'} · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </p>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="documents" className="mt-0 space-y-2">
              {docs.length === 0 && <Empty>No documents uploaded.</Empty>}
              {docs.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-md border p-3">
                  <FileText className="size-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium capitalize">{d.document_type.replace('_', ' ')}</p>
                    <p className="text-xs text-muted-foreground">
                      OCR {d.ocr_complete ? `${Math.round((d.ocr_confidence ?? 0) * 100)}%` : 'pending'}
                      {d.expiry_date && ` · exp ${d.expiry_date}`}
                    </p>
                  </div>
                  {d.verified ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">Verified</span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">Pending</span>
                  )}
                </div>
              ))}
            </TabsContent>

            <TabsContent value="assessments" className="mt-0 space-y-4">
              <AssessmentCard title="Speaking Assessment" score={speaking}>
                {sti ? (
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Pronunciation</span><span className="text-right tabular-nums text-foreground">{sti.pronunciation}/10</span>
                    <span>Fluency</span><span className="text-right tabular-nums text-foreground">{sti.fluency}/10</span>
                    <span>Vocabulary</span><span className="text-right tabular-nums text-foreground">{sti.vocabulary}/10</span>
                    <span>Grammar</span><span className="text-right tabular-nums text-foreground">{sti.grammar}/10</span>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Not yet assessed.</p>
                )}
              </AssessmentCard>
              <AssessmentCard title="Training" score={training} />
              <AssessmentCard title="Interview Round 1" score={interview} />
              <AssessmentCard title="Interview Round 2" score={null} />
            </TabsContent>

            <TabsContent value="ai" className="mt-0 space-y-3">
              <div className="rounded-lg border bg-gradient-to-br from-violet-50 to-transparent p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-violet-600" />
                  <p className="text-sm font-medium">AI Recommendation</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Strong candidate for <span className="font-medium text-foreground">{candidate.program_name}</span>.
                  Placement probability estimated at{' '}
                  <span className="font-medium text-foreground">
                    {Math.min(96, Math.round((candidate.total_score ?? 70) + 5))}%
                  </span>.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">Next best action: {stage.terminal ? 'Archive candidate' : `Progress to ${stage.label}`}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Strengths</p>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• Consistent language progress</li>
                  <li>• Complete document set</li>
                  <li>• Prior clinical experience</li>
                </ul>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Watch-outs</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>• Passport expiry approaching within 12 months</li>
                  <li>• Speaking score below B2 benchmark</li>
                </ul>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function ScorePill({ label, value }: { label: string; value: number | null | undefined }) {
  const v = value ?? null;
  return (
    <div className="rounded-lg border bg-card px-2.5 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {v == null ? (
        <p className="mt-1 text-sm text-muted-foreground">—</p>
      ) : (
        <>
          <p className="mt-1 text-sm font-semibold tabular-nums">{v.toFixed(0)}</p>
          <Progress value={v} className="mt-1.5 h-1" />
        </>
      )}
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm">{value}</p>
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

function AssessmentCard({ title, score, children }: { title: string; score: number | null | undefined; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{title}</p>
        {score == null ? (
          <span className="text-xs text-muted-foreground">Pending</span>
        ) : (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 tabular-nums">
            {score.toFixed(0)}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
