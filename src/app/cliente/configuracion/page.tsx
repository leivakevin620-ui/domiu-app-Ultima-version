'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { clientService, AppSettings } from '@/services/client';
import { getBrowserClient } from '@/lib/db/supabase';
import { motion } from 'framer-motion';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import {
  Bell, Shield, LogOut, ChevronRight,
  Mail, Smartphone, MessageSquare, ShoppingBag, Percent, CreditCard,
  User, Trash2, X, Loader2, Eye, EyeOff
} from 'lucide-react';
import { toast } from 'sonner';

type SettingsTab = 'notifications' | 'security' | 'account';

export default function ConfiguracionPage() {
  const { profile, logout } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<SettingsTab>('account');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwVisible, setPwVisible] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleteSaving, setDeleteSaving] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    clientService.getSettings(profile.id).then(s => {
      setSettings(s);
      setLoading(false);
    });
  }, [profile?.id]);

  const handleToggle = async (key: keyof AppSettings) => {
    if (!profile?.id || !settings) return;
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    setSaving(key);
    await clientService.updateSettings(profile.id, { [key]: updated[key] });
    setSaving('');
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const tabs: { key: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'notifications', label: 'Notificaciones', icon: Bell },
    { key: 'security', label: 'Seguridad', icon: Shield },
    { key: 'account', label: 'Cuenta', icon: User },
  ];

  if (loading) return <div className="min-h-screen bg-background pb-16 lg:pb-0"><SkeletonCard /></div>;

  return (
    <div className="min-h-screen bg-background pb-16 lg:pb-0">
      <div className="sticky top-0 z-30 bg-background/70 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <h1 className="text-base font-bold text-foreground">Configuración</h1>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex gap-1 rounded-xl bg-muted/50 p-1">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center justify-center gap-1.5 flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                tab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>

        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          {tab === 'notifications' && settings && (
            <>
              <ToggleRow icon={Mail} label="Notificaciones por email" description="Recibe actualizaciones en tu correo" checked={settings.emailNotifications} loading={saving === 'emailNotifications'} onChange={() => handleToggle('emailNotifications')} />
              <ToggleRow icon={Smartphone} label="Notificaciones push" description="Recibe notificaciones en tu dispositivo" checked={settings.pushNotifications} loading={saving === 'pushNotifications'} onChange={() => handleToggle('pushNotifications')} />
              <ToggleRow icon={MessageSquare} label="Notificaciones SMS" description="Recibe mensajes de texto" checked={settings.smsNotifications} loading={saving === 'smsNotifications'} onChange={() => handleToggle('smsNotifications')} />
              <div className="h-px bg-border/30 my-4" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Tipos de notificaciones</p>
              <ToggleRow icon={ShoppingBag} label="Actualizaciones de pedidos" description="Cambios en el estado de tu pedido" checked={settings.orderUpdates} loading={saving === 'orderUpdates'} onChange={() => handleToggle('orderUpdates')} />
              <ToggleRow icon={Percent} label="Promociones y ofertas" description="Cupones y descuentos especiales" checked={settings.promotions} loading={saving === 'promotions'} onChange={() => handleToggle('promotions')} />
              <ToggleRow icon={CreditCard} label="Alertas de pago" description="Confirmaciones y recibos de pago" checked={settings.paymentAlerts} loading={saving === 'paymentAlerts'} onChange={() => handleToggle('paymentAlerts')} />
            </>
          )}

          {tab === 'security' && (
            <>
              <p className="text-xs text-muted-foreground px-1 mb-3">Gestiona tu contraseña y la seguridad de tu cuenta.</p>
              <button onClick={() => setShowPasswordModal(true)} className="flex w-full items-center justify-between rounded-2xl border border-border/30 bg-card/50 p-4 transition-all hover:border-primary/20">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">Cambiar contraseña</p>
                    <p className="text-xs text-muted-foreground">Actualiza tu contraseña directamente</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>

              {showPasswordModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowPasswordModal(false)}>
                  <div className="w-full max-w-sm mx-4 rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-foreground">Cambiar contraseña</h3>
                      <button onClick={() => setShowPasswordModal(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Nueva contraseña</label>
                        <div className="relative">
                          <input type={pwVisible ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" className="h-11 w-full rounded-xl border border-border bg-background/50 px-3 pr-10 text-sm text-foreground" />
                          <button type="button" onClick={() => setPwVisible(!pwVisible)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">{pwVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Confirmar contraseña</label>
                        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repite la contraseña" className="h-11 w-full rounded-xl border border-border bg-background/50 px-3 text-sm text-foreground" />
                      </div>
                      <button
                        onClick={async () => {
                          if (newPassword.length < 8) { toast.error('La contraseña debe tener al menos 8 caracteres'); return; }
                          if (newPassword !== confirmPassword) { toast.error('Las contraseñas no coinciden'); return; }
                          setPwSaving(true);
                          try {
                            const supabase = await getBrowserClient();
                            const { error } = await supabase.auth.updateUser({ password: newPassword });
                            if (error) throw error;
                            toast.success('Contraseña actualizada exitosamente');
                            setShowPasswordModal(false);
                            setNewPassword('');
                            setConfirmPassword('');
                          } catch { toast.error('Error al actualizar contraseña'); }
                          setPwSaving(false);
                        }}
                        disabled={pwSaving}
                        className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {pwSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Actualizando...</> : 'Actualizar contraseña'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'account' && (
            <>
              <p className="text-xs text-muted-foreground px-1 mb-3">Información de tu cuenta y acciones disponibles.</p>
              <button onClick={handleLogout} className="flex w-full items-center justify-between rounded-2xl border border-border/30 bg-card/50 p-4 transition-all hover:border-red-200 hover:bg-red-50/50">
                <div className="flex items-center gap-3">
                  <LogOut className="h-5 w-5 text-red-500" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">Cerrar sesión</p>
                    <p className="text-xs text-muted-foreground">Salir de tu cuenta</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>

              <button onClick={() => setShowDeleteConfirm(true)} className="flex w-full items-center justify-between rounded-2xl border border-border/30 bg-card/50 p-4 transition-all hover:border-red-200 hover:bg-red-50/50">
                <div className="flex items-center gap-3">
                  <Trash2 className="h-5 w-5 text-red-500" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">Eliminar cuenta</p>
                    <p className="text-xs text-muted-foreground">Esta acción es irreversible</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>

              {showDeleteConfirm && (
                <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5 text-center">
                  <p className="text-sm font-semibold text-red-700 mb-2">¿Estás seguro de eliminar tu cuenta?</p>
                  <p className="text-xs text-red-600 mb-4">Tu perfil será desactivado y los administradores revisarán la solicitud. Tus pedidos históricos se conservarán.</p>
                  <div className="mb-3">
                    <label className="mb-1 block text-xs text-red-600 font-medium">Escribe &quot;ELIMINAR&quot; para confirmar</label>
                    <input value={deleteText} onChange={e => setDeleteText(e.target.value)} placeholder="ELIMINAR" className="h-11 w-full rounded-xl border border-red-300 bg-white/50 px-3 text-sm text-center font-bold text-foreground" />
                  </div>
                  <div className="flex gap-2 justify-center">
                    <button onClick={() => setShowDeleteConfirm(false)} className="rounded-xl bg-card px-5 py-2 text-xs font-semibold text-foreground">Cancelar</button>
                    <button
                      onClick={async () => {
                        if (deleteText !== 'ELIMINAR') { toast.error('Escribe ELIMINAR para confirmar'); return; }
                        setDeleteSaving(true);
                        try {
                          const supabase = await getBrowserClient();
                          const { error } = await supabase.from('profiles').update({ deleted_at: new Date().toISOString(), status: 'inactive' }).eq('id', profile?.id);
                          if (error) throw error;
                          toast.success('Cuenta desactivada. Serás redirigido al inicio.');
                          setShowDeleteConfirm(false);
                          setTimeout(() => { logout(); router.push('/login'); }, 1500);
                        } catch { toast.error('Error al solicitar eliminación'); }
                        setDeleteSaving(false);
                      }}
                      disabled={deleteSaving || deleteText !== 'ELIMINAR'}
                      className="rounded-xl bg-red-500 px-5 py-2 text-xs font-semibold text-white disabled:opacity-50 flex items-center gap-1"
                    >
                      {deleteSaving ? <><Loader2 className="h-3 w-3 animate-spin" /> Enviando...</> : 'Solicitar eliminación'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function ToggleRow({ icon: Icon, label, description, checked, loading, onChange }: {
  icon: React.ComponentType<{ className?: string }>; label: string; description: string; checked: boolean; loading: boolean; onChange: () => void;
}) {
  return (
    <button onClick={onChange} disabled={loading} className="flex w-full items-center gap-3 rounded-2xl border border-border/30 bg-card/50 p-4 transition-all hover:border-primary/20 disabled:opacity-50">
      <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
      <div className="flex-1 text-left">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted'}`}>
        <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
      </div>
    </button>
  );
}
