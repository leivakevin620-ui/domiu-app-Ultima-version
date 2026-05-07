"use client";

import { useRouter } from "next/navigation";
import { User, ArrowLeft, Smartphone, MapPin, CreditCard, HelpCircle, LogOut, ChevronRight } from "lucide-react";

export default function PerfilPage() {
  const router = useRouter();

  const menuItems = [
    { icon: Smartphone, label: "Notificaciones", desc: "Configura tus notificaciones" },
    { icon: MapPin, label: "Direcciones", desc: "Gestiona tus direcciones" },
    { icon: CreditCard, label: "Método de pago", desc: "Pago contra entrega" },
    { icon: HelpCircle, label: "Ayuda", desc: "Preguntas frecuentes" },
  ];

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-9 h-9 rounded-full bg-domi-yellow/20 flex items-center justify-center">
          <User size={18} className="text-domi-yellow" />
        </div>
        <h1 className="text-lg font-bold">Perfil</h1>
      </div>

      {/* Avatar area */}
      <div className="bg-domi-dark rounded-2xl p-6 text-center mb-6">
        <div className="w-20 h-20 rounded-full bg-domi-yellow/20 flex items-center justify-center mx-auto mb-3 border-2 border-domi-yellow/30">
          <User size={36} className="text-domi-yellow" />
        </div>
        <p className="font-bold text-lg">Cliente</p>
        <p className="text-xs text-white/40 mt-1">Sin cuenta — pide sin registrarte</p>
      </div>

      {/* Menu items */}
      <div className="bg-domi-dark rounded-2xl overflow-hidden mb-6">
        {menuItems.map((item, i) => {
          const Icon = item.icon;
          return (
            <button key={i} className={`w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors ${i < menuItems.length - 1 ? "border-b border-white/5" : ""}`}>
              <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                <Icon size={16} className="text-white/50" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-white/40">{item.desc}</p>
              </div>
              <ChevronRight size={16} className="text-white/20 shrink-0" />
            </button>
          );
        })}
      </div>

      {/* Logout */}
      <button onClick={() => router.push("/login")} className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-domi-dark text-red-400 font-medium text-sm hover:bg-red-500/10 transition-colors active:scale-[0.98]">
        <LogOut size={16} />
        Ir a inicio de sesión
      </button>

      <p className="text-center text-[10px] text-white/20 mt-6">DomiU Magdalena v1.0</p>
    </div>
  );
}
