'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Bell, Package, Zap, AlertTriangle, MessageSquare, Info, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { notificationService, type NotificationData } from '@/services/notifications';
import { fallbackNotifications } from '@/lib/mock/courier-profile';
import { getRelativeTime } from './shared';
import { toast } from 'sonner';

const notificationIcons: Record<string, React.ElementType> = {
  assignment: Package,
  incentive: Zap,
  system: AlertTriangle,
  message: MessageSquare,
  info: Info,
};

const iconColors: Record<string, string> = {
  assignment: 'bg-blue-50 text-blue-600',
  incentive: 'bg-amber-50 text-amber-600',
  system: 'bg-red-50 text-red-600',
  message: 'bg-violet-50 text-violet-600',
  info: 'bg-slate-50 text-slate-600',
};

export function CourierNotificationsCard() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = React.useState<NotificationData[]>([]);

  React.useEffect(() => {
    (async () => {
      if (!profile?.id) return;
      try {
        const notifs = await notificationService.getNotifications(profile.id, 4);
        setNotifications(notifs);
      } catch {
        setNotifications(fallbackNotifications(profile.id));
      }
    })();
  }, [profile?.id]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
      className="rounded-xl border border-white/70 bg-white/80 p-4 shadow-[0_8px_25px_rgba(15,23,42,0.06)] backdrop-blur"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-slate-500" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Notificaciones</p>
            <h3 className="text-base font-black text-slate-900">Alertas recientes</h3>
          </div>
        </div>
        {unreadCount > 0 && (
          <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">{unreadCount}</span>
        )}
      </div>

      <div className="space-y-1.5">
        {notifications.slice(0, 3).map((notif) => {
          const Icon = notificationIcons[notif.notification_type] || Bell;
          const color = iconColors[notif.notification_type] || iconColors.info;
          return (
            <div key={notif.id} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition hover:bg-slate-50/50 ${notif.is_read ? 'border-slate-100 bg-slate-50/30' : 'border-blue-100 bg-blue-50/30'}`}>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className={`text-xs font-bold truncate ${notif.is_read ? 'text-slate-700' : 'text-slate-900'}`}>{notif.title}</p>
                  {!notif.is_read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />}
                </div>
                <p className="text-[10px] text-slate-500 line-clamp-1">{notif.message}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">{getRelativeTime(notif.created_at)}</p>
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={() => toast.info('Función en preparación: centro de notificaciones')} className="w-full mt-3 flex items-center justify-center gap-1 rounded-xl bg-slate-50 py-2.5 text-[11px] font-bold text-slate-600 transition hover:bg-slate-100">
        Ver todas <ChevronRight className="h-3 w-3" />
      </button>
    </motion.section>
  );
}
