'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { businessService, type BusinessProduct } from '@/services/business';
import type { Category } from '@/types/database';
import { SkeletonCard } from '@/components/ui/skeleton';
import NextImage from 'next/image';
import { Package, Plus, Search, Edit3, Copy, Trash2, ToggleLeft, ToggleRight, Image as ImageIcon, Clock, Tag } from 'lucide-react';

const formatCurrency = (n: number) => '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0 });

export default function NegocioProductos() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<BusinessProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BusinessProduct | null>(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', category_id: '', quantity_available: '', preparation_time_minutes: '', image_url: '' });

  const loadProducts = async () => {
    if (!profile?.id) return;
    const bizId = await businessService.getBusinessId(profile.id);
    if (bizId) {
      setProducts(await businessService.getProducts(bizId));
      setCategories(await businessService.getCategories(bizId) as unknown as Category[]);
    }
  };

  useEffect(() => { (async () => { await loadProducts(); setLoading(false); })(); }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async () => {
    if (!profile?.id || !form.name) return;
    const bizId = await businessService.getBusinessId(profile.id);
    if (!bizId) return;
    const productData = {
      name: form.name,
      description: form.description,
      price: Number(form.price),
      category_id: form.category_id || '',
      quantity_available: Number(form.quantity_available),
      preparation_time_minutes: Number(form.preparation_time_minutes),
      image_url: form.image_url || '',
    };
    if (editing) {
      await businessService.updateProduct(editing.id, productData);
    } else {
      await businessService.createProduct(bizId, productData);
    }
    setShowForm(false); setEditing(null); setForm({ name: '', description: '', price: '', category_id: '', quantity_available: '', preparation_time_minutes: '', image_url: '' });
    await loadProducts();
  };

  const handleEdit = (p: BusinessProduct) => {
    setEditing(p);
    setForm({ name: p.name, description: p.description || '', price: String(p.price), category_id: p.category_id, quantity_available: String(p.quantity_available), preparation_time_minutes: String(p.preparation_time_minutes), image_url: p.image_url || '' });
    setShowForm(true);
  };

  const handleDuplicate = async (id: string) => { await businessService.duplicateProduct(id); await loadProducts(); };
  const handleDelete = async (id: string) => { if (confirm('¿Eliminar este producto?')) { await businessService.deleteProduct(id); await loadProducts(); } };
  const handleToggle = async (p: BusinessProduct) => { await businessService.updateProduct(p.id, { status: p.status === 'available' ? 'unavailable' : 'available' }); await loadProducts(); };

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <SkeletonCard />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-warning/10 to-warning/5">
            <Package className="h-5 w-5 text-warning" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Productos</h1>
            <p className="mt-1 text-sm text-muted-foreground">{products.length} productos en tu catálogo</p>
          </div>
        </div>
        <button onClick={() => { setEditing(null); setForm({ name: '', description: '', price: '', category_id: '', quantity_available: '', preparation_time_minutes: '', image_url: '' }); setShowForm(true); }} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-warning to-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-warning/20 transition-all hover:shadow-xl hover:shadow-warning/30 hover:-translate-y-0.5">
          <Plus className="h-4 w-4" /> Nuevo Producto
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar productos..." className="h-10 w-full rounded-xl border border-border bg-background/50 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20" />
      </div>

      {showForm && (
        <div className="rounded-2xl border border-border bg-card shadow-card p-5 animate-in fade-in slide-in-from-top-2">
          <h3 className="text-sm font-semibold text-foreground mb-4">{editing ? 'Editar' : 'Nuevo'} Producto</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Nombre *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Pizza Margherita" className="h-10 w-full rounded-xl border border-border bg-background/50 px-3 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Precio *</label>
              <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} type="number" placeholder="0" className="h-10 w-full rounded-xl border border-border bg-background/50 px-3 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Stock</label>
              <input value={form.quantity_available} onChange={(e) => setForm({ ...form, quantity_available: e.target.value })} type="number" placeholder="0" className="h-10 w-full rounded-xl border border-border bg-background/50 px-3 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Tiempo Prep. (min)</label>
              <input value={form.preparation_time_minutes} onChange={(e) => setForm({ ...form, preparation_time_minutes: e.target.value })} type="number" placeholder="0" className="h-10 w-full rounded-xl border border-border bg-background/50 px-3 text-sm text-foreground" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-muted-foreground">Descripción</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción del producto..." className="h-20 w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm text-foreground resize-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Categoría</label>
              <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="h-10 w-full rounded-xl border border-border bg-background/50 px-3 text-sm text-foreground">
                <option value="">Sin categoría</option>
                {categories.map((cat: Category) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-muted-foreground">URL de Imagen (Supabase Storage)</label>
              <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." className="h-10 w-full rounded-xl border border-border bg-background/50 px-3 text-sm text-foreground" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleCreate} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">{editing ? 'Guardar' : 'Crear'} Producto</button>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">Cancelar</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No hay productos{search ? ' con ese nombre' : ' aún. Crea tu primer producto.'}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product) => (
            <div key={product.id} className="group rounded-2xl border border-border bg-card shadow-card overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
              <div className="relative h-36 bg-gradient-to-br from-muted/50 to-muted/30 flex items-center justify-center overflow-hidden">
                {product.image_url ? (
                  <NextImage src={product.image_url} alt={product.name} fill className="object-cover transition-transform duration-300 group-hover:scale-105" sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  {product.status === 'available' ? (
                    <span className="rounded-full bg-success/90 px-2 py-0.5 text-[9px] font-medium text-white">Disponible</span>
                  ) : (
                    <span className="rounded-full bg-destructive/90 px-2 py-0.5 text-[9px] font-medium text-white">Agotado</span>
                  )}
                </div>
              </div>
              <div className="p-4">
                <h4 className="text-sm font-semibold text-foreground truncate">{product.name}</h4>
                <p className="mt-0.5 text-xs text-muted-foreground truncate">{product.description || 'Sin descripción'}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-base font-bold text-foreground">{formatCurrency(product.price)}</span>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Package className="h-3 w-3" />
                    <span>{product.quantity_available}</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{product.preparation_time_minutes} min</span>
                  {product.category_name && (
                    <><Tag className="h-3 w-3 ml-1" /><span>{product.category_name}</span></>
                  )}
                </div>
                <div className="mt-3 flex gap-1 border-t border-border/30 pt-3">
                  <button onClick={() => handleEdit(product)} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border/50 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"><Edit3 className="h-3 w-3" /> Editar</button>
                  <button onClick={() => handleDuplicate(product.id)} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border/50 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"><Copy className="h-3 w-3" /> Duplicar</button>
                  <button onClick={() => handleToggle(product)} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border/50 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground">{product.status === 'available' ? <ToggleRight className="h-3 w-3 text-success" /> : <ToggleLeft className="h-3 w-3" />}</button>
                  <button onClick={() => handleDelete(product.id)} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-destructive/20 py-1.5 text-[10px] font-medium text-destructive transition-colors hover:bg-destructive/10"><Trash2 className="h-3 w-3" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
