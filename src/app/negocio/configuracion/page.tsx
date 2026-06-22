'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getBrowserClient } from '@/lib/db/supabase';
import { SkeletonCard } from '@/components/ui/skeleton';
import NextImage from 'next/image';
import { Settings, Store, Clock, CreditCard, Truck, Percent, Image as ImageIcon, Users, Bell, Save } from 'lucide-react';

interface BusinessConfig {
  id?: string;
  name?: string;
  phone?: string;
  address?: string;
  description?: string;
  tax_id?: string;
  logo_url?: string;
  cover_url?: string;
  [key: string]: unknown;
}

const TABS = [
  { key: 'general', label: 'General', icon: Store },
  { key: 'hours', label: 'Horarios', icon: Clock },
  { key: 'coverage', label: 'Cobertura', icon: Truck },
  { key: 'payments', label: 'Pagos', icon: CreditCard },
  { key: 'taxes', label: 'Impuestos', icon: Percent },
  { key: 'images', label: 'Imágenes', icon: ImageIcon },
  { key: 'staff', label: 'Personal', icon: Users },
  { key: 'notifications', label: 'Notificaciones', icon: Bell },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function NegocioConfiguracion() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [business, setBusiness] = useState<BusinessConfig | null>(null);

  useEffect(() => {
    (async () => {
      if (!profile?.id) return;
      const supabase = await getBrowserClient();
      const { data } = await supabase.from('businesses').select('*').eq('owner_id', profile.id).maybeSingle();
      setBusiness((data || {}) as BusinessConfig);
      setLoading(false);
    })();
  }, [profile?.id]);

  const updateField = (key: string, value: unknown) => setBusiness((prev) => ({ ...(prev ?? {}), [key]: value } as BusinessConfig));

  const handleSave = async () => {
    if (!business?.id) return;
    setSaving(true);
    const supabase = await getBrowserClient();
    await supabase.from('businesses').update(business as never).eq('id', business.id as string);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <SkeletonCard />;
  if (!business) return <div className="p-12 text-center text-muted-foreground">No se encontró tu negocio</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-warning/10 to-warning/5">
            <Settings className="h-5 w-5 text-warning" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Configuración</h1>
            <p className="mt-1 text-sm text-muted-foreground">Administra todos los aspectos de tu negocio</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-warning to-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-warning/20 transition-all hover:shadow-xl hover:shadow-warning/30 disabled:opacity-50">
          <Save className="h-4 w-4" /> {saving ? 'Guardando...' : saved ? '¡Guardado!' : 'Guardar Cambios'}
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-background/50 p-1 pb-2 snap-x">
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors snap-start ${activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            <tab.icon className="h-4 w-4" /> {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        {activeTab === 'general' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground mb-4">Información General</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Nombre del Negocio</label>
                <input value={business.name || ''} onChange={(e) => updateField('name', e.target.value)} className="h-10 w-full rounded-xl border border-border bg-background/50 px-3 text-sm text-foreground" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Teléfono</label>
                <input value={business.phone || ''} onChange={(e) => updateField('phone', e.target.value)} className="h-10 w-full rounded-xl border border-border bg-background/50 px-3 text-sm text-foreground" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-muted-foreground">Dirección</label>
                <input value={business.address || ''} onChange={(e) => updateField('address', e.target.value)} className="h-10 w-full rounded-xl border border-border bg-background/50 px-3 text-sm text-foreground" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-muted-foreground">Descripción</label>
                <textarea value={business.description || ''} onChange={(e) => updateField('description', e.target.value)} rows={3} className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm text-foreground resize-none" />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'hours' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground mb-4">Horarios de Atención</h3>
            <p className="text-xs text-muted-foreground mb-4">Define los horarios de apertura y cierre para cada día.</p>
            {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((day, i) => (
              <div key={day} className="flex items-center gap-4 py-2 border-b border-border/30 last:border-0">
                <span className="w-24 text-sm font-medium text-foreground">{day}</span>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" defaultChecked={i < 6} className="rounded border-border" /> Abierto
                </label>
                <div className="flex items-center gap-2">
                  <input type="time" defaultValue="09:00" className="h-8 w-24 rounded-lg border border-border bg-background/50 px-2 text-xs text-foreground" />
                  <span className="text-xs text-muted-foreground">a</span>
                  <input type="time" defaultValue="22:00" className="h-8 w-24 rounded-lg border border-border bg-background/50 px-2 text-xs text-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'coverage' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground mb-4">Zonas de Reparto</h3>
            <p className="text-xs text-muted-foreground">Configura las zonas donde realizas repartos (próximamente: mapa interactivo).</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {['Zona Norte', 'Zona Centro', 'Zona Sur', 'Zona Occidente'].map((z) => (
                <label key={z} className="flex items-center gap-3 rounded-xl border border-border bg-background/30 p-3">
                  <input type="checkbox" defaultChecked className="rounded border-border" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{z}</p>
                    <p className="text-xs text-muted-foreground">Cobertura activa</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="mt-4">
              <label className="mb-1 block text-xs text-muted-foreground">Radio de reparto (km)</label>
              <input type="number" defaultValue={5} className="h-10 w-32 rounded-xl border border-border bg-background/50 px-3 text-sm text-foreground" />
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground mb-4">Métodos de Pago</h3>
            {[
              { id: 'cash', label: 'Efectivo' },
              { id: 'card', label: 'Tarjeta (Nequi/Bancolombia)' },
              { id: 'transfer', label: 'Transferencia' },
              { id: 'digital', label: 'Billetera Digital' },
            ].map((mp) => (
              <label key={mp.id} className="flex items-center gap-3 rounded-xl border border-border bg-background/30 p-3">
                <input type="checkbox" defaultChecked className="rounded border-border" />
                <p className="text-sm font-medium text-foreground">{mp.label}</p>
              </label>
            ))}
          </div>
        )}

        {activeTab === 'taxes' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground mb-4">Impuestos y Comisiones</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">NIT / RUT</label>
                <input value={business.tax_id || ''} onChange={(e) => updateField('tax_id', e.target.value)} className="h-10 w-full rounded-xl border border-border bg-background/50 px-3 text-sm text-foreground" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Régimen</label>
                <select className="h-10 w-full rounded-xl border border-border bg-background/50 px-3 text-sm text-foreground">
                  <option>Simplificado</option>
                  <option>Común</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">IVA (%)</label>
                <input type="number" defaultValue={19} className="h-10 w-full rounded-xl border border-border bg-background/50 px-3 text-sm text-foreground" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Comisión DomiU (%)</label>
                <input type="number" defaultValue={10} className="h-10 w-full rounded-xl border border-border bg-background/50 px-3 text-sm text-foreground" />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'images' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground mb-4">Imágenes del Negocio</h3>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs text-muted-foreground">Logo</label>
                <div className="relative flex h-40 items-center justify-center rounded-2xl border-2 border-dashed border-border bg-background/30">
                  {business.logo_url ? (
                    <NextImage src={business.logo_url} alt="Logo del negocio" fill className="object-contain rounded-2xl" sizes="160px" />
                  ) : (
                    <div className="text-center">
                      <ImageIcon className="mx-auto h-6 w-6 text-muted-foreground/50" aria-hidden="true" />
                      <p className="mt-2 text-xs text-muted-foreground">Sube tu logo</p>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs text-muted-foreground">Portada</label>
                <div className="relative flex h-40 items-center justify-center rounded-2xl border-2 border-dashed border-border bg-background/30">
                  {business.cover_url ? (
                    <NextImage src={business.cover_url} alt="Portada del negocio" fill className="object-cover rounded-2xl" sizes="160px" />
                  ) : (
                    <div className="text-center">
                      <ImageIcon className="mx-auto h-6 w-6 text-muted-foreground/50" aria-hidden="true" />
                      <p className="mt-2 text-xs text-muted-foreground">Sube tu portada</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-2">
              <label className="mb-1 block text-xs text-muted-foreground">URL de Logo</label>
              <input value={business.logo_url || ''} onChange={(e) => updateField('logo_url', e.target.value)} placeholder="https://..." className="h-10 w-full rounded-xl border border-border bg-background/50 px-3 text-sm text-foreground" />
            </div>
            <div className="mt-2">
              <label className="mb-1 block text-xs text-muted-foreground">URL de Portada</label>
              <input value={business.cover_url || ''} onChange={(e) => updateField('cover_url', e.target.value)} placeholder="https://..." className="h-10 w-full rounded-xl border border-border bg-background/50 px-3 text-sm text-foreground" />
            </div>
          </div>
        )}

        {activeTab === 'staff' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground mb-4">Personal del Negocio</h3>
            <p className="text-xs text-muted-foreground">Invita a tu equipo a gestionar el negocio (próximamente).</p>
            <div className="rounded-xl border border-border bg-background/30 p-6 text-center">
              <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">La gestión de personal estará disponible próximamente.</p>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground mb-4">Notificaciones</h3>
            {[
              { id: 'new_order', label: 'Nuevos pedidos' },
              { id: 'order_cancelled', label: 'Pedidos cancelados' },
              { id: 'order_ready', label: 'Pedido listo para recoger' },
              { id: 'low_stock', label: 'Stock bajo' },
              { id: 'new_rating', label: 'Nuevas calificaciones' },
              { id: 'promotions', label: 'Promociones' },
            ].map((n) => (
              <label key={n.id} className="flex items-center gap-3 rounded-xl border border-border bg-background/30 p-3">
                <input type="checkbox" defaultChecked className="rounded border-border" />
                <div>
                  <p className="text-sm font-medium text-foreground">{n.label}</p>
                  <p className="text-xs text-muted-foreground">Recibir notificación en tiempo real</p>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
