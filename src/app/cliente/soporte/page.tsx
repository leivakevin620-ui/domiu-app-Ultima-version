"use client";
import { Headphones, MessageCircle, Phone, Mail, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

const faqs = [
  { q: "¿Cómo hago un pedido?", a: "Busca un negocio, agrega productos al carrito y confirma tu pedido." },
  { q: "¿Cómo pago mi pedido?", a: "Puedes pagar en efectivo, Nequi, DaviPlata, transferencia bancaria o con tu billetera DomiPay." },
  { q: "¿Cuánto tarda el domicilio?", a: "Depende del negocio, pero usualmente 30-60 minutos." },
  { q: "¿Cómo rastreo mi pedido?", a: "Ve a la sección Mis Pedidos e ingresa tu número de teléfono." },
];

export default function SoportePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen pb-24 px-5 pt-5">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-[#10B981]/10 flex items-center justify-center">
          <Headphones size={24} className="text-[#10B981]" />
        </div>
        <div>
          <h1 className="text-xl font-black text-[#F8FAFC]">Soporte</h1>
          <p className="text-xs text-slate-400">Estamos aquí para ayudarte</p>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <button className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3 active:scale-[0.98] transition-all text-left">
          <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 flex items-center justify-center shrink-0">
            <MessageCircle size={18} className="text-[#10B981]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#F8FAFC]">Chat en vivo</p>
            <p className="text-xs text-slate-400">Respuesta inmediata</p>
          </div>
          <ChevronRight size={16} className="text-slate-500 shrink-0" />
        </button>

        <button className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3 active:scale-[0.98] transition-all text-left">
          <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 flex items-center justify-center shrink-0">
            <Phone size={18} className="text-[#10B981]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#F8FAFC]">Llamar</p>
            <p className="text-xs text-slate-400">+57 301 234 5678</p>
          </div>
          <ChevronRight size={16} className="text-slate-500 shrink-0" />
        </button>

        <button className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3 active:scale-[0.98] transition-all text-left">
          <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 flex items-center justify-center shrink-0">
            <Mail size={18} className="text-[#10B981]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#F8FAFC]">Email</p>
            <p className="text-xs text-slate-400">ayuda@domiumagdalena.com</p>
          </div>
          <ChevronRight size={16} className="text-slate-500 shrink-0" />
        </button>
      </div>

      <h2 className="font-bold text-base text-[#F8FAFC] mb-3">Preguntas frecuentes</h2>
      <div className="space-y-2">
        {faqs.map((faq, i) => (
          <details key={i} className="group rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
            <summary className="p-4 text-sm font-semibold text-[#F8FAFC] cursor-pointer list-none flex items-center justify-between">
              {faq.q}
              <ChevronRight size={14} className="text-slate-400 group-open:rotate-90 transition-transform shrink-0" />
            </summary>
            <div className="px-4 pb-4">
              <p className="text-xs text-slate-400 leading-relaxed">{faq.a}</p>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
