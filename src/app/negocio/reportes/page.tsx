'use client';

import React from 'react';
import { PageContainer } from '@/components/ui/page-container';
import { PageTitle } from '@/components/ui/page-title';
import { EmptyState } from '@/components/ui/empty-state';
import { BarChart3 } from 'lucide-react';

export default function NegocioReportes() {
  return (
    <PageContainer>
      <PageTitle title="Reportes" description="Estadísticas y análisis de tu negocio" />
      <EmptyState
        icon={<BarChart3 className="h-6 w-6" />}
        title="Reportes próximamente"
        description="Aquí podrás ver estadísticas detalladas de tus ventas y rendimiento."
      />
    </PageContainer>
  );
}
