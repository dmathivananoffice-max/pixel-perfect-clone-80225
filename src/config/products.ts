import {
  Globe, Stethoscope, GraduationCap, BookOpen, Award, Briefcase,
  type LucideIcon,
} from 'lucide-react';

export type ProductId = 'all' | 'nurses' | 'ausbildung' | 'pre_bachelor' | 'pre_masters' | 'mba';

export interface ProductConfig {
  id: ProductId;
  label: string;
  short: string;
  emoji: string;
  icon: LucideIcon;
  accent: string; // tailwind color class for badges
  widgets: string[];
  charts: string[];
  quickActions: string[];
}

export const PRODUCTS: ProductConfig[] = [
  {
    id: 'all',
    label: 'All Products',
    short: 'Executive',
    emoji: '🌍',
    icon: Globe,
    accent: 'text-slate-600 bg-slate-50',
    widgets: [
      'Total Candidates', 'Candidates by Product', 'Total Employers', 'Total Hospitals',
      'Total Universities', 'Active Recruitments', 'Active Visas',
      'Speaking Assessment Queue', 'STI Assessment Queue', 'Interview Queue',
      'Monthly Placements', 'Revenue Overview', 'AI Insights',
      'Recent Activities', 'Tasks Due Today',
    ],
    charts: [
      'Product-wise Candidate Distribution', 'Monthly Growth', 'Visa Pipeline',
      'Placement Funnel', 'Conversion Funnel', 'Revenue Trends',
    ],
    quickActions: ['Add Candidate', 'Add Employer', 'Add University', 'Create Campaign', 'Generate Reports'],
  },
  {
    id: 'nurses',
    label: 'Professional Nurses',
    short: 'Nurses',
    emoji: '🏥',
    icon: Stethoscope,
    accent: 'text-rose-600 bg-rose-50',
    widgets: [
      'Total Nurses', 'Language Progress', 'Recognition Status', 'Hospital Interviews',
      'Visa Status', 'Approbation Status', 'B2 Passed', 'Placements',
      'Recruiter Tasks', 'Pending Documents',
    ],
    charts: ['Language Progress Funnel', 'Recognition Pipeline', 'Placement Funnel'],
    quickActions: [
      'Add Nurse', 'Schedule Speaking Assessment', 'Schedule Interview',
      'Upload Documents', 'Start Recognition', 'Start Visa',
    ],
  },
  {
    id: 'ausbildung',
    label: 'Ausbildung',
    short: 'Ausbildung',
    emoji: '🎓',
    icon: GraduationCap,
    accent: 'text-indigo-600 bg-indigo-50',
    widgets: [
      'Total Candidates', 'Company Interviews', 'STI Pending', 'Speaking Assessment Pending',
      'Contracts Pending', 'Visa Status', 'Employer Matching', 'Placement Progress',
    ],
    charts: ['Interview Funnel', 'Contract Progress', 'Placement Trends'],
    quickActions: [
      'Add Candidate', 'Assign STI', 'Schedule Speaking Assessment',
      'Schedule Employer Interview', 'Generate Contract',
    ],
  },
  {
    id: 'pre_bachelor',
    label: 'Pre-Bachelor',
    short: 'Pre-Bachelor',
    emoji: '📚',
    icon: BookOpen,
    accent: 'text-emerald-600 bg-emerald-50',
    widgets: [
      'Students', 'APS Status', 'University Applications', 'Blocked Accounts',
      'Visa Status', 'Accommodation', 'Admissions', 'Pending Documents',
    ],
    charts: ['Application Funnel', 'Visa Pipeline', 'Admissions Trend'],
    quickActions: ['Add Student', 'Apply to University', 'Upload APS', 'Manage Visa'],
  },
  {
    id: 'pre_masters',
    label: 'Pre-Masters',
    short: 'Pre-Masters',
    emoji: '🎓',
    icon: Award,
    accent: 'text-violet-600 bg-violet-50',
    widgets: [
      'Students', 'SOP Progress', 'LOR Progress', 'University Applications',
      'Scholarships', 'Admissions', 'Visa Pipeline',
    ],
    charts: ['Application Funnel', 'Scholarship Wins', 'Admissions Trend'],
    quickActions: ['Add Student', 'Upload SOP', 'Track Universities', 'Apply for Scholarships'],
  },
  {
    id: 'mba',
    label: 'MBA',
    short: 'MBA',
    emoji: '💼',
    icon: Briefcase,
    accent: 'text-amber-600 bg-amber-50',
    widgets: [
      'Universities', 'Applications', 'Scholarships', 'GMAT Status',
      'Offers Received', 'Admissions', 'Visa Status',
    ],
    charts: ['Application Funnel', 'Offer Rate', 'Admissions Trend'],
    quickActions: ['Add Student', 'Apply to MBA', 'Manage Applications', 'Track Offers'],
  },
];

export const PRODUCT_MAP: Record<ProductId, ProductConfig> = PRODUCTS.reduce(
  (acc, p) => ({ ...acc, [p.id]: p }),
  {} as Record<ProductId, ProductConfig>,
);

export function getProduct(id: ProductId): ProductConfig {
  return PRODUCT_MAP[id] ?? PRODUCT_MAP.all;
}
