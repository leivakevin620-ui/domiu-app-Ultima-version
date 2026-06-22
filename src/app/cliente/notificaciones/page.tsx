'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { clientService, NotificationItem } from '@/services/client';
import { motion, AnimatePresence } from 'framer-motion';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { Bell, CheckCheck, Package, Star, Percent, Truck, MessageCircle, Wallet, Gift, Info } from 'lucide-react';

const TYPE_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  order_confirmed: { icon: Package, color: 'text-blue-500 bg-blue-50' },
  order_preparing: { icon: Package, color: 'text-purple-500 bg-purple-50' },
  order_ready: { icon: Package, color: 'text-emerald-500 bg-emerald-50' },
  order_in_transit: { icon: Truck, color: 'text-amber-500 bg-amber-50' },
  order_delivered: { icon: Package, color: 'text-green-500 bg-green-50' },
  order_cancelled: { icon: Package, color: 'text-red-500 bg-red-50' },
  payment_success: { icon: Wallet, color: 'text-emerald-500 bg-emerald-50' },
  payment_failed: { icon: Wallet, color: 'text-red-500 bg-red-50' },
  new_message: { icon: MessageCircle, color: 'text-cyan-500 bg-cyan-50' },
  promotion: { icon: Percent, color: 'text-rose-500 bg-rose-50' },
  review_request: { icon: Star, color: 'text-yellow-500 bg-yellow-50' },
  loyalty_points: { icon: Gift, color: 'text-amber-500 bg-amber-50' },
};

export default function NotificacionesPage() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    clientService.getNotifications(profile.id).then(data => {
      setNotifications(data);
      setLoading(false);
    });
  }, [profile?.id]);

  const handleMarkRead = async (id: string) => {
    await clientService.markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleMarkAllRead = async () => {
    if (!profile?.id) return;
    await clientService.markAllNotificationsRead(profile.id);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-background pb-16 lg:pb-0">
      <div className="sticky top-0 z-30 bg-background/70 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-foreground">Notificaciones</h1>
            {unreadCount > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} className="flex items-center gap-1 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              <CheckCheck className="h-3.5 w-3.5" /> Leer todo
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 lg:px-8">
        {loading ? (
          <SkeletonList />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-6 w-6" />}
            title="Sin notificaciones"
            description="Te avisaremos cuando haya novedades en tus pedidos."
          />
        ) : (
          <AnimatePresence>
            {notifications.map((n, i) => {
              const config = TYPE_CONFIG[n.notification_type] ?? { icon: Info, color: 'text-muted-foreground bg-muted' };
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => !n.is_read && handleMarkRead(n.id)}
                  className={`relative flex items-start gap-3 rounded-2xl border p-4 transition-all cursor-pointer ${
                    n.is_read
                      ? 'border-border/20 bg-card/30'
                      : 'border-primary/10 bg-gradient-to-r from-primary/[0.03] to-transparent'
                  }`}
                >
                  {!n.is_read && (
                    <span className="absolute right-3 top-3 flex h-2 w-2 rounded-full bg-primary" />
                  )}
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.color}`}>
                    <config.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${n.is_read ? 'text-foreground' : 'font-semibold text-foreground'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    {n.description && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5">{n.description}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/50 mt-1.5">
                      {new Date(n.created_at).toLocaleDateString('es-MX', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
