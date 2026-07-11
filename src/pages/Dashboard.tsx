import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReports } from '@/hooks/useReports';
import { useAuth } from '@/hooks/useAuth';
import { useProductStore } from '@/store/productStore';
import { useEngineKpis, type ProgramKey } from '@/store/selectionEngineStore';
import { getProduct, PRODUCTS, type ProductConfig, type ProductId } from '@/config/products';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ProductSelector } from '@/components/dashboard/ProductSelector';
import { WidgetCard } from '@/components/dashboard/WidgetCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { mockCandidates } from '@/lib/mockData';
import { cn } from '@/lib/utils';


import {
  Users, UserCheck, UserX, Plane, Briefcase, Calendar, FileText,
  ClipboardCheck, TrendingUp, ArrowRight, Building2, GraduationCap,
  Stethoscope, Award, BookOpen, Globe, DollarSign, Sparkles, Activity,
  ListChecks, Mic, MessageSquare, Home, ScrollText, FileSignature,
  Trophy, Target, LucideIcon,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

/** Heuristic: infer product from a candidate's program name. */
function inferProduct(programName?: string): ProductId {
  const p = (programName || '').toLowerCase();
  if (p.includes('nurse') || p.includes('nursing') || p.includes('pflege')) return 'nurses';
  if (p.includes('ausbildung')) return 'ausbildung';
  if (p.includes('bachelor') || p.includes('studienkolleg')) return 'pre_bachelor';
  if (p.includes('master')) return 'pre_masters';
  if (p.includes('mba')) return 'mba';
  return 'ausbildung';
}

function useProductMetrics(productId: ProductId) {
  return useMemo(() => {
    const list = productId === 'all'
      ? mockCandidates
      : mockCandidates.filter((c) => inferProduct(c.program_name) === productId);

    const byStatus = (status: string) => list.filter((c) => c.status === status).length;
    return {
      total: list.length,
      shortlisted: byStatus('shortlisted'),
      placed: byStatus('placed'),
      visa: byStatus('visa'),
      contract: byStatus('contract'),
      interviews: byStatus('interview1') + byStatus('interview2'),
      rejected: byStatus('rejected'),
      waiting: byStatus('waiting'),
    };
  }, [productId]);
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const selectedProductId = useProductStore((s) => s.selectedProductId);
  const product = getProduct(selectedProductId);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'managing_director';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{product.emoji}</span>
            <span className="uppercase tracking-wide">{product.short} Dashboard</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {product.id === 'all' ? 'Executive Overview' : `${product.label}`}
          </h1>
          <p className="text-sm text-muted-foreground">Welcome back, {user?.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ProductSelector />
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

      {product.id === 'all' && <ExecutiveDashboard product={product} />}
      {product.id === 'nurses' && <NursesDashboard product={product} />}
      {product.id === 'ausbildung' && <AusbildungDashboard product={product} />}
      {product.id === 'pre_bachelor' && <PreBachelorDashboard product={product} />}
      {product.id === 'pre_masters' && <PreMastersDashboard product={product} />}
      {product.id === 'mba' && <MbaDashboard product={product} />}
    </div>
  );
}

/* ---------- Executive (All Products) ---------- */

function ExecutiveDashboard({ product }: { product: ProductConfig }) {
  const metrics = useReports();
  const navigate = useNavigate();

  const productDistribution = useMemo(() => {
    const buckets = new Map<ProductId, number>();
    mockCandidates.forEach((c) => {
      const pid = inferProduct(c.program_name);
      buckets.set(pid, (buckets.get(pid) ?? 0) + 1);
    });
    return PRODUCTS.filter((p) => p.id !== 'all').map((p) => ({
      name: p.short,
      value: buckets.get(p.id) ?? 0,
    }));
  }, []);

  const widgets: Array<{ label: string; value: string | number; icon: LucideIcon; accent: string }> = [
    { label: 'Total Candidates', value: metrics.totalCandidates, icon: Users, accent: 'text-blue-600 bg-blue-50' },
    { label: 'Active Recruitments', value: metrics.shortlisted + metrics.pendingInterviews, icon: Activity, accent: 'text-indigo-600 bg-indigo-50' },
    { label: 'Total Employers', value: 12, icon: Building2, accent: 'text-cyan-600 bg-cyan-50' },
    { label: 'Total Hospitals', value: 8, icon: Stethoscope, accent: 'text-rose-600 bg-rose-50' },
    { label: 'Total Universities', value: 15, icon: GraduationCap, accent: 'text-violet-600 bg-violet-50' },
    { label: 'Active Visas', value: metrics.inVisa, icon: Plane, accent: 'text-orange-600 bg-orange-50' },
    { label: 'Speaking Queue', value: metrics.pendingSTI, icon: Mic, accent: 'text-purple-600 bg-purple-50' },
    { label: 'STI Queue', value: metrics.pendingSTI, icon: ClipboardCheck, accent: 'text-yellow-600 bg-yellow-50' },
    { label: 'Interview Queue', value: metrics.pendingInterviews, icon: Calendar, accent: 'text-pink-600 bg-pink-50' },
    { label: 'Monthly Placements', value: metrics.placed, icon: Briefcase, accent: 'text-green-600 bg-green-50' },
    { label: 'Revenue (MTD)', value: '€128k', icon: DollarSign, accent: 'text-emerald-600 bg-emerald-50' },
    { label: 'Tasks Due Today', value: 7, icon: ListChecks, accent: 'text-slate-600 bg-slate-50' },
  ];

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {widgets.map((w) => (
          <WidgetCard key={w.label} label={w.label} value={w.value} icon={w.icon} accent={w.accent} />
        ))}
      </div>

      <QuickActions actions={product.quickActions} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Product-wise Candidate Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={productDistribution} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value" nameKey="name" label>
                  {productDistribution.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Monthly Growth</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={metrics.monthlyPlacements}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Placement Funnel</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={metrics.candidatesByStatus}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> AI Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
              <p className="font-medium">Nurses pipeline healthy</p>
              <p className="text-muted-foreground text-xs">B2 pass rate up 12% vs. last month.</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
              <p className="font-medium">Ausbildung: 4 contracts stuck</p>
              <p className="text-muted-foreground text-xs">Consider following up with employer HR.</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
              <p className="font-medium">Revenue forecast: +18%</p>
              <p className="text-muted-foreground text-xs">Driven by MBA and Pre-Masters cohorts.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Activities</CardTitle>
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
                  by {activity.actor} · {new Date(activity.timestamp).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

/* ---------- Nurses ---------- */

function NursesDashboard({ product }: { product: ProductConfig }) {
  const m = useProductMetrics('nurses');
  const widgets = [
    { label: 'Total Nurses', value: m.total, icon: Stethoscope, accent: 'text-rose-600 bg-rose-50' },
    { label: 'Language Progress', value: `${Math.round((m.shortlisted / Math.max(m.total, 1)) * 100)}%`, icon: MessageSquare, accent: 'text-blue-600 bg-blue-50' },
    { label: 'Recognition Status', value: m.contract, icon: FileText, accent: 'text-indigo-600 bg-indigo-50' },
    { label: 'Hospital Interviews', value: m.interviews, icon: Calendar, accent: 'text-purple-600 bg-purple-50' },
    { label: 'Visa Status', value: m.visa, icon: Plane, accent: 'text-orange-600 bg-orange-50' },
    { label: 'Approbation', value: m.contract, icon: Award, accent: 'text-violet-600 bg-violet-50' },
    { label: 'B2 Passed', value: m.shortlisted, icon: Trophy, accent: 'text-emerald-600 bg-emerald-50' },
    { label: 'Placements', value: m.placed, icon: Briefcase, accent: 'text-green-600 bg-green-50' },
    { label: 'Recruiter Tasks', value: 5, icon: ListChecks, accent: 'text-slate-600 bg-slate-50' },
    { label: 'Pending Documents', value: m.waiting, icon: FileText, accent: 'text-yellow-600 bg-yellow-50' },
  ];
  return <ProductBody widgets={widgets} product={product} />;
}

/* ---------- Ausbildung ---------- */

function AusbildungDashboard({ product }: { product: ProductConfig }) {
  const m = useProductMetrics('ausbildung');
  const widgets = [
    { label: 'Total Candidates', value: m.total, icon: Users, accent: 'text-blue-600 bg-blue-50' },
    { label: 'Company Interviews', value: m.interviews, icon: Calendar, accent: 'text-purple-600 bg-purple-50' },
    { label: 'STI Pending', value: m.waiting, icon: ClipboardCheck, accent: 'text-yellow-600 bg-yellow-50' },
    { label: 'Speaking Pending', value: Math.max(m.waiting - 1, 0), icon: Mic, accent: 'text-pink-600 bg-pink-50' },
    { label: 'Contracts Pending', value: m.contract, icon: FileSignature, accent: 'text-cyan-600 bg-cyan-50' },
    { label: 'Visa Status', value: m.visa, icon: Plane, accent: 'text-orange-600 bg-orange-50' },
    { label: 'Employer Matching', value: m.shortlisted, icon: Target, accent: 'text-indigo-600 bg-indigo-50' },
    { label: 'Placements', value: m.placed, icon: Briefcase, accent: 'text-green-600 bg-green-50' },
  ];
  return <ProductBody widgets={widgets} product={product} />;
}

/* ---------- Pre-Bachelor ---------- */

function PreBachelorDashboard({ product }: { product: ProductConfig }) {
  const m = useProductMetrics('pre_bachelor');
  const widgets = [
    { label: 'Students', value: m.total, icon: BookOpen, accent: 'text-emerald-600 bg-emerald-50' },
    { label: 'APS Status', value: m.shortlisted, icon: UserCheck, accent: 'text-blue-600 bg-blue-50' },
    { label: 'University Apps', value: m.interviews, icon: GraduationCap, accent: 'text-violet-600 bg-violet-50' },
    { label: 'Blocked Accounts', value: m.contract, icon: DollarSign, accent: 'text-amber-600 bg-amber-50' },
    { label: 'Visa Status', value: m.visa, icon: Plane, accent: 'text-orange-600 bg-orange-50' },
    { label: 'Accommodation', value: 3, icon: Home, accent: 'text-cyan-600 bg-cyan-50' },
    { label: 'Admissions', value: m.placed, icon: Award, accent: 'text-green-600 bg-green-50' },
    { label: 'Pending Documents', value: m.waiting, icon: FileText, accent: 'text-yellow-600 bg-yellow-50' },
  ];
  return <ProductBody widgets={widgets} product={product} />;
}

/* ---------- Pre-Masters ---------- */

function PreMastersDashboard({ product }: { product: ProductConfig }) {
  const m = useProductMetrics('pre_masters');
  const widgets = [
    { label: 'Students', value: m.total, icon: GraduationCap, accent: 'text-violet-600 bg-violet-50' },
    { label: 'SOP Progress', value: `${m.shortlisted}/${m.total}`, icon: ScrollText, accent: 'text-blue-600 bg-blue-50' },
    { label: 'LOR Progress', value: `${m.shortlisted}/${m.total}`, icon: FileText, accent: 'text-indigo-600 bg-indigo-50' },
    { label: 'University Apps', value: m.interviews, icon: BookOpen, accent: 'text-emerald-600 bg-emerald-50' },
    { label: 'Scholarships', value: 4, icon: Trophy, accent: 'text-amber-600 bg-amber-50' },
    { label: 'Admissions', value: m.placed, icon: Award, accent: 'text-green-600 bg-green-50' },
    { label: 'Visa Pipeline', value: m.visa, icon: Plane, accent: 'text-orange-600 bg-orange-50' },
  ];
  return <ProductBody widgets={widgets} product={product} />;
}

/* ---------- MBA ---------- */

function MbaDashboard({ product }: { product: ProductConfig }) {
  const m = useProductMetrics('mba');
  const widgets = [
    { label: 'Universities', value: 22, icon: Globe, accent: 'text-blue-600 bg-blue-50' },
    { label: 'Applications', value: m.interviews, icon: FileText, accent: 'text-indigo-600 bg-indigo-50' },
    { label: 'Scholarships', value: 6, icon: Trophy, accent: 'text-amber-600 bg-amber-50' },
    { label: 'GMAT Status', value: `${m.shortlisted} ready`, icon: Target, accent: 'text-purple-600 bg-purple-50' },
    { label: 'Offers Received', value: m.contract, icon: Award, accent: 'text-emerald-600 bg-emerald-50' },
    { label: 'Admissions', value: m.placed, icon: Briefcase, accent: 'text-green-600 bg-green-50' },
    { label: 'Visa Status', value: m.visa, icon: Plane, accent: 'text-orange-600 bg-orange-50' },
  ];
  return <ProductBody widgets={widgets} product={product} />;
}

/* ---------- Shared body ---------- */

interface Widget { label: string; value: string | number; icon: LucideIcon; accent: string }

function ProductBody({ widgets, product }: { widgets: Widget[]; product: ProductConfig }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {widgets.map((w) => (
          <WidgetCard key={w.label} label={w.label} value={w.value} icon={w.icon} accent={w.accent} />
        ))}
      </div>

      <QuickActions actions={product.quickActions} />

      <Card>
        <CardHeader><CardTitle className="text-base">Charts</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {product.charts.map((c) => (
            <div key={c} className="p-4 rounded-lg border bg-muted/30 text-sm text-muted-foreground">
              {c}
              <p className="text-xs mt-1 opacity-70">Chart coming soon</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
