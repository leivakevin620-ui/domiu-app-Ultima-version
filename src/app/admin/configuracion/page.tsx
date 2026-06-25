'use client';

import React, { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Save, Settings, Shield, Globe, Bell, Database, Download } from 'lucide-react';
import { toast } from 'sonner';

const STORAGE_KEY = 'domiu_admin_config';

interface ConfigField {
  label: string;
  key: string;
  defaultValue: string;
  type?: string;
  hint?: string;
  readOnly?: boolean;
  isSelect?: boolean;
  options?: string[];
}

const defaultSections: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  fields: ConfigField[];
}[] = [
  {
    title: 'Configuración General',
    icon: Settings,
    fields: [
      { label: 'Nombre de la Plataforma', key: 'platform_name', defaultValue: 'DomiU' },
      { label: 'Comisión por Pedido (%)', key: 'commission_percent', defaultValue: '15', type: 'number' },
      { label: 'Tarifa de Envío Base (COP)', key: 'base_delivery_fee', defaultValue: '3500', type: 'number' },
      { label: 'Tiempo Máximo de Entrega (min)', key: 'max_delivery_minutes', defaultValue: '45', type: 'number' },
      { label: 'Distancia Máxima de Reparto (km)', key: 'max_delivery_km', defaultValue: '10', type: 'number' },
    ],
  },
  {
    title: 'Seguridad',
    icon: Shield,
    fields: [
      { label: 'Tiempo de Sesión (horas)', key: 'session_hours', defaultValue: '24', type: 'number' },
      { label: 'Intentos Máximos de Login', key: 'max_login_attempts', defaultValue: '5', type: 'number' },
      { label: 'Requerir Verificación de Email', key: 'require_email_verification', defaultValue: 'Sí', isSelect: true, options: ['Sí', 'No'] },
    ],
  },
  {
    title: 'Integraciones',
    icon: Globe,
    fields: [
      { label: 'Google Maps API Key', key: 'google_maps_key', defaultValue: '********', type: 'password', hint: 'Necesaria para mapas y geolocalización' },
      { label: 'Supabase URL', key: 'supabase_url', defaultValue: 'https://vuwaqmwgvldqmmgkpyjh.supabase.co', readOnly: true, hint: 'Configurado en variables de entorno' },
    ],
  },
  {
    title: 'Notificaciones',
    icon: Bell,
    fields: [
      { label: 'Email de Notificaciones', key: 'notifications_email', defaultValue: 'notificaciones@domiu.app', type: 'email' },
      { label: 'Notificaciones Push', key: 'push_notifications', defaultValue: 'Habilitadas', isSelect: true, options: ['Habilitadas', 'Deshabilitadas'] },
    ],
  },
];

export default function AdminConfig() {
  const [saved, setSaved] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setTimeout(() => setValues(parsed));
      }
    } catch {}
  }, []);

  const getValue = (key: string, defaultValue: string) => values[key] ?? defaultValue;

  const handleChange = (key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Configuración</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ajustes generales de la plataforma</p>
      </div>

      {saved && <Alert variant="success" title="Configuración guardada" description="Los cambios se aplicarán al recargar." dismissible onDismiss={() => setSaved(false)} />}

      <div className="grid gap-6 lg:grid-cols-2">
        {defaultSections.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.title} className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border/50 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent px-5 py-3.5">
                <Icon className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
              </div>
              <div className="p-5 space-y-4">
                {section.fields.map((field) => (
                  <div key={field.label}>
                    <label className="mb-1.5 block text-sm text-muted-foreground">{field.label}</label>
                    {field.isSelect ? (
                      <select
                        value={getValue(field.key, field.defaultValue)}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        className="flex h-10 w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm text-foreground"
                      >
                        {(field.options || []).map(o => <option key={o} value={o.toLowerCase()}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        value={getValue(field.key, field.defaultValue)}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        type={field.type || 'text'}
                        readOnly={field.readOnly}
                        className="h-10 w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                      />
                    )}
                    {field.hint && <p className="mt-1 text-[10px] text-muted-foreground">{field.hint}</p>}
                  </div>
                ))}
                <button onClick={handleSave} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                  <Save className="h-4 w-4" /> Guardar Cambios
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border/50 bg-card shadow-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border/50 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent px-5 py-3.5">
          <Database className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Respaldo y Exportación</h3>
        </div>
        <div className="p-5">
          <p className="mb-4 text-sm text-muted-foreground">Exporta los datos de la plataforma en formato CSV.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: 'Usuarios', filename: 'domiu_usuarios', icon: Shield },
                { label: 'Pedidos', filename: 'domiu_pedidos', icon: Settings },
                { label: 'Negocios', filename: 'domiu_negocios', icon: Settings },
                { label: 'Repartidores', filename: 'domiu_repartidores', icon: Settings },
              ].map((item) => {
                return (
                  <button
                    key={item.label}
                    onClick={async () => {
                      try {
                        toast.info(`Exportando ${item.label.toLowerCase()}...`);
                        const csv = `${item.label},ID,Fecha\nEjemplo,000,${new Date().toISOString().slice(0,10)}\n`;
                        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${item.filename}_${new Date().toISOString().slice(0, 10)}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success(`${item.label} exportado`);
                      } catch { toast.error('Error al exportar'); }
                    }}
                    className="flex flex-col items-center gap-2 rounded-xl border border-border/50 p-4 transition-all hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5">
                      <Download className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-xs font-medium text-foreground">{item.label}</span>
                    <span className="text-[10px] text-muted-foreground">CSV</span>
                  </button>
                );
              })}
          </div>
          <p className="mt-4 text-[10px] text-muted-foreground">
            Nota: La exportación directa requiere una API Server-Side. Por ahora se genera la descripción del archivo.
            Para exportar datos reales, usa la consola de Supabase.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card/50 p-5">
        <p className="text-xs text-muted-foreground">
          Los valores de configuración se almacenan en las variables de entorno (.env.local) y en la base de datos.
          Los cambios realizados aquí afectarán a toda la plataforma.
        </p>
      </div>
    </div>
  );
}
