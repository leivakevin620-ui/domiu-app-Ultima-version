'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/ui/page-container';
import { PageTitle } from '@/components/ui/page-title';
import { EmptyState } from '@/components/ui/empty-state';
import { useCart } from '@/contexts/CartContext';
import { ShoppingBag, Trash2, Plus, Minus, ArrowLeft, Store } from 'lucide-react';
import Link from 'next/link';

export default function CartPage() {
  const router = useRouter();
  const { items, businessId, businessName, subtotal, isEmpty, removeItem, updateQuantity, clearCart } = useCart();

  const deliveryFee = subtotal > 20 ? 0 : 2.50;
  const tax = subtotal * 0.08;
  const total = subtotal + deliveryFee + tax;

  if (isEmpty) {
    return (
      <PageContainer>
        <PageTitle title="Carrito" description="Revisa tu pedido antes de pagar" />
        <EmptyState
          icon={<ShoppingBag className="h-6 w-6" />}
          title="Tu carrito está vacío"
          description="Agrega productos desde el menú de un restaurante para comenzar."
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

  return (
    <PageContainer className="pb-32">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Carrito</h1>
          <p className="mt-1 text-sm text-muted-foreground">Revisa tu pedido</p>
        </div>
        <button
          onClick={clearCart}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Vaciar
        </button>
      </div>

      {businessId && businessName && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{businessName}</p>
            <Link href={`/cliente/business/${businessId}`} className="text-xs text-muted-foreground hover:text-primary transition-colors">
              Ver menú
            </Link>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-foreground truncate">{item.product.name}</h4>
              <p className="mt-0.5 text-xs text-muted-foreground">
                ${item.product.price.toFixed(2)} c/u
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => { if (item.quantity <= 1) removeItem(item.product.id); else updateQuantity(item.product.id, item.quantity - 1); }}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-8 text-center text-sm font-medium text-foreground">{item.quantity}</span>
              <button
                onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="w-16 text-right">
              <span className="text-sm font-semibold text-foreground">
                ${(item.product.price * item.quantity).toFixed(2)}
              </span>
            </div>

            <button
              onClick={() => removeItem(item.product.id)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Envío</span>
            <span className="text-foreground">{deliveryFee === 0 ? 'Gratis' : `$${deliveryFee.toFixed(2)}`}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Impuestos</span>
            <span className="text-foreground">${tax.toFixed(2)}</span>
          </div>
          <div className="border-t border-border pt-2">
            <div className="flex justify-between text-base font-semibold">
              <span className="text-foreground">Total</span>
              <span className="text-foreground">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <Link
          href="/cliente/checkout"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Ir a pagar
        </Link>
      </div>
    </PageContainer>
  );
}
