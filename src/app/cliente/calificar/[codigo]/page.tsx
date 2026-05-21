"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Star, MessageCircle, Bike, Store, ThumbsUp, Sparkles, Heart } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";

type PedidoData = {
  id: string; codigo: string; repartidor_id: string; negocio_id: string;
  cliente_telefono: string; calificado_repartidor: boolean; calificado_negocio: boolean;
  negocios: { nombre: string } | null;
};

type Producto = { id: string; producto_id: string; producto_nombre: string; };

const emojis = ["😡", "😕", "😐", "😊", "🤩"];

export default function CalificarPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const router = useRouter();
  const [pedido, setPedido] = useState<PedidoData | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [step, setStep] = useState<"repartidor" | "negocio" | "productos" | "fin">("repartidor");
  const [puntRepartidor, setPuntRepartidor] = useState(0);
  const [puntNegocio, setPuntNegocio] = useState(0);
  const [puntProductos, setPuntProductos] = useState<Record<string, number>>({});
  const [comentario, setComentario] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!codigo) return;
    getSupabaseClient()
      .from("pedidos_cliente")
      .select("*, negocios(nombre)")
      .eq("codigo", codigo)
      .single()
      .then(async ({ data }) => {
        if (data) {
          setPedido(data);
          setStep(data.calificado_repartidor ? "negocio" : "repartidor");
          if (data.id) {
            const { data: prods } = await getSupabaseClient()
              .from("detalle_pedido_cliente")
              .select("id, producto_id, producto_nombre")
              .eq("pedido_id", data.id);
            if (prods) setProductos(prods);
          }
        }
      });
  }, [codigo]);

  const guardarCalificacion = async (tipo: string, idRef: string | null, punt: number) => {
    if (!pedido || punt === 0) return;
    const payload: any = { tipo, cliente_telefono: pedido.cliente_telefono, puntuacion: punt, comentario: comentario || null, pedido_id: pedido.id };
    if (tipo === "repartidor") payload.repartidor_id = pedido.repartidor_id;
    if (tipo === "negocio") payload.negocio_id = pedido.negocio_id;
    if (tipo === "producto" && idRef) payload.producto_id = idRef;
    await getSupabaseClient().from("calificaciones").insert(payload);
  };

  const siguiente = async () => {
    if (!pedido) return;
    setSaving(true);
    if (step === "repartidor" && puntRepartidor > 0) {
      await guardarCalificacion("repartidor", null, puntRepartidor);
      await getSupabaseClient().from("pedidos_cliente").update({ calificado_repartidor: true }).eq("id", pedido.id);
      setStep("negocio");
    } else if (step === "negocio" && puntNegocio > 0) {
      await guardarCalificacion("negocio", null, puntNegocio);
      await getSupabaseClient().from("pedidos_cliente").update({ calificado_negocio: true }).eq("id", pedido.id);
      setStep("productos");
    } else if (step === "productos") {
      for (const p of productos) { if (puntProductos[p.id]) await guardarCalificacion("producto", p.producto_id, puntProductos[p.id]); }
      setStep("fin");
    }
    setSaving(false);
  };

  const Stars = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div className="flex gap-2 justify-center">
      {[1, 2, 3, 4, 5].map(v => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className="p-1 transition-all duration-200 active:scale-110 hover:scale-110">
          <Star size={40} className={`transition-all duration-200 ${v <= value ? "text-[var(--primary)] fill-[var(--primary)] drop-shadow-lg" : "text-[var(--text-muted)]/30"}`} />
        </button>
      ))}
    </div>
  );

  if (!pedido) return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--bg-primary)]">
      <div className="w-10 h-10 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (step === "fin") {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center px-6 animate-fade-in">
        <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-[var(--primary)]/20 to-[var(--primary)]/5 flex items-center justify-center mb-6 animate-float">
          <ThumbsUp size={52} className="text-[var(--primary)]" />
        </div>
        <h1 className="text-3xl font-black mb-2 gradient-text">¡Gracias!</h1>
        <p className="text-[var(--text-secondary)] text-sm mb-8 text-center">Tu opinión nos ayuda a mejorar</p>
        <button onClick={() => router.push("/cliente")} className="btn-primary w-full max-w-xs text-sm">
          Volver al inicio
        </button>
      </div>
    );
  }

  const currentEmoji = step === "repartidor" ? puntRepartidor : step === "negocio" ? puntNegocio : 0;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] animate-fade-in">
      <div className="px-5 pt-5 pb-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.back()} className="w-11 h-11 rounded-2xl bg-[var(--bg-card)] flex items-center justify-center border border-white/5 hover:border-[var(--primary)]/30 transition-all active:scale-90">
            <ArrowLeft size={18} className="text-[var(--text-secondary)]" />
          </button>
          <h1 className="text-xl font-bold">Calificar</h1>
        </div>

        <div className="glass-card p-8 text-center animate-fade-up">
          {step === "repartidor" && (
            <>
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[var(--primary)]/15 to-[var(--primary)]/5 flex items-center justify-center mx-auto mb-5">
                <Bike size={48} className="text-[var(--primary)]" />
              </div>
              <h2 className="text-2xl font-black mb-2">Califica al repartidor</h2>
              <p className="text-[var(--text-secondary)] text-sm mb-6">¿Cómo fue el servicio?</p>
              {currentEmoji > 0 && <div className="text-5xl mb-4 animate-scale-in">{emojis[currentEmoji - 1]}</div>}
              <Stars value={puntRepartidor} onChange={setPuntRepartidor} />
            </>
          )}

          {step === "negocio" && (
            <>
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[var(--primary)]/15 to-[var(--primary)]/5 flex items-center justify-center mx-auto mb-5">
                <Store size={48} className="text-[var(--primary)]" />
              </div>
              <h2 className="text-2xl font-black mb-2">Califica al negocio</h2>
              <p className="text-[var(--text-secondary)] text-sm mb-1">{pedido.negocios?.nombre || "Negocio"}</p>
              {currentEmoji > 0 && <div className="text-5xl mb-4 animate-scale-in">{emojis[currentEmoji - 1]}</div>}
              <Stars value={puntNegocio} onChange={setPuntNegocio} />
            </>
          )}

          {step === "productos" && productos.length > 0 && (
            <>
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[var(--primary)]/15 to-[var(--primary)]/5 flex items-center justify-center mx-auto mb-5">
                <Star size={48} className="text-[var(--primary)]" />
              </div>
              <h2 className="text-2xl font-black mb-6">Califica los productos</h2>
              <div className="space-y-5">
                {productos.map(p => (
                  <div key={p.id} className="p-5 rounded-2xl bg-[var(--bg-card)] border border-white/5">
                    <p className="font-bold text-sm mb-3">{p.producto_nombre}</p>
                    <Stars value={puntProductos[p.id] || 0} onChange={v => setPuntProductos(prev => ({ ...prev, [p.id]: v }))} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Comment */}
        <div className="mt-6 mb-6 animate-fade-up">
          <div className="glass-card p-4">
            <MessageCircle size={16} className="text-[var(--text-muted)] mb-2" />
            <textarea placeholder="Escribe un comentario (opcional)..." value={comentario} onChange={e => setComentario(e.target.value)} rows={3}
              className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]/50 outline-none resize-none" />
          </div>
        </div>

        <button onClick={siguiente} disabled={saving || (step !== "productos" && ((step === "repartidor" && puntRepartidor === 0) || (step === "negocio" && puntNegocio === 0)))}
          className="btn-primary w-full text-sm disabled:opacity-40 active:scale-[0.98] transition-all">
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              Guardando...
            </span>
          ) : step === "productos" ? "Finalizar" : "Siguiente"}
        </button>
      </div>
    </div>
  );
}
