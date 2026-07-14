'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Save, Store } from 'lucide-react';
import { toast } from 'sonner';
import { getBusinessFullDetail, updateBusinessHoursAction } from '@/app/actions/admin-business';
import { updateBusinessCompleteAction } from '@/app/actions/admin-business-management';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const TYPES = [['restaurant','Restaurante'],['fast_food','Comida rápida'],['cafe','Cafetería'],['bakery','Panadería'],['supermarket','Supermercado'],['pharmacy','Farmacia'],['store','Tienda'],['other','Otro']];

type Hours = { day_of_week: number; opens_at: string; closes_at: string; is_closed: boolean };

export default function EditarNegocioPage() {
  const id = useParams().id as string;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'general'|'hours'>('general');
  const [hours, setHours] = useState<Hours[]>([]);
  const [form, setForm] = useState({
    name:'', description:'', cuisineType:'', businessType:'restaurant', phone:'', email:'', website:'',
    isVerified:false, addressId:'', address:'', city:'Santa Marta', latitude:'', longitude:'',
  });

  useEffect(() => {
    (async () => {
      try {
        const detail = await getBusinessFullDetail(id);
        if (!detail) return toast.error('Negocio no encontrado');
        const address = detail.addresses?.find((a: any) => a.is_primary) || detail.addresses?.[0];
        setForm({
          name: detail.business.name || '', description: detail.business.description || '',
          cuisineType: detail.business.cuisine_type || '', businessType: detail.business.business_type || 'restaurant',
          phone: detail.business.phone || '', email: detail.business.email || '', website: detail.business.website || '',
          isVerified: !!detail.business.is_verified, addressId: address?.id || '', address: address?.street_address || '',
          city: address?.city || 'Santa Marta', latitude: address?.latitude?.toString() || '', longitude: address?.longitude?.toString() || '',
        });
        setHours(detail.hours?.map((h:any) => ({ day_of_week:h.day_of_week, opens_at:h.opens_at?.slice(0,5)||'08:00', closes_at:h.closes_at?.slice(0,5)||'22:00', is_closed:!!h.is_closed })) || []);
      } catch { toast.error('No se pudieron cargar los datos'); }
      finally { setLoading(false); }
    })();
  }, [id]);

  const set = (key:string, value:string|boolean) => setForm(prev => ({...prev,[key]:value}));
  const input = 'h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none';
  const label = 'text-xs font-semibold text-muted-foreground';

  const saveGeneral = async (e:React.FormEvent) => {
    e.preventDefault();
    if (!form.addressId) return toast.error('El negocio no tiene una dirección principal válida');
    setSaving(true);
    try {
      const result = await updateBusinessCompleteAction({
        businessId:id, name:form.name, description:form.description, cuisineType:form.cuisineType,
        businessType:form.businessType, phone:form.phone, email:form.email, website:form.website,
        isVerified:form.isVerified, addressId:form.addressId, address:form.address, city:form.city,
        latitude:form.latitude ? Number(form.latitude) : null, longitude:form.longitude ? Number(form.longitude) : null,
      });
      if (result.error) return toast.error(result.error);
      toast.success('Negocio y dirección actualizados');
      router.refresh();
    } finally { setSaving(false); }
  };

  const saveHours = async () => {
    for (const h of hours) if (!h.is_closed && h.opens_at >= h.closes_at) return toast.error(`Horario inválido en ${DAYS[h.day_of_week]}`);
    setSaving(true);
    try {
      const result = await updateBusinessHoursAction(id, hours);
      if (result.error) return toast.error(result.error);
      toast.success('Horarios actualizados');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="py-20 text-center text-muted-foreground">Cargando negocio...</div>;

  return <div className="mx-auto max-w-3xl space-y-6">
    <div className="flex items-center gap-3">
      <button onClick={() => router.push(`/admin/negocios/${id}`)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border"><ArrowLeft className="h-4 w-4" /></button>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/20"><Store className="h-5 w-5 text-success" /></div>
      <div><h1 className="text-xl font-bold">Editar {form.name}</h1><p className="text-sm text-muted-foreground">Datos comerciales, ubicación y horarios</p></div>
    </div>

    <div className="flex border-b border-border">
      <button onClick={() => setTab('general')} className={`px-4 py-3 text-sm border-b-2 ${tab==='general'?'border-success text-success':'border-transparent text-muted-foreground'}`}>Información y dirección</button>
      <button onClick={() => setTab('hours')} className={`px-4 py-3 text-sm border-b-2 ${tab==='hours'?'border-success text-success':'border-transparent text-muted-foreground'}`}>Horarios</button>
    </div>

    {tab === 'general' && <form onSubmit={saveGeneral} className="space-y-5">
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Información comercial</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5"><span className={label}>Nombre *</span><input required minLength={3} value={form.name} onChange={e=>set('name',e.target.value)} className={input}/></label>
          <label className="space-y-1.5"><span className={label}>Tipo *</span><select value={form.businessType} onChange={e=>set('businessType',e.target.value)} className={input}>{TYPES.map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
          <label className="space-y-1.5"><span className={label}>Categoría o cocina</span><input value={form.cuisineType} onChange={e=>set('cuisineType',e.target.value)} className={input}/></label>
          <label className="space-y-1.5"><span className={label}>Teléfono</span><input value={form.phone} onChange={e=>set('phone',e.target.value)} className={input}/></label>
          <label className="space-y-1.5"><span className={label}>Correo</span><input type="email" value={form.email} onChange={e=>set('email',e.target.value)} className={input}/></label>
          <label className="space-y-1.5"><span className={label}>Sitio web</span><input value={form.website} onChange={e=>set('website',e.target.value)} className={input}/></label>
        </div>
        <label className="block space-y-1.5"><span className={label}>Descripción</span><textarea maxLength={1200} rows={3} value={form.description} onChange={e=>set('description',e.target.value)} className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm"/></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.isVerified} onChange={e=>set('isVerified',e.target.checked)}/><span className="text-sm">Negocio verificado</span></label>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Dirección principal</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5 md:col-span-2"><span className={label}>Dirección *</span><input required minLength={5} value={form.address} onChange={e=>set('address',e.target.value)} className={input}/></label>
          <label className="space-y-1.5"><span className={label}>Ciudad *</span><input required value={form.city} onChange={e=>set('city',e.target.value)} className={input}/></label>
          <div />
          <label className="space-y-1.5"><span className={label}>Latitud</span><input type="number" step="any" min="-90" max="90" value={form.latitude} onChange={e=>set('latitude',e.target.value)} className={input}/></label>
          <label className="space-y-1.5"><span className={label}>Longitud</span><input type="number" step="any" min="-180" max="180" value={form.longitude} onChange={e=>set('longitude',e.target.value)} className={input}/></label>
        </div>
      </section>
      <button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-success px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>} Guardar información completa</button>
    </form>}

    {tab === 'hours' && <section className="rounded-xl border border-border bg-card p-5 space-y-3">
      {hours.map(h => <div key={h.day_of_week} className="grid grid-cols-[100px_90px_1fr_1fr] items-center gap-3 rounded-lg bg-muted/30 p-3">
        <span className="text-sm font-medium">{DAYS[h.day_of_week]}</span>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!h.is_closed} onChange={()=>setHours(prev=>prev.map(x=>x.day_of_week===h.day_of_week?{...x,is_closed:!x.is_closed}:x))}/> Abierto</label>
        <input disabled={h.is_closed} type="time" value={h.opens_at} onChange={e=>setHours(prev=>prev.map(x=>x.day_of_week===h.day_of_week?{...x,opens_at:e.target.value}:x))} className={input}/>
        <input disabled={h.is_closed} type="time" value={h.closes_at} onChange={e=>setHours(prev=>prev.map(x=>x.day_of_week===h.day_of_week?{...x,closes_at:e.target.value}:x))} className={input}/>
      </div>)}
      <button onClick={saveHours} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-success px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>} Guardar horarios</button>
    </section>}
  </div>;
}
