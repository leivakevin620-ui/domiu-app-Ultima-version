'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PageContainer } from '@/components/ui/page-container';
import { PageTitle } from '@/components/ui/page-title';
import { StatCard } from '@/components/ui/stat-card';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { Package, ClipboardList, DollarSign, Star, TrendingUp } from 'lucide-react';

export default function NegocioDashboard() {
  const { profile } = useAuth();

  return (
    <PageContainer>
      <PageTitle
        title={`Panel de Negocio`}
        description={`Bienvenido, ${profile?.first_name ?? 'Negocio'}`}
      />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Package className="h-5 w-5" />}
          label="Productos"
          value="0"
        />
        <StatCard
          icon={<ClipboardList className="h-5 w-5" />}
          label="Órdenes"
          value="0"
        />
        <StatCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Ingresos"
          value="$0"
        />
        <StatCard
          icon={<Star className="h-5 w-5" />}
          label="Rating"
          value="0"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardCard title="Pedidos Recientes" action={{ label: 'Ver todos' }}>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <TrendingUp className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Sin pedidos recientes</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Los pedidos de tus clientes aparecerán aquí
            </p>
          </div>
        </DashboardCard>

        <DashboardCard title="Productos Destacados" action={{ label: 'Gestionar' }}>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Package className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aún no tienes productos</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Agrega productos para comenzar a vender
            </p>
          </div>
        </DashboardCard>
      </div>

      <div className="mt-6">
        <DashboardCard title="Información del Negocio">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Nombre del Negocio</dt>
              <dd className="text-sm text-foreground">{profile?.first_name ?? 'No especificado'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Email</dt>
              <dd className="text-sm text-foreground">{profile?.email ?? 'No especificado'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Teléfono</dt>
              <dd className="text-sm text-foreground">{profile?.phone ?? 'No especificado'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Rol</dt>
              <dd className="text-sm text-foreground">Negocio</dd>
            </div>
          </dl>
        </DashboardCard>
      </div>
    </PageContainer>
  );
}
