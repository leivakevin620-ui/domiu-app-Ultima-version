'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Star, XCircle, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { orderService } from '@/services/orders';
import { fallbackRecentDeliveries, getDeliveryStatusColor, getDeliveryStatusLabel } from '@/lib/mock/courier-profile';
import { getRelativeTime } from './shared';

interface RecentDelivery {
  id: string;
  orderNumber: string;
  businessName: string;
  status: string;
  deliveredAt: string;
}

export function CourierRecentDeliveries() {
  const { profile } = useAuth();
  const [deliveries, setDeliveries] = React.useState<RecentDelivery[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      if (!profile?.id) return;
      try {
        const orders = await orderService.getCourierOrders(profile.id);
        const recent = (orders || [])
          .filter(o => o.status === 'delivered' || o.status === 'cancelled')
          .slice(0, 5)
          .map(o => ({
            id: o.id,
            orderNumber: o.order_number,
            businessName: o.business_name,
            status: o.status,
            deliveredAt: o.updated_at,
            amount: 0,
            rating: 0,
          }));
        if (recent.length > 0) {
          setDeliveries(recent);
        } else {
          setDeliveries(fallbackRecentDeliveries());
        }
      } catch {
        setDeliveries(fallbackRecentDeliveries());
      }
      setLoading(false);
    })();
  }, [profile?.id]);

  if (loading) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="rounded-xl border border-white/70 bg-white/80 p-4 shadow-[0_8px_25px_rgba(15,23,42,0.06)] backdrop-blur"
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Historial</p>
          <h3 className="text-base font-black text-slate-900">Entregas recientes</h3>
        </div>
        <span className="text-[10px] font-semibold text-slate-400">{deliveries.length} entregas</span>
      </div>

      <div className="space-y-1.5">
        {deliveries.map((delivery) => (
          <div key={delivery.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 transition hover:bg-slate-100/50">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                {delivery.status === 'delivered' ? (
                  <Star className="h-4 w-4 text-amber-400" fill={delivery.rating >= 4 ? '#F59E0B' : 'none'} />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900 truncate">{delivery.businessName}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ${getDeliveryStatusColor(delivery.status)}`}>
                    {getDeliveryStatusLabel(delivery.status)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span>{delivery.orderNumber}</span>
                  <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{getRelativeTime(delivery.deliveredAt)}</span>
                </div>
              </div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          </div>
        ))}
      </div>
    </motion.section>
  );
}
