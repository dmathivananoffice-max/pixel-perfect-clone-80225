import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Candidate } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Users, UserCheck, UserX, TrendingUp } from "lucide-react";

interface AgencyRow {
  id: string;
  name: string;
  country: string;
  contact_email: string | null;
}

export default function AgencyPortal() {
  const { user } = useAuth();
  const [agency, setAgency] = useState<AgencyRow | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // The agency user's email identifies their agency record.
      const { data: agencyRows } = await supabase
        .from("agencies")
        .select("id, name, country, contact_email")
        .eq("contact_email", user?.email ?? "")
        .limit(1);
      const agencyRow = (agencyRows ?? [])[0] as AgencyRow | undefined;
      if (cancelled) return;
      setAgency(agencyRow ?? null);

      if (agencyRow) {
        const { data: cands } = await supabase
          .from("candidates")
          .select("*")
          .eq("source_agency_id", agencyRow.id)
          .order("created_at", { ascending: false });
        if (!cancelled) setCandidates((cands ?? []) as unknown as Candidate[]);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  const total = candidates.length;
  const selected = candidates.filter((c) =>
    ["placed", "contract", "visa"].includes(c.status),
  ).length;
  const rejected = candidates.filter((c) => ["rejected", "withdrawn"].includes(c.status)).length;
  const inProgress = candidates.filter(
    (c) => !["placed", "rejected", "withdrawn"].includes(c.status),
  ).length;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
          Loading agency data…
        </div>
      </div>
    );
  }

  if (!agency) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold tracking-tight">No agency linked</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account ({user?.email}) is not linked to an agency record. Please contact Workforce
            Europe to set up your agency profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agency Portal</h1>
          <p className="text-sm text-muted-foreground">
            {agency.name} &middot; {agency.country}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Submitted</p>
                <p className="text-2xl font-bold">{total}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Selected/Placed</p>
                <p className="text-2xl font-bold">{selected}</p>
              </div>
              <div className="p-3 rounded-lg bg-green-50 text-green-600">
                <UserCheck className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold">{rejected}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-50 text-red-600">
                <UserX className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">{inProgress}</p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-50 text-yellow-600">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Candidates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Gate</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((c) => (
                  <TableRow key={c.candidate_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {c.first_name} {c.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">{c.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{c.program_name}</TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} type="candidate" />
                    </TableCell>
                    <TableCell>{c.total_score?.toFixed(1) || "N/A"}</TableCell>
                    <TableCell>
                      <StatusBadge status={c.gate_status} type="gate" />
                    </TableCell>
                    <TableCell>{new Date(c.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
                {candidates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No candidates submitted yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversion Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Success Rate</span>
              <span className="font-medium">
                {total > 0 ? ((selected / total) * 100).toFixed(1) : 0}%
              </span>
            </div>
            <Progress value={total > 0 ? (selected / total) * 100 : 0} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
