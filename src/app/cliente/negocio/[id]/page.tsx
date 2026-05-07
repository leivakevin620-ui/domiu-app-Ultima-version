"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ShoppingCart, Star, Clock, Bike, Plus, Minus } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { useCart } from "@/context/CartContext";

type Negocio = {
  id: string;
  nombre: string;
  categoria: string;
  descripcion: string;
  logo: string;
  banner: string;
  rating: number;
  tiempo_estimado: string;
  domicilio_cost: number;
  abierto: boolean;
  direccion: string;
  telefono: string;
};

type Producto = {
  id: string;
  negocio_id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  imagen: string;
  categoria_producto: string;
};

export default function NegocioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { items, addItem, updateQuantity } = useCart();
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [selectedCat, setSelectedCat] = useState("");

  useEffect(() => {
    if (!id) return;
    getSupabaseClient().from("negocios").select("*").eq("id", id).single().then(({ data }) => {
      if (data) setNegocio(data);
    });
    getSupabaseClient().from("productos").select("*").eq("negocio_id", id).eq("disponible", true).then(({ data }) => {
      if (data) {
        setProductos(data);
        const cats = [...new Set(data.map((p) => p.categoria_producto))];
        if (cats.length > 0) setSelectedCat(cats[0]);
      }
    });
  }, [id]);

  const categories = [...new Set(productos.map((p) => p.categoria_producto))];
  const filtered = selectedCat ? productos.filter((p) => p.categoria_producto === selectedCat) : productos;
  const cartItems = items.filter((i) => i.negocioId === id);
  const totalItems = cartItems.reduce((s, i) => s + i.cantidad, 0);
  const totalPrice = cartItems.reduce((s, i) => s + i.precio * i.cantidad, 0);

  if (!negocio) {
    return (
      <div className="flex items-center justify-center h-screen bg-domi-black">
        <div className="w-8 h-8 border-2 border-domi-yellow border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const getItemQty = (productId: string) => items.find((i) => i.productId === productId)?.cantidad || 0;

  return (
    <div className="min-h-screen bg-domi-black text-white pb-24">
      {/* Banner */}
      <div className="relative h-44 bg-gradient-to-br from-domi-yellow/30 to-domi-black flex items-end">
        <button onClick={() => router.back()} className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm z-10">
          <ArrowLeft size={18} />
        </button>
        <div className="absolute bottom-4 left-4 right-4 max-w-lg mx-auto">
          <div className="flex items-start gap-3">
            <div className="w-16 h-16 rounded-2xl bg-domi-yellow/20 flex items-center justify-center text-domi-yellow font-bold text-2xl shrink-0 backdrop-blur-sm border border-white/10">
              {negocio.nombre[0]}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold drop-shadow-lg">{negocio.nombre}</h1>
              <p className="text-xs text-white/60">{negocio.categoria}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1 text-xs text-domi-yellow"><Star size={12} /> {negocio.rating}</span>
                <span className="flex items-center gap-1 text-xs text-white/50"><Clock size={12} /> {negocio.tiempo_estimado}</span>
                <span className="flex items-center gap-1 text-xs text-white/50"><Bike size={12} /> ${negocio.domicilio_cost.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product categories */}
      {categories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-4 py-4 scrollbar-none border-b border-white/5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCat === cat ? "bg-domi-yellow text-domi-black" : "bg-domi-dark text-white/60 hover:bg-white/10"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Products */}
      <div className="px-4 pt-4 pb-4 max-w-lg mx-auto grid gap-3">
        {filtered.map((p) => {
          const qty = getItemQty(p.id);
          return (
            <div key={p.id} className="bg-domi-dark rounded-2xl p-4">
              <div className="flex gap-3">
                <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-domi-yellow/10 to-white/5 flex items-center justify-center text-3xl shrink-0 border border-white/5">
                  🍽️
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm">{p.nombre}</h4>
                  <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{p.descripcion}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-domi-yellow text-sm">${p.precio.toLocaleString()}</span>
                    {qty === 0 ? (
                      <button onClick={() => addItem({ productId: p.id, negocioId: negocio.id, negocioNombre: negocio.nombre, nombre: p.nombre, precio: p.precio, descripcion: p.descripcion })} className="w-8 h-8 rounded-full bg-domi-yellow text-domi-black flex items-center justify-center hover:brightness-110 transition-all active:scale-90">
                        <Plus size={18} />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 bg-domi-black rounded-full px-1">
                        <button onClick={() => updateQuantity(p.id, qty - 1)} className="w-7 h-7 rounded-full bg-domi-yellow text-domi-black flex items-center justify-center hover:brightness-110 transition-all active:scale-90">
                          <Minus size={14} />
                        </button>
                        <span className="text-sm font-bold w-5 text-center">{qty}</span>
                        <button onClick={() => updateQuantity(p.id, qty + 1)} className="w-7 h-7 rounded-full bg-domi-yellow text-domi-black flex items-center justify-center hover:brightness-110 transition-all active:scale-90">
                          <Plus size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-white/40 text-sm">No hay productos en esta categoría</p>
          </div>
        )}
      </div>

      {/* Bottom cart bar */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4 pb-6 bg-gradient-to-t from-domi-black via-domi-black to-transparent pointer-events-none">
          <button onClick={() => router.push("/cliente/carrito")} className="pointer-events-auto w-full max-w-lg mx-auto flex items-center justify-between bg-domi-yellow text-domi-black rounded-2xl px-5 py-4 font-bold shadow-lg active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-2">
              <ShoppingCart size={20} />
              <span>Ver carrito ({totalItems})</span>
            </div>
            <span>${totalPrice.toLocaleString()}</span>
          </button>
        </div>
      )}
    </div>
  );
}
