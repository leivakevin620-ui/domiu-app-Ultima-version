'use client';

import React from 'react';
import { PageContainer } from '@/components/ui/page-container';
import { PageTitle } from '@/components/ui/page-title';
import { EmptyState } from '@/components/ui/empty-state';
import { Users } from 'lucide-react';

export default function NegocioClientes() {
  return (
    <PageContainer>
      <PageTitle title="Clientes" description="Visualiza tus clientes frecuentes" />
      <EmptyState
        icon={<Users className="h-6 w-6" />}
        title="Sin clientes aún"
        description="Cuando los clientes realicen pedidos, aparecerán aquí."
      />
    </PageContainer>
  );
}
