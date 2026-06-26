'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Bike } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCourier } from '@/contexts/CourierContext';
import { SkeletonCard } from '@/components/ui/skeleton';
import { PremiumHeroCard } from '@/components/courier/profile/PremiumHeroCard';
import { OperationalStatusCard } from '@/components/courier/profile/OperationalStatusCard';
import { ActiveMissionCard } from '@/components/courier/profile/ActiveMissionCard';
import { SmartEarningsCard } from '@/components/courier/profile/SmartEarningsCard';
import { ProScoreCard } from '@/components/courier/profile/ProScoreCard';
import { ReputationCard } from '@/components/courier/profile/ReputationCard';
import { VehicleProCard } from '@/components/courier/profile/VehicleProCard';
import { DocumentsProCard } from '@/components/courier/profile/DocumentsProCard';
import { ShieldCard } from '@/components/courier/profile/ShieldCard';
import { CopilotCard } from '@/components/courier/profile/CopilotCard';
import { ShiftChecklistCard } from '@/components/courier/profile/ShiftChecklistCard';
import { ActionGrid } from '@/components/courier/profile/ActionGrid';

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
    <div className="relative min-h-screen bg-[#0B1120]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.06),transparent_50%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.04),transparent_50%)]" />

      <div className="relative mx-auto max-w-7xl space-y-4 px-4 pb-28 pt-4 sm:px-6 lg:px-8">
        <div className="mb-2 flex items-center gap-2">
          <Bike className="h-5 w-5 text-blue-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-blue-400">Perfil DomiU Pro</h2>
          <span className="ml-auto rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
            Conectado
          </span>
        </div>

        <PremiumHeroCard />

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <OperationalStatusCard />
            <ActiveMissionCard />
            <SmartEarningsCard />
            <div className="grid gap-4 sm:grid-cols-2">
              <ProScoreCard />
              <ReputationCard />
            </div>
          </div>
          <div className="space-y-4">
            <VehicleProCard />
            <DocumentsProCard />
            <CopilotCard />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ShieldCard />
          <div className="space-y-4">
            <ShiftChecklistCard />
            <ActionGrid />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
          className="flex items-center justify-center gap-2 pt-4"
        >
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/20">
            DomiU 1.5 · Perfil Profesional
          </span>
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </motion.div>
      </div>
    </div>
  );
}

export default function RepartidorPerfilPage() {
  return <PerfilContent />;
}
