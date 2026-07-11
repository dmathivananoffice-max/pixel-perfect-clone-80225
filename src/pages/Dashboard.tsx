import { useNavigate } from 'react-router-dom';
import { useReports } from '@/hooks/useReports';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import {
  Users, UserCheck, UserX, Plane, Briefcase, Calendar, FileText,
  ClipboardCheck, TrendingUp, ArrowRight,
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#94a3b8', '#3b82f6', '#ef4444', '#a855f7', '#6366f1', '#06b6d4', '#f97316', '#22c55e', '#6b7280'];

export default function Dashboard() {
  const metrics = useReports();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'managing_director';

  const kpiCards = [
    { label: 'Total Candidates', value: metrics.totalCandidates, icon: <Users className="w-5 h-5" />, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Shortlisted', value: metrics.shortlisted, icon: <UserCheck className="w-5 h-5" />, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Rejected', value: metrics.rejected, icon: <UserX className="w-5 h-5" />, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'In Visa', value: metrics.inVisa, icon: <Plane className="w-5 h-5" />, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Placed', value: metrics.placed, icon: <Briefcase className="w-5 h-5" />, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Pending Interviews', value: metrics.pendingInterviews, icon: <Calendar className="w-5 h-5" />, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Pending Contracts', value: metrics.pendingContracts, icon: <FileText className="w-5 h-5" />, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { label: 'Pending STI', value: metrics.pendingSTI, icon: <ClipboardCheck className="w-5 h-5" />, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Welcome back, {user?.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/candidates')}>
            View Candidates
          </Button>
          {isAdmin && (
            <Button size="sm" onClick={() => navigate('/reports')}>
              <TrendingUp className="w-4 h-4 mr-2" /> Reports
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.slice(0, isAdmin ? 8 : 4).map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${kpi.bg} ${kpi.color}`}>
                  {kpi.icon}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Candidates by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={metrics.candidatesByStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="count"
                  nameKey="status"
                >
                  {metrics.candidatesByStatus.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Placements</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={metrics.monthlyPlacements}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Programs & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Programs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.topPrograms.map((prog) => (
              <div key={prog.program} className="flex items-center justify-between">
                <span className="text-sm">{prog.program}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(prog.count / metrics.totalCandidates) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-6 text-right">{prog.count}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/candidates')}>
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="truncate">{activity.description}</p>
                  <p className="text-xs text-muted-foreground">
                    by {activity.actor} &middot; {new Date(activity.timestamp).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
