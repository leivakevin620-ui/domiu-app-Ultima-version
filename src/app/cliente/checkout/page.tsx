"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Phone, User, FileText } from "lucide-react";
import { useCart } from "@/context/CartContext";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, negocioId, negocioNombre, subtotal, clearCart } = useCart();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [barrio, setBarrio] = useState("");
  const [nota, setNota] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (items.length === 0) {
    router.replace("/cliente");
    return null;
  }

  const domicilio = 3000;
  const total = subtotal + domicilio;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !telefono.trim() || !direccion.trim()) {
      setError("Completa nombre, teléfono y dirección");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/cliente/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_nombre: nombre.trim(),
          cliente_telefono: telefono.trim(),
          cliente_direccion: direccion.trim(),
          cliente_barrio: barrio.trim(),
          nota: nota.trim(),
          negocio_id: negocioId,
          domicilio,
          items: items.map((i) => ({
            productId: i.productId,
            nombre: i.nombre,
            cantidad: i.cantidad,
            precio: i.precio,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear pedido");

      clearCart();
      router.push(`/cliente/confirmacion?codigo=${data.pedido.codigo}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-domi-black text-white pb-8">
      {/* Header */}
      <div className="px-4 pt-5 pb-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-domi-dark flex items-center justify-center">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold">Confirmar pedido</h1>
        </div>
        <p className="text-xs text-white/40 ml-12">{negocioNombre}</p>
      </div>

      <form onSubmit={handleSubmit} className="px-4 max-w-lg mx-auto">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Order summary */}
        <div className="bg-domi-dark rounded-2xl p-4 mb-4">
          <h3 className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-3">Resumen del pedido</h3>
          {items.map((item) => (
            <div key={item.productId} className="flex justify-between text-sm mb-2 last:mb-0">
              <span className="text-white/70">{item.cantidad}x {item.nombre}</span>
              <span>${(item.precio * item.cantidad).toLocaleString()}</span>
            </div>
          ))}
          <div className="h-px bg-white/10 my-3" />
          <div className="flex justify-between text-sm mb-1">
            <span className="text-white/50">Subtotal</span>
            <span>${subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-white/50">Domicilio</span>
            <span>${domicilio.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold text-base mt-2">
            <span>Total</span>
            <span className="text-domi-yellow">${total.toLocaleString()}</span>
          </div>
        </div>

        {/* Client data */}
        <div className="bg-domi-dark rounded-2xl p-4 mb-4">
          <h3 className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-3">Tus datos</h3>
          <div className="space-y-3">
            <div className="relative">
              <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
              <input type="text" placeholder="Nombre completo *" value={nombre} onChange={(e) => setNombre(e.target.value)} required className="w-full bg-domi-black border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-white/30 outline-none focus:border-domi-yellow/50" />
            </div>
            <div className="relative">
              <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
              <input type="tel" placeholder="Teléfono *" value={telefono} onChange={(e) => setTelefono(e.target.value)} required className="w-full bg-domi-black border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-white/30 outline-none focus:border-domi-yellow/50" />
            </div>
            <div className="relative">
              <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
              <input type="text" placeholder="Dirección *" value={direccion} onChange={(e) => setDireccion(e.target.value)} required className="w-full bg-domi-black border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-white/30 outline-none focus:border-domi-yellow/50" />
            </div>
            <div className="relative">
              <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
              <input type="text" placeholder="Barrio (opcional)" value={barrio} onChange={(e) => setBarrio(e.target.value)} className="w-full bg-domi-black border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-white/30 outline-none focus:border-domi-yellow/50" />
            </div>
            <div className="relative">
              <FileText size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
              <textarea placeholder="Nota para el negocio (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} rows={2} className="w-full bg-domi-black border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-white/30 outline-none focus:border-domi-yellow/50 resize-none" />
            </div>
          </div>
        </div>

        <p className="text-xs text-white/30 mb-4 text-center">
          Pago contra entrega. Solo efectivo.
        </p>

        <button type="submit" disabled={loading} className="w-full py-4 rounded-2xl bg-domi-yellow text-domi-black font-bold text-base disabled:opacity-50 active:scale-[0.98] transition-transform shadow-lg shadow-domi-yellow/20">
          {loading ? "Procesando..." : `Confirmar pedido - $${total.toLocaleString()}`}
        </button>
      </form>
    </div>
  );
}
