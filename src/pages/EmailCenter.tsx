import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Send, Clock } from "lucide-react";
import toast from "react-hot-toast";

const templates = [
  { value: "offer_letter", label: "Offer Letter" },
  { value: "rejection", label: "Rejection Notice" },
  { value: "interview_invite", label: "Interview Invitation" },
  { value: "interview_reminder", label: "Interview Reminder" },
  { value: "contract_ready", label: "Contract Ready" },
  { value: "visa_update", label: "Visa Update" },
  { value: "placement_confirmation", label: "Placement Confirmation" },
  { value: "custom", label: "Custom Email" },
];

interface CandidateOption {
  candidate_id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface EmailLogRow {
  id: string;
  recipient_email: string;
  template: string;
  subject: string;
  status: string;
  sent_by: string | null;
  created_at: string;
}

// email_logs is created by a migration newer than the generated Database
// types — use the same escape hatch the codebase already uses for
// candidate_scores.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const emailLogsTable = () => (supabase.from as any)("email_logs");

export default function EmailCenter() {
  const { user } = useAuth();
  const [selectedTemplate, setSelectedTemplate] = useState("interview_invite");
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [subject, setSubject] = useState("Interview Invitation - Next Steps");
  const [body, setBody] = useState(`Dear Candidate,

We are pleased to invite you for an interview as part of your application process.

Please confirm your availability by replying to this email.

Best regards,
Workforce Europe Team`);
  const [logs, setLogs] = useState<EmailLogRow[]>([]);
  const [sending, setSending] = useState(false);

  const loadLogs = async () => {
    const { data } = await emailLogsTable()
      .select("id, recipient_email, template, subject, status, sent_by, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setLogs(data as EmailLogRow[]);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("candidates")
        .select("candidate_id, first_name, last_name, email")
        .neq("email", "")
        .order("created_at", { ascending: false })
        .limit(100);
      if (!cancelled && data) setCandidates(data as CandidateOption[]);
    })();
    void loadLogs();
    return () => {
      cancelled = true;
    };
  }, []);

  const recipient = candidates.find((c) => c.candidate_id === selectedCandidateId);

  const handleSend = async () => {
    if (!recipient || !subject || !body) {
      toast.error("Please fill in all fields");
      return;
    }
    setSending(true);
    try {
      // No outbound mail provider is configured yet — the message is
      // persisted as 'pending' so the history is truthful (never faked
      // as 'sent').
      const { error } = await emailLogsTable().insert({
        candidate_id: recipient.candidate_id,
        recipient_email: recipient.email,
        template: selectedTemplate,
        subject,
        body,
        status: "pending",
        sent_by: user?.name ?? null,
      });
      if (error) throw new Error(error.message);
      toast.success("Email queued — it will send once mail delivery is configured");
      await loadLogs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save email");
    } finally {
      setSending(false);
    }
  };

  const loadTemplate = (template: string) => {
    setSelectedTemplate(template);
    const subjects: Record<string, string> = {
      offer_letter: "Job Offer - Congratulations!",
      rejection: "Update on Your Application",
      interview_invite: "Interview Invitation - Next Steps",
      interview_reminder: "Reminder: Upcoming Interview",
      contract_ready: "Your Contract is Ready for Review",
      visa_update: "Visa Application Update",
      placement_confirmation: "Placement Confirmation",
      custom: "",
    };
    setSubject(subjects[template] || "");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Email Center</h1>
        <p className="text-sm text-muted-foreground">Compose and manage candidate communications</p>
      </div>

      <Tabs defaultValue="compose">
        <TabsList>
          <TabsTrigger value="compose">
            <Mail className="w-4 h-4 mr-2" /> Compose
          </TabsTrigger>
          <TabsTrigger value="history">
            <Clock className="w-4 h-4 mr-2" /> History ({logs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Compose Email</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Template</Label>
                  <Select value={selectedTemplate} onValueChange={loadTemplate}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Recipient</Label>
                  <Select value={selectedCandidateId} onValueChange={setSelectedCandidateId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select candidate" />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.map((c) => (
                        <SelectItem key={c.candidate_id} value={c.candidate_id}>
                          {c.first_name} {c.last_name} ({c.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Subject</Label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Body</Label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="w-full min-h-[200px] mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSend} disabled={sending}>
                    <Send className="w-4 h-4 mr-2" /> {sending ? "Saving…" : "Queue Email"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg p-4 space-y-3 bg-white">
                  <div className="border-b pb-3">
                    <p className="text-sm">
                      <strong>From:</strong> noreply@workforce-europe.com
                    </p>
                    <p className="text-sm">
                      <strong>To:</strong> {recipient?.email || "[Select recipient]"}
                    </p>
                    <p className="text-sm">
                      <strong>Subject:</strong> {subject}
                    </p>
                  </div>
                  <div className="text-sm whitespace-pre-wrap text-muted-foreground">{body}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Composed By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No emails composed yet.
                        </TableCell>
                      </TableRow>
                    )}
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="capitalize">
                          {log.template.replace("_", " ")}
                        </TableCell>
                        <TableCell>{log.recipient_email}</TableCell>
                        <TableCell>{log.subject}</TableCell>
                        <TableCell>{log.sent_by ?? "—"}</TableCell>
                        <TableCell>{new Date(log.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                              log.status === "sent"
                                ? "bg-green-100 text-green-800"
                                : log.status === "failed"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {log.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
