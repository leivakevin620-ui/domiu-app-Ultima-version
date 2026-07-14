'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { businessService, type BusinessProduct } from '@/services/business';
import type { Category } from '@/types/database';
import { SkeletonCard } from '@/components/ui/skeleton';
import { StorageManager } from '@/components/storage/storage-manager';
import { STORAGE_BUCKETS } from '@/lib/storage';
import NextImage from 'next/image';
import {
  Package,
  Plus,
  Search,
  Edit3,
  Copy,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Image as ImageIcon,
  Clock,
  Tag,
  RefreshCw,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';

interface ProductForm {
  name: string;
  description: string;
  price: string;
  category_id: string;
  quantity_available: string;
  preparation_time_minutes: string;
  image_url: string;
  image_path: string;
  status: string;
  is_featured: boolean;
}

const EMPTY_FORM: ProductForm = {
  name: '',
  description: '',
  price: '',
  category_id: '',
  quantity_available: '0',
  preparation_time_minutes: '15',
  image_url: '',
  image_path: '',
  status: 'available',
  is_featured: false,
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);

function toForm(product?: BusinessProduct): ProductForm {
  if (!product) return { ...EMPTY_FORM };
  const metadata = (product as unknown as { metadata?: Record<string, unknown> }).metadata || {};
  return {
    name: product.name,
    description: product.description || '',
    price: String(product.price),
    category_id: product.category_id || '',
    quantity_available: String(product.quantity_available),
    preparation_time_minutes: String(product.preparation_time_minutes),
    image_url: product.image_url || '',
    image_path: metadata.imagePath ? String(metadata.imagePath) : '',
    status: product.status || 'available',
    is_featured: Boolean(product.is_featured),
  };
}

export default function NegocioProductos() {
  const { profile } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [products, setProducts] = useState<BusinessProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BusinessProduct | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [error, setError] = useState('');

  const loadProducts = useCallback(async (showSpinner = false) => {
    if (!profile?.id) return;
    if (showSpinner) setRefreshing(true);
    try {
      const id = businessId || (await businessService.getBusinessId(profile.id));
      if (!id) {
        setProducts([]);
        setCategories([]);
        setError('No se encontró el negocio asociado a esta cuenta.');
        return;
      }
      if (!businessId) setBusinessId(id);
      const [productRows, categoryRows] = await Promise.all([
        businessService.getProducts(id),
        businessService.getCategories(id),
      ]);
      setProducts(productRows);
      setCategories(categoryRows as unknown as Category[]);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los productos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessId, profile?.id]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  };

  const openEdit = (product: BusinessProduct) => {
    setEditing(product);
    setForm(toForm(product));
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!businessId) return;
    const name = form.name.trim();
    const price = Number(form.price);
    const stock = Number(form.quantity_available);
    const preparationTime = Number(form.preparation_time_minutes);

    if (!name) {
      toast.error('El nombre del producto es obligatorio');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error('Ingresa un precio válido');
      return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
      toast.error('El stock debe ser un número entero igual o mayor a cero');
      return;
    }
    if (!Number.isInteger(preparationTime) || preparationTime < 0) {
      toast.error('El tiempo de preparación no es válido');
      return;
    }

    setSaving(true);
    try {
      const productData: Partial<BusinessProduct> = {
        name,
        description: form.description.trim() || null,
        price,
        category_id: form.category_id || null,
        quantity_available: stock,
        preparation_time_minutes: preparationTime,
        image_url: form.image_url || null,
        status: form.status,
        is_featured: form.is_featured,
      };

      if (editing) {
        await businessService.updateProduct(editing.id, productData);
        toast.success('Producto actualizado y verificado');
      } else {
        await businessService.createProduct(businessId, productData);
        toast.success('Producto creado correctamente');
      }

      setShowForm(false);
      setEditing(null);
      setForm({ ...EMPTY_FORM });
      await loadProducts();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo guardar el producto');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await businessService.duplicateProduct(id);
      await loadProducts();
      toast.success('Producto duplicado correctamente');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo duplicar el producto');
    }
  };

  const handleDelete = async (product: BusinessProduct) => {
    if (!window.confirm(`¿Eliminar ${product.name}? El producto dejará de aparecer en el menú.`)) return;
    try {
      await businessService.deleteProduct(product.id);
      await loadProducts();
      toast.success('Producto retirado del catálogo');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo eliminar el producto');
    }
  };

  const handleToggle = async (product: BusinessProduct) => {
    const nextStatus = product.status === 'available' ? 'unavailable' : 'available';
    try {
      await businessService.updateProduct(product.id, { status: nextStatus });
      await loadProducts();
      toast.success(nextStatus === 'available' ? 'Producto disponible' : 'Producto marcado como agotado');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo cambiar el estado');
    }
  };

  const filtered = products.filter((product) =>
    `${product.name} ${product.description || ''} ${product.category_name || ''}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  if (loading) return <SkeletonCard />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
            <Package className="h-5 w-5 text-warning" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {products.length} productos · precios, imágenes, stock y disponibilidad persistentes
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadProducts(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Actualizar
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-warning px-4 py-2.5 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" /> Nuevo producto
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar productos..."
          className="h-10 w-full rounded-xl border bg-background pl-10 pr-4 text-sm"
        />
      </div>

      {showForm && (
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <h3 className="mb-4 font-semibold">{editing ? 'Editar producto' : 'Nuevo producto'}</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Nombre *</span>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Precio *</span>
              <input
                value={form.price}
                onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                type="number"
                min={0}
                className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Stock actual *</span>
              <input
                value={form.quantity_available}
                onChange={(event) =>
                  setForm((current) => ({ ...current, quantity_available: event.target.value }))
                }
                type="number"
                min={0}
                step={1}
                className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Tiempo de preparación</span>
              <input
                value={form.preparation_time_minutes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, preparation_time_minutes: event.target.value }))
                }
                type="number"
                min={0}
                step={1}
                className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs text-muted-foreground">Descripción</span>
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                rows={3}
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Categoría</span>
              <select
                value={form.category_id}
                onChange={(event) =>
                  setForm((current) => ({ ...current, category_id: event.target.value }))
                }
                className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
              >
                <option value="">Sin categoría</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Estado</span>
              <select
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
              >
                <option value="available">Disponible</option>
                <option value="unavailable">Agotado / no disponible</option>
                <option value="discontinued">Descontinuado</option>
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-xl border p-3 text-sm">
              <input
                type="checkbox"
                checked={form.is_featured}
                onChange={(event) =>
                  setForm((current) => ({ ...current, is_featured: event.target.checked }))
                }
              />
              Producto destacado
            </label>
            <div className="sm:col-span-2 lg:col-span-4">
              <p className="mb-2 text-xs text-muted-foreground">Imagen del producto</p>
              <div className="max-w-md">
                <StorageManager
                  key={`${editing?.id || 'new'}-${form.image_url}`}
                  bucket={STORAGE_BUCKETS.PRODUCT_IMAGES}
                  previewType="product"
                  currentUrl={form.image_url || null}
                  currentPath={form.image_path || null}
                  folder={`businesses/${businessId || 'unknown'}/products`}
                  onUploaded={(url, path) =>
                    setForm((current) => ({ ...current, image_url: url, image_path: path }))
                  }
                  onDeleted={() =>
                    setForm((current) => ({ ...current, image_url: '', image_path: '' }))
                  }
                />
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> {saving ? 'Guardando y verificando…' : 'Guardar producto'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditing(null);
                setForm({ ...EMPTY_FORM });
              }}
              disabled={saving}
              className="rounded-xl border px-4 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No hay productos{search ? ' con ese criterio' : ' todavía'}.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product) => (
            <article key={product.id} className="overflow-hidden rounded-2xl border bg-card shadow-card">
              <div className="relative flex h-36 items-center justify-center overflow-hidden bg-muted/30">
                {product.image_url ? (
                  <NextImage
                    src={product.image_url}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                )}
                <span
                  className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-medium text-white ${
                    product.status === 'available' ? 'bg-success' : 'bg-destructive'
                  }`}
                >
                  {product.status === 'available' ? 'Disponible' : 'Agotado'}
                </span>
                {product.quantity_available <= 5 && product.status === 'available' && (
                  <span className="absolute left-2 top-2 rounded-full bg-warning px-2 py-0.5 text-[9px] font-medium text-white">
                    Stock bajo
                  </span>
                )}
              </div>
              <div className="p-4">
                <h4 className="truncate text-sm font-semibold">{product.name}</h4>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {product.description || 'Sin descripción'}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-base font-bold">{formatCurrency(product.price)}</span>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Package className="h-3 w-3" /> {product.quantity_available}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" /> {product.preparation_time_minutes} min
                  <Tag className="ml-1 h-3 w-3" /> {product.category_name || 'Sin categoría'}
                </div>
                <div className="mt-3 flex gap-1 border-t pt-3">
                  <button
                    type="button"
                    onClick={() => openEdit(product)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg border py-1.5 text-[10px]"
                  >
                    <Edit3 className="h-3 w-3" /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDuplicate(product.id)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg border py-1.5 text-[10px]"
                  >
                    <Copy className="h-3 w-3" /> Duplicar
                  </button>
                  <button
                    type="button"
                    title={product.status === 'available' ? 'Marcar agotado' : 'Marcar disponible'}
                    onClick={() => void handleToggle(product)}
                    className="flex flex-1 items-center justify-center rounded-lg border py-1.5"
                  >
                    {product.status === 'available' ? (
                      <ToggleRight className="h-4 w-4 text-success" />
                    ) : (
                      <ToggleLeft className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(product)}
                    className="flex flex-1 items-center justify-center rounded-lg border border-destructive/20 py-1.5 text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
