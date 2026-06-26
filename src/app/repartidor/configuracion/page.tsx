'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Settings, User, Bike, Bell, Shield, LogOut, ChevronRight, MapPin, Clock } from 'lucide-react';

export default function ConfiguracionPage() {
  const { logout } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      router.replace('/login');
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in pb-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/20 to-sky-600/10">
          <Settings className="h-5 w-5 text-sky-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Configuración</h1>
          <p className="mt-1 text-sm text-muted-foreground">Administra tu cuenta y preferencias</p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <Section title="Cuenta" icon={User} color="text-blue-400" gradient="from-blue-500/20 to-blue-600/10">
          <SettingRow label="Datos personales" href="/repartidor/perfil" />
          <SettingRow label="Cambiar contraseña" href="/login?reset=password" />
        </Section>

        <Section title="Vehículo" icon={Bike} color="text-emerald-400" gradient="from-emerald-500/20 to-emerald-600/10">
          <SettingRow label="Información del vehículo" href="/repartidor/perfil" />
          <SettingRow label="Documentos" href="/repartidor/perfil" />
        </Section>

        <Section title="Disponibilidad" icon={Clock} color="text-amber-400" gradient="from-amber-500/20 to-amber-600/10">
          <SettingRow label="Horario laboral" href="/repartidor/perfil" />
          <SettingRow label="Estado actual" href="/repartidor" />
        </Section>

        <Section title="Notificaciones" icon={Bell} color="text-violet-400" gradient="from-violet-500/20 to-violet-600/10">
          <SettingRow label="Preferencias de notificación" href="/repartidor/perfil" />
        </Section>

        <Section title="Ubicación" icon={MapPin} color="text-rose-400" gradient="from-rose-500/20 to-rose-600/10">
          <SettingRow label="Zona de trabajo" href="/repartidor/mapa" />
        </Section>

        <Section title="Seguridad" icon={Shield} color="text-cyan-400" gradient="from-cyan-500/20 to-cyan-600/10">
          <SettingRow label="Contacto de emergencia" href="/repartidor/perfil" />
        </Section>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5"
      >
        <h3 className="text-sm font-bold text-red-400 mb-2">Cerrar Sesión</h3>
        <p className="text-xs text-red-300/70 mb-4">Desconecta tu cuenta de este dispositivo</p>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition-all hover:shadow-xl hover:shadow-red-500/30 hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
          {loggingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
        </button>
      </motion.div>
    </div>
  );
}

function Section({ title, icon: Icon, color, gradient, children }: { title: string; icon: React.ComponentType<{ className?: string }>; color: string; gradient: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden shadow-card">
      <div className={`flex items-center gap-2 border-b border-border/30 bg-gradient-to-r ${gradient} px-4 py-3`}>
        <Icon className={`h-4 w-4 ${color}`} />
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">{title}</h3>
      </div>
      <div className="divide-y divide-border/30">{children}</div>
    </div>
  );
}

function SettingRow({ label, href }: { label: string; href: string }) {
  return (
    <a href={href} className="flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-muted/50">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </a>
  );
}
