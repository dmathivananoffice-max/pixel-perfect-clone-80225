import { NavLink } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard, Users, Settings, FileText, BarChart3,
  ClipboardCheck, Briefcase, Building2, UserCircle, Mail,
  Sparkles, Shield, GraduationCap, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: string[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" />, roles: ['super_admin', 'managing_director', 'sales_executive', 'recruiter', 'documentation_officer', 'german_trainer'] },
  { label: 'Candidates', path: '/candidates', icon: <Users className="w-5 h-5" />, roles: ['super_admin', 'managing_director', 'recruiter', 'documentation_officer'] },
  { label: 'Candidate Intake', path: '/candidates/new', icon: <Sparkles className="w-5 h-5" />, roles: ['super_admin', 'managing_director', 'recruiter', 'documentation_officer'] },
  { label: 'Selection Engine', path: '/admin/scoring', icon: <Settings className="w-5 h-5" />, roles: ['super_admin'] },
  { label: 'Evaluation Center', path: '/sti', icon: <ClipboardCheck className="w-5 h-5" />, roles: ['german_trainer', 'recruiter', 'super_admin'] },
  { label: 'Recruiter Hub', path: '/recruiter', icon: <Briefcase className="w-5 h-5" />, roles: ['recruiter', 'super_admin'] },
  { label: 'Agency Portal', path: '/agency', icon: <Building2 className="w-5 h-5" />, roles: ['agency_partner'] },
  { label: 'Employer Portal', path: '/employer', icon: <Building2 className="w-5 h-5" />, roles: ['employer'] },
  { label: 'My Portal', path: '/candidate', icon: <UserCircle className="w-5 h-5" />, roles: ['candidate'] },
  { label: 'Email Center', path: '/emails', icon: <Mail className="w-5 h-5" />, roles: ['super_admin', 'recruiter', 'managing_director'] },
  { label: 'User Management', path: '/admin/users', icon: <Shield className="w-5 h-5" />, roles: ['super_admin', 'managing_director'] },
  { label: 'Reports', path: '/reports', icon: <BarChart3 className="w-5 h-5" />, roles: ['super_admin', 'managing_director', 'recruiter'] },
];

const footerNav: NavItem[] = [
  { label: 'Docs', path: '#', icon: <FileText className="w-5 h-5" />, roles: ['super_admin', 'managing_director', 'sales_executive', 'recruiter', 'documentation_officer', 'german_trainer', 'agency_partner', 'employer', 'candidate'] },
  { label: 'Settings', path: '#', icon: <Settings className="w-5 h-5" />, roles: ['super_admin', 'managing_director', 'sales_executive', 'recruiter', 'documentation_officer', 'german_trainer', 'agency_partner', 'employer', 'candidate'] },
];

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const { user } = useAuth();
  const userRole = user?.role || '';

  const filteredItems = navItems.filter((item) => item.roles.includes(userRole));

  return (
    <>
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-all duration-300 translate-x-0',
          isOpen ? 'w-64' : 'w-16'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border shrink-0">
          <div className={cn('flex items-center gap-2 overflow-hidden', !isOpen && 'hidden')}>{isOpen && (
            <>
              <GraduationCap className="w-7 h-7 text-sidebar-primary shrink-0" />
              <span className="font-bold text-lg whitespace-nowrap text-sidebar-primary-foreground">Workforce Europe</span>
            </>
          )}</div>
          <button
            onClick={onToggle}
            className="p-1 rounded-md hover:bg-sidebar-accent"
          >
            {isOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {filteredItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                  !isOpen && 'justify-center px-2'
                )
              }
              title={!isOpen ? item.label : undefined}
            >
              {item.icon}
              <span className={cn('whitespace-nowrap', !isOpen && 'hidden')}>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer Nav */}
        <div className="border-t border-sidebar-border py-2 px-3 space-y-1 shrink-0">
          {footerNav.map((item) => (
            <button
              key={item.label}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors w-full',
                !isOpen && 'justify-center px-2'
              )}
              title={!isOpen ? item.label : undefined}
              onClick={() => alert(`${item.label} - Coming soon`)}
            >
              {item.icon}
              <span className={cn('whitespace-nowrap', !isOpen && 'hidden')}>{item.label}</span>
            </button>
          ))}
        </div>
      </aside>
    </>
  );
}
