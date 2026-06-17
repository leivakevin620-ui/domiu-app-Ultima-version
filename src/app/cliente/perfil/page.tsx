'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PageContainer } from '@/components/ui/page-container';
import { PageTitle } from '@/components/ui/page-title';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { User, Mail, Phone, Shield } from 'lucide-react';

export default function ClientePerfil() {
  const { profile, user } = useAuth();

  return (
    <PageContainer>
      <PageTitle title="Mi Perfil" description="Tu información personal" />

      <div className="mb-6 flex items-center gap-4 rounded-xl border border-border bg-card p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/5 text-2xl font-semibold text-primary">
          {profile?.first_name?.charAt(0) ?? 'U'}
          {profile?.last_name?.charAt(0) ?? ''}
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {profile?.first_name} {profile?.last_name}
          </h2>
          <p className="text-sm text-muted-foreground">Cliente</p>
        </div>
      </div>

      <DashboardCard title="Información Personal">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <dt className="text-xs text-muted-foreground">Nombre</dt>
              <dd className="text-sm text-foreground">
                {profile?.first_name} {profile?.last_name}
              </dd>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div>
              <dt className="text-xs text-muted-foreground">Email</dt>
              <dd className="text-sm text-foreground">{user?.email}</dd>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <div>
              <dt className="text-xs text-muted-foreground">Teléfono</dt>
              <dd className="text-sm text-foreground">{profile?.phone ?? 'No especificado'}</dd>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <div>
              <dt className="text-xs text-muted-foreground">Rol</dt>
              <dd className="text-sm text-foreground">Cliente</dd>
            </div>
          </div>
        </dl>
      </DashboardCard>
    </PageContainer>
  );
}
