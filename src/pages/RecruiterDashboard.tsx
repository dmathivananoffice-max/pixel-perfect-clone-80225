import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useReports } from '@/hooks/useReports';
import { mockCandidates, mockSTISpeaking } from '@/lib/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';

import {
  ClipboardList, Calendar, UserCheck, AlertCircle, ArrowRight, Clock,
} from 'lucide-react';

export default function RecruiterDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const _metrics = useReports();
  void _metrics;

  const myCandidates = mockCandidates.filter((c) => c.assigned_recruiter_id === user?.id);
  const candidatesNeedingAction = myCandidates.filter(
    (c) => c.status === 'waiting' || c.status === 'interview1'
  );
  const pendingSTI = myCandidates.filter(
    (c) => c.status === 'shortlisted' && !mockSTISpeaking.find((s) => s.candidate_id === c.candidate_id)
  );
  const upcomingInterviews = mockCandidates
    .filter((c) => c.status === 'interview1' || c.status === 'interview2')
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recruiter Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your pipeline and pending actions</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">My Candidates</p>
                <p className="text-2xl font-bold">{myCandidates.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 text-blue-600"><ClipboardList className="w-5 h-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Need Action</p>
                <p className="text-2xl font-bold">{candidatesNeedingAction.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-50 text-yellow-600"><AlertCircle className="w-5 h-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending STI</p>
                <p className="text-2xl font-bold">{pendingSTI.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-orange-50 text-orange-600"><Clock className="w-5 h-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Upcoming Interviews</p>
                <p className="text-2xl font-bold">{upcomingInterviews.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-purple-50 text-purple-600"><Calendar className="w-5 h-5" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Candidates Needing Action</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/candidates')}>
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {candidatesNeedingAction.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No pending actions</p>
            ) : (
              candidatesNeedingAction.map((c) => (
                <div key={c.candidate_id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => navigate(`/candidates/${c.candidate_id}`)}>
                  <div className="flex items-center gap-3">
                    <UserCheck className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{c.first_name} {c.last_name}</p>
                      <p className="text-xs text-muted-foreground">{c.program_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={c.status} type="candidate" />
                    {c.total_score && <span className="text-xs text-muted-foreground">{c.total_score.toFixed(1)}</span>}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Pending STI Assessments</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/sti')}>
              Go to STI <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingSTI.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No pending STI assessments</p>
            ) : (
              pendingSTI.map((c) => (
                <div key={c.candidate_id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => navigate(`/sti/${c.candidate_id}`)}>
                  <div>
                    <p className="font-medium text-sm">{c.first_name} {c.last_name}</p>
                    <p className="text-xs text-muted-foreground">{c.program_name} &middot; Needs speaking assessment</p>
                  </div>
                  <Button size="sm" variant="outline">Assess</Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">My Pipeline Overview</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {['waiting', 'shortlisted', 'interview1', 'interview2', 'contract', 'visa', 'placed'].map((status) => {
              const count = myCandidates.filter((c) => c.status === status).length;
              const total = myCandidates.length;
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className="text-sm w-24 capitalize">{status.replace('interview', 'Interview ')}</span>
                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm font-medium w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
