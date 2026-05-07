"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle, Package, CookingPot, UserCheck, Bike, MapPin, Home } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";

type Pedido = {
  id: string;
  codigo: string;
  cliente_nombre: string;
  estado: string;
  total: number;
  created_at: string;
  negocios: { nombre: string; logo: string } | null;
};

const steps = [
  { key: "recibido", label: "Pedido recibido", icon: Package, desc: "Hemos recibido tu pedido" },
  { key: "preparacion", label: "En preparación", icon: CookingPot, desc: "El negocio está preparando tu pedido" },
  { key: "asignado", label: "Repartidor asignado", icon: UserCheck, desc: "Un repartidor está yendo al negocio" },
  { key: "camino", label: "En camino", icon: Bike, desc: "Tu pedido va en camino" },
  { key: "entregado", label: "Entregado", icon: Home, desc: "¡Pedido entregado!" },
];

const stepIndex: Record<string, number> = { recibido: 0, preparacion: 1, asignado: 2, camino: 3, entregado: 4 };

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
        .select("*, negocios(nombre, logo)")
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

  if (!pedido) {
    return (
      <div className="flex items-center justify-center h-screen bg-domi-black">
        <div className="w-8 h-8 border-2 border-domi-yellow border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-domi-black text-white">
      <div className="px-4 pt-5 pb-8 max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-domi-dark flex items-center justify-center">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold">Seguimiento</h1>
            <p className="text-xs text-white/40">Pedido #{pedido.codigo}</p>
          </div>
        </div>

        {/* Business info */}
        <div className="bg-domi-dark rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-domi-yellow/20 flex items-center justify-center text-domi-yellow font-bold text-lg">
              {pedido.negocios?.nombre?.[0] || "N"}
            </div>
            <div>
              <p className="font-semibold text-sm">{pedido.negocios?.nombre || "Negocio"}</p>
              <p className="text-xs text-white/40">Total: ${pedido.total.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative">
          {steps.map((step, i) => {
            const isComplete = i <= currentStep;
            const isCurrent = i === currentStep;
            const Icon = step.icon;

            return (
              <div key={step.key} className="flex gap-4 pb-8 last:pb-0 relative">
                {/* Line */}
                {i < steps.length - 1 && (
                  <div className={`absolute left-[19px] top-10 w-0.5 h-[calc(100%-20px)] ${i < currentStep ? "bg-green-500" : "bg-white/10"}`} />
                )}
                {/* Icon */}
                <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  isComplete ? "bg-green-500" : isCurrent ? "bg-domi-yellow" : "bg-domi-dark"
                }`}>
                  {isComplete ? (
                    <CheckCircle2 size={20} className="text-white" />
                  ) : (
                    <Icon size={18} className={isCurrent ? "text-domi-black" : "text-white/30"} />
                  )}
                </div>
                {/* Content */}
                <div className="pt-1.5">
                  <p className={`font-semibold text-sm ${isComplete ? "text-green-400" : isCurrent ? "text-domi-yellow" : "text-white/30"}`}>
                    {step.label}
                  </p>
                  <p className={`text-xs mt-0.5 ${isComplete || isCurrent ? "text-white/50" : "text-white/20"}`}>
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Map button */}
        <button
          onClick={() => {
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=Magdalena`;
            window.open(mapsUrl, "_blank");
          }}
          className="w-full mt-6 py-4 rounded-2xl bg-domi-dark border border-white/10 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <MapPin size={18} className="text-domi-yellow" />
          Ver en mapa
        </button>

        <button onClick={() => router.push("/cliente")} className="w-full mt-3 py-3 text-xs text-white/30 font-medium">
          Volver al inicio
        </button>
      </div>
    </div>
  );
}
