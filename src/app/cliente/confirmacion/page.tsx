"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, Package, Clock, MapPin, Bike } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";

type Pedido = {
  id: string;
  codigo: string;
  cliente_nombre: string;
  cliente_direccion: string;
  subtotal: number;
  domicilio: number;
  total: number;
  estado: string;
  created_at: string;
  negocios: { nombre: string } | null;
};

function ConfirmacionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codigo = searchParams.get("codigo") || "";
  const [pedido, setPedido] = useState<Pedido | null>(null);

  useEffect(() => {
    if (!codigo) return;
    getSupabaseClient()
      .from("pedidos_cliente")
      .select("*, negocios(nombre)")
      .eq("codigo", codigo)
      .single()
      .then(({ data }) => {
        if (data) setPedido(data);
      });
  }, [codigo]);

  if (!codigo) {
    router.replace("/cliente");
    return null;
  }

  return (
    <div className="min-h-screen bg-domi-black text-white flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-lg mx-auto w-full">
        {/* Success animation */}
        <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
          <CheckCircle size={56} className="text-green-400" />
        </div>

        <h1 className="text-2xl font-black mb-2">¡Pedido confirmado!</h1>
        <p className="text-white/50 text-sm mb-8">Tu pedido ha sido recibido y pronto será preparado.</p>

        {/* Order code */}
        <div className="bg-domi-dark rounded-2xl p-6 w-full mb-6">
          <p className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-2">Código de pedido</p>
          <p className="text-3xl font-black text-domi-yellow tracking-widest">{pedido?.codigo || codigo}</p>

          <div className="h-px bg-white/10 my-4" />

          {pedido && (
            <div className="text-left space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Package size={14} className="text-white/40" />
                <span className="text-white/70">{pedido.negocios?.nombre || "Negocio"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin size={14} className="text-white/40" />
                <span className="text-white/70">{pedido.cliente_direccion}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Bike size={14} className="text-white/40" />
                <span className="text-white/70">Domicilio: ${pedido.domicilio.toLocaleString()}</span>
              </div>
              <div className="h-px bg-white/10 my-2" />
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span className="text-domi-yellow">${pedido.total.toLocaleString()}</span>
              </div>
              <p className="text-xs text-white/30 pt-1">Pago contra entrega</p>
            </div>
          )}
        </div>

        {/* Tracking button */}
        <button onClick={() => router.push(`/cliente/seguimiento/${pedido?.codigo || codigo}`)} className="w-full py-4 rounded-2xl bg-domi-yellow text-domi-black font-bold text-base mb-3 active:scale-[0.98] transition-transform shadow-lg shadow-domi-yellow/20">
          <div className="flex items-center justify-center gap-2">
            <Clock size={18} />
            Seguir pedido
          </div>
        </button>

        <button onClick={() => router.push("/cliente")} className="text-sm text-white/50 font-medium py-3">
          Volver al inicio
        </button>
      </div>
    </div>
  );
}

export default function ConfirmacionPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-domi-black"><div className="w-8 h-8 border-2 border-domi-yellow border-t-transparent rounded-full animate-spin" /></div>}>
      <ConfirmacionContent />
    </Suspense>
  );
}
