"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, ShoppingCart, Plus, Minus, Trash2 } from "lucide-react";
import { useCart } from "@/context/CartContext";

export default function CarritoPage() {
  const router = useRouter();
  const { items, negocioNombre, negocioId, updateQuantity, removeItem, subtotal, clearCart } = useCart();

  const domicilio = 3000;
  const total = subtotal + domicilio;

  if (items.length === 0) {
    return (
      <div className="px-4 pt-5 pb-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-domi-dark flex items-center justify-center">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold">Carrito</h1>
        </div>
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-full bg-domi-dark flex items-center justify-center mx-auto mb-4">
            <ShoppingCart size={36} className="text-white/20" />
          </div>
          <p className="text-white/50 font-medium">Tu carrito está vacío</p>
          <p className="text-xs text-white/30 mt-1">Agrega productos desde un negocio</p>
          <button onClick={() => router.push("/cliente")} className="mt-6 px-6 py-3 rounded-xl bg-domi-yellow text-domi-black font-bold text-sm">
            Ir a Inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-5 pb-32 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-domi-dark flex items-center justify-center">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold">Carrito</h1>
        </div>
        <button onClick={clearCart} className="text-xs text-red-400 font-medium flex items-center gap-1">
          <Trash2 size={14} /> Vaciar
        </button>
      </div>

      {/* Business name */}
      <div className="bg-domi-dark rounded-2xl p-3 mb-4">
        <p className="text-xs text-white/40">Negocio</p>
        <p className="font-semibold text-sm">{negocioNombre}</p>
      </div>

      {/* Items */}
      <div className="grid gap-2 mb-5">
        {items.map((item) => (
          <div key={item.productId} className="bg-domi-dark rounded-2xl p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{item.nombre}</p>
              <p className="text-domi-yellow font-bold text-sm mt-0.5">${(item.precio * item.cantidad).toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2 bg-domi-black rounded-full px-1">
              <button onClick={() => updateQuantity(item.productId, item.cantidad - 1)} className="w-7 h-7 rounded-full bg-domi-yellow text-domi-black flex items-center justify-center active:scale-90">
                <Minus size={14} />
              </button>
              <span className="text-sm font-bold w-5 text-center">{item.cantidad}</span>
              <button onClick={() => updateQuantity(item.productId, item.cantidad + 1)} className="w-7 h-7 rounded-full bg-domi-yellow text-domi-black flex items-center justify-center active:scale-90">
                <Plus size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="bg-domi-dark rounded-2xl p-4 mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-white/50">Subtotal</span>
          <span>${subtotal.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-white/50">Domicilio</span>
          <span>${domicilio.toLocaleString()}</span>
        </div>
        <div className="h-px bg-white/10 my-2" />
        <div className="flex justify-between font-bold text-base">
          <span>Total</span>
          <span className="text-domi-yellow">${total.toLocaleString()}</span>
        </div>
      </div>

      {/* Checkout button */}
      <button onClick={() => router.push("/cliente/checkout")} className="w-full py-4 rounded-2xl bg-domi-yellow text-domi-black font-bold text-base active:scale-[0.98] transition-transform shadow-lg shadow-domi-yellow/20">
        Confirmar pedido
      </button>
    </div>
  );
}
