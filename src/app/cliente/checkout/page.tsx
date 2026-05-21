"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Phone, User, FileText, CreditCard, Banknote, Smartphone, CheckCircle, Shield, Lock } from "lucide-react";
import { useCart } from "@/context/CartContext";

const metodosPago = [
  { id: "efectivo", label: "Efectivo", icon: Banknote, desc: "Paga al recibir", color: "#00C853" },
  { id: "transferencia", label: "Transferencia", icon: CreditCard, desc: "Bancolombia, Nequi, etc.", color: "#2979FF" },
  { id: "nequi", label: "Nequi", icon: Smartphone, desc: "Paga con Nequi", color: "#FF3D81" },
  { id: "daviplata", label: "DaviPlata", icon: Smartphone, desc: "Paga con DaviPlata", color: "#FF6B00" },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { items, negocioNombre, subtotal, clearCart } = useCart();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [barrio, setBarrio] = useState("");
  const [nota, setNota] = useState("");
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (items.length === 0) { router.replace("/cliente"); return null; }

  const domicilio = 3000;
  const total = subtotal + domicilio;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !telefono.trim() || !direccion.trim()) {
      setError("Completa nombre, teléfono y dirección"); return;
    }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/cliente/pedidos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_nombre: nombre.trim(), cliente_telefono: telefono.trim(),
          cliente_direccion: direccion.trim(), cliente_barrio: barrio.trim(),
          nota: nota.trim(), negocio_id: items[0].negocioId, domicilio,
          metodo_pago: metodoPago,
          items: items.map((i) => ({ productId: i.productId, nombre: i.nombre, cantidad: i.cantidad, precio: i.precio })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear pedido");
      clearCart();
      router.push(`/cliente/confirmacion?codigo=${data.pedido.codigo}&metodo=${metodoPago}`);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-8 animate-fade-in">
      <div className="px-5 pt-5 pb-2">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => router.back()} className="w-11 h-11 rounded-2xl bg-[var(--bg-card)] flex items-center justify-center border border-white/5 hover:border-[var(--primary)]/30 transition-all active:scale-90">
            <ArrowLeft size={18} className="text-[var(--text-secondary)]" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Confirmar pedido</h1>
            <p className="text-xs text-[var(--text-secondary)]">{negocioNombre}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-5">
        {error && (
          <div className="bg-[var(--error)]/10 border border-[var(--error)]/30 rounded-xl px-4 py-3 mb-5 animate-fade-up">
            <p className="text-[var(--error)] text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Order summary */}
        <div className="glass-card p-5 mb-5 animate-fade-up">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-[1.5px]">Resumen del pedido</h3>
          </div>
          {items.map((item) => (
            <div key={item.productId} className="flex justify-between text-sm mb-2.5 last:mb-0">
              <span className="text-[var(--text-secondary)]">{item.cantidad}x {item.nombre}</span>
              <span className="font-semibold">${(item.precio * item.cantidad).toLocaleString()}</span>
            </div>
          ))}
          <div className="h-px bg-gradient-to-r from-white/5 via-white/10 to-transparent my-3" />
          <div className="flex justify-between text-sm mb-1">
            <span className="text-[var(--text-secondary)]">Subtotal</span>
            <span>${subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-[var(--text-secondary)]">Domicilio</span>
            <span>${domicilio.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold text-base mt-3 pt-3 border-t border-white/5">
            <span>Total</span>
            <span className="gradient-text">${total.toLocaleString()}</span>
          </div>
        </div>

        {/* Payment method */}
        <div className="glass-card p-5 mb-5 animate-fade-up" style={{ animationDelay: "80ms" }}>
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-[1.5px] mb-4">Método de pago</h3>
          <div className="grid grid-cols-2 gap-3">
            {metodosPago.map((mp) => {
              const Icon = mp.icon;
              const selected = metodoPago === mp.id;
              return (
                <button key={mp.id} type="button" onClick={() => setMetodoPago(mp.id)}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border text-left transition-all active:scale-[0.97] ${
                    selected
                      ? "bg-[var(--primary)]/10 border-[var(--primary)] shadow-lg shadow-[var(--primary)]/10"
                      : "bg-[var(--bg-card)] border-white/5 text-[var(--text-secondary)] hover:border-white/20"
                  }`}>
                  {selected && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--primary)] flex items-center justify-center">
                      <CheckCircle size={12} className="text-black" />
                    </div>
                  )}
                  <Icon size={24} style={{ color: selected ? "var(--primary)" : mp.color }} />
                  <span className={`text-xs font-bold ${selected ? "text-[var(--primary)]" : ""}`}>{mp.label}</span>
                  <span className={`text-[9px] text-center leading-tight ${selected ? "text-[var(--primary)]/70" : "text-[var(--text-muted)]/60"}`}>{mp.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Client data */}
        <div className="glass-card p-5 mb-5 animate-fade-up" style={{ animationDelay: "160ms" }}>
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-[1.5px] mb-4">Tus datos</h3>
          <div className="space-y-3.5">
            {[{ icon: User, placeholder: "Nombre completo *", val: nombre, set: setNombre, type: "text" },
              { icon: Phone, placeholder: "Teléfono *", val: telefono, set: setTelefono, type: "tel" },
              { icon: MapPin, placeholder: "Dirección *", val: direccion, set: setDireccion, type: "text" },
              { icon: MapPin, placeholder: "Barrio (opcional)", val: barrio, set: setBarrio, type: "text" },
            ].map((f) => (
              <div key={f.placeholder} className="relative">
                <f.icon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]/50" />
                <input type={f.type} placeholder={f.placeholder} value={f.val} onChange={(e) => f.set(e.target.value)}
                  className="input-field" />
              </div>
            ))}
            <div className="relative">
              <FileText size={16} className="absolute left-4 top-4 text-[var(--text-muted)]/50" />
              <textarea placeholder="Nota para el negocio (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} rows={2}
                className="input-field resize-none pt-4" />
            </div>
          </div>
        </div>

        {/* Security note */}
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-5 animate-fade-up" style={{ animationDelay: "240ms" }}>
          <Lock size={12} />
          <span>Tus datos están seguros. Solo se usan para procesar tu pedido.</span>
        </div>

        <button type="submit" disabled={loading}
          className="btn-primary w-full text-sm disabled:opacity-40 active:scale-[0.98] transition-all shadow-lg shadow-[var(--primary)]/20">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              Procesando...
            </span>
          ) : `Confirmar pedido — $${total.toLocaleString()}`}
        </button>
      </form>
    </div>
  );
}
