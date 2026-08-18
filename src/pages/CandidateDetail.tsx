import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCandidates } from "@/hooks/useCandidates";
import { supabase } from "@/integrations/supabase/client";
import type { Contract } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/hooks/useAuth";
import { STAGES } from "@/lib/workflow";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScoreBar } from "@/components/ScoreBar";
// Layout component
import { FileText, Upload, CheckCircle, Clock } from "lucide-react";
import toast from "react-hot-toast";

interface AssessmentRow {
  kind: string;
  scores: Record<string, number>;
  overall_score: number | null;
  recommendation: string | null;
  assessor_name: string | null;
  assessed_at: string | null;
}

interface InterviewRow {
  round: string;
  rating: number | null;
  decision: string | null;
  employer_name: string | null;
  scheduled_at: string | null;
  notes: string | null;
}

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    getCandidate,
    getCandidateDocuments,
    getCandidateAuditEvents,
    getCandidateScores,
    refresh,
  } = useCandidates();

  const candidate = getCandidate(id || "");
  const documents = getCandidateDocuments(id || "");
  const audits = getCandidateAuditEvents(id || "");
  const scores = getCandidateScores(id || "");

  const { user } = useAuth();
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");
  const [statusSaving, setStatusSaving] = useState(false);

  /** Opens a document from private storage via a short-lived signed URL. */
  const viewDocument = async (storagePath: string) => {
    const { data, error } = await supabase.storage
      .from("candidate-documents")
      .createSignedUrl(storagePath, 300);
    if (error || !data?.signedUrl) {
      toast.error(error?.message ?? "Could not open document");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const saveStatus = async () => {
    if (!candidate || !newStatus || newStatus === candidate.status) {
      setStatusDialogOpen(false);
      return;
    }
    setStatusSaving(true);
    try {
      const { error } = await supabase
        .from("candidates")
        .update({ status: newStatus })
        .eq("candidate_id", candidate.candidate_id);
      if (error) throw new Error(error.message);

      await supabase.from("audit_events").insert({
        entity_type: "candidate",
        entity_id: candidate.candidate_id,
        event_type: "candidate_status_changed",
        actor_name: user?.name ?? "Unknown",
        old_value: { status: candidate.status },
        new_value: { status: newStatus },
      });

      toast.success(`Status updated to ${newStatus}`);
      setStatusDialogOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Status update failed");
    } finally {
      setStatusSaving(false);
    }
  };

  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [interviews, setInterviews] = useState<InterviewRow[]>([]);
  const [contract, setContract] = useState<Contract | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const [aRes, iRes, cRes] = await Promise.all([
        supabase
          .from("assessments")
          .select("kind, scores, overall_score, recommendation, assessor_name, assessed_at")
          .eq("candidate_id", id),
        supabase
          .from("interviews")
          .select("round, rating, decision, employer_name, scheduled_at, notes")
          .eq("candidate_id", id),
        supabase
          .from("contracts")
          .select("*")
          .eq("candidate_id", id)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);
      if (cancelled) return;
      setAssessments((aRes.data ?? []) as AssessmentRow[]);
      setInterviews((iRes.data ?? []) as InterviewRow[]);
      setContract(((cRes.data ?? [])[0] ?? null) as unknown as Contract | null);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const speaking = assessments.find((a) => a.kind === "speaking");
  const training = assessments.find((a) => a.kind === "training");
  const stiAssessment = assessments.find((a) => a.kind === "sti");
  const interview1 = interviews.find((i) => i.round === "interview1");
  const interview2 = interviews.find((i) => i.round === "interview2" || i.round === "final");

  if (!candidate) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Candidate not found</p>
      </div>
    );
  }

  // Real per-criterion scores only (written by the scoring engine).
  // No synthetic breakdown is fabricated when none exist.
  const scoreBreakdown = scores;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {candidate.first_name} {candidate.last_name}
            </h1>
            <StatusBadge status={candidate.status} type="candidate" />
            <StatusBadge status={candidate.gate_status} type="gate" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            ID: {candidate.candidate_id} &middot; Rank: {candidate.rank || "N/A"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/candidates/${candidate.candidate_id}/intake`)}
          >
            Open in Intake Studio
          </Button>
          <Button size="sm" onClick={() => setStatusDialogOpen(true)}>
            Update Status
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{candidate.total_score?.toFixed(1) || "N/A"}</div>
            {candidate.total_score && <ScoreBar score={candidate.total_score} size="sm" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Program</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">{candidate.program_name}</div>
            <p className="text-xs text-muted- capitalize">
              {candidate.source_type}{" "}
              {candidate.source_agency_name && `\u00B7 ${candidate.source_agency_name}`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recruiter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">{candidate.assigned_recruiter_name}</div>
            <p className="text-xs text-muted-foreground">{candidate.country}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
          <TabsTrigger value="sti">STI History</TabsTrigger>
          <TabsTrigger value="scores">Scores</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="visa">Visa</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <LabelSmall>Email</LabelSmall>
                  <Value>{candidate.email}</Value>
                </div>
                <div>
                  <LabelSmall>Phone</LabelSmall>
                  <Value>{candidate.phone}</Value>
                </div>
                <div>
                  <LabelSmall>Date of Birth</LabelSmall>
                  <Value>{candidate.dob || "N/A"}</Value>
                </div>
                <div>
                  <LabelSmall>Gender</LabelSmall>
                  <Value className="capitalize">{candidate.gender || "N/A"}</Value>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <LabelSmall>Country</LabelSmall>
                  <Value>{candidate.country}</Value>
                </div>
                <div>
                  <LabelSmall>Highest Qualification</LabelSmall>
                  <Value>{candidate.highest_qualification || "N/A"}</Value>
                </div>
                <div>
                  <LabelSmall>Source</LabelSmall>
                  <Value className="capitalize">{candidate.source_type}</Value>
                </div>
                <div>
                  <LabelSmall>Created</LabelSmall>
                  <Value>{new Date(candidate.created_at).toLocaleDateString()}</Value>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Documents</h3>
          </div>
          {documents.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No documents uploaded yet
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <Card key={doc.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="font-medium capitalize">
                          {doc.document_type.replace("_", " ")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          OCR:{" "}
                          {(() => {
                            const status = (doc as { ocr_status?: string }).ocr_status;
                            if (status === "failed") return "Failed";
                            if (status === "processing") return "Processing";
                            if (!doc.ocr_complete && status !== "complete") return "Pending";
                            return doc.ocr_confidence
                              ? `${Math.round(doc.ocr_confidence * 100)}%`
                              : "Complete";
                          })()}
                          {doc.verified && " \u00B7 Verified"}
                          {doc.expiry_date &&
                            ` \u00B7 Expires: ${new Date(doc.expiry_date).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.verified ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-yellow-500" />
                      )}
                      {doc.storage_path && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void viewDocument(doc.storage_path!)}
                        >
                          View
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sti" className="space-y-4">
          {speaking && (
            <Card>
              <CardHeader>
                <CardTitle>Speaking Assessment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-4 gap-4">
                  {Object.entries(speaking.scores).map(([k, v]) => (
                    <div key={k}>
                      <LabelSmall className="capitalize">{k.replace("_", " ")}</LabelSmall>
                      <div className="text-lg font-semibold">{v}</div>
                      <ScoreBar score={v} size="sm" showLabel={false} />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    Overall: <strong>{speaking.overall_score ?? "—"}</strong>
                  </span>
                  {speaking.assessor_name && (
                    <>
                      <span>|</span>
                      <span>Assessor: {speaking.assessor_name}</span>
                    </>
                  )}
                  {speaking.assessed_at && (
                    <>
                      <span>|</span>
                      <span>{new Date(speaking.assessed_at).toLocaleDateString()}</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          {training && (
            <Card>
              <CardHeader>
                <CardTitle>Training Assessment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-4 gap-4">
                  {Object.entries(training.scores).map(([k, v]) => (
                    <div key={k}>
                      <LabelSmall className="capitalize">{k.replace("_", " ")}</LabelSmall>
                      <div className="text-lg font-semibold">{v}</div>
                      <ScoreBar score={v} size="sm" showLabel={false} />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {training.recommendation && (
                    <span>
                      Recommendation: <StatusBadge status={training.recommendation} />
                    </span>
                  )}
                  {training.assessor_name && (
                    <span className="text-muted-foreground">
                      | Trainer: {training.assessor_name}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          {stiAssessment && (
            <Card>
              <CardHeader>
                <CardTitle>STI Assessment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-4 gap-4">
                  {Object.entries(stiAssessment.scores).map(([k, v]) => (
                    <div key={k}>
                      <LabelSmall className="capitalize">{k.replace("_", " ")}</LabelSmall>
                      <div className="text-lg font-semibold">{v}</div>
                      <ScoreBar score={v} size="sm" showLabel={false} />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    Overall: <strong>{stiAssessment.overall_score ?? "—"}</strong>
                  </span>
                  {stiAssessment.recommendation && (
                    <>
                      <span>|</span>
                      <span>Recommendation: {stiAssessment.recommendation}</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          {interview1 && (
            <Card>
              <CardHeader>
                <CardTitle>Interview 1</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <LabelSmall>Rating</LabelSmall>
                    <Value>{interview1.rating != null ? `${interview1.rating}/100` : "—"}</Value>
                  </div>
                  <div>
                    <LabelSmall>Decision</LabelSmall>
                    <StatusBadge status={interview1.decision || "pending"} />
                  </div>
                  <div>
                    <LabelSmall>Date</LabelSmall>
                    <Value>
                      {interview1.scheduled_at
                        ? new Date(interview1.scheduled_at).toLocaleDateString()
                        : "N/A"}
                    </Value>
                  </div>
                </div>
                {interview1.notes && (
                  <p className="mt-3 text-sm text-muted-foreground bg-muted p-3 rounded-md">
                    {interview1.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
          {interview2 && (
            <Card>
              <CardHeader>
                <CardTitle>Interview 2</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <LabelSmall>Rating</LabelSmall>
                    <Value>{interview2.rating != null ? `${interview2.rating}/100` : "—"}</Value>
                  </div>
                  <div>
                    <LabelSmall>Decision</LabelSmall>
                    <StatusBadge status={interview2.decision || "pending"} />
                  </div>
                  <div>
                    <LabelSmall>Employer</LabelSmall>
                    <Value>{interview2.employer_name ?? "—"}</Value>
                  </div>
                  <div>
                    <LabelSmall>Date</LabelSmall>
                    <Value>
                      {interview2.scheduled_at
                        ? new Date(interview2.scheduled_at).toLocaleDateString()
                        : "N/A"}
                    </Value>
                  </div>
                </div>
                {interview2.notes && (
                  <p className="mt-3 text-sm text-muted-foreground bg-muted p-3 rounded-md">
                    {interview2.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
          {!speaking && !training && !stiAssessment && !interview1 && !interview2 && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No STI assessments recorded yet
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="scores" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Score Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {scoreBreakdown.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No criterion scores recorded yet. Scores appear here after the selection engine
                  runs for this candidate.
                </p>
              )}
              {scoreBreakdown.map((s, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{s.criteria_name}</span>
                      {s.gate_status !== "eligible" && (
                        <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                          GATING
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold w-12 text-right">
                        {s.raw_score.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <ScoreBar score={s.raw_score} size="sm" showLabel={false} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="space-y-4">
          {contract ? (
            <Card>
              <CardHeader>
                <CardTitle>Contract Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <LabelSmall>Employer</LabelSmall>
                    <Value>{contract.employer_name ?? "To be confirmed"}</Value>
                  </div>
                  <div>
                    <LabelSmall>Status</LabelSmall>
                    <StatusBadge status={contract.status} type="contract" />
                  </div>
                  <div>
                    <LabelSmall>Signed</LabelSmall>
                    <Value>
                      {contract.signed_at
                        ? new Date(contract.signed_at).toLocaleDateString()
                        : "Not signed"}
                    </Value>
                  </div>
                  <div>
                    <LabelSmall>Created</LabelSmall>
                    <Value>{new Date(contract.created_at).toLocaleDateString()}</Value>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  {contract.status === "sent" && (
                    <Button size="sm" onClick={() => navigate(`/contracts/sign/${contract.id}`)}>
                      Sign Contract
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No contract generated yet
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="visa" className="space-y-4">
          {candidate.status === "visa" || candidate.status === "placed" ? (
            <Card>
              <CardHeader>
                <CardTitle>Visa Process</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <StatusBadge status={candidate.status} type="candidate" />
                  <span className="text-sm text-muted-foreground">
                    Updated: {new Date(candidate.updated_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Detailed visa tracking is not configured yet. Current lifecycle stage is shown
                  from the candidate status.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No visa process started
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="activity" className="space-y-2">
          {audits.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No activity recorded
              </CardContent>
            </Card>
          ) : (
            audits.map((audit) => (
              <Card key={audit.id}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium capitalize">
                      {audit.event_type.replace("_", " ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      by {audit.actor_name || "System"} &middot;{" "}
                      {new Date(audit.created_at).toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Update status dialog — writes through to the database */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update candidate status</DialogTitle>
            <DialogDescription>
              Current status: <StatusBadge status={candidate.status} type="candidate" />
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label>New status</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select new status" />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveStatus()} disabled={statusSaving || !newStatus}>
              {statusSaving ? "Saving…" : "Save status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LabelSmall({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={`text-xs text-muted-foreground ${className}`}>{children}</p>;
}

function Value({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-sm font-medium ${className}`}>{children}</p>;
}
