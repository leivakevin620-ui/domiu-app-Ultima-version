"use client";

import { useState, useEffect } from "react";
import { Store, Save, X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { useNegocio } from "@/context/negocio/NegocioContext";

const categorias = ["Restaurantes", "Tiendas", "Licoreras", "Droguerias", "Promociones"];

export default function PerfilPage() {
  const { negocio, refetch } = useNegocio();
  const [form, setForm] = useState({
    nombre: "", categoria: "Restaurantes", telefono: "", direccion: "", descripcion: "",
    logo: "", banner: "", tiempo_estimado: "", domicilio_cost: "", abierto: true, horario: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (negocio) {
      setForm({
        nombre: negocio.nombre || "",
        categoria: negocio.categoria || "Restaurantes",
        telefono: negocio.telefono || "",
        direccion: negocio.direccion || "",
        descripcion: negocio.descripcion || "",
        logo: negocio.logo || "",
        banner: negocio.banner || "",
        tiempo_estimado: negocio.tiempo_estimado || "30-45 min",
        domicilio_cost: String(negocio.domicilio_cost || 3000),
        abierto: negocio.abierto ?? true,
        horario: negocio.horario || "Lun-Dom 8:00-22:00",
      });
    }
  }, [negocio]);

  const handleSave = async () => {
    if (!negocio?.id) return;
    setSaving(true);
    setMsg("");
    const { error } = await getSupabaseClient()
      .from("negocios")
      .update({
        nombre: form.nombre,
        categoria: form.categoria,
        telefono: form.telefono,
        direccion: form.direccion,
        descripcion: form.descripcion,
        logo: form.logo,
        banner: form.banner,
        tiempo_estimado: form.tiempo_estimado,
        domicilio_cost: Number(form.domicilio_cost) || 0,
        abierto: form.abierto,
        horario: form.horario,
      })
      .eq("id", negocio.id);
    if (error) {
      setMsg("Error al guardar: " + error.message);
    } else {
      setMsg("Cambios guardados correctamente");
      refetch();
    }
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  };

  if (!negocio) return null;

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Mi perfil</h1>

      {msg && (
        <div className={`px-4 py-3 rounded-xl mb-4 text-sm font-medium ${msg.includes("Error") ? "bg-red-500/10 text-red-400 border border-red-500/30" : "bg-green-500/10 text-green-400 border border-green-500/30"}`}>
          {msg}
        </div>
      )}

      <div className="bg-domi-dark rounded-2xl p-5 mb-4">
        <h2 className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-4">Informacion del negocio</h2>
        <div className="grid gap-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Nombre del negocio</label>
              <input type="text" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full bg-domi-black border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-white/30 outline-none focus:border-domi-yellow/50" />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Categoria</label>
              <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="w-full bg-domi-black border border-white/10 rounded-xl py-3 px-4 text-sm text-white outline-none focus:border-domi-yellow/50">
                {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Telefono</label>
              <input type="tel" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="w-full bg-domi-black border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-white/30 outline-none focus:border-domi-yellow/50" />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Direccion</label>
              <input type="text" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} className="w-full bg-domi-black border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-white/30 outline-none focus:border-domi-yellow/50" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1.5">Descripcion</label>
            <textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} rows={2} className="w-full bg-domi-black border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-white/30 outline-none focus:border-domi-yellow/50 resize-none" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Tiempo estimado</label>
              <input type="text" value={form.tiempo_estimado} onChange={(e) => setForm({ ...form, tiempo_estimado: e.target.value })} placeholder="30-45 min" className="w-full bg-domi-black border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-white/30 outline-none focus:border-domi-yellow/50" />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Costo domicilio ($)</label>
              <input type="number" value={form.domicilio_cost} onChange={(e) => setForm({ ...form, domicilio_cost: e.target.value })} className="w-full bg-domi-black border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-white/30 outline-none focus:border-domi-yellow/50" />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Horario</label>
              <input type="text" value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} className="w-full bg-domi-black border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-white/30 outline-none focus:border-domi-yellow/50" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1.5">URL del logo</label>
            <input type="text" value={form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value })} className="w-full bg-domi-black border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-white/30 outline-none focus:border-domi-yellow/50" />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1.5">URL del banner</label>
            <input type="text" value={form.banner} onChange={(e) => setForm({ ...form, banner: e.target.value })} className="w-full bg-domi-black border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-white/30 outline-none focus:border-domi-yellow/50" />
          </div>
        </div>
      </div>

      {/* Estado */}
      <div className="bg-domi-dark rounded-2xl p-5 mb-6">
        <h2 className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-4">Estado del negocio</h2>
        <div className="flex items-center gap-4">
          <button onClick={() => setForm({ ...form, abierto: true })} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${form.abierto ? "bg-green-500 text-white" : "bg-white/5 text-white/40"}`}>
            Abierto
          </button>
          <button onClick={() => setForm({ ...form, abierto: false })} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${!form.abierto ? "bg-red-500 text-white" : "bg-white/5 text-white/40"}`}>
            Cerrado
          </button>
        </div>
      </div>

      {/* Save */}
      <button onClick={handleSave} disabled={saving} className="w-full py-4 rounded-2xl bg-domi-yellow text-domi-black font-bold text-base disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
        <Save size={20} />
        {saving ? "Guardando..." : "Guardar cambios"}
      </button>
    </div>
  );
}
