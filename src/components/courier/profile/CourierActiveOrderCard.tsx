'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Package, Navigation, MessageCircle, ChevronRight, Building, User, Clock, CreditCard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCourier } from '@/contexts/CourierContext';
import { courierProService, type ActiveOrderDetail } from '@/services/courier-pro';
import { fallbackActiveOrder, getDeliveryStatusLabel, getDeliveryStatusColor } from '@/lib/mock/courier-profile';
import { formatCurrency } from './shared';

export function CourierActiveOrderCard() {
  const { profile } = useAuth();
  const { activeDeliveries } = useCourier();
  const [order, setOrder] = React.useState<ActiveOrderDetail | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      if (!profile?.id) return;
      try {
        const detail = await courierProService.getActiveOrderDetail(profile.id);
        if (detail) {
          setOrder(detail);
        } else if (activeDeliveries.length > 0) {
          setOrder(fallbackActiveOrder());
        } else {
          setOrder(null);
        }
      } catch {
        setOrder(activeDeliveries.length > 0 ? fallbackActiveOrder() : null);
      }
      setLoading(false);
    })();
  }, [profile?.id, activeDeliveries]);

  if (loading) return null;
  if (!order) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-white shadow-[0_8px_30px_rgba(37,99,235,0.12)]"
    >
      <div className="px-4 pt-4 pb-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow">
              <Package className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Pedido activo</p>
              <p className="text-sm font-black text-slate-900">{order.orderNumber}</p>
            </div>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${getDeliveryStatusColor(order.status)}`}>
            {getDeliveryStatusLabel(order.status)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/80 border border-blue-50 p-2.5">
            <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">
              <Building className="h-3 w-3" />
              Negocio
            </div>
            <p className="text-xs font-bold text-slate-900 truncate">{order.businessName}</p>
            <p className="text-[10px] text-slate-500 truncate">{order.businessAddress}</p>
          </div>
          <div className="rounded-xl bg-white/80 border border-blue-50 p-2.5">
            <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">
              <User className="h-3 w-3" />
              Cliente
            </div>
            <p className="text-xs font-bold text-slate-900 truncate">{order.customerName}</p>
            <p className="text-[10px] text-slate-500 truncate">{order.deliveryAddress}</p>
          </div>
          <div className="rounded-xl bg-white/80 border border-blue-50 p-2.5">
            <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">
              <Clock className="h-3 w-3" />
              Tiempo estimado
            </div>
            <p className="text-xs font-bold text-slate-900">{order.estimatedTime > 0 ? `${order.estimatedTime} min` : '—'}</p>
            {order.distance > 0 && <p className="text-[10px] text-slate-500">{order.distance.toFixed(1)} km</p>}
          </div>
          <div className="rounded-xl bg-white/80 border border-blue-50 p-2.5">
            <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">
              <CreditCard className="h-3 w-3" />
              Ganancia estimada
            </div>
            <p className="text-xs font-bold text-emerald-600">{formatCurrency(order.commission)}</p>
            {order.tip > 0 && <p className="text-[10px] text-amber-500">+ {formatCurrency(order.tip)} propina</p>}
          </div>
        </div>

        {order.items.length > 0 && (
          <div className="mt-2 rounded-xl bg-white/80 border border-blue-50 p-2.5">
            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500 mb-1">Productos</p>
            <div className="space-y-0.5">
              {order.items.slice(0, 3).map((item, i) => (
                <div key={i} className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-700"><span className="font-bold text-slate-900">{item.quantity}x</span> {item.name}</span>
                  <span className="font-semibold text-slate-600">${Math.round(item.price * item.quantity).toLocaleString('es-CO')}</span>
                </div>
              ))}
              {order.items.length > 3 && (
                <p className="text-[10px] font-semibold text-slate-400">+{order.items.length - 3} más</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 border-t border-blue-100">
        <a href="/repartidor/mapa" className="flex items-center justify-center gap-1.5 py-3 text-xs font-bold text-blue-600 transition hover:bg-blue-50">
          <Navigation className="h-3.5 w-3.5" />
          Navegar
        </a>
        <button className="flex items-center justify-center gap-1.5 py-3 text-xs font-bold text-violet-600 transition hover:bg-violet-50" aria-label="Abrir chat">
          <MessageCircle className="h-3.5 w-3.5" />
          Chat
        </button>
        <a href="/repartidor/pedidos" className="flex items-center justify-center gap-1.5 py-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50">
          <ChevronRight className="h-3.5 w-3.5" />
          Detalles
        </a>
      </div>
    </motion.section>
  );
}
