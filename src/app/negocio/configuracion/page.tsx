'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getBrowserClient } from '@/lib/db/supabase';
import { SkeletonCard } from '@/components/ui/skeleton';
import { StorageManager } from '@/components/storage/storage-manager';
import { STORAGE_BUCKETS } from '@/lib/storage';
import {
  Settings,
  Store,
  Clock,
  CreditCard,
  Truck,
  Percent,
  Image as ImageIcon,
  Users,
  Bell,
  Save,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface BusinessConfig {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  metadata: Record<string, unknown>;
}

interface AddressConfig {
  id?: string;
  street_address: string;
  city: string;
  state_province: string;
  postal_code: string;
  country: string;
  latitude: string;
  longitude: string;
  phone: string;
}

interface DayHour {
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  is_closed: boolean;
}

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

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

type TabKey = (typeof TABS)[number]['key'];

const DEFAULT_ADDRESS: AddressConfig = {
  street_address: '',
  city: 'Santa Marta',
  state_province: 'Magdalena',
  postal_code: '',
  country: 'Colombia',
  latitude: '',
  longitude: '',
  phone: '',
};

const ALL_ZONES = ['Zona Norte', 'Zona Centro', 'Zona Sur', 'Zona Occidente'];
const ALL_PAYMENTS = [
  { id: 'cash', label: 'Efectivo' },
  { id: 'card', label: 'Tarjeta' },
  { id: 'transfer', label: 'Transferencia bancaria' },
  { id: 'nequi', label: 'Nequi' },
  { id: 'daviplata', label: 'Daviplata' },
];
const ALL_NOTIFICATIONS = [
  { id: 'new_order', label: 'Nuevos pedidos' },
  { id: 'order_cancelled', label: 'Pedidos cancelados' },
  { id: 'order_ready', label: 'Pedido listo para recoger' },
  { id: 'low_stock', label: 'Stock bajo' },
  { id: 'new_rating', label: 'Nuevas calificaciones' },
  { id: 'promotions', label: 'Promociones' },
];

function toCoordinate(value: string): number | null {
  const number = Number(value);
  return value.trim() && Number.isFinite(number) ? number : null;
}

export default function NegocioConfiguracion() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [business, setBusiness] = useState<BusinessConfig | null>(null);
  const [address, setAddress] = useState<AddressConfig>(DEFAULT_ADDRESS);
  const [hours, setHours] = useState<DayHour[]>([]);
  const [coverageZones, setCoverageZones] = useState<string[]>([]);
  const [coverageKm, setCoverageKm] = useState(5);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [taxId, setTaxId] = useState('');
  const [taxRegime, setTaxRegime] = useState('Simplificado');
  const [taxIva, setTaxIva] = useState(0);
  const [taxCommission, setTaxCommission] = useState(10);
  const [notificationPrefs, setNotificationPrefs] = useState<string[]>(['new_order']);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [bannerPath, setBannerPath] = useState<string | null>(null);

  const loadConfiguration = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const supabase = getBrowserClient();
      const { data: businessRow, error: businessError } = await supabase
        .from('businesses')
        .select('id,name,phone,email,description,logo_url,banner_url,metadata')
        .eq('owner_id', profile.id)
        .is('deleted_at', null)
        .maybeSingle();
      if (businessError) throw businessError;
      if (!businessRow) {
        setBusiness(null);
        return;
      }

      const normalizedBusiness: BusinessConfig = {
        id: String(businessRow.id),
        name: String(businessRow.name || ''),
        phone: businessRow.phone ? String(businessRow.phone) : null,
        email: businessRow.email ? String(businessRow.email) : null,
        description: businessRow.description ? String(businessRow.description) : null,
        logo_url: businessRow.logo_url ? String(businessRow.logo_url) : null,
        banner_url: businessRow.banner_url ? String(businessRow.banner_url) : null,
        metadata: (businessRow.metadata as Record<string, unknown> | null) || {},
      };
      setBusiness(normalizedBusiness);

      const [{ data: addressRow, error: addressError }, { data: hoursRows, error: hoursError }] =
        await Promise.all([
          supabase
            .from('business_addresses')
            .select('id,street_address,city,state_province,postal_code,country,latitude,longitude,phone')
            .eq('business_id', businessRow.id)
            .eq('is_primary', true)
            .is('deleted_at', null)
            .maybeSingle(),
          supabase
            .from('business_hours')
            .select('day_of_week,opens_at,closes_at,is_closed')
            .eq('business_id', businessRow.id)
            .order('day_of_week'),
        ]);
      if (addressError) throw addressError;
      if (hoursError) throw hoursError;

      if (addressRow) {
        setAddress({
          id: String(addressRow.id),
          street_address: String(addressRow.street_address || ''),
          city: String(addressRow.city || 'Santa Marta'),
          state_province: String(addressRow.state_province || 'Magdalena'),
          postal_code: String(addressRow.postal_code || ''),
          country: String(addressRow.country || 'Colombia'),
          latitude: addressRow.latitude == null ? '' : String(addressRow.latitude),
          longitude: addressRow.longitude == null ? '' : String(addressRow.longitude),
          phone: String(addressRow.phone || businessRow.phone || ''),
        });
      } else {
        setAddress({ ...DEFAULT_ADDRESS, phone: String(businessRow.phone || '') });
      }

      if (hoursRows && hoursRows.length > 0) {
        setHours(
          hoursRows.map((hour) => ({
            day_of_week: Number(hour.day_of_week),
            opens_at: String(hour.opens_at || '09:00').slice(0, 5),
            closes_at: String(hour.closes_at || '22:00').slice(0, 5),
            is_closed: Boolean(hour.is_closed),
          })),
        );
      } else {
        setHours(
          Array.from({ length: 7 }, (_, day) => ({
            day_of_week: day,
            opens_at: '09:00',
            closes_at: '22:00',
            is_closed: day === 0,
          })),
        );
      }

      const metadata = normalizedBusiness.metadata;
      setCoverageZones((metadata.coverageZones as string[]) || []);
      setCoverageKm(Number(metadata.coverageKm ?? 5));
      setPaymentMethods((metadata.paymentMethods as string[]) || []);
      setTaxId(String(metadata.taxId || ''));
      setTaxRegime(String(metadata.taxRegime || 'Simplificado'));
      setTaxIva(Number(metadata.taxIva ?? 0));
      setTaxCommission(Number(metadata.taxCommission ?? 10));
      setNotificationPrefs((metadata.notificationPrefs as string[]) || ['new_order']);
      setLogoPath(metadata.logoPath ? String(metadata.logoPath) : null);
      setBannerPath(metadata.bannerPath ? String(metadata.bannerPath) : null);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo cargar la configuración');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    void loadConfiguration();
  }, [loadConfiguration]);

  const updateBusiness = (key: keyof BusinessConfig, value: unknown) => {
    setBusiness((current) => (current ? { ...current, [key]: value } : current));
  };

  const updateAddress = (key: keyof AddressConfig, value: string) => {
    setAddress((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    if (!business?.id) return;
    if (!business.name.trim()) {
      toast.error('El nombre del negocio es obligatorio');
      return;
    }
    if (!address.street_address.trim()) {
      toast.error('La dirección principal es obligatoria');
      setActiveTab('general');
      return;
    }

    setSaving(true);
    try {
      const supabase = getBrowserClient();
      const metadata = {
        ...business.metadata,
        coverageZones,
        coverageKm,
        paymentMethods,
        taxId,
        taxRegime,
        taxIva,
        taxCommission,
        notificationPrefs,
        logoPath,
        bannerPath,
      };

      const { data: savedBusiness, error: businessError } = await supabase
        .from('businesses')
        .update({
          name: business.name.trim(),
          phone: business.phone?.trim() || null,
          email: business.email?.trim() || null,
          description: business.description?.trim() || null,
          logo_url: business.logo_url || null,
          banner_url: business.banner_url || null,
          metadata,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', business.id)
        .select('id,name,phone,email,description,logo_url,banner_url,metadata')
        .single();
      if (businessError) throw businessError;
      if (!savedBusiness) throw new Error('El negocio no confirmó la actualización');

      const addressPayload = {
        business_id: business.id,
        street_address: address.street_address.trim(),
        city: address.city.trim() || 'Santa Marta',
        state_province: address.state_province.trim() || 'Magdalena',
        postal_code: address.postal_code.trim() || null,
        country: address.country.trim() || 'Colombia',
        latitude: toCoordinate(address.latitude),
        longitude: toCoordinate(address.longitude),
        phone: address.phone.trim() || business.phone?.trim() || null,
        is_primary: true,
        delivery_available: true,
        updated_at: new Date().toISOString(),
      };

      if (address.id) {
        const { data: savedAddress, error: addressError } = await supabase
          .from('business_addresses')
          .update(addressPayload as never)
          .eq('id', address.id)
          .select('id')
          .single();
        if (addressError) throw addressError;
        if (!savedAddress) throw new Error('La dirección no confirmó la actualización');
      } else {
        const { data: savedAddress, error: addressError } = await supabase
          .from('business_addresses')
          .insert(addressPayload as never)
          .select('id')
          .single();
        if (addressError) throw addressError;
        if (!savedAddress) throw new Error('No se pudo crear la dirección del negocio');
        setAddress((current) => ({ ...current, id: String(savedAddress.id) }));
      }

      for (const hour of hours) {
        const { error: hourError } = await supabase.from('business_hours').upsert(
          {
            business_id: business.id,
            day_of_week: hour.day_of_week,
            opens_at: hour.opens_at,
            closes_at: hour.closes_at,
            is_closed: hour.is_closed,
          } as never,
          { onConflict: 'business_id,day_of_week' },
        );
        if (hourError) throw hourError;
      }

      setSaved(true);
      toast.success('Los cambios se guardaron permanentemente');
      await loadConfiguration();
      window.setTimeout(() => setSaved(false), 2500);
    } catch (cause) {
      toast.error(
        `No se guardaron los cambios: ${cause instanceof Error ? cause.message : 'error desconocido'}`,
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <SkeletonCard />;
  if (!business) {
    return <div className="p-12 text-center text-muted-foreground">No se encontró tu negocio</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
            <Settings className="h-5 w-5 text-warning" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Cada cambio se guarda en Supabase y se verifica antes de mostrarlo como completado.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadConfiguration()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm"
          >
            <RefreshCw className="h-4 w-4" /> Recargar
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-warning px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Guardando y verificando…' : saved ? '¡Guardado y verificado!' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border bg-background/50 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
              activeTab === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="h-4 w-4" /> {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border bg-card p-6">
        {activeTab === 'general' && (
          <div className="space-y-5">
            <h3 className="font-semibold">Información general y ubicación</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">Nombre del negocio *</span>
                <input
                  value={business.name}
                  onChange={(event) => updateBusiness('name', event.target.value)}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">Teléfono</span>
                <input
                  value={business.phone || ''}
                  onChange={(event) => updateBusiness('phone', event.target.value)}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs text-muted-foreground">Correo comercial</span>
                <input
                  type="email"
                  value={business.email || ''}
                  onChange={(event) => updateBusiness('email', event.target.value)}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs text-muted-foreground">Dirección principal *</span>
                <input
                  value={address.street_address}
                  onChange={(event) => updateAddress('street_address', event.target.value)}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">Ciudad</span>
                <input
                  value={address.city}
                  onChange={(event) => updateAddress('city', event.target.value)}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">Departamento</span>
                <input
                  value={address.state_province}
                  onChange={(event) => updateAddress('state_province', event.target.value)}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs text-muted-foreground">Descripción</span>
                <textarea
                  value={business.description || ''}
                  onChange={(event) => updateBusiness('description', event.target.value)}
                  rows={4}
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>
        )}

        {activeTab === 'hours' && (
          <div className="space-y-4">
            <h3 className="font-semibold">Horarios de atención</h3>
            {hours.map((hour) => (
              <div key={hour.day_of_week} className="flex flex-wrap items-center gap-4 border-b py-3 last:border-0">
                <span className="w-24 text-sm font-medium">{DAY_LABELS[hour.day_of_week]}</span>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={!hour.is_closed}
                    onChange={(event) =>
                      setHours((current) =>
                        current.map((item) =>
                          item.day_of_week === hour.day_of_week
                            ? { ...item, is_closed: !event.target.checked }
                            : item,
                        ),
                      )
                    }
                  />
                  Abierto
                </label>
                {!hour.is_closed && (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={hour.opens_at}
                      onChange={(event) =>
                        setHours((current) =>
                          current.map((item) =>
                            item.day_of_week === hour.day_of_week
                              ? { ...item, opens_at: event.target.value }
                              : item,
                          ),
                        )
                      }
                      className="h-9 rounded-lg border bg-background px-2 text-xs"
                    />
                    <span className="text-xs text-muted-foreground">a</span>
                    <input
                      type="time"
                      value={hour.closes_at}
                      onChange={(event) =>
                        setHours((current) =>
                          current.map((item) =>
                            item.day_of_week === hour.day_of_week
                              ? { ...item, closes_at: event.target.value }
                              : item,
                          ),
                        )
                      }
                      className="h-9 rounded-lg border bg-background px-2 text-xs"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'coverage' && (
          <div className="space-y-4">
            <h3 className="font-semibold">Cobertura de reparto</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {ALL_ZONES.map((zone) => (
                <label key={zone} className="flex items-center gap-3 rounded-xl border p-3">
                  <input
                    type="checkbox"
                    checked={coverageZones.includes(zone)}
                    onChange={(event) =>
                      setCoverageZones((current) =>
                        event.target.checked
                          ? [...new Set([...current, zone])]
                          : current.filter((item) => item !== zone),
                      )
                    }
                  />
                  <span className="text-sm font-medium">{zone}</span>
                </label>
              ))}
            </div>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Radio máximo (km)</span>
              <input
                type="number"
                min={1}
                value={coverageKm}
                onChange={(event) => setCoverageKm(Math.max(1, Number(event.target.value)))}
                className="h-10 w-32 rounded-xl border bg-background px-3 text-sm"
              />
            </label>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-3">
            <h3 className="font-semibold">Métodos de pago aceptados</h3>
            {ALL_PAYMENTS.map((method) => (
              <label key={method.id} className="flex items-center gap-3 rounded-xl border p-3">
                <input
                  type="checkbox"
                  checked={paymentMethods.includes(method.id)}
                  onChange={(event) =>
                    setPaymentMethods((current) =>
                      event.target.checked
                        ? [...new Set([...current, method.id])]
                        : current.filter((item) => item !== method.id),
                    )
                  }
                />
                <span className="text-sm font-medium">{method.label}</span>
              </label>
            ))}
          </div>
        )}

        {activeTab === 'taxes' && (
          <div className="space-y-4">
            <h3 className="font-semibold">Información tributaria y comisiones</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">NIT / RUT</span>
                <input
                  value={taxId}
                  onChange={(event) => setTaxId(event.target.value)}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">Régimen</span>
                <select
                  value={taxRegime}
                  onChange={(event) => setTaxRegime(event.target.value)}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                >
                  <option>Simplificado</option>
                  <option>Común</option>
                  <option>No responsable de IVA</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">IVA (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={taxIva}
                  onChange={(event) => setTaxIva(Number(event.target.value))}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">Comisión DomiU (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={taxCommission}
                  onChange={(event) => setTaxCommission(Number(event.target.value))}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                />
              </label>
            </div>
          </div>
        )}

        {activeTab === 'images' && (
          <div className="space-y-5">
            <h3 className="font-semibold">Logo y portada del negocio</h3>
            <p className="text-xs text-muted-foreground">
              La imagen se sube primero y queda asociada definitivamente cuando presionas Guardar cambios.
            </p>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Logo</p>
                <StorageManager
                  bucket={STORAGE_BUCKETS.BUSINESS_LOGOS}
                  previewType="logo"
                  currentUrl={business.logo_url}
                  currentPath={logoPath}
                  folder={`businesses/${business.id}`}
                  onUploaded={(url, path) => {
                    updateBusiness('logo_url', url);
                    setLogoPath(path);
                  }}
                  onDeleted={() => {
                    updateBusiness('logo_url', null);
                    setLogoPath(null);
                  }}
                />
              </div>
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Portada</p>
                <StorageManager
                  bucket={STORAGE_BUCKETS.BUSINESS_BANNERS}
                  previewType="banner"
                  currentUrl={business.banner_url}
                  currentPath={bannerPath}
                  folder={`businesses/${business.id}`}
                  onUploaded={(url, path) => {
                    updateBusiness('banner_url', url);
                    setBannerPath(path);
                  }}
                  onDeleted={() => {
                    updateBusiness('banner_url', null);
                    setBannerPath(null);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'staff' && (
          <div className="rounded-xl border p-8 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Gestión de personal</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Este módulo se habilitará después de estabilizar los flujos críticos del lanzamiento.
            </p>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-3">
            <h3 className="font-semibold">Preferencias de notificación</h3>
            {ALL_NOTIFICATIONS.map((notification) => (
              <label key={notification.id} className="flex items-center gap-3 rounded-xl border p-3">
                <input
                  type="checkbox"
                  checked={notificationPrefs.includes(notification.id)}
                  onChange={(event) =>
                    setNotificationPrefs((current) =>
                      event.target.checked
                        ? [...new Set([...current, notification.id])]
                        : current.filter((item) => item !== notification.id),
                    )
                  }
                />
                <div>
                  <p className="text-sm font-medium">{notification.label}</p>
                  <p className="text-xs text-muted-foreground">Recibir aviso en tiempo real</p>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
