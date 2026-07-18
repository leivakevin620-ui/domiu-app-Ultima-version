'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/ui/page-container';
import { PageTitle } from '@/components/ui/page-title';
import { SkeletonList } from '@/components/ui/skeleton';
import { notificationService, type NotificationData } from '@/services/notifications';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `hace ${days}d`;
  return new Date(dateStr).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

export default function NotificacionesPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState('');
  const unreadCount = useMemo(() => notifications.filter((item) => !item.is_read).length, [notifications]);

  useEffect(() => {
    if (!profile?.id) return;
    notificationService
      .getNotifications(profile.id, 200)
      .then(setNotifications)
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las notificaciones'))
      .finally(() => setLoading(false));
  }, [profile?.id]);

  const handleClick = async (notification: NotificationData) => {
    if (!notification.is_read) {
      await notificationService.markAsRead(notification.id).catch(() => {});
      setNotifications((current) => current.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item)));
    }
    if (notification.action_url) router.push(notification.action_url);
    else if (notification.order_id) {
      if (profile?.role === 'merchant') router.push(`/negocio/pedidos?id=${notification.order_id}`);
      else if (profile?.role === 'customer') router.push(`/cliente/pedidos/${notification.order_id}`);
      else if (profile?.role === 'courier') router.push(`/repartidor/pedidos?id=${notification.order_id}`);
    }
  };

  const markAll = async () => {
    if (!profile?.id || unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    setError('');
    try {
      await notificationService.markAllAsRead(profile.id);
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true, read_at: item.read_at || readAt })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron marcar como leídas');
    } finally {
      setMarkingAll(false);
    }
  };

  if (loading) return <SkeletonList />;

  return (
    <PageContainer>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle title="Notificaciones" description={`${unreadCount} sin leer · historial de actividad`} />
        <button
          type="button"
          onClick={() => void markAll()}
          disabled={unreadCount === 0 || markingAll}
          className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2 text-sm font-bold shadow-sm transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {markingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
          Marcar todas como leídas
        </button>
      </div>

      {error && <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bell className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No hay notificaciones</p>
        </div>
      ) : (
        <div className="mt-5 space-y-2">
          {notifications.map((notification) => (
            <button
              key={notification.id}
              onClick={() => void handleClick(notification)}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted/50',
                !notification.is_read && 'border-primary/20 bg-primary/5',
              )}
            >
              <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-muted-foreground/20">
                {!notification.is_read && <div className="h-2 w-2 rounded-full bg-primary" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={cn('text-sm', !notification.is_read && 'font-semibold')}>{notification.title}</p>
                  <span className="shrink-0 text-[10px] text-muted-foreground/60">{timeAgo(notification.created_at)}</span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{notification.message}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
