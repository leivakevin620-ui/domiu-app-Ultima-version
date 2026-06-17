'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CourierProvider, useCourier } from '@/contexts/CourierContext';
import { PageContainer } from '@/components/ui/page-container';
import { PageTitle } from '@/components/ui/page-title';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { DriverStatsCard } from '@/components/delivery/DriverStatsCard';
import { DollarSign, TrendingUp, Calendar, Wallet, Clock } from 'lucide-react';

function GananciasContent() {
  const { earnings, todayEarnings, weekEarnings, monthEarnings, totalEarnings } = useCourier();

  return (
    <PageContainer>
      <PageTitle title="Ganancias" description="Historial de ingresos" />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <DriverStatsCard label="Hoy" value={`$${todayEarnings.toFixed(2)}`} />
        <DriverStatsCard label="Esta Semana" value={`$${weekEarnings.toFixed(2)}`} />
        <DriverStatsCard label="Este Mes" value={`$${monthEarnings.toFixed(2)}`} />
        <DriverStatsCard label="Total" value={`$${totalEarnings.toFixed(2)}`} />
      </div>

      <DashboardCard title="Transacciones Recientes">
        {earnings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <DollarSign className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No hay transacciones aún</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Completa entregas para ver tus ganancias
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {earnings.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{e.business_name}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(e.date).toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' · '}#{e.order_number}
                  </p>
                </div>
                <span className="text-sm font-semibold text-success">+${e.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </DashboardCard>
    </PageContainer>
  );
}

export default function RepartidorGanancias() {
  const { profile } = useAuth();
  return (
    <CourierProvider courierId={profile?.id ?? 'courier-1'}>
      <GananciasContent />
    </CourierProvider>
  );
}
