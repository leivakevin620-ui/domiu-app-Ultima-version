"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Phone, MapPin, Clock, FileText, CheckCircle, CookingPot, PackageCheck } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";

type Pedido = {
  id: string;
  codigo: string;
  cliente_nombre: string;
  cliente_telefono: string;
  cliente_direccion: string;
  cliente_barrio: string;
  nota: string;
  subtotal: number;
  domicilio: number;
  total: number;
  estado_negocio: string;
  created_at: string;
};

type Detalle = {
  id: string;
  producto_nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
};

export default function PedidoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [detalles, setDetalles] = useState<Detalle[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    getSupabaseClient().from("pedidos_cliente").select("*").eq("id", id).single().then(({ data }) => {
      if (data) setPedido(data);
    });
    getSupabaseClient().from("detalle_pedido_cliente").select("*").eq("pedido_id", id).then(({ data }) => {
      if (data) setDetalles(data);
    });
  }, [id]);

  const cambiarEstado = async (nuevoEstado: string) => {
    setLoading(true);
    const { error } = await getSupabaseClient()
      .from("pedidos_cliente")
      .update({ estado_negocio: nuevoEstado, estado: nuevoEstado === "en_preparacion" ? "preparacion" : undefined, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) {
      setPedido((prev) => prev ? { ...prev, estado_negocio: nuevoEstado } : prev);
    }
    setLoading(false);
  };

  if (!pedido) {
    return <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-2 border-domi-yellow border-t-transparent rounded-full animate-spin" /></div>;
  }

  const estados = [
    { key: "recibido", label: "Recibido", icon: CheckCircle, desc: "Pedido recibido, revisalo", disabled: pedido.estado_negocio === "recibido" },
    { key: "en_preparacion", label: "En preparacion", icon: CookingPot, desc: "Confirma que estas preparando", disabled: pedido.estado_negocio === "en_preparacion" || pedido.estado_negocio === "listo_para_recoger" },
    { key: "listo_para_recoger", label: "Listo para recoger", icon: PackageCheck, desc: "Notifica que el pedido esta listo", disabled: pedido.estado_negocio === "listo_para_recoger" },
  ];

  const stepIndex = { recibido: 0, en_preparacion: 1, listo_para_recoger: 2 };
  const currentStep = stepIndex[pedido.estado_negocio as keyof typeof stepIndex] ?? 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-domi-dark flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-bold">Pedido #{pedido.codigo}</h1>
          <p className="text-xs text-white/40">{new Date(pedido.created_at).toLocaleString("es-CO")}</p>
        </div>
      </div>

      {/* Timeline del negocio */}
      <div className="bg-domi-dark rounded-2xl p-5 mb-4">
        <h2 className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-4">Estado del pedido</h2>
        <div className="flex items-center justify-between">
          {estados.map((est, i) => {
            const Icon = est.icon;
            const isActive = i <= currentStep;
            const isCurrent = i === currentStep;
            return (
              <div key={est.key} className="flex flex-col items-center gap-1 flex-1 relative">
                {i < estados.length - 1 && (
                  <div className={`absolute top-4 left-[calc(50%+16px)] right-[calc(50%-50%)] h-0.5 ${i < currentStep ? "bg-domi-yellow" : "bg-white/10"}`} />
                )}
                <div className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center ${isActive ? "bg-domi-yellow text-domi-black" : "bg-white/10 text-white/30"}`}>
                  <Icon size={18} />
                </div>
                <span className={`text-[10px] font-medium text-center ${isCurrent ? "text-domi-yellow" : isActive ? "text-white/70" : "text-white/30"}`}>
                  {est.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Acciones */}
      <div className="bg-domi-dark rounded-2xl p-5 mb-4">
        <h2 className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-3">Acciones</h2>
        <div className="grid gap-2">
          {estados.map((est) => {
            const Icon = est.icon;
            const isCurrent = est.key === pedido.estado_negocio;
            return (
              <button
                key={est.key}
                onClick={() => cambiarEstado(est.key)}
                disabled={est.disabled || loading}
                className={`flex items-center gap-3 p-4 rounded-xl text-left transition-all w-full ${isCurrent ? "bg-domi-yellow/10 border border-domi-yellow/30" : "bg-white/5 hover:bg-white/10"} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isCurrent ? "bg-domi-yellow text-domi-black" : "bg-white/10 text-white/50"}`}>
                  <Icon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{est.label}</p>
                  <p className="text-xs text-white/40">{est.desc}</p>
                </div>
                {isCurrent && <span className="text-[10px] text-domi-yellow font-semibold">Actual</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cliente info */}
      <div className="bg-domi-dark rounded-2xl p-5 mb-4">
        <h2 className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-3">Datos del cliente</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-domi-yellow/20 flex items-center justify-center text-domi-yellow font-bold text-sm shrink-0">{pedido.cliente_nombre[0]}</div>
            <div>
              <p className="font-semibold text-sm">{pedido.cliente_nombre}</p>
            </div>
          </div>
          <a href={`https://wa.me/57${pedido.cliente_telefono.replace(/\D/g, "")}`} target="_blank" className="flex items-center gap-3 text-sm text-white/70 hover:text-domi-yellow transition-colors">
            <Phone size={16} className="text-white/40" />
            {pedido.cliente_telefono}
          </a>
          <div className="flex items-center gap-3 text-sm text-white/70">
            <MapPin size={16} className="text-white/40" />
            {pedido.cliente_direccion}{pedido.cliente_barrio ? `, ${pedido.cliente_barrio}` : ""}
          </div>
          {pedido.nota && (
            <div className="flex items-start gap-3 text-sm text-white/70">
              <FileText size={16} className="text-white/40 mt-0.5" />
              <p className="text-white/50 italic">&quot;{pedido.nota}&quot;</p>
            </div>
          )}
        </div>
      </div>

      {/* Productos */}
      <div className="bg-domi-dark rounded-2xl p-5 mb-4">
        <h2 className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-3">Productos</h2>
        <div className="space-y-3">
          {detalles.map((d) => (
            <div key={d.id} className="flex items-center justify-between pb-3 border-b border-white/5 last:border-0 last:pb-0">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-domi-yellow/10 text-domi-yellow text-xs font-bold flex items-center justify-center">{d.cantidad}</span>
                <div>
                  <p className="text-sm font-medium">{d.producto_nombre}</p>
                  <p className="text-xs text-white/40">${d.precio_unitario.toLocaleString()} c/u</p>
                </div>
              </div>
              <p className="text-sm font-semibold">${d.subtotal.toLocaleString()}</p>
            </div>
          ))}
        </div>
        <div className="h-px bg-white/10 my-3" />
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-white/50"><span>Subtotal</span><span>${pedido.subtotal.toLocaleString()}</span></div>
          <div className="flex justify-between text-sm text-white/50"><span>Domicilio</span><span>${pedido.domicilio.toLocaleString()}</span></div>
          <div className="flex justify-between font-bold text-base pt-2"><span>Total</span><span className="text-domi-yellow">${pedido.total.toLocaleString()}</span></div>
        </div>
      </div>
    </div>
  );
}
