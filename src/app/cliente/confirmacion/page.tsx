"use client";
import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, Package, Clock, MapPin, Bike, CreditCard, Banknote, Smartphone, ArrowRight, Sparkles } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";

const metodosLabels: Record<string, { label: string; icon: any }> = {
  efectivo: { label: "Efectivo", icon: Banknote },
  transferencia: { label: "Transferencia", icon: CreditCard },
  nequi: { label: "Nequi", icon: Smartphone },
  daviplata: { label: "DaviPlata", icon: Smartphone },
};

type Pedido = {
  id: string; codigo: string; cliente_nombre: string; cliente_direccion: string;
  subtotal: number; domicilio: number; total: number; estado: string;
  metodo_pago: string; created_at: string;
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
      .then(({ data }) => { if (data) setPedido(data); });
  }, [codigo]);

  if (!codigo) { router.replace("/cliente"); return null; }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col animate-fade-in">
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-lg mx-auto w-full">
        {/* Success */}
        <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-[var(--success)]/20 to-[var(--success)]/5 flex items-center justify-center mb-6 animate-scale-in shadow-2xl shadow-[var(--success)]/10">
          <CheckCircle size={56} className="text-[var(--success)]" />
        </div>

        <h1 className="text-3xl font-black mb-2 gradient-text">¡Pedido confirmado!</h1>
        <p className="text-[var(--text-secondary)] text-sm mb-8">Tu pedido ha sido recibido y pronto será preparado.</p>

        {/* Order code */}
        <div className="glass-card p-6 w-full mb-6 animate-fade-up">
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-[2px] font-semibold mb-2">Código de pedido</p>
          <p className="text-3xl font-black text-[var(--primary)] tracking-[4px]">{pedido?.codigo || codigo}</p>

          <div className="h-px bg-gradient-to-r from-[var(--primary)]/20 via-white/10 to-transparent my-5" />

          {pedido && (
            <div className="text-left space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
                  <Package size={14} className="text-[var(--primary)]" />
                </div>
                <span className="text-[var(--text-secondary)]">{pedido.negocios?.nombre || "Negocio"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
                  <MapPin size={14} className="text-[var(--primary)]" />
                </div>
                <span className="text-[var(--text-secondary)] truncate">{pedido.cliente_direccion}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
                  <Bike size={14} className="text-[var(--primary)]" />
                </div>
                <span className="text-[var(--text-secondary)]">Domicilio: ${pedido.domicilio.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
                  <CreditCard size={14} className="text-[var(--primary)]" />
                </div>
                <span className="text-[var(--text-secondary)]">
                  {pedido.metodo_pago ? (metodosLabels[pedido.metodo_pago]?.label || pedido.metodo_pago) : "Pago contra entrega"}
                </span>
              </div>
              <div className="h-px bg-gradient-to-r from-white/5 via-white/10 to-transparent my-3" />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="gradient-text">${pedido.total.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* Tracking button */}
        <button onClick={() => router.push(`/cliente/seguimiento/${pedido?.codigo || codigo}`)}
          className="btn-primary w-full text-sm mb-3 flex items-center justify-center gap-2 active:scale-[0.97] transition-all shadow-lg shadow-[var(--primary)]/20">
          <Clock size={18} /> Seguir pedido <ArrowRight size={16} />
        </button>

        <button onClick={() => router.push("/cliente")} className="text-sm text-[var(--text-muted)] font-medium py-3 hover:text-[var(--text-secondary)] transition-colors">
          Volver al inicio
        </button>
      </div>
    </div>
  );
}

export default function ConfirmacionPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-[var(--bg-primary)]"><div className="w-10 h-10 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" /></div>}>
      <ConfirmacionContent />
    </Suspense>
  );
}
