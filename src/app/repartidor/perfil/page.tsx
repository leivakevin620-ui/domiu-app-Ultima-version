'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Award,
  Bike,
  Calendar,
  Car,
  CheckCircle2,
  ChevronRight,
  Clock,
  Crown,
  FileCheck2,
  Gauge,
  Gift,
  Headphones,
  HelpCircle,
  IdCard,
  KeyRound,
  LogOut,
  Mail,
  MapPin,
  Medal,
  PenLine,
  Phone,
  Settings,
  Shield,
  Sparkles,
  Star,
  Timer,
  TrendingUp,
  Trophy,
  User,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { CourierProvider, useCourier } from '@/contexts/CourierContext';
import { courierProService, getCourierLevel, getNextLevel } from '@/services/courier-pro';
import { reviewService } from '@/services/reviews';
import { getBrowserClient } from '@/lib/db/supabase';
import { SkeletonCard } from '@/components/ui/skeleton';

type ReviewItem = {
  id: string;
  author_name: string;
  rating: number;
  review: string | null;
  created_at: string;
};

type CourierStats = {
  avg_rating: number;
  total_ratings: number;
  total_deliveries: number;
};

type DriverDocument = {
  label: string;
  expiry: string;
  status: 'verified' | 'pending' | 'expired';
};

const formatCurrency = (value: number) =>
  '$' + value.toLocaleString('es-CO', { minimumFractionDigits: 0 });

const formatDate = (value?: string | null) => {
  if (!value) return 'Pendiente';
  return new Date(value).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getInitials = (firstName?: string | null, lastName?: string | null, email?: string | null) => {
  const initials = [firstName?.[0], lastName?.[0]].filter(Boolean).join('');
  return initials || email?.[0]?.toUpperCase() || '?';
};

const vehicleLabels: Record<string, string> = {
  motorcycle: 'Motocicleta',
  bike: 'Bicicleta',
  car: 'Carro',
  van: 'Camioneta',
};

const levelStyles: Record<string, { ring: string; badge: string; text: string; icon: React.ElementType }> = {
  Novato: {
    ring: 'from-slate-400 via-slate-300 to-slate-500',
    badge: 'from-slate-600 to-slate-500',
    text: 'text-slate-700',
    icon: Sparkles,
  },
  Bronce: {
    ring: 'from-amber-700 via-orange-400 to-amber-800',
    badge: 'from-amber-700 to-orange-500',
    text: 'text-amber-800',
    icon: Medal,
  },
  Plata: {
    ring: 'from-slate-300 via-white to-slate-500',
    badge: 'from-slate-500 to-slate-300',
    text: 'text-slate-700',
    icon: Shield,
  },
  Oro: {
    ring: 'from-amber-300 via-yellow-400 to-orange-500',
    badge: 'from-yellow-400 to-orange-500',
    text: 'text-amber-700',
    icon: Trophy,
  },
  Platino: {
    ring: 'from-slate-200 via-emerald-200 to-slate-500',
    badge: 'from-slate-500 to-emerald-400',
    text: 'text-emerald-700',
    icon: Award,
  },
  Diamante: {
    ring: 'from-sky-300 via-cyan-300 to-blue-600',
    badge: 'from-cyan-400 to-blue-600',
    text: 'text-blue-700',
    icon: Sparkles,
  },
  Elite: {
    ring: 'from-fuchsia-400 via-violet-500 to-indigo-600',
    badge: 'from-violet-500 to-fuchsia-600',
    text: 'text-violet-700',
    icon: Crown,
  },
};

const cardMotion = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

function GlassCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      variants={cardMotion}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={`rounded-[1.35rem] border border-white/70 bg-white/75 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-5 ${className}`}
    >
      {children}
    </motion.section>
  );
}

function Stars({ rating, size = 'h-3.5 w-3.5' }: { rating: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={`${size} ${index < Math.round(rating) ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-slate-300'}`}
        />
      ))}
    </div>
  );
}

function getDocumentStatus(expiry?: string) {
  if (!expiry) return 'pending';
  const expiryTime = new Date(expiry).getTime();
  return Number.isFinite(expiryTime) && expiryTime < Date.now() ? 'expired' : 'verified';
}

function PerfilContent() {
  const { profile } = useAuth();
  const {
    courier,
    loading,
    isAvailable,
    todayEarnings,
    weekEarnings,
    monthEarnings,
    totalEarnings,
  } = useCourier();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<CourierStats | null>(null);
  const [vehicleForm, setVehicleForm] = useState({ type: 'motorcycle', plate: '', model: '' });
  const [docForm, setDocForm] = useState({ licenseNumber: '', licenseExpiry: '' });
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [savingDocs, setSavingDocs] = useState(false);

  useEffect(() => {
    (async () => {
      if (!profile?.id) return;
      const [revs, st, supabase] = await Promise.all([
        reviewService.getCourierReviews(profile.id),
        reviewService.getCourierStats(profile.id),
        getBrowserClient(),
      ]);
      setReviews(revs);
      setStats(st);
      const { data: driver } = await supabase
        .from('drivers')
        .select('vehicle_type, vehicle_plate, vehicle_model, license_number, license_expiry')
        .eq('id', profile.id)
        .single();
      if (driver) {
        setVehicleForm({
          type: driver.vehicle_type || 'motorcycle',
          plate: driver.vehicle_plate || '',
          model: driver.vehicle_model || '',
        });
        setDocForm({
          licenseNumber: driver.license_number || '',
          licenseExpiry: driver.license_expiry || '',
        });
      }
    })();
  }, [profile?.id]);

  const handleSaveVehicle = async () => {
    if (!profile?.id) return;
    setSavingVehicle(true);
    await courierProService.updateVehicle(profile.id, vehicleForm);
    setSavingVehicle(false);
  };

  const handleSaveDocs = async () => {
    if (!profile?.id) return;
    setSavingDocs(true);
    await courierProService.updateDocuments(profile.id, docForm);
    setSavingDocs(false);
  };

  const deliveredOrders = stats?.total_deliveries || courier?.total_deliveries || 0;
  const level = getCourierLevel(deliveredOrders);
  const nextLevel = getNextLevel(deliveredOrders);
  const cleanLevelTitle = level.title.replace('Ã‰', 'E');
  const levelStyle = levelStyles[cleanLevelTitle] || levelStyles.Novato;
  const LevelIcon = levelStyle.icon;
  const currentLevelStart = level.minDeliveries;
  const nextLevelTarget = nextLevel?.minDeliveries ?? Math.max(currentLevelStart + 250, deliveredOrders);
  const levelSpan = Math.max(nextLevelTarget - currentLevelStart, 1);
  const progressValue = nextLevel ? Math.min(100, ((deliveredOrders - currentLevelStart) / levelSpan) * 100) : 100;
  const avgRating = stats?.avg_rating || courier?.rating || 0;
  const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Repartidor DomiU';
  const city = String(profile?.metadata?.city || profile?.metadata?.zone || 'Ciudad principal');
  const driverId = profile?.id ? `DU-${profile.id.slice(0, 8).toUpperCase()}` : 'DU-PENDIENTE';
  const acceptedRate = Math.min(99, Math.max(92, 94 + Math.floor(deliveredOrders / 125)));
  const averageTime = deliveredOrders >= 500 ? 18 : deliveredOrders >= 100 ? 21 : 24;

  const documents: DriverDocument[] = useMemo(
    () => [
      { label: 'Licencia', expiry: docForm.licenseExpiry, status: getDocumentStatus(docForm.licenseExpiry) },
      { label: 'SOAT', expiry: 'Pendiente', status: 'pending' },
      { label: 'Tecnomecanica', expiry: 'Pendiente', status: 'pending' },
      { label: 'Documento identidad', expiry: profile?.verified_at || '', status: profile?.verified_at ? 'verified' : 'pending' },
    ],
    [docForm.licenseExpiry, profile?.verified_at],
  );

  const achievements = [
    { label: 'Primer pedido', active: deliveredOrders >= 1, icon: Trophy },
    { label: '100 entregas', active: deliveredOrders >= 100, icon: Medal },
    { label: '500 entregas', active: deliveredOrders >= 500, icon: Award },
    { label: '1000 entregas', active: deliveredOrders >= 1000, icon: Crown },
    { label: 'Calificacion perfecta', active: avgRating >= 5, icon: Star },
    { label: 'Entregas rapidas', active: averageTime <= 18, icon: Timer },
  ];

  const bonuses = [
    { label: 'Bono semanal', value: formatCurrency(Math.round(weekEarnings * 0.08)), icon: Gift, color: 'from-[#2563EB] to-[#38BDF8]' },
    { label: 'Bono mensual', value: formatCurrency(Math.round(monthEarnings * 0.12)), icon: TrendingUp, color: 'from-[#10B981] to-[#34D399]' },
    { label: 'Cashback', value: '3.5%', icon: Wallet, color: 'from-[#F59E0B] to-[#FBBF24]' },
    { label: 'Incentivos activos', value: nextLevel ? '2 disponibles' : 'Maximo nivel', icon: Sparkles, color: 'from-[#8B5CF6] to-[#EC4899]' },
  ];

  const quickActions = [
    { label: 'Editar perfil', icon: PenLine },
    { label: 'Editar vehiculo', icon: Car },
    { label: 'Cambiar contraseña', icon: KeyRound },
    { label: 'Configuracion', icon: Settings },
    { label: 'Centro de ayuda', icon: HelpCircle },
    { label: 'Cerrar sesion', icon: LogOut },
  ];

  if (loading) return <SkeletonCard />;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
      className="relative -mx-4 min-h-screen overflow-hidden bg-[#F8FAFC] px-4 pb-8 pt-3 sm:mx-0 sm:rounded-[2rem] sm:px-5 lg:px-7"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.14),transparent_34%),linear-gradient(135deg,rgba(16,185,129,0.12),transparent_42%)]" />
      <div className="relative space-y-5">
        <motion.section
          variants={cardMotion}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="overflow-hidden rounded-[1.75rem] bg-[linear-gradient(135deg,#0F172A_0%,#2563EB_52%,#10B981_130%)] p-[1px] shadow-[0_26px_70px_rgba(37,99,235,0.28)]"
        >
          <div className="relative overflow-hidden rounded-[1.7rem] bg-white/10 p-5 text-white backdrop-blur-2xl sm:p-7">
            <div className="absolute inset-x-0 top-0 h-24 bg-white/10" />
            <div className="relative grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
              <div className="flex flex-col items-center text-center sm:flex-row sm:items-end sm:text-left">
                <motion.div
                  animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                  className={`flex h-[132px] w-[132px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${levelStyle.ring} bg-[length:220%_220%] p-1 shadow-2xl`}
                >
                  <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-slate-950 text-4xl font-black text-white">
                    {profile?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.avatar_url} alt={fullName} className="h-full w-full object-cover" />
                    ) : (
                      getInitials(profile?.first_name, profile?.last_name, profile?.email)
                    )}
                  </div>
                </motion.div>

                <div className="mt-4 min-w-0 sm:ml-5 sm:mt-0">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
                    <span className={`h-2.5 w-2.5 rounded-full ${isAvailable ? 'bg-[#10B981]' : 'bg-[#EF4444]'}`} />
                    {isAvailable ? 'En linea' : 'Fuera de linea'}
                  </div>
                  <h2 className="text-2xl font-black leading-tight sm:text-3xl lg:text-4xl">{fullName}</h2>
                  <div className="mt-3 grid gap-2 text-sm text-white/80 sm:grid-cols-2">
                    <span className="flex items-center justify-center gap-1.5 sm:justify-start">
                      <MapPin className="h-4 w-4" />
                      {city}
                    </span>
                    <span className="flex items-center justify-center gap-1.5 sm:justify-start">
                      <Calendar className="h-4 w-4" />
                      Ingreso {formatDate(profile?.created_at)}
                    </span>
                    <span className="flex items-center justify-center gap-1.5 sm:justify-start">
                      <IdCard className="h-4 w-4" />
                      {driverId}
                    </span>
                    <span className="flex items-center justify-center gap-1.5 sm:justify-start">
                      <Bike className="h-4 w-4" />
                      Repartidor DomiU
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-white/20 bg-white/14 p-4 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r ${levelStyle.badge} px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white shadow-lg`}>
                    <LevelIcon className="h-4 w-4" />
                    {cleanLevelTitle}
                  </div>
                  <span className="text-xs font-semibold text-white/75">Nivel {level.level}</span>
                </div>
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold text-white/80">
                    <span>{deliveredOrders} / {nextLevelTarget} puntos</span>
                    <span>{Math.round(progressValue)}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-white/20">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progressValue}%` }}
                      transition={{ duration: 0.9, ease: 'easeOut' }}
                      className={`h-full rounded-full bg-gradient-to-r ${levelStyle.badge} shadow-[0_0_24px_rgba(255,255,255,0.35)]`}
                    />
                  </div>
                  <p className="mt-3 text-sm text-white/85">
                    {nextLevel
                      ? `Faltan ${Math.max(nextLevelTarget - deliveredOrders, 0)} puntos para subir a ${nextLevel.title.replace('Ã‰', 'E')}`
                      : 'Has alcanzado el nivel mas alto disponible'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.div variants={cardMotion} className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: 'Ganancias Hoy', value: formatCurrency(todayEarnings), icon: Wallet, color: 'text-[#10B981]' },
            { label: 'Ganancias Semana', value: formatCurrency(weekEarnings), icon: TrendingUp, color: 'text-[#2563EB]' },
            { label: 'Ganancias Mes', value: formatCurrency(monthEarnings), icon: Calendar, color: 'text-[#8B5CF6]' },
            { label: 'Ganancias Totales', value: formatCurrency(totalEarnings), icon: Trophy, color: 'text-[#F59E0B]' },
            { label: 'Pedidos Entregados', value: deliveredOrders.toLocaleString('es-CO'), icon: Award, color: 'text-[#2563EB]' },
            { label: 'Calificacion', value: `${avgRating.toFixed(1)} / 5.0`, icon: Star, color: 'text-[#F59E0B]', stars: true },
            { label: 'Tiempo Promedio', value: `${averageTime} min`, icon: Clock, color: 'text-[#10B981]' },
            { label: 'Tasa de Aceptacion', value: `${acceptedRate}%`, icon: Gauge, color: 'text-[#2563EB]' },
          ].map((item, index) => (
            <motion.div
              key={item.label}
              variants={cardMotion}
              transition={{ delay: index * 0.03, duration: 0.3 }}
              className="rounded-[1.1rem] border border-white/70 bg-white/80 p-3 shadow-[0_14px_35px_rgba(15,23,42,0.07)] backdrop-blur-xl sm:p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{item.label}</span>
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
              {item.stars && <Stars rating={avgRating} />}
              <p className={`mt-1 text-lg font-black leading-tight sm:text-xl ${item.color}`}>{item.value}</p>
            </motion.div>
          ))}
        </motion.div>

        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <GlassCard>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#2563EB]">Vehiculo</p>
                <h3 className="text-lg font-black text-slate-950">Unidad de reparto</h3>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2563EB]/10 text-[#2563EB]">
                <Bike className="h-6 w-6" />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="relative flex min-h-44 items-center justify-center overflow-hidden rounded-[1.25rem] bg-gradient-to-br from-slate-950 via-[#2563EB] to-[#10B981] p-4 text-white">
                <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.18),transparent)]" />
                <Bike className="h-24 w-24 drop-shadow-2xl" />
                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-white/70">{vehicleLabels[vehicleForm.type] || 'Vehiculo'}</p>
                    <p className="text-xl font-black">{vehicleForm.model || 'Modelo pendiente'}</p>
                  </div>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black backdrop-blur">
                    {vehicleForm.plate || 'ABC123'}
                  </span>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Tipo</span>
                    <select
                      value={vehicleForm.type}
                      onChange={(event) => setVehicleForm({ ...vehicleForm, type: event.target.value })}
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
                    >
                      <option value="motorcycle">Motocicleta</option>
                      <option value="bike">Bicicleta</option>
                      <option value="car">Carro</option>
                      <option value="van">Camioneta</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Placa</span>
                    <input
                      value={vehicleForm.plate}
                      onChange={(event) => setVehicleForm({ ...vehicleForm, plate: event.target.value.toUpperCase() })}
                      placeholder="ABC123"
                      maxLength={10}
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold uppercase text-slate-800 outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Modelo</span>
                  <input
                    value={vehicleForm.model}
                    onChange={(event) => setVehicleForm({ ...vehicleForm, model: event.target.value })}
                    placeholder="Yamaha XTZ 150 2024"
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
                  />
                </label>
                <button
                  onClick={handleSaveVehicle}
                  disabled={savingVehicle}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#2563EB] px-4 text-sm font-black text-white shadow-[0_14px_28px_rgba(37,99,235,0.28)] transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingVehicle ? 'Guardando...' : 'Guardar vehiculo'}
                </button>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#10B981]">Documentos</p>
                <h3 className="text-lg font-black text-slate-950">Validacion operativa</h3>
              </div>
              <FileCheck2 className="h-6 w-6 text-[#10B981]" />
            </div>

            <div className="grid gap-2">
              {documents.map((doc) => {
                const statusMap = {
                  verified: { label: 'Verificado', icon: CheckCircle2, className: 'bg-[#10B981]/10 text-[#047857]' },
                  pending: { label: 'Pendiente', icon: Clock, className: 'bg-[#F59E0B]/10 text-[#B45309]' },
                  expired: { label: 'Vencido', icon: XCircle, className: 'bg-[#EF4444]/10 text-[#B91C1C]' },
                }[doc.status];
                return (
                  <div key={doc.label} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
                    <div>
                      <p className="text-sm font-black text-slate-900">{doc.label}</p>
                      <p className="text-xs font-medium text-slate-500">
                        Vence: {doc.expiry === 'Pendiente' ? 'Pendiente' : formatDate(doc.expiry)}
                      </p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ${statusMap.className}`}>
                      <statusMap.icon className="h-3.5 w-3.5" />
                      {statusMap.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Numero licencia</span>
                <input
                  value={docForm.licenseNumber}
                  onChange={(event) => setDocForm({ ...docForm, licenseNumber: event.target.value })}
                  placeholder="Ingresa tu licencia"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Vencimiento</span>
                <input
                  value={docForm.licenseExpiry}
                  onChange={(event) => setDocForm({ ...docForm, licenseExpiry: event.target.value })}
                  type="date"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
                />
              </label>
            </div>
            <button
              onClick={handleSaveDocs}
              disabled={savingDocs}
              className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[#10B981] px-4 text-sm font-black text-white shadow-[0_14px_28px_rgba(16,185,129,0.24)] transition hover:bg-emerald-600 disabled:opacity-50"
            >
              {savingDocs ? 'Guardando...' : 'Guardar documentos'}
            </button>
          </GlassCard>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <GlassCard>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#F59E0B]">Logros</p>
                <h3 className="text-lg font-black text-slate-950">Insignias DomiU</h3>
              </div>
              <Trophy className="h-6 w-6 text-[#F59E0B]" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {achievements.map((achievement, index) => (
                <motion.div
                  key={achievement.label}
                  variants={cardMotion}
                  transition={{ delay: index * 0.04 }}
                  className={`rounded-2xl border p-3 text-center ${
                    achievement.active
                      ? 'border-[#F59E0B]/30 bg-[#F59E0B]/10 text-slate-950'
                      : 'border-slate-100 bg-slate-50 text-slate-400'
                  }`}
                >
                  <achievement.icon className={`mx-auto h-7 w-7 ${achievement.active ? 'text-[#F59E0B]' : 'text-slate-300'}`} />
                  <p className="mt-2 text-xs font-black leading-tight">{achievement.label}</p>
                </motion.div>
              ))}
            </div>
          </GlassCard>

          <GlassCard>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#2563EB]">Bonificaciones</p>
                <h3 className="text-lg font-black text-slate-950">Impulso de ganancias</h3>
              </div>
              <Gift className="h-6 w-6 text-[#2563EB]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {bonuses.map((bonus) => (
                <div key={bonus.label} className={`rounded-2xl bg-gradient-to-br ${bonus.color} p-3 text-white shadow-lg`}>
                  <bonus.icon className="h-5 w-5" />
                  <p className="mt-3 text-xs font-semibold text-white/80">{bonus.label}</p>
                  <p className="text-lg font-black">{bonus.value}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <GlassCard>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#2563EB]">Contacto</p>
                <h3 className="text-lg font-black text-slate-950">Informacion personal</h3>
              </div>
              <User className="h-6 w-6 text-[#2563EB]" />
            </div>
            <div className="grid gap-3">
              {[
                { label: 'Email', value: profile?.email || 'Pendiente', icon: Mail },
                { label: 'Telefono', value: profile?.phone || 'Pendiente', icon: Phone },
                { label: 'Rol', value: 'Repartidor', icon: Shield },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{item.label}</p>
                    <p className="truncate text-sm font-black text-slate-900">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#F59E0B]">Resenas</p>
                <h3 className="text-lg font-black text-slate-950">Ultimas calificaciones</h3>
              </div>
              <span className="rounded-full bg-[#F59E0B]/10 px-3 py-1 text-xs font-black text-[#B45309]">
                {reviews.length} reseñas
              </span>
            </div>
            <div className="space-y-3">
              {(reviews.length > 0 ? reviews.slice(0, 3) : [
                { id: 'demo-1', author_name: 'Cliente DomiU', rating: Math.max(avgRating, 5), review: 'Excelente servicio', created_at: new Date().toISOString() },
                { id: 'demo-2', author_name: 'Pedido reciente', rating: 5, review: 'Muy amable', created_at: new Date().toISOString() },
                { id: 'demo-3', author_name: 'Entrega express', rating: 4, review: 'Llego rapido', created_at: new Date().toISOString() },
              ]).map((review) => (
                <div key={review.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">{review.author_name}</p>
                      <p className="text-xs font-medium text-slate-500">{formatDate(review.created_at)}</p>
                    </div>
                    <Stars rating={review.rating} />
                  </div>
                  {review.review && <p className="mt-2 text-sm font-medium text-slate-600">&quot;{review.review}&quot;</p>}
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        <GlassCard>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Configuracion</p>
              <h3 className="text-lg font-black text-slate-950">Accesos rapidos</h3>
            </div>
            <Headphones className="h-6 w-6 text-slate-500" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                className="flex h-14 items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-3 text-left transition hover:border-[#2563EB]/25 hover:bg-white hover:shadow-md"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#2563EB] shadow-sm">
                    <action.icon className="h-4 w-4" />
                  </span>
                  <span className="truncate text-sm font-black text-slate-800">{action.label}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </button>
            ))}
          </div>
        </GlassCard>
      </div>
    </motion.div>
  );
}

export default function RepartidorPerfil() {
  const { profile } = useAuth();
  return (
    <CourierProvider courierId={profile?.id}>
      <PerfilContent />
    </CourierProvider>
  );
}
