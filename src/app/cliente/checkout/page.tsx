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
import { ShoppingBag, CheckCircle, MapPin, ClipboardList, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function CheckoutPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const { items, businessId, businessName, subtotal, isEmpty, clearCart } = useCart();
  const { createOrder } = useOrders();
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(false);

  const [form, setForm] = useState({
    address: '',
    city: '',
    instructions: '',
  });

  const deliveryFee = subtotal > 20 ? 0 : 2.50;
  const tax = subtotal * 0.08;
  const total = subtotal + deliveryFee + tax;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !businessId || !businessName) return;
    setPlacing(true);
    try {
      await createOrder({
        customerId: profile.id,
        customerName: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Cliente',
        businessId,
        businessName,
        items: items.map((i) => ({
          productId: i.product.id,
          productName: i.product.name,
          quantity: i.quantity,
          unitPrice: i.product.price,
        })),
        subtotal,
        deliveryFee,
        taxAmount: tax,
        totalAmount: total,
        deliveryAddress: `${form.address}, ${form.city}`,
        instructions: form.instructions,
      });
      setPlaced(true);
      clearCart();
      setTimeout(() => router.push('/cliente/pedidos'), 2000);
    } catch {
      setPlacing(false);
    }
  };

  if (isEmpty && !placed) {
    return (
      <PageContainer>
        <div className="mb-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>
        </div>
        <EmptyState
          icon={<ShoppingBag className="h-6 w-6" />}
          title="Carrito vacío"
          description="Agrega productos antes de continuar con el pago."
          action={
            <Link
              href="/cliente"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Ver restaurantes
            </Link>
          }
        />
      </PageContainer>
    );
  }

  if (placed) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
            <CheckCircle className="h-8 w-8 text-success" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">¡Pedido confirmado!</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu pedido en <strong>{businessName}</strong> ha sido recibido.
          </p>
          <p className="text-sm text-muted-foreground">Redirigiendo a mis pedidos...</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="pb-16">
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Checkout</h1>
        <p className="mt-1 text-sm text-muted-foreground">Confirma tu pedido y dirección</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Dirección de entrega</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm text-muted-foreground">Dirección</label>
                  <Input
                    required
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Calle y número"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm text-muted-foreground">Ciudad</label>
                  <Input
                    required
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Ciudad"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Instrucciones</h2>
              </div>
              <Textarea
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                placeholder="Ej: Dejar el pedido en la puerta, tocar el timbre..."
                rows={3}
              />
            </div>

            <button
              type="submit"
              disabled={placing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {placing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                `Confirmar pedido — $${total.toFixed(2)}`
              )}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-base font-semibold text-foreground">Resumen del pedido</h2>
            <p className="mb-3 text-sm text-muted-foreground">{businessName}</p>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {item.quantity}x {item.product.name}
                  </span>
                  <span className="text-foreground">
                    ${(item.product.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Envío</span>
                <span>{deliveryFee === 0 ? 'Gratis' : `$${deliveryFee.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Impuestos</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span className="text-foreground">Total</span>
                <span className="text-foreground">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
