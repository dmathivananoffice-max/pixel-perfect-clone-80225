import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useUIStore } from '@/store/uiStore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bell, Search, Menu, LogOut, User, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function Navbar() {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const _sidebarOpen = useUIStore((s) => s.sidebarOpen);
  void _sidebarOpen;
  const navigate = useNavigate();

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'U';

  return (
    <header className="h-16 border-b bg-background flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-md hover:bg-accent lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden lg:flex items-center gap-2 text-muted-foreground text-sm">
          <span>Workforce Europe</span>
          <span>/</span>
          <span className="text-foreground font-medium capitalize">{user?.role?.replace('_', ' ') || 'Dashboard'}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="hidden md:flex items-center relative">
          <Search className="w-4 h-4 absolute left-3 text-muted-foreground" />
          <Input
            placeholder="Search candidates..."
            className="pl-9 w-64 h-9"
            onKeyDown={(e) => {
              if (e.key === 'Enter') navigate('/candidates');
            }}
          />
        </div>

        {/* Notifications */}
        <button
          className="relative p-2 rounded-md hover:bg-accent"
          onClick={() => navigate('/dashboard')}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 hover:bg-accent rounded-md px-2 py-1">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium leading-none">{user?.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role?.replace('_', ' ')}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => alert('Profile - Coming soon')}>
              <User className="w-4 h-4 mr-2" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => alert('Settings - Coming soon')}>
              <Settings className="w-4 h-4 mr-2" /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout}>
              <LogOut className="w-4 h-4 mr-2" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
