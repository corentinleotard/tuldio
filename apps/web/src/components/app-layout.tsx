import { NavLink, Outlet } from 'react-router-dom';
import { MessageSquare, FileText, Users, BarChart3, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { Avatar } from '@/components/ui/avatar';
import { PwaInstallPrompt, usePwaBanner } from '@/components/pwa-install-prompt';

const navItems = [
  { to: '/chat', label: 'Chat', desktopLabel: 'Chat', icon: MessageSquare, badge: 0 },
  { to: '/documents', label: 'Documents', desktopLabel: 'Documents', icon: FileText, badge: 0 },
  { to: '/clients', label: 'Clients', desktopLabel: 'Clients', icon: Users, badge: 0 },
  { to: '/stats', label: 'Stats', desktopLabel: 'Statistiques', icon: BarChart3, badge: 0 },
];

export function AppLayout() {
  const { user } = useAuth();
  const pwaBannerVisible = usePwaBanner();

  return (
    <div className="flex h-dvh">
      {/* Desktop sidebar */}
      <aside className="hidden w-72 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex items-center border-b px-5 pb-4 pt-5">
          <span className="text-[22px] font-bold tracking-tight text-primary">Tuldio</span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-2.5 py-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 font-semibold text-primary'
                    : 'font-medium text-muted-foreground hover:bg-secondary hover:text-foreground',
                )
              }
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.desktopLabel}
            </NavLink>
          ))}
        </nav>
        {user && (
          <div className="flex items-center justify-between border-t px-6 py-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={user.name} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </div>
            <NavLink
              to="/settings"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Settings className="h-[18px] w-[18px]" />
            </NavLink>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex min-w-0 flex-1 flex-col pt-safe-top md:pt-0">
        <div className={cn('flex-1 overflow-auto md:pb-0', pwaBannerVisible ? 'pb-[calc(104px+env(safe-area-inset-bottom))]' : 'pb-[calc(4rem+env(safe-area-inset-bottom))]')}>
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom: install prompt + tabs */}
      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        <PwaInstallPrompt />
        <nav className="flex border-t border-border bg-card pb-safe">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center gap-[3px] pt-2 pb-1 text-[10px] font-medium transition-colors',
                  isActive
                    ? 'font-semibold text-primary'
                    : 'text-muted-foreground',
                )
              }
            >
              <div className="relative">
                <item.icon className="h-6 w-6" />
                {item.badge > 0 && (
                  <span className="absolute -right-2 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">
                    {item.badge}
                  </span>
                )}
              </div>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
