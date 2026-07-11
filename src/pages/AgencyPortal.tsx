import { useAuth } from '@/hooks/useAuth';
import { mockCandidates, mockAgencies } from '@/lib/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Users, UserCheck, UserX, TrendingUp, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AgencyPortal() {
  const { user } = useAuth();
  const agency = mockAgencies.find((a) => a.contact_email === user?.email);
  const agencyCandidates = mockCandidates.filter((c) => c.source_agency_id === agency?.id);

  const total = agencyCandidates.length;
  const selected = agencyCandidates.filter((c) => c.status === 'placed' || c.status === 'contract' || c.status === 'visa').length;
  const rejected = agencyCandidates.filter((c) => c.status === 'rejected' || c.status === 'withdrawn').length;
  const inProgress = agencyCandidates.filter((c) => !['placed', 'rejected', 'withdrawn'].includes(c.status)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agency Portal</h1>
          <p className="text-sm text-muted-foreground">{agency?.agency_name} &middot; {agency?.country}</p>
        </div>
        <Button onClick={() => toast.success('Add candidate form - coming soon')}>
          <Plus className="w-4 h-4 mr-2" /> Add Candidate
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Submitted</p>
                <p className="text-2xl font-bold">{total}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 text-blue-600"><Users className="w-5 h-5" /></div>
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
              <div className="p-3 rounded-lg bg-green-50 text-green-600"><UserCheck className="w-5 h-5" /></div>
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
              <div className="p-3 rounded-lg bg-red-50 text-red-600"><UserX className="w-5 h-5" /></div>
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
              <div className="p-3 rounded-lg bg-yellow-50 text-yellow-600"><TrendingUp className="w-5 h-5" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>My Candidates</CardTitle></CardHeader>
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
                {agencyCandidates.map((c) => (
                  <TableRow key={c.candidate_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{c.first_name} {c.last_name}</p>
                        <p className="text-xs text-muted-foreground">{c.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{c.program_name}</TableCell>
                    <TableCell><StatusBadge status={c.status} type="candidate" /></TableCell>
                    <TableCell>{c.total_score?.toFixed(1) || 'N/A'}</TableCell>
                    <TableCell><StatusBadge status={c.gate_status} type="gate" /></TableCell>
                    <TableCell>{new Date(c.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
                {agencyCandidates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No candidates submitted yet</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Conversion Rate */}
      <Card>
        <CardHeader><CardTitle className="text-base">Conversion Rate</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Success Rate</span>
              <span className="font-medium">{total > 0 ? ((selected / total) * 100).toFixed(1) : 0}%</span>
            </div>
            <Progress value={total > 0 ? (selected / total) * 100 : 0} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
