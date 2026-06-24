'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Bike } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { CourierProvider, useCourier } from '@/contexts/CourierContext';
import { SkeletonCard } from '@/components/ui/skeleton';
import { CourierProfileHeader } from '@/components/courier/profile/CourierProfileHeader';
import { CourierStatsCards } from '@/components/courier/profile/CourierStatsCards';
import { CourierActiveOrderCard } from '@/components/courier/profile/CourierActiveOrderCard';
import { CourierVehicleCard } from '@/components/courier/profile/CourierVehicleCard';
import { CourierDocumentsCard } from '@/components/courier/profile/CourierDocumentsCard';
import { CourierAvailabilityCard } from '@/components/courier/profile/CourierAvailabilityCard';
import { CourierCoverageCard } from '@/components/courier/profile/CourierCoverageCard';
import { CourierWeeklyStats } from '@/components/courier/profile/CourierWeeklyStats';
import { CourierRecentDeliveries } from '@/components/courier/profile/CourierRecentDeliveries';
import { CourierLiveLocationCard } from '@/components/courier/profile/CourierLiveLocationCard';
import { CourierWalletCard } from '@/components/courier/profile/CourierWalletCard';
import { CourierNotificationsCard } from '@/components/courier/profile/CourierNotificationsCard';
import { CourierChatPreview } from '@/components/courier/profile/CourierChatPreview';

function PerfilContent() {
  const { profile } = useAuth();
  const { loading } = useCourier();

  if (loading && !profile) {
    return (
      <div className="space-y-4 p-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#F8FAFC]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.08),transparent_50%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.06),transparent_50%)]" />

      <div className="relative mx-auto max-w-7xl space-y-4 px-4 pb-28 pt-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 mb-1">
          <Bike className="h-5 w-5 text-blue-600" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-blue-600">Perfil profesional</h2>
          <span className="ml-auto rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 animate-pulse">
            Conectado al sistema
          </span>
        </div>

        <CourierProfileHeader />

        <CourierActiveOrderCard />

        <CourierStatsCards />

        <div id="courier-vehicle-section" className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <CourierVehicleCard />
            <CourierDocumentsCard />
            <CourierAvailabilityCard />
            <CourierCoverageCard />
            <CourierNotificationsCard />
          </div>
          <div className="space-y-4">
            <CourierWalletCard />
            <CourierWeeklyStats />
            <CourierLiveLocationCard />
            <CourierRecentDeliveries />
            <CourierChatPreview />
          </div>
        </div>

        <motion.a
          href="/repartidor/pedidos"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
          className="sticky bottom-24 z-10 mx-auto mt-6 flex max-w-md items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-sm font-black text-white shadow-[0_14px_35px_rgba(37,99,235,0.35)] transition hover:from-blue-700 hover:to-blue-800 hover:shadow-[0_18px_40px_rgba(37,99,235,0.45)]"
          aria-label="Ir a pedidos activos"
        >
          <Bike className="h-5 w-5" />
          Ir a pedidos activos
          <ArrowRight className="h-5 w-5" />
        </motion.a>
      </div>
    </div>
  );
}

export default function RepartidorPerfilPage() {
  const { profile } = useAuth();
  return (
    <CourierProvider courierId={profile?.id}>
      <PerfilContent />
    </CourierProvider>
  );
}
