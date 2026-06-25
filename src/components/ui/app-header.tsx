'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { LogOut, User } from 'lucide-react';
import { NotificationBell } from '@/components/notifications/NotificationBell';

interface AppHeaderProps {
  title?: string;
  className?: string;
}

export function AppHeader({ title, className }: AppHeaderProps) {
  const { user, profile, logout } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const initials = profile
    ? `${profile.first_name?.charAt(0) ?? ''}${profile.last_name?.charAt(0) ?? ''}`
    : 'U';

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {title && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              D
            </div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <NotificationBell />

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
          >
            {initials}
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-card p-2 shadow-dropdown animate-scale-in">
                <div className="border-b border-border px-3 py-2">
                  <p className="text-sm font-medium text-foreground">
                    {profile?.first_name} {profile?.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <button onClick={() => { setMenuOpen(false); router.push('/cliente/configuracion'); }} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  <User className="h-4 w-4" />
                  Perfil
                </button>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
