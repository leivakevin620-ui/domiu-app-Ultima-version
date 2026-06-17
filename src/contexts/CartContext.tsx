'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { MarketplaceProduct } from '@/services/marketplace';

export interface CartItem {
  id: string;
  product: MarketplaceProduct;
  quantity: number;
  notes?: string;
}

interface CartState {
  businessId: string | null;
  businessName: string | null;
  items: CartItem[];
}

interface CartContextValue {
  items: CartItem[];
  businessId: string | null;
  businessName: string | null;
  itemCount: number;
  subtotal: number;
  isEmpty: boolean;
  addItem: (product: MarketplaceProduct, businessId: string, businessName: string, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = 'domiu-cart';

function loadCart(): CartState {
  if (typeof window === 'undefined') return { businessId: null, businessName: null, items: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as CartState;
  } catch { /* ignore */ }
  return { businessId: null, businessName: null, items: [] };
}

function saveCart(state: CartState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CartState>({ businessId: null, businessName: null, items: [] });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(loadCart());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) saveCart(state);
  }, [state, ready]);

  const addItem = useCallback((product: MarketplaceProduct, businessId: string, businessName: string, quantity = 1) => {
    setState((prev) => {
      if (prev.businessId && prev.businessId !== businessId && prev.items.length > 0) {
        return {
          businessId,
          businessName,
          items: [{ id: crypto.randomUUID?.() ?? Math.random().toString(36), product, quantity }],
        };
      }
      const existing = prev.items.find((i) => i.product.id === product.id);
      if (existing) {
        return {
          ...prev,
          businessId,
          businessName,
          items: prev.items.map((i) =>
            i.product.id === product.id ? { ...i, quantity: i.quantity + quantity } : i,
          ),
        };
      }
      return {
        businessId,
        businessName,
        items: [...prev.items, { id: crypto.randomUUID?.() ?? Math.random().toString(36), product, quantity }],
      };
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setState((prev) => {
      const items = prev.items.filter((i) => i.product.id !== productId);
      if (items.length === 0) return { businessId: null, businessName: null, items: [] };
      return { ...prev, items };
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) return;
    setState((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.product.id === productId ? { ...i, quantity } : i)),
    }));
  }, []);

  const clearCart = useCallback(() => {
    setState({ businessId: null, businessName: null, items: [] });
  }, []);

  const value = useMemo(
    () => ({
      items: state.items,
      businessId: state.businessId,
      businessName: state.businessName,
      itemCount: state.items.reduce((sum, i) => sum + i.quantity, 0),
      subtotal: state.items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
      isEmpty: state.items.length === 0,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
    }),
    [state, addItem, removeItem, updateQuantity, clearCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
