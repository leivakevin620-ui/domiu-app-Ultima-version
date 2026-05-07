"use client";

import { useState, useEffect } from "react";
import { Package, Plus, Edit2, Trash2, Eye, EyeOff, X, Check, AlertCircle } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { useNegocio } from "@/context/negocio/NegocioContext";

type Producto = {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  categoria_producto: string;
  imagen_url: string;
  disponible: boolean;
};

export default function ProductosPage() {
  const { negocio } = useNegocio();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: "", descripcion: "", precio: "", categoria_producto: "General", imagen_url: "" });

  useEffect(() => {
    if (!negocio?.id) return;
    getSupabaseClient().from("productos").select("*").eq("negocio_id", negocio.id).order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setProductos(data);
    });
  }, [negocio?.id]);

  const resetForm = () => { setForm({ nombre: "", descripcion: "", precio: "", categoria_producto: "General", imagen_url: "" }); setEditId(null); setShowForm(false); };

  const openEdit = (p: Producto) => {
    setForm({ nombre: p.nombre, descripcion: p.descripcion, precio: String(p.precio), categoria_producto: p.categoria_producto, imagen_url: p.imagen_url });
    setEditId(p.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!negocio?.id || !form.nombre || !form.precio) return;
    const data = { nombre: form.nombre, descripcion: form.descripcion, precio: Number(form.precio), categoria_producto: form.categoria_producto, imagen_url: form.imagen_url, negocio_id: negocio.id };
    if (editId) {
      await getSupabaseClient().from("productos").update(data).eq("id", editId);
    } else {
      await getSupabaseClient().from("productos").insert(data);
    }
    const { data: updated } = await getSupabaseClient().from("productos").select("*").eq("negocio_id", negocio.id).order("created_at", { ascending: false });
    if (updated) setProductos(updated);
    resetForm();
  };

  const toggleDisponible = async (p: Producto) => {
    await getSupabaseClient().from("productos").update({ disponible: !p.disponible }).eq("id", p.id);
    setProductos((prev) => prev.map((x) => x.id === p.id ? { ...x, disponible: !x.disponible } : x));
  };

  const eliminar = async (id: string) => {
    if (!confirm("Eliminar este producto?")) return;
    await getSupabaseClient().from("productos").delete().eq("id", id);
    setProductos((prev) => prev.filter((x) => x.id !== id));
  };

  const categorias = ["General", "Pizzas", "Bebidas", "Abarrotes", "Lacteos", "Panaderia", "Limpieza", "Cervezas", "Vinos", "Licores", "Cocteles", "Medicamentos", "Cuidado Personal", "Rolls", "Nigiri", "Postres", "Desayunos", "Almuerzos", "Cenas"];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Productos</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-domi-yellow text-domi-black text-sm font-bold">
          <Plus size={16} /> Agregar
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="bg-domi-dark rounded-2xl p-5 mb-5 border border-domi-yellow/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm">{editId ? "Editar producto" : "Nuevo producto"}</h2>
            <button onClick={resetForm}><X size={18} className="text-white/40" /></button>
          </div>
          <div className="grid gap-3">
            <input type="text" placeholder="Nombre *" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full bg-domi-black border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-white/30 outline-none focus:border-domi-yellow/50" />
            <input type="text" placeholder="Descripcion" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className="w-full bg-domi-black border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-white/30 outline-none focus:border-domi-yellow/50" />
            <div className="grid grid-cols-2 gap-3">
              <input type="number" placeholder="Precio *" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} className="w-full bg-domi-black border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-white/30 outline-none focus:border-domi-yellow/50" />
              <select value={form.categoria_producto} onChange={(e) => setForm({ ...form, categoria_producto: e.target.value })} className="w-full bg-domi-black border border-white/10 rounded-xl py-3 px-4 text-sm text-white outline-none focus:border-domi-yellow/50">
                {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <input type="text" placeholder="URL de imagen (opcional)" value={form.imagen_url} onChange={(e) => setForm({ ...form, imagen_url: e.target.value })} className="w-full bg-domi-black border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-white/30 outline-none focus:border-domi-yellow/50" />
            <button onClick={handleSave} disabled={!form.nombre || !form.precio} className="py-3 rounded-xl bg-domi-yellow text-domi-black font-bold text-sm disabled:opacity-50">
              {editId ? "Guardar cambios" : "Crear producto"}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {productos.length === 0 ? (
        <div className="text-center py-16">
          <Package size={40} className="mx-auto text-white/20 mb-3" />
          <p className="text-white/50 text-sm">No tienes productos aun</p>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="mt-4 px-6 py-3 rounded-xl bg-domi-yellow text-domi-black font-bold text-sm">Crear primer producto</button>
        </div>
      ) : (
        <div className="grid gap-3">
          {productos.map((p) => (
            <div key={p.id} className={`bg-domi-dark rounded-2xl p-4 transition-all ${!p.disponible ? "opacity-50" : ""}`}>
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-domi-yellow/10 to-white/5 flex items-center justify-center text-2xl shrink-0 border border-white/5">
                  🍽️
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-sm">{p.nombre}</h4>
                      <p className="text-xs text-white/40 mt-0.5">{p.descripcion || "Sin descripcion"}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => toggleDisponible(p)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10" title={p.disponible ? "Desactivar" : "Activar"}>
                        {p.disponible ? <Eye size={14} className="text-green-400" /> : <EyeOff size={14} className="text-red-400" />}
                      </button>
                      <button onClick={() => openEdit(p)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10" title="Editar">
                        <Edit2 size={14} className="text-blue-400" />
                      </button>
                      <button onClick={() => eliminar(p.id)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10" title="Eliminar">
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="font-bold text-domi-yellow text-sm">${p.precio.toLocaleString()}</span>
                    <span className="text-[10px] text-white/30 px-2 py-0.5 rounded-full bg-white/5">{p.categoria_producto}</span>
                    {p.disponible ? <span className="text-[10px] text-green-400/60">Disponible</span> : <span className="text-[10px] text-red-400/60">Desactivado</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
