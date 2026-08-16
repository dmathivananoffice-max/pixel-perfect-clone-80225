import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Candidate, CandidateDocument, Contract } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, CheckCircle, Bell, User, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";

interface AuditRow {
  id: string;
  event_type: string;
  actor_name: string | null;
  created_at: string;
}

export default function CandidatePortal() {
  const { user } = useAuth();
  const [myCandidate, setMyCandidate] = useState<Candidate | null>(null);
  const [myDocuments, setMyDocuments] = useState<CandidateDocument[]>([]);
  const [myContract, setMyContract] = useState<Contract | null>(null);
  const [events, setEvents] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [agreed, setAgreed] = useState(false);
  const [signed, setSigned] = useState(false);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // The candidate's login email identifies their candidate record.
      const { data: cands } = await supabase
        .from("candidates")
        .select("*")
        .eq("email", (user?.email ?? "").toLowerCase())
        .limit(1);
      const candidate = ((cands ?? [])[0] ?? null) as unknown as Candidate | null;
      if (cancelled) return;
      setMyCandidate(candidate);

      if (candidate) {
        const [dRes, cRes, aRes] = await Promise.all([
          supabase
            .from("candidate_documents")
            .select("*")
            .eq("candidate_id", candidate.candidate_id),
          supabase
            .from("contracts")
            .select("*")
            .eq("candidate_id", candidate.candidate_id)
            .order("created_at", { ascending: false })
            .limit(1),
          supabase
            .from("audit_events")
            .select("id, event_type, actor_name, created_at")
            .eq("entity_id", candidate.candidate_id)
            .order("created_at", { ascending: false })
            .limit(10),
        ]);
        if (cancelled) return;
        setMyDocuments((dRes.data ?? []) as unknown as CandidateDocument[]);
        setMyContract(((cRes.data ?? [])[0] ?? null) as unknown as Contract | null);
        setEvents((aRes.data ?? []) as AuditRow[]);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  const handleSign = async () => {
    if (!agreed) {
      toast.error("Please agree to the terms first");
      return;
    }
    if (!myContract) return;
    setSigning(true);
    try {
      const { error } = await supabase
        .from("contracts")
        .update({ status: "signed", signed_at: new Date().toISOString() })
        .eq("id", myContract.id);
      if (error) throw new Error(error.message);
      setSigned(true);
      setMyContract({ ...myContract, status: "signed", signed_at: new Date().toISOString() });
      toast.success("Contract signed successfully!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Signing failed");
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
          Loading your portal…
        </div>
      </div>
    );
  }

  if (!myCandidate) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold tracking-tight">No application found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We could not find an application linked to {user?.email}. If you recently applied,
            please allow time for your recruiter to process your documents.
          </p>
        </div>
      </div>
    );
  }

  const statusSteps = [
    { label: "Applied", status: "completed" },
    { label: "Shortlisted", status: myCandidate.status === "waiting" ? "pending" : "completed" },
    {
      label: "Assessment",
      status: ["interview1", "interview2", "contract", "visa", "placed"].includes(
        myCandidate.status,
      )
        ? "completed"
        : myCandidate.status === "shortlisted"
          ? "active"
          : "pending",
    },
    {
      label: "Interview",
      status: ["interview2", "contract", "visa", "placed"].includes(myCandidate.status)
        ? "completed"
        : myCandidate.status === "interview1"
          ? "active"
          : "pending",
    },
    {
      label: "Contract",
      status: ["contract", "visa", "placed"].includes(myCandidate.status) ? "completed" : "pending",
    },
    {
      label: "Visa",
      status: ["visa", "placed"].includes(myCandidate.status) ? "completed" : "pending",
    },
    { label: "Placed", status: myCandidate.status === "placed" ? "completed" : "pending" },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Portal</h1>
        <p className="text-sm text-muted-foreground">
          Welcome, {myCandidate.first_name} {myCandidate.last_name}
        </p>
      </div>

      {/* Status Tracker */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">My Application Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            {statusSteps.map((step, idx) => (
              <div key={step.label} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      step.status === "completed"
                        ? "bg-green-500 text-white"
                        : step.status === "active"
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {step.status === "completed" ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span className="text-[9px] mt-1 text-center w-12 leading-tight hidden sm:block">
                    {step.label}
                  </span>
                </div>
                {idx < statusSteps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-0.5 ${step.status === "completed" ? "bg-green-500" : "bg-gray-200"}`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <StatusBadge status={myCandidate.status} type="candidate" />
            <StatusBadge status={myCandidate.gate_status} type="gate" />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="profile">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="profile">
            <User className="w-4 h-4 mr-2" /> Profile
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="w-4 h-4 mr-2" /> Documents
          </TabsTrigger>
          <TabsTrigger value="contract">
            <FileCheck className="w-4 h-4 mr-2" /> Contract
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 mr-2" /> Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoField
                label="Full Name"
                value={`${myCandidate.first_name} ${myCandidate.last_name}`}
              />
              <InfoField label="Email" value={myCandidate.email} />
              <InfoField label="Phone" value={myCandidate.phone} />
              <InfoField label="Date of Birth" value={myCandidate.dob || "N/A"} />
              <InfoField label="Country" value={myCandidate.country} />
              <InfoField label="Gender" value={myCandidate.gender || "N/A"} />
              <InfoField label="Qualification" value={myCandidate.highest_qualification || "N/A"} />
              <InfoField label="Program" value={myCandidate.program_name || "N/A"} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <h3 className="font-semibold">My Documents</h3>
          {myDocuments.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No documents on file yet.
              </CardContent>
            </Card>
          )}
          {myDocuments.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="font-medium capitalize">{doc.document_type.replace("_", " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.verified ? "Verified" : "Pending verification"}
                      {doc.expiry_date &&
                        ` · Expires: ${new Date(doc.expiry_date).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                {doc.verified ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <div className="text-xs text-yellow-600">Pending</div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="contract" className="space-y-4">
          {myContract ? (
            <Card>
              <CardHeader>
                <CardTitle>Contract</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted p-4 rounded-md">
                  <div className="mt-1 space-y-2 text-sm">
                    <p>
                      <strong>Candidate:</strong> {myCandidate.first_name} {myCandidate.last_name}
                    </p>
                    <p>
                      <strong>Employer:</strong> {myContract.employer_name ?? "To be confirmed"}
                    </p>
                    <p>
                      <strong>Status:</strong>{" "}
                      <StatusBadge status={myContract.status} type="contract" />
                    </p>
                    <p>
                      <strong>Created:</strong>{" "}
                      {new Date(myContract.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {myContract.status === "sent" && !signed && (
                  <>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="agree"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="agree" className="text-sm">
                        I have read and agree to the terms and conditions
                      </label>
                    </div>
                    <Button onClick={handleSign} className="w-full" disabled={signing}>
                      {signing ? "Signing…" : "Sign Contract"}
                    </Button>
                  </>
                )}

                {(signed || myContract.status === "signed") && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-4 text-center">
                    <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <p className="font-medium text-green-800">Contract Signed</p>
                    <p className="text-sm text-green-600">
                      Signed on{" "}
                      {myContract.signed_at
                        ? new Date(myContract.signed_at).toLocaleDateString()
                        : new Date().toLocaleDateString()}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No contract available yet
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="notifications" className="space-y-2">
          {events.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No activity yet.
              </CardContent>
            </Card>
          )}
          {events.map((ev) => (
            <Card key={ev.id}>
              <CardContent className="p-4 flex items-start gap-3">
                <Bell className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-sm capitalize">
                    {ev.event_type.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-muted-foreground">{ev.actor_name ?? "System"}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(ev.created_at).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
