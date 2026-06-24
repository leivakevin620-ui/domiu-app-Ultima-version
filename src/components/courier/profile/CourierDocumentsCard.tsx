'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileCheck2, Clock, XCircle, Save, IdCard, Shield, Gauge, Camera } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { DOCUMENT_TYPES } from '@/lib/mock/courier-profile';

const iconMap: Record<string, React.ElementType> = {
  IdCard, FileCheck2, Shield, Gauge, Camera,
};

const statusConfig = {
  verified: { label: 'Verificado', icon: FileCheck2, className: 'bg-emerald-50 text-emerald-700' },
  pending: { label: 'Pendiente', icon: Clock, className: 'bg-amber-50 text-amber-700' },
  expired: { label: 'Vencido', icon: XCircle, className: 'bg-red-50 text-red-700' },
};

export function CourierDocumentsCard() {
  const { profile } = useAuth();
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [saving, setSaving] = useState(false);
  type DocStatus = 'verified' | 'pending' | 'expired';
  const [documents, setDocuments] = useState<{ key: string; label: string; status: DocStatus; icon: string }[]>(DOCUMENT_TYPES);

  useEffect(() => {
    (async () => {
      if (!profile?.id) return;
      try {
        const { getBrowserClient } = await import('@/lib/db/supabase');
        const supabase = getBrowserClient();
        const { data: driver } = await supabase
          .from('drivers')
          .select('license_number, license_expiry, is_verified, vehicle_type')
          .eq('id', profile.id)
          .single();
        if (driver) {
          setLicenseNumber(driver.license_number || '');
          setLicenseExpiry(driver.license_expiry || '');
          setDocuments(prev => prev.map(d => {
            if (d.key === 'license') {
              const expiry = driver.license_expiry;
              const expired = expiry && new Date(expiry).getTime() < Date.now();
              return { ...d, status: expired ? 'expired' as const : (driver.license_number ? 'verified' as const : 'pending' as const) };
            }
            if (d.key === 'id') return { ...d, status: (profile?.verified_at ? 'verified' as const : 'pending' as const) };
            return d;
          }));
        }
      } catch (e) {
        console.error('Error cargando documentos:', e);
      }
    })();
  }, [profile?.id, profile?.verified_at]);

  const handleSave = async () => {
    if (!profile?.id) return;
    setSaving(true);
    try {
      const { updateDriverProfileAction } = await import('@/app/actions/auth');
      await updateDriverProfileAction(profile.id, {
        license_number: licenseNumber,
      });
      setDocuments(prev => prev.map(d => d.key === 'license' ? { ...d, status: 'verified' as const } : d));
    } catch (e) {
      console.error('Error guardando documentos:', e);
    }
    setSaving(false);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-xl border border-white/70 bg-white/80 p-4 shadow-[0_8px_25px_rgba(15,23,42,0.06)] backdrop-blur"
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Documentos</p>
          <h3 className="text-base font-black text-slate-900">Validación operativa</h3>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
          {documents.filter(d => d.status === 'verified').length}/{documents.length} verificados
        </span>
      </div>

      <div className="space-y-1.5">
        {documents.map((doc) => {
          const Icon = iconMap[doc.icon] || FileCheck2;
          const status = statusConfig[doc.status];
          const StatusIcon = status.icon;
          return (
            <div key={doc.key} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{doc.label}</p>
                </div>
              </div>
              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${status.className}`}>
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">N° Licencia</span>
          <input
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
            placeholder="Ingresa tu licencia"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10"
            aria-label="Número de licencia"
          />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Vencimiento</span>
          <input
            value={licenseExpiry}
            onChange={(e) => setLicenseExpiry(e.target.value)}
            type="date"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10"
            aria-label="Fecha de vencimiento de licencia"
          />
        </label>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-3 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-50"
        aria-label={saving ? 'Guardando documentos' : 'Guardar documentos'}
      >
        <Save className="h-3.5 w-3.5" />
        {saving ? 'Guardando...' : 'Guardar documentos'}
      </button>
    </motion.section>
  );
}
