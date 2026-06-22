'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SkeletonCard } from '@/components/ui/skeleton';
import { coverageService } from '@/services/coverage';
import type { City, Zone, DeliveryRate } from '@/services/coverage';
import { MapPin, Globe, Plus } from 'lucide-react';

type TabId = 'ciudades' | 'zonas' | 'tarifas';

export default function AdminCobertura() {
  useAuth();
  const [tab, setTab] = useState<TabId>('ciudades');
  const [cities, setCities] = useState<City[]>([]);
  const [zones, setZones] = useState<(Zone & { city_name: string })[]>([]);
  const [rates, setRates] = useState<DeliveryRate[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCityForm, setShowCityForm] = useState(false);
  const [newCityName, setNewCityName] = useState('');
  const [newCityDept, setNewCityDept] = useState('');

  const [showZoneForm, setShowZoneForm] = useState(false);
  const [newZoneCity, setNewZoneCity] = useState('');
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneEstimate, setNewZoneEstimate] = useState('');

  const [showRateForm, setShowRateForm] = useState(false);
  const [editRate, setEditRate] = useState<Partial<DeliveryRate>>({});

  const loadAll = () => {
    Promise.all([
      coverageService.getAllCities(),
      coverageService.getAllZones(),
      coverageService.getRates(),
    ])
      .then(([c, z, r]) => {
        setCities(c);
        setZones(z);
        setRates(r);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  const handleCreateCity = async () => {
    if (!newCityName) return;
    await coverageService.createCity(newCityName, newCityDept || undefined);
    setNewCityName(''); setNewCityDept(''); setShowCityForm(false); loadAll();
  };

  const handleCreateZone = async () => {
    if (!newZoneCity || !newZoneName) return;
    await coverageService.createZone(newZoneCity, newZoneName, newZoneEstimate || undefined);
    setNewZoneCity(''); setNewZoneName(''); setNewZoneEstimate(''); setShowZoneForm(false); loadAll();
  };

  const handleUpsertRate = async () => {
    if (!editRate.base_rate) return;
    await coverageService.upsertRate(editRate);
    setEditRate({}); setShowRateForm(false); loadAll();
  };

  if (loading) return <SkeletonCard />;

  const tabs = [
    { id: 'ciudades' as TabId, label: 'Ciudades' },
    { id: 'zonas' as TabId, label: 'Zonas' },
    { id: 'tarifas' as TabId, label: 'Tarifas de Envío' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Cobertura</h1>
        <p className="mt-1 text-sm text-muted-foreground">Administrar ciudades, zonas y tarifas de envío</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={<Globe className="h-5 w-5" />} label="Ciudades Activas" value={String(cities.filter(c => c.is_active).length)} gradient="success" />
        <StatCard icon={<MapPin className="h-5 w-5" />} label="Total Ciudades" value={String(cities.length)} gradient="primary" />
        <StatCard icon={<Globe className="h-5 w-5" />} label="Inactivas" value={String(cities.filter(c => !c.is_active).length)} gradient="warning" />
      </div>

      <Tabs tabs={tabs} activeTab={tab} onTabChange={(id) => setTab(id as TabId)} />

      {tab === 'ciudades' && (
        <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/50 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent px-5 py-3.5">
            <h3 className="text-sm font-semibold text-foreground">Ciudades</h3>
            <button onClick={() => setShowCityForm(!showCityForm)} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
              {showCityForm ? 'Cancelar' : '+ Nueva Ciudad'}
            </button>
          </div>
          <div className="p-5 space-y-2">
            {showCityForm && (
              <div className="mb-4 flex flex-wrap gap-3 rounded-xl border border-border/50 p-4 bg-muted/20">
                <Input value={newCityName} onChange={(e) => setNewCityName(e.target.value)} placeholder="Nombre de la ciudad" className="w-48" />
                <Input value={newCityDept} onChange={(e) => setNewCityDept(e.target.value)} placeholder="Departamento" className="w-40" />
                <button onClick={handleCreateCity} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  <Plus className="mr-1 inline h-4 w-4" /> Crear
                </button>
              </div>
            )}
            {cities.map((city) => (
              <div key={city.id} className="flex items-center justify-between rounded-xl border border-border/50 px-4 py-3 hover:bg-muted/30 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-foreground">{city.name}</p>
                  {city.department && <p className="text-xs text-muted-foreground">{city.department}</p>}
                </div>
                <div className="flex items-center gap-3">
                  {city.latitude && city.longitude && (
                    <span className="text-[10px] text-muted-foreground">{city.latitude.toFixed(4)}, {city.longitude.toFixed(4)}</span>
                  )}
                  <Badge variant={city.is_active ? 'default' : 'secondary'}>{city.is_active ? 'Activa' : 'Inactiva'}</Badge>
                  <button
                    onClick={() => coverageService.toggleCity(city.id, !city.is_active).then(loadAll)}
                    className={`text-xs font-medium ${city.is_active ? 'text-destructive' : 'text-success'}`}
                  >
                    {city.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'zonas' && (
        <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/50 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent px-5 py-3.5">
            <h3 className="text-sm font-semibold text-foreground">Zonas</h3>
            <button onClick={() => setShowZoneForm(!showZoneForm)} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
              {showZoneForm ? 'Cancelar' : '+ Nueva Zona'}
            </button>
          </div>
          <div className="p-5 space-y-2">
            {showZoneForm && (
              <div className="mb-4 flex flex-wrap gap-3 rounded-xl border border-border/50 p-4 bg-muted/20">
                <select value={newZoneCity} onChange={(e) => setNewZoneCity(e.target.value)} className="rounded-xl border border-border bg-background/50 px-3 py-2 text-sm">
                  <option value="">Seleccionar ciudad</option>
                  {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <Input value={newZoneName} onChange={(e) => setNewZoneName(e.target.value)} placeholder="Nombre de la zona" className="w-48" />
                <Input value={newZoneEstimate} onChange={(e) => setNewZoneEstimate(e.target.value)} placeholder="Tiempo estimado" className="w-48" />
                <button onClick={handleCreateZone} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  <Plus className="mr-1 inline h-4 w-4" /> Crear
                </button>
              </div>
            )}
            {zones.map((zone) => (
              <div key={zone.id} className="flex items-center justify-between rounded-xl border border-border/50 px-4 py-3 hover:bg-muted/30 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-foreground">{zone.name}</p>
                  <p className="text-xs text-muted-foreground">{zone.city_name}{zone.delivery_estimate ? ` · ${zone.delivery_estimate}` : ''}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={zone.is_active ? 'default' : 'secondary'}>{zone.is_active ? 'Activa' : 'Inactiva'}</Badge>
                  <button
                    onClick={() => coverageService.toggleZone(zone.id, !zone.is_active).then(loadAll)}
                    className={`text-xs font-medium ${zone.is_active ? 'text-destructive' : 'text-success'}`}
                  >
                    {zone.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'tarifas' && (
        <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/50 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent px-5 py-3.5">
            <h3 className="text-sm font-semibold text-foreground">Tarifas de Envío</h3>
            <button onClick={() => {
              if (showRateForm) { setShowRateForm(false); setEditRate({}); }
              else { setShowRateForm(true); setEditRate({ base_rate: 2.5, rate_per_km: 0.5 }); }
            }} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
              {showRateForm ? 'Cancelar' : '+ Nueva Tarifa'}
            </button>
          </div>
          <div className="p-5 space-y-2">
            {showRateForm && (
              <div className="mb-4 flex flex-wrap gap-3 rounded-xl border border-border/50 p-4 bg-muted/20">
                <select value={editRate.city_id || ''} onChange={(e) => setEditRate((prev) => ({ ...prev, city_id: e.target.value }))} className="rounded-xl border border-border bg-background/50 px-3 py-2 text-sm">
                  <option value="">Todas las ciudades</option>
                  {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <Input value={editRate.base_rate ?? ''} onChange={(e) => setEditRate((prev) => ({ ...prev, base_rate: parseFloat(e.target.value) || 0 }))} placeholder="Tarifa base" type="number" step="0.01" className="w-28" />
                <Input value={editRate.rate_per_km ?? ''} onChange={(e) => setEditRate((prev) => ({ ...prev, rate_per_km: parseFloat(e.target.value) || 0 }))} placeholder="$ / km" type="number" step="0.01" className="w-28" />
                <Input value={editRate.free_delivery_min ?? ''} onChange={(e) => setEditRate((prev) => ({ ...prev, free_delivery_min: parseFloat(e.target.value) || null }))} placeholder="Envío gratis desde" type="number" step="0.01" className="w-36" />
                <button onClick={handleUpsertRate} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  Guardar
                </button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left text-xs font-semibold text-muted-foreground">
                    <th className="pb-3 font-medium">Ciudad</th>
                    <th className="pb-3 font-medium">Tarifa Base</th>
                    <th className="pb-3 font-medium">$/km</th>
                    <th className="pb-3 font-medium">Envío Gratis</th>
                    <th className="pb-3 font-medium">Estado</th>
                    <th className="pb-3 font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((r: DeliveryRate & { cities?: { name: string } }) => (
                    <tr key={r.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <td className="py-3 text-foreground">{r.cities?.name || 'Todas'}</td>
                      <td className="py-3">${Number(r.base_rate).toFixed(2)}</td>
                      <td className="py-3">${Number(r.rate_per_km).toFixed(2)}</td>
                      <td className="py-3">{r.free_delivery_min ? `$${Number(r.free_delivery_min).toFixed(2)}` : '-'}</td>
                      <td className="py-3"><Badge variant={r.is_active ? 'default' : 'secondary'}>{r.is_active ? 'Activa' : 'Inactiva'}</Badge></td>
                      <td className="py-3">
                        <button onClick={() => coverageService.toggleRate(r.id, !r.is_active).then(loadAll)} className={`text-xs font-medium ${r.is_active ? 'text-destructive' : 'text-success'}`}>
                          {r.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
