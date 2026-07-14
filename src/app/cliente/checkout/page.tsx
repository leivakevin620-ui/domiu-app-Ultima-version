'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCart, type CartCustomization } from '@/contexts/CartContext';
import { useOrders } from '@/contexts/OrderContext';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

function customizationSummary(customization?: CartCustomization) {
  if (!customization) return [];

  const rows: string[] = [];
  if (customization.style) rows.push(`Estilo: ${customization.style}`);
  if (customization.sauces?.length) rows.push(`Salsas: ${customization.sauces.join(', ')}`);
  if (customization.saucePresentation) {
    rows.push(
      `Presentación: ${customization.saucePresentation === 'aparte' ? 'salsas aparte' : 'alitas bañadas en salsa'}`,
    );
  }
  if (customization.extras?.length) {
    rows.push(
      `Adicionales: ${customization.extras
        .filter((extra) => extra.quantity > 0)
        .map((extra) => `${extra.quantity}x ${extra.name}`)
        .join(', ')}`,
    );
  }
  if (customization.preparationNote?.trim()) {
    rows.push(`Nota de preparación: ${customization.preparationNote.trim()}`);
  }
  return rows;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const { items, businessId, businessName, subtotal, isEmpty, clearCart } = useCart();
  const { createOrder } = useOrders();

  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    address: '',
    city: 'Santa Marta',
    instructions: '',
  });

  const deliveryFee = 0;
  const tax = 0;
  const total = subtotal + deliveryFee + tax;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!profile) {
      setError('Debes iniciar sesión para confirmar el pedido.');
      return;
    }
    if (!businessId || !businessName || items.length === 0) {
      setError('El carrito no contiene un pedido válido.');
      return;
    }

    setPlacing(true);
    setError('');

    try {
      await createOrder({
        customerId: profile.id,
        customerName:
          [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Cliente',
        businessId,
        businessName,
        items: items.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          customization: item.customization,
          specialInstructions: item.customization?.preparationNote,
        })),
        subtotal,
        deliveryFee,
        taxAmount: tax,
        totalAmount: total,
        deliveryAddress: `${form.address.trim()}, ${form.city.trim()}`,
        instructions: form.instructions.trim(),
      });

      setPlaced(true);
      clearCart();
      window.setTimeout(() => router.push('/cliente/pedidos'), 1500);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear el pedido.');
      setPlacing(false);
    }
  };

  if (isEmpty && !placed) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-4 py-12">
        <section className="w-full rounded-3xl border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-2xl">
            🛍️
          </div>
          <h1 className="text-xl font-bold text-foreground">Tu carrito está vacío</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Agrega productos desde el menú de Olma Wings antes de continuar.
          </p>
          <a
            href="/cliente/business/olma-wings-and-smokehouse"
            className="mt-6 inline-flex rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            Ver menú de Olma Wings
          </a>
        </section>
      </main>
    );
  }

  if (placed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <section className="max-w-md rounded-3xl border border-border bg-card p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-3xl">
            ✓
          </div>
          <h1 className="text-2xl font-bold text-foreground">¡Pedido confirmado!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Olma Wings recibió los productos, las salsas, los adicionales y las notas de preparación.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-lg"
            aria-label="Volver"
          >
            ←
          </button>
          <span className="font-semibold text-foreground">Confirmar pedido</span>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-5">
        <form onSubmit={submit} className="space-y-5 lg:col-span-3">
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 font-bold text-foreground">Dirección de entrega</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-muted-foreground">
                  Dirección completa
                </span>
                <input
                  required
                  value={form.address}
                  onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                  placeholder="Calle, carrera, número, barrio y referencia"
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-muted-foreground">Ciudad</span>
                <input
                  required
                  value={form.city}
                  onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 font-bold text-foreground">Instrucciones generales de entrega</h2>
            <textarea
              value={form.instructions}
              onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))}
              placeholder="Ejemplo: llamar al llegar, entregar en portería o no tocar el timbre."
              rows={4}
              className="w-full resize-y rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Las notas de preparación de cada producto ya aparecen en el resumen de la derecha.
            </p>
          </section>

          {error && (
            <p className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={placing}
            className="flex w-full items-center justify-center rounded-2xl bg-primary py-4 font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {placing ? 'Creando pedido…' : `Confirmar pedido — ${formatCurrency(total)}`}
          </button>
        </form>

        <aside className="h-fit rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-20 lg:col-span-2">
          <h2 className="mb-1 font-bold text-foreground">Resumen del pedido</h2>
          <p className="mb-4 text-sm text-muted-foreground">{businessName}</p>

          <div className="space-y-4">
            {items.map((item) => (
              <article key={item.id} className="border-b border-border pb-4 last:border-b-0">
                <div className="flex justify-between gap-3">
                  <span className="font-medium text-foreground">
                    {item.quantity}x {item.product.name}
                  </span>
                  <span className="shrink-0 font-semibold text-foreground">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </span>
                </div>

                {customizationSummary(item.customization).map((row) => (
                  <p key={row} className="mt-1 text-xs leading-5 text-muted-foreground">
                    {row}
                  </p>
                ))}
              </article>
            ))}
          </div>

          <div className="mt-4 flex justify-between border-t border-border pt-4 text-lg font-bold text-foreground">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </aside>
      </div>
    </main>
  );
}
