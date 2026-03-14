import { NavLink, Outlet } from 'react-router-dom';
import { MessageSquare, FileText, Users, BarChart3, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';

const navItems = [
  { to: '/chat', label: 'Chat', desktopLabel: 'Chat', icon: MessageSquare, badge: 0 },
  { to: '/documents', label: 'Documents', desktopLabel: 'Documents', icon: FileText, badge: 0 },
  { to: '/clients', label: 'Clients', desktopLabel: 'Clients', icon: Users, badge: 0 },
  { to: '/stats', label: 'Stats', desktopLabel: 'Statistiques', icon: BarChart3, badge: 0 },
  { to: '/settings', label: 'Compte', desktopLabel: 'Compte', icon: Settings, badge: 0 },
];

export function AppLayout() {
  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
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
      </aside>

      {/* Main content */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col pt-safe-top md:pt-0">
        <div className="relative min-h-0 flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom: install prompt + tabs */}
      <div className="shrink-0 bg-card md:hidden">
        <PwaInstallPrompt />
        <nav className="flex border-t border-border">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 touch-manipulation flex-col items-center gap-0.5 pt-1.5 pb-0.5 text-[10px] font-medium transition-colors',
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
