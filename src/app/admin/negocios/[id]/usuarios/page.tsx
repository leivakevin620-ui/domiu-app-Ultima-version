'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { User, ArrowLeft, Mail, Phone, Shield, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { getBusinessFullDetail } from '@/app/actions/admin-business';

export default function BusinessUsuariosPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState('');
  const [owner, setOwner] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await getBusinessFullDetail(id);
        if (d) {
          setBusinessName(d.business.name);
          setOwner(d.owner);
        }
      } catch { toast.error('Error al cargar'); }
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return <div className="py-20 text-center text-slate-500">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push(`/admin/negocios/${id}`)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/50 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-900/50">
          <User className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Usuarios</h1>
          <p className="text-sm text-slate-400">{businessName}</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Propietario / Responsable</h3>
        {owner ? (
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-900/40 text-emerald-400 text-lg font-bold">
              {((owner.first_name || '')[0] || '?').toUpperCase()}
            </div>
            <div className="flex-1 space-y-1.5">
              <p className="text-base font-medium text-white">
                {[owner.first_name, owner.last_name].filter(Boolean).join(' ') || 'Sin nombre'}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
                <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {owner.email}</span>
                {owner.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {owner.phone}</span>}
                <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> Rol: {owner.role}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${owner.status === 'active' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-amber-900/40 text-amber-400'}`}>
                  {owner.status}
                </span>
              </div>
            </div>
            <button className="shrink-0 rounded-lg border border-slate-700/50 px-3 py-2 text-xs text-slate-300 hover:text-white transition-colors">
              <Lock className="h-3.5 w-3.5 inline mr-1" /> Resetear acceso
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Sin propietario asignado</p>
        )}
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Gestión de Acceso</h3>
        </div>
        <p className="text-sm text-slate-400">
          El propietario actual tiene acceso al panel de negocio con su cuenta existente. Para crear usuarios adicionales o modificar accesos, usa las siguientes opciones:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button className="rounded-lg border border-slate-700/50 bg-slate-800/50 p-4 text-left hover:border-emerald-800/50 transition-all group">
            <p className="text-sm font-medium text-white group-hover:text-emerald-400">Crear nuevo usuario</p>
            <p className="text-xs text-slate-500 mt-1">Crea una cuenta de acceso para el personal del local</p>
          </button>
          <button className="rounded-lg border border-slate-700/50 bg-slate-800/50 p-4 text-left hover:border-emerald-800/50 transition-all group">
            <p className="text-sm font-medium text-white group-hover:text-emerald-400">Asociar usuario existente</p>
            <p className="text-xs text-slate-500 mt-1">Vincular un usuario ya registrado al local</p>
          </button>
          <button className="rounded-lg border border-slate-700/50 bg-slate-800/50 p-4 text-left hover:border-emerald-800/50 transition-all group">
            <p className="text-sm font-medium text-white group-hover:text-emerald-400">Restablecer contraseña</p>
            <p className="text-xs text-slate-500 mt-1">Generar nueva contraseña temporal para el propietario</p>
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-2">
          Estas funciones requieren la creación de server actions protegidas. Por ahora, el propietario existente puede acceder al panel de negocio con su cuenta. Para crear o modificar usuarios, usa el panel de usuarios general en /admin/usuarios.
        </p>
      </div>
    </div>
  );
}
