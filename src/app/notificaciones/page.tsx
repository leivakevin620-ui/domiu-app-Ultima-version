'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/ui/page-container';
import { PageTitle } from '@/components/ui/page-title';
import { SkeletonList } from '@/components/ui/skeleton';
import { notificationService, type NotificationData } from '@/services/notifications';
import { Bell } from 'lucide-react';
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

  useEffect(() => {
    if (!profile?.id) return;
    notificationService
      .getNotifications(profile.id, 200)
      .then(setNotifications)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profile?.id]);

  const handleClick = async (n: NotificationData) => {
    if (!n.is_read) {
      await notificationService.markAsRead(n.id).catch(() => {});
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    }
    if (n.action_url) {
      router.push(n.action_url);
    } else if (n.order_id) {
      if (profile?.role === 'merchant') router.push(`/negocio/pedidos?id=${n.order_id}`);
      else if (profile?.role === 'customer') router.push(`/cliente/pedidos/${n.order_id}`);
      else if (profile?.role === 'courier') router.push(`/repartidor/pedidos?id=${n.order_id}`);
    }
  };

  if (loading) return <SkeletonList />;

  return (
    <PageContainer>
      <PageTitle title="Notificaciones" description="Historial de notificaciones" />

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bell className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No hay notificaciones</p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted/50',
                !n.is_read && 'border-primary/20 bg-primary/5',
              )}
            >
              <div className="mt-0.5">
                {!n.is_read && <div className="h-2 w-2 rounded-full bg-primary" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={cn('text-sm', !n.is_read && 'font-semibold')}>{n.title}</p>
                  <span className="shrink-0 text-[10px] text-muted-foreground/60">{timeAgo(n.created_at)}</span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
