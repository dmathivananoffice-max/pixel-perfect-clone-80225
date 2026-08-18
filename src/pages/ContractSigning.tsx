import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Candidate, Contract } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FileText, CheckCircle, Pen } from "lucide-react";
import toast from "react-hot-toast";

export default function ContractSigning() {
  const { id } = useParams<{ id: string }>();
  const [contract, setContract] = useState<Contract | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);

  const [agreed, setAgreed] = useState(false);
  const [signed, setSigned] = useState(false);
  const [signature, setSignature] = useState("");
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const { data: contractRow } = await supabase
        .from("contracts")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      const c = (contractRow ?? null) as unknown as Contract | null;
      setContract(c);
      if (c) {
        const { data: candRow } = await supabase
          .from("candidates")
          .select("*")
          .eq("candidate_id", c.candidate_id)
          .maybeSingle();
        if (!cancelled) setCandidate((candRow ?? null) as unknown as Candidate | null);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSign = async () => {
    if (!agreed) {
      toast.error("Please read and agree to the terms");
      return;
    }
    if (!signature.trim()) {
      toast.error("Please type your name as a signature");
      return;
    }
    if (!contract) return;
    setSigning(true);
    try {
      const signedAt = new Date().toISOString();
      const { error } = await supabase
        .from("contracts")
        .update({
          status: "signed",
          signed_at: signedAt,
          metadata: { signed_by_name: signature.trim() },
        })
        .eq("id", contract.id);
      if (error) throw new Error(error.message);

      await supabase.from("audit_events").insert({
        entity_type: "contract",
        entity_id: contract.id,
        event_type: "contract_signed",
        actor_name: signature.trim(),
        new_value: { status: "signed", signed_at: signedAt },
      });

      setSigned(true);
      setContract({ ...contract, status: "signed", signed_at: signedAt });
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
          Loading contract…
        </div>
      </div>
    );
  }

  if (!contract || !candidate) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Contract not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Contract Signing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {contract.employer_name ?? "Employment Contract"}
        </p>
      </div>

      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-3">
            <FileText className="w-8 h-8 text-primary" />
          </div>
          <CardTitle>Employment Agreement</CardTitle>
          <StatusBadge status={contract.status} type="contract" />
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Contract Preview */}
          <div className="bg-muted/50 rounded-lg p-6 space-y-4 border">
            <div className="text-center border-b pb-4">
              <h3 className="font-bold text-lg">WORKFORCE EUROPE</h3>
              <p className="text-sm text-muted-foreground">Recruitment Intelligence Platform</p>
            </div>

            <div className="space-y-3 text-sm">
              <p>
                <strong>Candidate:</strong> {candidate.first_name} {candidate.last_name}
              </p>
              <p>
                <strong>Email:</strong> {candidate.email}
              </p>
              <p>
                <strong>Program:</strong> {candidate.program_name}
              </p>
              <p>
                <strong>Employer:</strong> {contract.employer_name ?? "To be confirmed"}
              </p>
              <p>
                <strong>Date:</strong> {new Date(contract.created_at).toLocaleDateString()}
              </p>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">Terms and Conditions</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This agreement outlines the terms of employment between the candidate and the
                employer through Workforce Europe. By signing this contract, you agree to abide by
                all terms including work duration, compensation, accommodation arrangements, and
                training requirements. All parties acknowledge that Workforce Europe acts solely as
                a recruitment facilitator and is not the direct employer.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                The candidate agrees to complete all required training programs, maintain valid work
                authorization documents, and adhere to the employer's code of conduct. Either party
                may terminate this agreement with 30 days written notice.
              </p>
            </div>
          </div>

          {!signed && contract.status === "sent" && (
            <>
              <div className="flex items-start gap-3 p-4 border rounded-lg">
                <Checkbox
                  id="agree"
                  checked={agreed}
                  onCheckedChange={(v) => setAgreed(v === true)}
                  className="mt-0.5"
                />
                <div>
                  <Label htmlFor="agree" className="font-medium cursor-pointer">
                    I have read and agree to the terms and conditions
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    By checking this box, you confirm that you have read, understood, and agree to
                    be bound by all terms and conditions outlined in this contract.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Digital Signature</Label>
                <p className="text-xs text-muted-foreground">
                  Type your full name below as your digital signature
                </p>
                <input
                  type="text"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder={`${candidate.first_name} ${candidate.last_name}`}
                  className="w-full h-16 text-2xl font-serif border-2 border-dashed border-gray-300 rounded-lg text-center focus:border-primary focus:outline-none italic"
                />
              </div>

              <Button onClick={handleSign} className="w-full" size="lg" disabled={signing}>
                <Pen className="w-4 h-4 mr-2" /> {signing ? "Signing…" : "Sign Contract"}
              </Button>
            </>
          )}

          {(signed || contract.status === "signed") && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center space-y-3">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
              <h3 className="text-lg font-bold text-green-800">Contract Signed</h3>
              <p className="text-sm text-green-600">
                {contract.signed_at
                  ? `Signed on ${new Date(contract.signed_at).toLocaleDateString()}`
                  : "Signed successfully"}
              </p>
            </div>
          )}

          {!signed && contract.status === "draft" && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
              <p className="text-sm text-amber-800">
                This contract is still in draft. It will become signable once it is sent to you.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
