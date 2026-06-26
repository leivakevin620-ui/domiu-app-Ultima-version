'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, CheckCheck, Package, MessageSquare, Info, AlertTriangle, Zap, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
  metadata?: Record<string, unknown>;
}

const iconMap: Record<string, React.ElementType> = {
  order_placed: Package, order_confirmed: Package, order_preparing: Package,
  order_ready: Package, order_in_transit: Package, order_delivered: Package,
  order_assigned: Package, driver_assigned: Package, courier_nearby: Zap,
  new_message: MessageSquare, payment_received: Zap, promotion: Info,
  system_alert: AlertTriangle, rate_request: Info, review_reminder: Info,
  manual_order_created: Package, order_cancelled: AlertTriangle,
};

const iconColors: Record<string, string> = {
  order_placed: 'bg-blue-100 text-blue-600', order_delivered: 'bg-emerald-100 text-emerald-600',
  new_message: 'bg-violet-100 text-violet-600', system_alert: 'bg-red-100 text-red-600',
  driver_assigned: 'bg-amber-100 text-amber-600', payment_received: 'bg-green-100 text-green-600',
};

function getTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `Hace ${days}d`;
}

export default function NotificacionesPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadNotifications = () => {
    (async () => {
      try {
        const { getMyNotificationsAction } = await import('@/app/actions/notifications');
        const result = await getMyNotificationsAction(50);
        if (result.success) {
          setNotifications(result.data as NotificationItem[]);
        } else {
          setError(result.error || 'Error al cargar');
        }
      } catch {
        setError('Error de conexión');
      }
      setLoading(false);
    })();
  };

  useEffect(() => { loadNotifications(); }, []);

  const markRead = async (id: string) => {
    try {
      const { markNotificationReadAction } = await import('@/app/actions/notifications');
      await markNotificationReadAction(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch { /* ignore */ }
  };

  const markAllRead = async () => {
    try {
      const { markAllNotificationsReadAction } = await import('@/app/actions/notifications');
      await markAllNotificationsReadAction();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch { /* ignore */ }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-5 animate-fade-in pb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-600/10">
            <Bell className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Notificaciones</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todas leídas'}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead}
            className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Leer todas
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse rounded-2xl border border-border/50 bg-card/50 p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-3/4 rounded bg-muted" />
                  <div className="h-2 w-1/2 rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive/50" />
          <p className="mt-3 text-sm text-destructive">{error}</p>
          <button onClick={loadNotifications}
            className="mt-4 text-sm font-medium text-info hover:underline"
          >Reintentar</button>
        </div>
      ) : notifications.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-12 text-center shadow-card"
        >
          <Bell className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-4 text-lg font-semibold text-foreground">No tienes notificaciones</p>
          <p className="mt-1 text-sm text-muted-foreground">Las notificaciones aparecerán aquí cuando tengas actividad.</p>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const Icon = iconMap[notif.notification_type] || Bell;
            const color = iconColors[notif.notification_type] || 'bg-muted text-muted-foreground';
            return (
              <div key={notif.id}
                className={`group flex items-start gap-3 rounded-2xl border p-4 transition-all hover:shadow-sm ${
                  notif.is_read
                    ? 'border-border/50 bg-card/30'
                    : 'border-info/20 bg-info/5'
                }`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold ${notif.is_read ? 'text-foreground' : 'text-foreground'}`}>
                      {notif.title}
                    </p>
                    {!notif.is_read && <span className="h-2 w-2 rounded-full bg-info shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-muted-foreground">{getTimeAgo(notif.created_at)}</span>
                    {(notif.metadata as Record<string, string>)?.order_id && (
                      <Link href={`/repartidor/pedidos`}
                        className="text-[10px] font-medium text-info hover:underline inline-flex items-center gap-0.5"
                      >
                        Ver pedido <ChevronRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
                {!notif.is_read && (
                  <button onClick={() => markRead(notif.id)}
                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
                    aria-label="Marcar como leída"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
