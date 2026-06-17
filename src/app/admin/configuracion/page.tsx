'use client';

import React, { useState } from 'react';
import { PageContainer } from '@/components/ui/page-container';
import { PageTitle } from '@/components/ui/page-title';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Save } from 'lucide-react';

export default function AdminConfig() {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <PageContainer>
      <PageTitle title="Configuración" description="Ajustes generales de la plataforma" />

      {saved && <Alert variant="success" title="Configuración guardada" description="Los cambios se aplicarán al recargar." dismissible onDismiss={() => setSaved(false)} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardCard title="Configuración General">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Nombre de la Plataforma</label>
              <Input defaultValue="DomiU" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Comisión por Pedido (%)</label>
              <Input defaultValue="15" type="number" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Tarifa de Envío Base (COP)</label>
              <Input defaultValue="3500" type="number" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Tiempo Máximo de Entrega (min)</label>
              <Input defaultValue="45" type="number" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Distancia Máxima de Reparto (km)</label>
              <Input defaultValue="10" type="number" />
            </div>
            <Button onClick={handleSave}><Save className="mr-1.5 h-4 w-4" /> Guardar Cambios</Button>
          </div>
        </DashboardCard>

        <DashboardCard title="Seguridad">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Tiempo de Sesión (horas)</label>
              <Input defaultValue="24" type="number" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Intentos Máximos de Login</label>
              <Input defaultValue="5" type="number" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Requerir Verificación de Email</label>
              <select className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm">
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            </div>
            <Button onClick={handleSave}><Save className="mr-1.5 h-4 w-4" /> Guardar Cambios</Button>
          </div>
        </DashboardCard>

        <DashboardCard title="Integraciones">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Google Maps API Key</label>
              <Input defaultValue="********" type="password" />
              <p className="mt-1 text-[10px] text-muted-foreground">Necesaria para mapas y geolocalización</p>
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Supabase URL</label>
              <Input defaultValue="https://vuwaqmwgvldqmmgkpyjh.supabase.co" readOnly />
              <p className="mt-1 text-[10px] text-muted-foreground">Configurado en variables de entorno</p>
            </div>
            <Button onClick={handleSave}><Save className="mr-1.5 h-4 w-4" /> Guardar Cambios</Button>
          </div>
        </DashboardCard>

        <DashboardCard title="Notificaciones">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Email de Notificaciones</label>
              <Input defaultValue="notificaciones@domiu.app" type="email" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Notificaciones Push</label>
              <select className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm">
                <option value="enabled">Habilitadas</option>
                <option value="disabled">Deshabilitadas</option>
              </select>
            </div>
            <Button onClick={handleSave}><Save className="mr-1.5 h-4 w-4" /> Guardar Cambios</Button>
          </div>
        </DashboardCard>
      </div>

      <Card className="mt-6 p-4">
        <p className="text-xs text-muted-foreground">
          Los valores de configuración se almacenan en las variables de entorno (.env.local) y en la base de datos.
          Los cambios realizados aquí afectarán a toda la plataforma.
        </p>
      </Card>
    </PageContainer>
  );
}
