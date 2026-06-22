import React from 'react';
import { Sparkles, Medal, Shield, Trophy, Award, Crown } from 'lucide-react';

export const levelStyles: Record<string, { ring: string; badge: string; text: string; icon: React.ElementType }> = {
  Novato: { ring: 'from-slate-400 via-slate-300 to-slate-500', badge: 'from-slate-600 to-slate-500', text: 'text-slate-700', icon: Sparkles },
  Bronce: { ring: 'from-amber-700 via-orange-400 to-amber-800', badge: 'from-amber-700 to-orange-500', text: 'text-amber-800', icon: Medal },
  Plata: { ring: 'from-slate-300 via-white to-slate-500', badge: 'from-slate-500 to-slate-300', text: 'text-slate-700', icon: Shield },
  Oro: { ring: 'from-amber-300 via-yellow-400 to-orange-500', badge: 'from-yellow-400 to-orange-500', text: 'text-amber-700', icon: Trophy },
  Platino: { ring: 'from-slate-200 via-emerald-200 to-slate-500', badge: 'from-slate-500 to-emerald-400', text: 'text-emerald-700', icon: Award },
  Diamante: { ring: 'from-sky-300 via-cyan-300 to-blue-600', badge: 'from-cyan-400 to-blue-600', text: 'text-blue-700', icon: Sparkles },
  'Élite': { ring: 'from-fuchsia-400 via-violet-500 to-indigo-600', badge: 'from-violet-500 to-fuchsia-600', text: 'text-violet-700', icon: Crown },
};

export function getInitials(firstName?: string | null, lastName?: string | null, email?: string | null) {
  const initials = [firstName?.[0], lastName?.[0]].filter(Boolean).join('');
  return initials || email?.[0]?.toUpperCase() || '?';
}

export function formatDate(value?: string | null) {
  if (!value) return 'Pendiente';
  return new Date(value).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatCurrency(value: number) {
  return '$' + Math.round(value).toLocaleString('es-CO');
}

export function getRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}
