"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ShoppingCart, Star, Clock, Bike, Plus, Minus, MapPin, Phone, ChevronDown, Sparkles } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { useCart } from "@/context/CartContext";

type Negocio = {
  id: string; nombre: string; categoria: string; descripcion: string;
  logo: string; banner: string; rating: number; calificacion: number;
  tiempo_estimado: string; domicilio_cost: number; abierto: boolean;
  direccion: string; telefono: string;
};
type Producto = {
  id: string; negocio_id: string; nombre: string; descripcion: string;
  precio: number; imagen: string; categoria_producto: string;
};

export default function NegocioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { items, addItem, updateQuantity } = useCart();
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [selectedCat, setSelectedCat] = useState("");
  const catRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!id) return;
    getSupabaseClient().from("negocios").select("*").eq("id", id).single().then(({ data }) => { if (data) setNegocio(data); });
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

  const scrollToCat = (cat: string) => {
    setSelectedCat(cat);
    catRefs.current[cat]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!negocio) return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--bg-primary)]">
      <div className="w-10 h-10 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const getItemQty = (productId: string) => items.find((i) => i.productId === productId)?.cantidad || 0;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-28 animate-fade-in">
      {/* Banner */}
      <div className="relative h-52 bg-gradient-to-br from-[var(--primary)]/10 via-[var(--bg-primary)] to-[var(--primary)]/5 flex items-end overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{backgroundImage: "radial-gradient(circle at 20% 50%, var(--primary) 0%, transparent 50%), radial-gradient(circle at 80% 20%, var(--primary) 0%, transparent 50%)"}} />
        <button onClick={() => router.back()}
          className="absolute top-4 left-4 w-11 h-11 rounded-2xl bg-black/30 flex items-center justify-center backdrop-blur-md z-10 border border-white/10 hover:bg-black/50 transition-all active:scale-90">
          <ArrowLeft size={18} />
        </button>
        <div className="absolute bottom-4 left-5 right-5">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[var(--primary)]/30 to-[var(--primary)]/5 flex items-center justify-center text-[var(--primary)] font-bold text-3xl shrink-0 backdrop-blur-sm border border-white/10 shadow-2xl">
              {negocio.nombre[0]}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h1 className="text-2xl font-black drop-shadow-lg">{negocio.nombre}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-medium text-[var(--text-secondary)] bg-white/5 px-2.5 py-0.5 rounded-full backdrop-blur-sm">{negocio.categoria}</span>
                <span className={`badge ${negocio.abierto ? "badge-success" : "badge-error"}`}>
                  {negocio.abierto ? "Abierto" : "Cerrado"}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1 text-xs text-[var(--primary)] font-bold bg-[var(--primary)]/10 px-2 py-1 rounded-full">
                  <Star size={11} fill="var(--primary)" stroke="none" /> {negocio.rating || negocio.calificacion || "—"}
                </span>
                <span className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                  <Clock size={11} /> {negocio.tiempo_estimado}
                </span>
                <span className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                  <Bike size={11} /> ${negocio.domicilio_cost.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info bar */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] bg-[var(--bg-card)] px-3 py-2 rounded-xl flex-1 min-w-0">
          <MapPin size={13} className="text-[var(--primary)] shrink-0" />
          <span className="truncate">{negocio.direccion}</span>
        </div>
        {negocio.telefono && (
          <a href={`tel:${negocio.telefono}`}
            className="w-9 h-9 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] shrink-0 hover:bg-[var(--primary)]/20 transition-all active:scale-90">
            <Phone size={15} />
          </a>
        )}
      </div>

      {/* Category tabs */}
      {categories.length > 1 && (
        <div className="sticky top-0 z-30 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-white/5">
          <div className="flex gap-2 overflow-x-auto px-5 py-3 scroll-hide">
            {categories.map((cat) => (
              <button key={cat} onClick={() => scrollToCat(cat)}
                className={`chip whitespace-nowrap transition-all active:scale-95 ${selectedCat === cat ? "chip-active" : "chip-inactive"}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Products by category */}
      <div className="px-5 pt-5 pb-4">
        {categories.length > 1 ? (
          categories.map((cat) => {
            const catProducts = productos.filter((p) => p.categoria_producto === cat);
            if (catProducts.length === 0) return null;
            return (
              <div key={cat} ref={(el) => { catRefs.current[cat] = el; }} className="mb-6 animate-fade-up">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles size={14} className="text-[var(--primary)]" />
                  <h3 className="font-bold text-sm">{cat}</h3>
                  <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-card)] px-2 py-0.5 rounded-full">{catProducts.length}</span>
                </div>
                <div className="grid gap-2">
                  {catProducts.map((p, idx) => {
                    const qty = getItemQty(p.id);
                    return (
                      <div key={p.id} className="glass-card p-4 flex items-center gap-4 active:scale-[0.99] transition-all" style={{ animationDelay: `${idx * 50}ms` }}>
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--primary)]/10 to-transparent flex items-center justify-center text-2xl shrink-0 border border-white/5 shadow-inner">
                          🍽️
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-semibold text-sm truncate">{p.nombre}</h4>
                          </div>
                          {p.descripcion && <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">{p.descripcion}</p>}
                          <div className="flex items-center justify-between mt-2">
                            <span className="font-bold text-base gradient-text">${p.precio.toLocaleString()}</span>
                            {qty === 0 ? (
                              <button onClick={(e) => { e.stopPropagation(); addItem({ productId: p.id, negocioId: negocio.id, negocioNombre: negocio.nombre, nombre: p.nombre, precio: p.precio, descripcion: p.descripcion || "" }); }}
                                className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-black font-bold flex items-center justify-center hover:brightness-110 transition-all active:scale-90 shadow-lg shadow-[var(--primary)]/25">
                                <Plus size={18} />
                              </button>
                            ) : (
                              <div className="flex items-center gap-2 bg-[var(--bg-card)] rounded-xl p-0.5 border border-white/5">
                                <button onClick={(e) => { e.stopPropagation(); updateQuantity(p.id, qty - 1); }}
                                  className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-black font-bold flex items-center justify-center hover:brightness-110 transition-all active:scale-90">
                                  <Minus size={14} />
                                </button>
                                <span className="text-sm font-bold w-6 text-center text-[var(--text-primary)]">{qty}</span>
                                <button onClick={(e) => { e.stopPropagation(); updateQuantity(p.id, qty + 1); }}
                                  className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-black font-bold flex items-center justify-center hover:brightness-110 transition-all active:scale-90">
                                  <Plus size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        ) : (
          /* Single category - flat list */
          <div className="grid gap-2">
            {filtered.map((p, idx) => {
              const qty = getItemQty(p.id);
              return (
                <div key={p.id} className="glass-card p-4 flex items-center gap-4 active:scale-[0.99] transition-all animate-fade-up" style={{ animationDelay: `${idx * 50}ms` }}>
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--primary)]/10 to-transparent flex items-center justify-center text-2xl shrink-0 border border-white/5 shadow-inner">
                    🍽️
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm truncate">{p.nombre}</h4>
                    {p.descripcion && <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">{p.descripcion}</p>}
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-bold text-base gradient-text">${p.precio.toLocaleString()}</span>
                      {qty === 0 ? (
                        <button onClick={(e) => { e.stopPropagation(); addItem({ productId: p.id, negocioId: negocio.id, negocioNombre: negocio.nombre, nombre: p.nombre, precio: p.precio, descripcion: p.descripcion || "" }); }}
                          className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-black font-bold flex items-center justify-center hover:brightness-110 transition-all active:scale-90 shadow-lg shadow-[var(--primary)]/25">
                          <Plus size={18} />
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 bg-[var(--bg-card)] rounded-xl p-0.5 border border-white/5">
                          <button onClick={(e) => { e.stopPropagation(); updateQuantity(p.id, qty - 1); }}
                            className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-black font-bold flex items-center justify-center hover:brightness-110 transition-all active:scale-90">
                            <Minus size={14} />
                          </button>
                          <span className="text-sm font-bold w-6 text-center">{qty}</span>
                          <button onClick={(e) => { e.stopPropagation(); updateQuantity(p.id, qty + 1); }}
                            className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-black font-bold flex items-center justify-center hover:brightness-110 transition-all active:scale-90">
                            <Plus size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty */}
        {productos.length === 0 && (
          <div className="text-center py-20 animate-fade-up">
            <div className="w-20 h-20 rounded-3xl bg-[var(--bg-card)] flex items-center justify-center mx-auto mb-4">
              🍽️
            </div>
            <p className="text-[var(--text-secondary)] font-medium">No hay productos disponibles</p>
          </div>
        )}
      </div>

      {/* Floating cart */}
      {totalItems > 0 && (
        <div className="fixed bottom-20 left-0 right-0 z-40 p-4 pb-3 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)] to-transparent pointer-events-none">
          <button onClick={() => router.push("/cliente/carrito")}
            className="floating-cart pointer-events-auto w-full active:scale-[0.97] transition-all">
            <div className="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center">
              <ShoppingCart size={16} />
            </div>
            <span className="font-semibold">Ver carrito</span>
            <div className="flex items-center gap-2">
              <span className="bg-black/20 px-2 py-0.5 rounded-md text-xs font-bold">{totalItems}</span>
              <span className="font-bold">${totalPrice.toLocaleString()}</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
