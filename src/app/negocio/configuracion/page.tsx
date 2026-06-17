'use client';

import React from 'react';
import { PageContainer } from '@/components/ui/page-container';
import { PageTitle } from '@/components/ui/page-title';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { Store, Clock, CreditCard, Truck } from 'lucide-react';

export default function NegocioConfiguracion() {
  return (
    <PageContainer>
      <PageTitle title="Configuración" description="Administra la configuración de tu negocio" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardCard title="Información del Negocio">
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Store className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Configura los datos de tu negocio</p>
          </div>
        </DashboardCard>

        <DashboardCard title="Horarios">
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Clock className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Define tus horarios de atención</p>
          </div>
        </DashboardCard>

        <DashboardCard title="Métodos de Pago">
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CreditCard className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Configura tus métodos de pago</p>
          </div>
        </DashboardCard>

        <DashboardCard title="Zonas de Reparto">
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Truck className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Define tus zonas de cobertura</p>
          </div>
        </DashboardCard>
      </div>
    </PageContainer>
  );
}
