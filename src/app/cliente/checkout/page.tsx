'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/ui/page-container';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useOrders } from '@/contexts/OrderContext';
import { ShoppingBag, ArrowLeft, Loader2, Store } from 'lucide-react';
import Link from 'next/link';

function customizationSummary(customization: Record<string, unknown> | undefined) {
  if (!customization) return [];
  const rows: string[] = [];
  if (customization.style) rows.push(`Estilo: ${customization.style}`);
  if (Array.isArray(customization.sauces)) rows.push(`Salsas: ${customization.sauces.join(', ')}`);
  if (customization.saucePresentation) rows.push(`Presentación: ${customization.saucePresentation === 'aparte' ? 'salsas aparte' : 'alitas bañadas'}`);
  if (Array.isArray(customization.extras) && customization.extras.length) rows.push(`Adicionales: ${(customization.extras as Array<{ name: string; quantity: number }>).map((extra) => `${extra.quantity}x ${extra.name}`).join(', ')}`);
  if (customization.preparationNote) rows.push(`Nota: ${customization.preparationNote}`);
  return rows;
}

export default function CheckoutPage() {
  const router = useRouter(); const { profile } = useAuth(); const { items, businessId, businessName, subtotal, isEmpty, clearCart } = useCart(); const { createOrder } = useOrders();
  const [placing, setPlacing] = useState(false); const [placed, setPlaced] = useState(false); const [error, setError] = useState(''); const [form, setForm] = useState({ address: '', city: 'Santa Marta', instructions: '' });
  const deliveryFee = 0; const tax = 0; const total = subtotal + deliveryFee + tax;
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!profile || !businessId || !businessName) return; setPlacing(true); setError(''); try { await createOrder({ customerId: profile.id, customerName: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Cliente', businessId, businessName, items: items.map((item) => ({ productId: item.product.id, productName: item.product.name, quantity: item.quantity, unitPrice: item.unitPrice, customization: item.customization as Record<string, unknown> | undefined, specialInstructions: item.customization?.preparationNote })), subtotal, deliveryFee, taxAmount: tax, totalAmount: total, deliveryAddress: `${form.address}, ${form.city}`, instructions: form.instructions }); setPlaced(true); clearCart(); setTimeout(() => router.push('/cliente/pedidos'), 1500); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo crear el pedido'); setPlacing(false); } };
  if (isEmpty && !placed) return <PageContainer><EmptyState icon={<ShoppingBag className="h-6 w-6" />} title="Carrito vacío" description="Agrega productos antes de continuar." action={<Link href="/cliente">Ver restaurantes</Link>} /></PageContainer>;
  if (placed) return <div className="flex min-h-screen items-center justify-center"><div className="text-center"><h1 className="text-2xl font-bold">¡Pedido confirmado!</h1><p className="mt-2 text-muted-foreground">Olma recibió todas tus selecciones.</p></div></div>;
  return <div className="min-h-screen bg-background pb-20"><header className="sticky top-0 z-20 border-b bg-background/90"><div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4"><button onClick={() => router.back()}><ArrowLeft className="h-5 w-5" /></button><span className="font-semibold">Confirmar pedido</span></div></header><PageContainer><div className="grid gap-6 lg:grid-cols-5"><form onSubmit={submit} className="space-y-5 lg:col-span-3"><div className="rounded-2xl border p-5"><h2 className="mb-4 font-bold">Dirección de entrega</h2><div className="space-y-3"><Input required value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Dirección completa" /><Input required value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} placeholder="Ciudad" /></div></div><div className="rounded-2xl border p-5"><h2 className="mb-3 font-bold">Instrucciones generales del pedido</h2><Textarea value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} placeholder="Ej: llamar al llegar, no tocar el timbre..." rows={3} /></div>{error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}<button disabled={placing} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 font-bold text-primary-foreground disabled:opacity-60">{placing ? <Loader2 className="h-5 w-5 animate-spin" /> : `Confirmar pedido — $${total.toLocaleString('es-CO')}`}</button></form><aside className="rounded-2xl border p-5 lg:col-span-2"><h2 className="mb-2 flex items-center gap-2 font-bold"><Store className="h-4 w-4" />{businessName}</h2><div className="space-y-4">{items.map((item) => <div key={item.id} className="border-b pb-3"><div className="flex justify-between gap-3"><span className="font-medium">{item.quantity}x {item.product.name}</span><span>${(item.unitPrice * item.quantity).toLocaleString('es-CO')}</span></div>{customizationSummary(item.customization as Record<string, unknown> | undefined).map((row) => <p key={row} className="mt-1 text-xs text-muted-foreground">{row}</p>)}</div>)}</div><div className="mt-4 flex justify-between border-t pt-4 text-lg font-bold"><span>Total</span><span>${total.toLocaleString('es-CO')}</span></div></aside></div></PageContainer></div>;
}
