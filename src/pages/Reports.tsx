import { useReports } from '@/hooks/useReports';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Users, UserCheck, UserX, Plane, Briefcase, Calendar, FileText,
  Download,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

export default function Reports() {
  const metrics = useReports();

  const funnelData = [
    { stage: 'Applied', count: metrics.totalCandidates, color: '#94a3b8' },
    { stage: 'Shortlisted', count: metrics.shortlisted, color: '#3b82f6' },
    { stage: 'Assessed', count: metrics.totalCandidates - metrics.pendingSTI, color: '#22c55e' },
    { stage: 'Interviewed', count: metrics.pendingInterviews + metrics.placed, color: '#8b5cf6' },
    { stage: 'Contracted', count: metrics.pendingContracts + metrics.placed, color: '#06b6d4' },
    { stage: 'Placed', count: metrics.placed, color: '#f97316' },
  ];

  const kpiCards = [
    { label: 'Total Candidates', value: metrics.totalCandidates, icon: <Users className="w-5 h-5" />, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Shortlisted', value: metrics.shortlisted, icon: <UserCheck className="w-5 h-5" />, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Rejected', value: metrics.rejected, icon: <UserX className="w-5 h-5" />, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'In Visa', value: metrics.inVisa, icon: <Plane className="w-5 h-5" />, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Placed', value: metrics.placed, icon: <Briefcase className="w-5 h-5" />, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Pending Interviews', value: metrics.pendingInterviews, icon: <Calendar className="w-5 h-5" />, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  ];

  const exportCSV = () => {
    // Simple CSV export
    const headers = ['ID', 'Name', 'Program', 'Status', 'Score', 'Country'];
    // Would need actual candidate data here
    const csv = [headers.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'candidates-report.csv';
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">Analytics, metrics, and exports</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-2" /> CSV
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <FileText className="w-4 h-4 mr-2" /> PDF
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiCards.map((kpi) => (
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

      {/* Funnel Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Candidate Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {funnelData.map((stage) => {
              const maxCount = funnelData[0].count;
              const width = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
              return (
                <div key={stage.stage} className="flex items-center gap-3">
                  <span className="text-sm w-24 text-right">{stage.stage}</span>
                  <div className="flex-1 h-8 bg-gray-100 rounded-md overflow-hidden relative">
                    <div
                      className="h-full rounded-md transition-all flex items-center justify-end pr-2"
                      style={{ width: `${Math.max(width, 5)}%`, backgroundColor: stage.color }}
                    >
                      <span className="text-white text-xs font-bold">{stage.count}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Candidates by Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={metrics.candidatesByStatus}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="count"
                  nameKey="status"
                  label
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
          <CardHeader><CardTitle className="text-base">Monthly Placements</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={metrics.monthlyPlacements}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="count" fill="#3b82f6" stroke="#3b82f6" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Program Performance</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={metrics.topPrograms} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="program" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Conversion Rates</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Applied to Shortlisted', rate: metrics.totalCandidates > 0 ? (metrics.shortlisted / metrics.totalCandidates) * 100 : 0 },
              { label: 'Shortlisted to Placed', rate: metrics.shortlisted > 0 ? (metrics.placed / metrics.shortlisted) * 100 : 0 },
              { label: 'Overall Conversion', rate: metrics.totalCandidates > 0 ? (metrics.placed / metrics.totalCandidates) * 100 : 0 },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{item.label}</span>
                  <span className="font-medium">{item.rate.toFixed(1)}%</span>
                </div>
                <Progress value={item.rate} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
