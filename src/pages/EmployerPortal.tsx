import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Candidate } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ScoreBar } from "@/components/ScoreBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Users } from "lucide-react";
import toast from "react-hot-toast";

interface AssessmentRow {
  kind: string;
  scores: Record<string, number>;
  overall_score: number | null;
  recommendation: string | null;
  notes: string | null;
}

interface InterviewRow {
  id: string;
  round: string;
  rating: number | null;
  decision: string | null;
  notes: string | null;
}

export default function EmployerPortal() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [interviews, setInterviews] = useState<InterviewRow[]>([]);
  const [feedback, setFeedback] = useState({ rating: 75, notes: "", decision: "selected" });
  const [saving, setSaving] = useState(false);

  // Employer-facing queue: candidates at employer-interview stage or beyond.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("candidates")
        .select("*")
        .in("status", ["interview2", "placed"])
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setCandidates((data ?? []) as unknown as Candidate[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load per-candidate evaluation detail on selection.
  useEffect(() => {
    if (!selectedCandidate) return;
    let cancelled = false;
    (async () => {
      const [aRes, iRes] = await Promise.all([
        supabase
          .from("assessments")
          .select("kind, scores, overall_score, recommendation, notes")
          .eq("candidate_id", selectedCandidate),
        supabase
          .from("interviews")
          .select("id, round, rating, decision, notes")
          .eq("candidate_id", selectedCandidate),
      ]);
      if (cancelled) return;
      setAssessments((aRes.data ?? []) as AssessmentRow[]);
      setInterviews((iRes.data ?? []) as InterviewRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCandidate]);

  const selected = candidates.find((c) => c.candidate_id === selectedCandidate);
  const speaking = assessments.find((a) => a.kind === "speaking");
  const training = assessments.find((a) => a.kind === "training");
  const sti = assessments.find((a) => a.kind === "sti");
  const interview1 = interviews.find((i) => i.round === "interview1");
  const interview2 = interviews.find((i) => i.round === "interview2" || i.round === "final");

  const submitFeedback = async () => {
    if (!selectedCandidate) return;
    setSaving(true);
    try {
      const payload = {
        candidate_id: selectedCandidate,
        round: "interview2",
        rating: feedback.rating,
        decision: feedback.decision,
        notes: feedback.notes || null,
      };
      const { data: existing } = await supabase
        .from("interviews")
        .select("id")
        .eq("candidate_id", selectedCandidate)
        .eq("round", "interview2")
        .maybeSingle();
      const { error } = existing
        ? await supabase.from("interviews").update(payload).eq("id", existing.id)
        : await supabase.from("interviews").insert(payload);
      if (error) throw new Error(error.message);
      toast.success("Interview feedback submitted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
          Loading candidates…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employer Portal</h1>
          <p className="text-sm text-muted-foreground">
            Review shortlisted candidates and provide interview feedback
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Candidate List */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Users className="w-4 h-4" /> Shortlisted Candidates ({candidates.length})
          </h3>
          {candidates.length === 0 && (
            <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-6 text-center">
              No candidates are at the employer-interview stage yet.
            </p>
          )}
          {candidates.map((c) => (
            <Card
              key={c.candidate_id}
              className={`cursor-pointer transition-colors ${selectedCandidate === c.candidate_id ? "border-primary bg-primary/5" : "hover:bg-accent/50"}`}
              onClick={() => setSelectedCandidate(c.candidate_id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {c.first_name} {c.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.program_name} &middot; {c.country}
                    </p>
                  </div>
                  <StatusBadge status={c.status} type="candidate" />
                </div>
                {c.total_score != null && (
                  <div className="mt-2">
                    <ScoreBar score={c.total_score} size="sm" showLabel={false} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Candidate Detail */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>
                      {selected.first_name} {selected.last_name}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="profile">
                    <TabsList>
                      <TabsTrigger value="profile">Profile</TabsTrigger>
                      <TabsTrigger value="sti">Evaluation Results</TabsTrigger>
                      <TabsTrigger value="feedback">Feedback</TabsTrigger>
                    </TabsList>

                    <TabsContent value="profile" className="space-y-3 mt-4">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Email:</span> {selected.email}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Phone:</span> {selected.phone}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Qualification:</span>{" "}
                          {selected.highest_qualification ?? "—"}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Score:</span>{" "}
                          {selected.total_score?.toFixed(1) ?? "—"}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="sti" className="space-y-4 mt-4">
                      {!speaking && !training && !sti && !interview1 && !interview2 && (
                        <p className="text-sm text-muted-foreground">
                          No evaluations recorded yet.
                        </p>
                      )}
                      {speaking && (
                        <div>
                          <h4 className="font-medium text-sm mb-2">
                            Speaking: {speaking.overall_score ?? "—"}/100
                          </h4>
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            {Object.entries(speaking.scores).map(([k, v]) => (
                              <div key={k} className="text-center">
                                <div className="capitalize text-muted-foreground">{k}</div>
                                <div className="font-bold">{v}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {training && (
                        <div>
                          <h4 className="font-medium text-sm mb-2">
                            Training: {training.overall_score ?? "—"}/100
                            {training.recommendation ? ` (${training.recommendation})` : ""}
                          </h4>
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            {Object.entries(training.scores).map(([k, v]) => (
                              <div key={k} className="text-center">
                                <div className="capitalize text-muted-foreground">
                                  {k.replace("_", " ")}
                                </div>
                                <div className="font-bold">{v}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {sti && (
                        <div>
                          <h4 className="font-medium text-sm mb-2">
                            STI: {sti.overall_score ?? "—"}/100
                            {sti.recommendation ? ` (${sti.recommendation})` : ""}
                          </h4>
                        </div>
                      )}
                      {interview1 && (
                        <div>
                          <h4 className="font-medium text-sm mb-2">
                            Interview 1: {interview1.rating ?? "—"}/100 (
                            {interview1.decision ?? "pending"})
                          </h4>
                          {interview1.notes && (
                            <p className="text-xs text-muted-foreground">{interview1.notes}</p>
                          )}
                        </div>
                      )}
                      {interview2 && (
                        <div>
                          <h4 className="font-medium text-sm mb-2">
                            Interview 2: {interview2.rating ?? "—"}/100 (
                            {interview2.decision ?? "pending"})
                          </h4>
                          {interview2.notes && (
                            <p className="text-xs text-muted-foreground">{interview2.notes}</p>
                          )}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="feedback" className="space-y-4 mt-4">
                      <div>
                        <label className="text-sm font-medium">Rating</label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={feedback.rating}
                          onChange={(e) =>
                            setFeedback({ ...feedback, rating: Number(e.target.value) })
                          }
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary mt-2"
                        />
                        <div className="text-sm font-medium mt-1">{feedback.rating}/100</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Decision</label>
                        <Select
                          value={feedback.decision}
                          onValueChange={(v) => setFeedback({ ...feedback, decision: v })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="selected">Selected</SelectItem>
                            <SelectItem value="hold">Hold</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Notes</label>
                        <textarea
                          value={feedback.notes}
                          onChange={(e) => setFeedback({ ...feedback, notes: e.target.value })}
                          placeholder="Enter your feedback..."
                          className="mt-1 flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <Button onClick={submitFeedback} disabled={saving}>
                        {saving ? "Submitting…" : "Submit Feedback"}
                      </Button>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="flex items-center justify-center h-96">
              <div className="text-center text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a candidate to view details and provide feedback</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
