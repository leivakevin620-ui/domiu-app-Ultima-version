'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Phone, AlertTriangle, Heart, BookOpen, ChevronDown, ChevronUp, Plus, PenLine, Save, X, FileWarning, User } from 'lucide-react';
import { useCourier } from '@/contexts/CourierContext';
import { useAuth } from '@/contexts/AuthContext';
import { updateCourierEmergencyContactAction, reportCourierIncidentAction } from '@/app/actions/courier-profile';

const severityColors: Record<string, string> = {
  minor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  moderate: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  severe: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const incidentLabels: Record<string, string> = {
  accident: 'Accidente',
  traffic_violation: 'Infracción',
  customer_complaint: 'Queja cliente',
  order_issue: 'Problema pedido',
  vehicle_issue: 'Problema vehículo',
  other: 'Otro',
};

const safetyTips = [
  { icon: Phone, text: 'Mantén tu teléfono cargado y visible' },
  { icon: User, text: 'Verifica la identidad del cliente al entregar' },
  { icon: Shield, text: 'Usa siempre tu casco y equipo de protección' },
  { icon: Heart, text: 'Hidrátate y descansa cada 4 horas' },
];

export function ShieldCard() {
  const { profile } = useAuth();
  const { courier, refresh } = useCourier();
  const driverMeta = (courier?.metadata as Record<string, unknown>) || {};
  const emergencyContact = driverMeta?.emergency_contact as Record<string, string> | null;
  const [editingContact, setEditingContact] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', phone: '', relationship: '' });
  const [saving, setSaving] = useState(false);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incidentForm, setIncidentForm] = useState({ type: 'other', description: '', severity: 'minor' });
  const [reporting, setReporting] = useState(false);
  const [expandedIncident, setExpandedIncident] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<Record<string, unknown>[]>([]);
  const [loadingIncidents, setLoadingIncidents] = useState(true);

  React.useEffect(() => {
    (async () => {
      if (!profile?.id) return;
      try {
        const { getCourierFullProfileAction } = await import('@/app/actions/courier-profile');
        const result = await getCourierFullProfileAction(profile.id);
        if (result.success) {
          setIncidents(result.incidents as Record<string, unknown>[]);
        }
      } catch {
        setIncidents([]);
      }
      setLoadingIncidents(false);
    })();
  }, [profile?.id]);

  const pendingCount = incidents.filter((i) => !i.resolved_at).length;

  const startEditing = () => {
    setContactForm({
      name: emergencyContact?.name || '',
      phone: emergencyContact?.phone || '',
      relationship: emergencyContact?.relationship || '',
    });
    setEditingContact(true);
  };

  const handleSaveContact = async () => {
    if (!profile?.id || !contactForm.name || !contactForm.phone) return;
    setSaving(true);
    try {
      await updateCourierEmergencyContactAction(profile.id, contactForm);
      refresh();
      setEditingContact(false);
    } catch (e) {
      console.error('Error saving contact:', e);
    }
    setSaving(false);
  };

  const handleReportIncident = async () => {
    if (!incidentForm.description) return;
    setReporting(true);
    try {
      await reportCourierIncidentAction({
        incident_type: incidentForm.type as 'accident' | 'traffic_violation' | 'customer_complaint' | 'order_issue' | 'vehicle_issue' | 'other',
        description: incidentForm.description,
        severity: incidentForm.severity as 'minor' | 'moderate' | 'severe' | 'critical',
      });
      setIncidentForm({ type: 'other', description: '', severity: 'minor' });
      setShowIncidentModal(false);
      const { getCourierFullProfileAction } = await import('@/app/actions/courier-profile');
      if (profile?.id) {
        const result = await getCourierFullProfileAction(profile.id);
        if (result.success) setIncidents(result.incidents as Record<string, unknown>[]);
      }
    } catch (e) {
      console.error('Error reporting incident:', e);
    }
    setReporting(false);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35 }}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#1E293B] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
    >
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/80">Seguridad</p>
            <h3 className="text-sm font-black text-white">Centro de protección</h3>
          </div>
        </div>
        {pendingCount > 0 && (
          <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30">
            {pendingCount} pendientes
          </span>
        )}
      </div>

      <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-white/60" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">Contacto de emergencia</span>
          </div>
          <button
            onClick={startEditing}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
            aria-label="Editar contacto"
          >
            <PenLine className="h-3.5 w-3.5" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {editingContact ? (
            <motion.div
              key="edit"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 overflow-hidden"
            >
              <input
                value={contactForm.name}
                onChange={(e) => setContactForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Nombre completo"
                className="h-9 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white outline-none placeholder:text-white/30 transition focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
              />
              <input
                value={contactForm.phone}
                onChange={(e) => setContactForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="Teléfono"
                className="h-9 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white outline-none placeholder:text-white/30 transition focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
              />
              <input
                value={contactForm.relationship}
                onChange={(e) => setContactForm(p => ({ ...p, relationship: e.target.value }))}
                placeholder="Parentesco"
                className="h-9 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white outline-none placeholder:text-white/30 transition focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveContact}
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-2 text-[10px] font-bold text-white transition hover:bg-emerald-600 disabled:opacity-50"
                >
                  <Save className="h-3 w-3" />
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  onClick={() => setEditingContact(false)}
                  className="flex items-center justify-center rounded-lg bg-white/5 px-3 text-white/60 transition hover:bg-white/10"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="view" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white/60">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">{emergencyContact?.name || 'No registrado'}</p>
                <p className="text-[11px] text-white/60">
                  {emergencyContact?.phone || 'Sin teléfono'}
                  {emergencyContact?.relationship && ` · ${emergencyContact.relationship}`}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-white/60" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">Incidencias</span>
          </div>
          <button
            onClick={() => setShowIncidentModal(true)}
            className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-400 transition hover:bg-emerald-500/25"
          >
            <Plus className="h-3 w-3" />
            Reportar
          </button>
        </div>

        {loadingIncidents ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : incidents.length === 0 ? (
          <p className="text-center text-[11px] text-white/40 py-3">Sin incidencias registradas</p>
        ) : (
          <div className="space-y-1.5">
            {incidents.slice(0, 5).map((inc) => {
              const isExpanded = expandedIncident === inc.id;
              const sev = (inc.severity as string) || 'minor';
              return (
                <div key={inc.id as string}>
                  <button
                    onClick={() => setExpandedIncident(isExpanded ? null : inc.id as string)}
                    className="flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-left transition hover:bg-white/[0.05]"
                  >
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${severityColors[sev] || severityColors.minor}`}>
                      <FileWarning className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-white truncate">
                          {incidentLabels[inc.incident_type as string] || (inc.incident_type as string)}
                        </span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase ${severityColors[sev] || severityColors.minor}`}>
                          {sev}
                        </span>
                      </div>
                      <p className="text-[10px] text-white/40">
                        {new Date(inc.created_at as string).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                        {inc.resolved_at ? ' · Resuelta' : ' · Pendiente'}
                      </p>
                    </div>
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-white/40" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/40" />}
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mx-3 mb-1 mt-1 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                          <p className="text-[11px] text-white/60 leading-relaxed">{inc.description as string}</p>
                          {(inc.resolution_notes as string) && (
                            <p className="mt-1.5 text-[10px] text-emerald-400/80">Resolución: {inc.resolution_notes as string}</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mb-4">
        <div className="mb-2 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-white/60" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">Consejos de seguridad</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {safetyTips.map((tip, i) => {
            const Icon = tip.icon;
            return (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/70" />
                <span className="text-[10px] text-white/60 leading-relaxed">{tip.text}</span>
              </div>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => setShowIncidentModal(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-3 text-[11px] font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:from-emerald-600 hover:to-emerald-700"
      >
        <AlertTriangle className="h-4 w-4" />
        Reportar incidencia
      </button>

      <AnimatePresence>
        {showIncidentModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowIncidentModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1E293B] p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
                    <FileWarning className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Reportar incidencia</h3>
                    <p className="text-[10px] text-white/60">Describe lo sucedido</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowIncidentModal(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-white/60 transition hover:bg-white/10"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/60">Tipo</span>
                  <select
                    value={incidentForm.type}
                    onChange={(e) => setIncidentForm(p => ({ ...p, type: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white outline-none transition focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20"
                  >
                    {Object.entries(incidentLabels).map(([k, v]) => (
                      <option key={k} value={k} className="bg-[#1E293B]">{v}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/60">Severidad</span>
                  <select
                    value={incidentForm.severity}
                    onChange={(e) => setIncidentForm(p => ({ ...p, severity: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white outline-none transition focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20"
                  >
                    <option value="minor" className="bg-[#1E293B]">Menor</option>
                    <option value="moderate" className="bg-[#1E293B]">Moderada</option>
                    <option value="severe" className="bg-[#1E293B]">Severa</option>
                    <option value="critical" className="bg-[#1E293B]">Crítica</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/60">Descripción</span>
                  <textarea
                    value={incidentForm.description}
                    onChange={(e) => setIncidentForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Describe lo sucedido..."
                    rows={4}
                    className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-semibold text-white outline-none placeholder:text-white/30 transition focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20"
                  />
                </label>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setShowIncidentModal(false)}
                  className="flex flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/5 py-2.5 text-[11px] font-bold text-white/80 transition hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleReportIncident}
                  disabled={reporting || !incidentForm.description}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-red-500 to-orange-600 py-2.5 text-[11px] font-bold text-white shadow-lg shadow-red-500/20 transition hover:from-red-600 hover:to-orange-700 disabled:opacity-50"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {reporting ? 'Enviando...' : 'Reportar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
