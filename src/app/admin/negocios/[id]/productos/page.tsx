'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Package, ArrowLeft, Plus, Search, Loader2, Edit3, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getBusinessFullDetail, createProductAction, updateProductAction, deleteProductAction, createCategoryAction } from '@/app/actions/admin-business';

export default function BusinessProductsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', price: '', costPrice: '', discountPrice: '',
    categoryId: '', quantityAvailable: '0', preparationTime: '15',
    imageUrl: '', status: 'available' as string, isFeatured: false,
  });
  const [catForm, setCatForm] = useState({ name: '', description: '' });

  const loadData = async () => {
    try {
      const d = await getBusinessFullDetail(id);
      if (d) {
        setProducts(d.products || []);
        setCategories(d.categories || []);
        setBusinessName(d.business.name);
      }
    } catch { toast.error('Error al cargar datos'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [id]); // eslint-disable-line react-hooks/set-state-in-effect

  const resetForm = () => {
    setForm({ name: '', description: '', price: '', costPrice: '', discountPrice: '', categoryId: '', quantityAvailable: '0', preparationTime: '15', imageUrl: '', status: 'available', isFeatured: false });
    setEditingProduct(null);
    setShowForm(false);
  };

  const handleEdit = (p: any) => {
    setForm({
      name: p.name, description: p.description || '', price: String(p.price),
      costPrice: p.cost_price ? String(p.cost_price) : '',
      discountPrice: p.discount_price ? String(p.discount_price) : '',
      categoryId: p.category_id, quantityAvailable: String(p.quantity_available || 0),
      preparationTime: String(p.preparation_time_minutes || 15),
      imageUrl: p.image_url || '', status: p.status, isFeatured: p.is_featured || false,
    });
    setEditingProduct(p);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (editingProduct) {
      const res = await updateProductAction(editingProduct.id, {
        name: form.name, description: form.description || undefined,
        price: Number(form.price), cost_price: form.costPrice ? Number(form.costPrice) : undefined,
        discount_price: form.discountPrice ? Number(form.discountPrice) : undefined,
        category_id: form.categoryId, quantity_available: Number(form.quantityAvailable),
        preparation_time_minutes: Number(form.preparationTime),
        image_url: form.imageUrl || undefined, status: form.status,
        is_featured: form.isFeatured,
      });
      if (res.error) { toast.error(res.error); setSaving(false); return; }
      toast.success('Producto actualizado');
    } else {
      const res = await createProductAction({
        businessId: id, categoryId: form.categoryId, name: form.name,
        description: form.description || undefined, price: Number(form.price),
        costPrice: form.costPrice ? Number(form.costPrice) : undefined,
        discountPrice: form.discountPrice ? Number(form.discountPrice) : undefined,
        quantityAvailable: Number(form.quantityAvailable),
        preparationTimeMinutes: Number(form.preparationTime),
        imageUrl: form.imageUrl || undefined, status: form.status as any,
        isFeatured: form.isFeatured,
      });
      if (res.error) { toast.error(res.error); setSaving(false); return; }
      toast.success('Producto creado');
    }

    setSaving(false);
    resetForm();
    loadData();
  };

  const handleDelete = async (productId: string) => {
    if (!confirm('¿Eliminar este producto?')) return;
    const res = await deleteProductAction(productId);
    if (res.error) { toast.error(res.error); return; }
    toast.success('Producto eliminado');
    loadData();
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createCategoryAction({ businessId: id, name: catForm.name, description: catForm.description || undefined });
    if (res.error) { toast.error(res.error); return; }
    toast.success('Categoría creada');
    setCatForm({ name: '', description: '' });
    setShowCategoryForm(false);
    loadData();
  };

  const filtered = products.filter((p: any) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push(`/admin/negocios/${id}`)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/20">
          <Package className="h-5 w-5 text-success" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Productos</h1>
          <p className="text-sm text-muted-foreground">{businessName}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto..." className="h-9 w-full rounded-lg border border-border bg-input-bg pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring/50 focus:outline-none" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCategoryForm(!showCategoryForm)} className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground/80 hover:text-foreground transition-colors">
            + Categoría
          </button>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="rounded-lg bg-success px-3 py-2 text-xs font-semibold text-white hover:bg-success/90 border-0 flex items-center gap-1">
            <Plus className="h-3.5 w-3.5" /> Nuevo Producto
          </button>
        </div>
      </div>

      {showCategoryForm && (
        <form onSubmit={handleCreateCategory} className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Nueva Categoría</h3>
          <div className="flex gap-3">
            <input value={catForm.name} onChange={e => setCatForm(prev => ({ ...prev, name: e.target.value }))} required placeholder="Nombre de la categoría" className="flex-1 h-9 rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none" />
            <input value={catForm.description} onChange={e => setCatForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Descripción (opcional)" className="flex-1 h-9 rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none" />
            <button type="submit" className="rounded-lg bg-success px-3 py-2 text-xs font-semibold text-white hover:bg-success/90 border-0">Crear</button>
            <button type="button" onClick={() => setShowCategoryForm(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
        </form>
      )}

      {showForm && (
        <form onSubmit={handleSave} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground">{editingProduct ? 'Editar' : 'Nuevo'} Producto</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Nombre *</label>
              <input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} required className="h-9 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Categoría *</label>
              <select value={form.categoryId} onChange={e => setForm(prev => ({ ...prev, categoryId: e.target.value }))} required className="h-9 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none">
                <option value="">Seleccionar...</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Descripción</label>
            <textarea value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} rows={2} className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm text-foreground focus:border-ring/50 focus:outline-none" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Precio *</label>
              <input value={form.price} onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))} type="number" step="0.01" required className="h-9 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Costo</label>
              <input value={form.costPrice} onChange={e => setForm(prev => ({ ...prev, costPrice: e.target.value }))} type="number" step="0.01" className="h-9 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Precio desc.</label>
              <input value={form.discountPrice} onChange={e => setForm(prev => ({ ...prev, discountPrice: e.target.value }))} type="number" step="0.01" className="h-9 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Stock</label>
              <input value={form.quantityAvailable} onChange={e => setForm(prev => ({ ...prev, quantityAvailable: e.target.value }))} type="number" className="h-9 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Tiempo prep. (min)</label>
              <input value={form.preparationTime} onChange={e => setForm(prev => ({ ...prev, preparationTime: e.target.value }))} type="number" className="h-9 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Estado</label>
              <select value={form.status} onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))} className="h-9 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none">
                <option value="available">Disponible</option>
                <option value="unavailable">No disponible</option>
                <option value="discontinued">Descontinuado</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">URL de imagen</label>
            <input value={form.imageUrl} onChange={e => setForm(prev => ({ ...prev, imageUrl: e.target.value }))} className="h-9 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground font-mono focus:border-ring/50 focus:outline-none" placeholder="https://..." />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="isFeatured" checked={form.isFeatured} onChange={e => setForm(prev => ({ ...prev, isFeatured: e.target.checked }))} className="rounded border-slate-600 bg-slate-700 text-emerald-500" />
            <label htmlFor="isFeatured" className="text-sm text-foreground/80">Producto destacado</label>
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white hover:bg-success/90 border-0 disabled:opacity-50">
              {saving ? <Loader2 className="inline h-4 w-4 animate-spin" /> : editingProduct ? 'Guardar Cambios' : 'Crear Producto'}
            </button>
            <button type="button" onClick={resetForm} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground/80 hover:text-foreground">Cancelar</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando productos...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Package className="mb-3 h-10 w-10 text-slate-600" />
          <p className="text-sm">No hay productos</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3 group hover:border-border transition-all">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted overflow-hidden">
                  {p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" /> : <Package className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                    {p.is_featured && <span className="text-[9px] text-warning">★</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.category_name} · ${Number(p.price).toLocaleString('es-CO')}
                    {p.cost_price ? ` · Costo: $${Number(p.cost_price).toLocaleString('es-CO')}` : ''}
                    {p.total_sales > 0 ? ` · ${p.total_sales} vendidos` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  p.status === 'available' ? 'bg-success/15 text-success' :
                  p.status === 'unavailable' ? 'bg-warning/20 text-warning' :
                  'bg-destructive/20 text-destructive'
                }`}>
                  {p.status === 'available' ? 'Disponible' : p.status === 'unavailable' ? 'No disponible' : 'Descontinuado'}
                </span>
                <button onClick={() => handleEdit(p)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-all" title="Editar">
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/20 opacity-0 group-hover:opacity-100 transition-all" title="Eliminar">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
