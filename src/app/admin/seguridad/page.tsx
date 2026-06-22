'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { permissionsService } from '@/services/permissions';
import { adminAuthService } from '@/services/admin-auth';
import { useRouter } from 'next/navigation';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Shield, Smartphone, Monitor, Globe, LogOut, AlertTriangle, History } from 'lucide-react';
import type { AdminSession } from '@/types/admin';
import { ADMIN_ROLES } from '@/types/auth';

export default function AdminSeguridad() {
  const { profile, isLoading } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!profile || !ADMIN_ROLES.includes(profile.role)) { router.push('/login'); return; }
    if (!permissionsService.hasPermission(profile.admin_role, 'security.read', profile.email)) {
      router.push('/admin');
      return;
    }
  }, [profile, isLoading, router]);

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      setLoading(true);
      try {
        const data = await adminAuthService.getSessions(profile.id);
        setSessions(data);
      } catch { /* ok */ }
      setLoading(false);
    })();
  }, [profile?.id]);

  const handleTerminate = async (sessionId: string) => {
    setTerminatingId(sessionId);
    try {
      await adminAuthService.terminateSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setAlert({ type: 'success', msg: 'Sesión cerrada remotamente' });
    } catch {
      setAlert({ type: 'error', msg: 'Error al cerrar sesión' });
    }
    setTerminatingId(null);
  };

  if (isLoading) return <SkeletonCard />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Seguridad</h1>
            <p className="mt-1 text-sm text-muted-foreground">Gestiona tus sesiones y dispositivos conectados</p>
          </div>
        </div>
      </div>

      {alert && (
        <div className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm ${alert.type === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
          <AlertTriangle className="h-4 w-4" />
          <span>{alert.msg}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <div className="border-b border-border/50 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Sesiones Activas</h3>
            </div>
          </div>
          <div className="divide-y divide-border/30">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4">
                  <div className="space-y-2">
                    <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                  </div>
                  <div className="h-8 w-20 animate-pulse rounded-xl bg-muted" />
                </div>
              ))
            ) : sessions.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Sin sesiones activas</div>
            ) : (
              sessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-4 transition-colors hover:bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${session.is_current ? 'bg-success/10' : 'bg-muted/30'}`}>
                      {session.device === 'Mobile' ? <Smartphone className={`h-4 w-4 ${session.is_current ? 'text-success' : 'text-muted-foreground'}`} />
                        : <Monitor className={`h-4 w-4 ${session.is_current ? 'text-success' : 'text-muted-foreground'}`} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{session.browser || 'Desconocido'} · {session.os || '—'}</span>
                        {session.is_current && (
                          <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">Actual</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {session.device || '—'} · {session.location_city ? `${session.location_city}, ` : ''}{session.location_country || '—'}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60">
                        Última actividad: {new Date(session.last_active_at).toLocaleString('es-CO')}
                      </p>
                    </div>
                  </div>
                  {!session.is_current && (
                    <button
                      onClick={() => handleTerminate(session.id)}
                      disabled={terminatingId === session.id}
                      className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      {terminatingId === session.id ? '...' : 'Cerrar'}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <div className="border-b border-border/50 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Información del Dispositivo</h3>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-border/50 p-3">
                <p className="text-[11px] font-medium text-muted-foreground">Navegador</p>
                <p className="mt-1 text-sm font-medium text-foreground">{navigator.userAgent.includes('Chrome') ? 'Chrome' : navigator.userAgent.includes('Firefox') ? 'Firefox' : navigator.userAgent.includes('Safari') ? 'Safari' : 'Otro'}</p>
              </div>
              <div className="rounded-xl border border-border/50 p-3">
                <p className="text-[11px] font-medium text-muted-foreground">Sistema Operativo</p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {navigator.userAgent.includes('Windows') ? 'Windows' : navigator.userAgent.includes('Mac') ? 'macOS' : navigator.userAgent.includes('Linux') ? 'Linux' : 'Otro'}
                </p>
              </div>
              <div className="rounded-xl border border-border/50 p-3">
                <p className="text-[11px] font-medium text-muted-foreground">Dispositivo</p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {navigator.userAgent.includes('Mobile') ? 'Móvil' : navigator.userAgent.includes('Tablet') ? 'Tablet' : 'Escritorio'}
                </p>
              </div>
              <div className="rounded-xl border border-border/50 p-3">
                <p className="text-[11px] font-medium text-muted-foreground">Idioma</p>
                <p className="mt-1 text-sm font-medium text-foreground">{navigator.language || '—'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
        <div className="border-b border-border/50 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent px-5 py-3.5">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Historial de Acceso Reciente</h3>
          </div>
        </div>
        <div className="p-5">
          <p className="text-sm text-muted-foreground">Próximamente: registro detallado de inicios de sesión con IP, ubicación y dispositivo.</p>
        </div>
      </div>
    </div>
  );
}
