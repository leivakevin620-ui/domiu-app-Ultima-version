'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bike, Package, MapPin, CheckCircle2, Circle, Phone, Navigation, Camera } from 'lucide-react';
import { useCourier } from '@/contexts/CourierContext';
import { getRelativeTime } from './shared';
import { buildNavigationUrl } from '@/lib/maps/navigation-url';

const MISSION_STEPS = [
  { key: 'assigned', label: 'Asignado', icon: CheckCircle2 },
  { key: 'picked_up', label: 'Recogido', icon: Package },
  { key: 'in_transit', label: 'En tránsito', icon: Bike },
  { key: 'delivered', label: 'Entregado', icon: MapPin },
] as const;

const STATUS_ORDER: Record<string, number> = {
  assigned: 0,
  accepted: 0,
  picked_up: 1,
  in_transit: 2,
  delivered: 3,
};

export function ActiveMissionCard() {
  const { activeDeliveries, refresh } = useCourier();
  const [showProofModal, setShowProofModal] = useState(false);
  const [proofPhoto, setProofPhoto] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const order = activeDeliveries[0];
  const currentIndex = order ? (STATUS_ORDER[order.status] ?? -1) : -1;
  const progress = order ? ((currentIndex + 1) / MISSION_STEPS.length) * 100 : 0;

  if (!order) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
        className="rounded-2xl border border-white/10 bg-[#1E293B]/80 p-5 shadow-lg backdrop-blur-xl"
      >
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
            <Package className="h-7 w-7 text-white/30" />
          </div>
          <p className="text-lg font-black text-white">Sin misión activa</p>
          <p className="mt-1 text-sm text-white/50">Espera nuevas asignaciones</p>
        </div>
      </motion.section>
    );
  }

  const handleOpenMaps = () => {
    const url = buildNavigationUrl({
      destination: { address: order.delivery_address },
    });
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleProofUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        setProofPhoto(reader.result as string);
        setShowProofModal(true);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleConfirmDelivery = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const { markOrderDeliveredAction } = await import('@/app/actions/courier-orders');
      const result = await markOrderDeliveredAction(order.id);
      if (result.success) {
        await refresh();
        setShowProofModal(false);
        setProofPhoto(null);
      }
    } catch (e) {
      console.error('Error al confirmar entrega:', e);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
      className="rounded-2xl border border-white/10 bg-[#1E293B]/80 p-5 shadow-lg backdrop-blur-xl"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
            <Package className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Misión activa</p>
            <p className="text-sm font-black text-white">{order.order_number}</p>
          </div>
        </div>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/70 backdrop-blur">
          {getRelativeTime(order.updated_at)}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/5 bg-white/5 p-2.5 backdrop-blur">
          <p className="text-[9px] font-bold uppercase tracking-wide text-white/40">Negocio</p>
          <p className="text-xs font-bold text-white truncate">{order.business_name}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/5 p-2.5 backdrop-blur">
          <p className="text-[9px] font-bold uppercase tracking-wide text-white/40">Cliente</p>
          <p className="text-xs font-bold text-white truncate">{order.customer_name}</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between text-[10px] font-semibold text-white/50 mb-2">
          <span>Progreso del pedido</span>
          <span>{currentIndex + 1}/{MISSION_STEPS.length}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
          />
        </div>
      </div>

      <div className="space-y-1">
        {MISSION_STEPS.map((step, i) => {
          const isCompleted = i <= currentIndex;
          const isCurrent = i === currentIndex;

          return (
            <div key={step.key} className="flex items-center gap-3">
              {isCompleted ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
              ) : isCurrent ? (
                <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                  <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400/40" />
                  <Circle className="h-5 w-5 text-emerald-400" />
                </div>
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-white/20" />
              )}
              <span className={`text-sm font-semibold ${
                isCompleted ? 'text-white' : isCurrent ? 'text-emerald-300' : 'text-white/30'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={() => window.open(`tel:${order.customer_phone || ''}`)}
          disabled={!order.customer_phone}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-white/5 bg-white/5 py-2.5 text-xs font-bold text-white backdrop-blur transition hover:bg-white/10 disabled:opacity-30"
        >
          <Phone className="h-3.5 w-3.5" />
          Cliente
        </button>
        <button
          onClick={handleOpenMaps}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow transition hover:bg-blue-700"
        >
          <Navigation className="h-3.5 w-3.5" />
          Navegar
        </button>
      </div>

      {order.status !== 'delivered' && (
        <button
          onClick={handleProofUpload}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-xs font-bold text-emerald-300 backdrop-blur transition hover:bg-emerald-500/20"
        >
          <Camera className="h-3.5 w-3.5" />
          Confirmar entrega con foto
        </button>
      )}

      <AnimatePresence>
        {showProofModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowProofModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="mx-4 w-full max-w-sm rounded-2xl border border-white/10 bg-[#0F172A] p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-3 text-lg font-bold text-white">Confirmar entrega</h3>
              {proofPhoto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={proofPhoto} alt="Foto de entrega" className="mb-3 w-full rounded-xl object-cover" />
              )}
              <p className="mb-4 text-sm text-white/60">¿Estás seguro de que deseas marcar este pedido como entregado?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowProofModal(false)}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDelivery}
                  disabled={actionLoading}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white shadow transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Confirmando...' : 'Confirmar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
