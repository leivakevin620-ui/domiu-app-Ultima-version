"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Package, CookingPot, UserCheck, Bike, Home, Star, MessageCircle, MapPin, Clock, Phone, Navigation } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import MapaRepartidorCliente from "@/components/MapaRepartidorCliente";

type Pedido = {
  id: string; codigo: string; cliente_nombre: string; estado: string;
  total: number; created_at: string; repartidor_id: string | null;
  repartidores?: { nombre: string; telefono: string } | null;
  negocios: { nombre: string; logo: string; latitud?: number; longitud?: number } | null;
};

const steps = [
  { key: "recibido", label: "Pedido recibido", icon: Package, desc: "Hemos recibido tu pedido" },
  { key: "preparacion", label: "En preparación", icon: CookingPot, desc: "El negocio está preparando tu pedido" },
  { key: "asignado", label: "Repartidor asignado", icon: UserCheck, desc: "Un repartidor va al negocio" },
  { key: "camino", label: "En camino", icon: Bike, desc: "Tu pedido va en camino" },
  { key: "entregado", label: "Entregado", icon: Home, desc: "¡Pedido entregado!" },
];

const stepIndex: Record<string, number> = { recibido: 0, preparacion: 1, asignado: 2, camino: 3, entregado: 4 };
const stepLabels: Record<string, string> = { recibido: "RECIBIDO", preparacion: "PREPARACIÓN", asignado: "ASIGNADO", camino: "EN CAMINO", entregado: "ENTREGADO" };

export default function SeguimientoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [currentStep, setCurrentStep] = useState(-1);

  useEffect(() => {
    if (!id) return;
    const fetchPedido = () => {
      getSupabaseClient()
        .from("pedidos_cliente")
        .select("*, negocios(nombre, logo, latitud, longitud), repartidores(nombre, telefono)")
        .eq("codigo", id)
        .single()
        .then(({ data }) => {
          if (data) {
            setPedido(data);
            setCurrentStep(stepIndex[data.estado] ?? -1);
          }
        });
    };
    fetchPedido();
    const interval = setInterval(fetchPedido, 10000);
    return () => clearInterval(interval);
  }, [id]);

  if (!pedido) return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--bg-primary)]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[var(--text-secondary)]">Cargando pedido...</p>
      </div>
    </div>
  );

  const isEntregado = pedido.estado === "entregado";
  const eta = pedido.estado === "camino" ? "5-10 min" : pedido.estado === "asignado" ? "15-20 min" : "—";
  const currentCat = Math.min(currentStep, 3);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="px-5 pt-5 pb-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="w-11 h-11 rounded-2xl bg-[var(--bg-card)] flex items-center justify-center border border-white/5 hover:border-[var(--primary)]/30 transition-all active:scale-90">
            <ArrowLeft size={18} className="text-[var(--text-secondary)]" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Seguimiento</h1>
            <p className="text-xs text-[var(--text-secondary)] font-medium">Pedido #{pedido.codigo}</p>
          </div>
        </div>

        {/* Status Hero */}
        <div className="glass-card p-6 mb-5 text-center animate-fade-up">
          {isEntregado ? (
            <div className="w-20 h-20 rounded-3xl bg-[var(--success)]/15 flex items-center justify-center mx-auto mb-4 animate-bounce-in">
              <Home size={34} className="text-[var(--success)]" />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-3xl bg-[var(--primary)]/10 flex items-center justify-center mx-auto mb-4 animate-pulse-glow">
              <Bike size={34} className="text-[var(--primary)]" />
            </div>
          )}
          <h2 className="text-xl font-black mb-1">
            {isEntregado ? "¡Pedido entregado!" : pedido.estado === "camino" ? "Tu pedido está en camino" : "Estamos procesando tu pedido"}
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">{pedido.negocios?.nombre}</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            {currentStep >= 0 && (
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20">
                <Clock size={13} className="text-[var(--primary)]" />
                <span className="text-xs font-bold text-[var(--primary)]">{stepLabels[pedido.estado]}</span>
              </div>
            )}
            {!isEntregado && currentStep >= 0 && (
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--bg-card)] border border-white/5 text-xs text-[var(--text-secondary)]">
                <Navigation size={12} className="text-[var(--primary)]" /> ETA: {eta}
              </div>
            )}
          </div>

          {/* ETA Progress */}
          {!isEntregado && currentStep >= 0 && (
            <div className="mt-5">
              <div className="h-1.5 bg-[var(--bg-card)] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${currentStep >= 4 ? 100 : (currentStep + 1) * 25}%` }} />
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-1.5">Progreso del pedido</p>
            </div>
          )}
        </div>

        {/* Live GPS Map */}
        {(currentStep >= 2 || pedido.repartidor_id) && !isEntregado && (
          <div className="mb-5 rounded-3xl overflow-hidden border border-white/5 shadow-2xl animate-fade-up">
            <MapaRepartidorCliente repartidorId={pedido.repartidor_id || undefined} negocioLat={pedido.negocios?.latitud} negocioLng={pedido.negocios?.longitud} negocioNombre={pedido.negocios?.nombre} />
          </div>
        )}

        {/* Repartidor info */}
        {pedido.repartidores && !isEntregado && (
          <div className="glass-card p-5 mb-5 animate-fade-up">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--primary)]/20 to-[var(--primary)]/5 flex items-center justify-center text-xl shrink-0">
                🏍️
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{pedido.repartidores.nombre}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">Tu repartidor</p>
              </div>
              <a href={`tel:${pedido.repartidores.telefono}`}
                className="w-11 h-11 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-all active:scale-90">
                <Phone size={18} />
              </a>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="glass-card p-5 mb-5 animate-fade-up">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-[1.5px] mb-6">Estado del pedido</h3>
          <div className="relative">
            {steps.map((step, i) => {
              const isComplete = i <= currentStep;
              const isCurrent = i === currentStep;
              const Icon = step.icon;
              return (
                <div key={step.key} className="timeline-step pb-6 last:pb-0 relative">
                  {i < steps.length - 1 && (
                    <div className={`timeline-line ${i < currentStep ? "!bg-[var(--primary)]" : ""}`} />
                  )}
                  <div className="relative z-10 flex items-center gap-4">
                    <div className={`timeline-dot ${isComplete ? "completed" : isCurrent ? "active" : ""}`}>
                      {(isComplete || isCurrent) && (
                        <div className={`w-full h-full rounded-full flex items-center justify-center ${isComplete ? "bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)]" : "bg-[var(--primary)]"}`}>
                          {isComplete ? (
                            <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-black" />
                          )}
                        </div>
                      )}
                    </div>
                    <div className={`transition-all duration-300 ${isComplete ? "opacity-100" : isCurrent ? "opacity-100" : "opacity-40"}`}>
                      <p className={`font-bold text-sm ${isComplete ? "text-[var(--primary)]" : isCurrent ? "text-[var(--primary)]" : ""}`}>
                        {step.label}
                      </p>
                      <p className={`text-xs mt-0.5 ${isComplete || isCurrent ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]/60"}`}>
                        {step.desc}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 animate-fade-up">
          <button onClick={() => { window.open(`https://www.google.com/maps/search/?api=1&query=Magdalena`, "_blank"); }}
            className="glass-card py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-all">
            <MapPin size={16} className="text-[var(--primary)]" />
            Ver en mapa
          </button>
          <button onClick={() => router.push(`/cliente/chat/${pedido.codigo}`)}
            className="glass-card py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-all">
            <MessageCircle size={16} className="text-[var(--primary)]" />
            Chat
          </button>
        </div>

        {isEntregado && (
          <button onClick={() => router.push(`/cliente/calificar/${pedido.codigo}`)}
            className="btn-primary w-full mt-5 flex items-center justify-center gap-2 text-sm active:scale-[0.97] transition-all animate-fade-up">
            <Star size={18} />
            Calificar pedido
          </button>
        )}

        <button onClick={() => router.push("/cliente")} className="w-full mt-6 py-3 text-xs text-[var(--text-muted)]/50 font-medium hover:text-[var(--text-muted)] transition-colors">
          Volver al inicio
        </button>
      </div>
    </div>
  );
}
