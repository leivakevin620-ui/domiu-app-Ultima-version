'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { MarketplaceProduct } from '@/services/marketplace';

export interface CartCustomization {
  style?: string;
  sauces?: string[];
  saucePresentation?: 'banadas' | 'aparte';
  extras?: Array<{ name: string; price: number; quantity: number }>;
  preparationNote?: string;
}

export interface CartItem {
  id: string;
  product: MarketplaceProduct;
  quantity: number;
  unitPrice: number;
  customization?: CartCustomization;
  notes?: string;
}

interface CartState { businessId: string | null; businessName: string | null; items: CartItem[]; }
interface AddItemOptions { quantity?: number; unitPrice?: number; customization?: CartCustomization; }
interface CartContextValue {
  items: CartItem[]; businessId: string | null; businessName: string | null; itemCount: number; subtotal: number; isEmpty: boolean;
  addItem: (product: MarketplaceProduct, businessId: string, businessName: string, options?: AddItemOptions) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'domiu-cart';
function loadCart(): CartState { if (typeof window === 'undefined') return { businessId: null, businessName: null, items: [] }; try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { const parsed = JSON.parse(raw) as CartState; return { ...parsed, items: parsed.items.map((item) => ({ ...item, unitPrice: item.unitPrice ?? item.product.price })) }; } } catch { /* ignore */ } return { businessId: null, businessName: null, items: [] }; }
function saveCart(state: CartState) { if (typeof window === 'undefined') return; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ } }

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CartState>({ businessId: null, businessName: null, items: [] }); const [ready, setReady] = useState(false);
  useEffect(() => { setState(loadCart()); setReady(true); }, []);
  useEffect(() => { if (ready) saveCart(state); }, [state, ready]);

  const addItem = useCallback((product: MarketplaceProduct, businessId: string, businessName: string, options: AddItemOptions = {}) => {
    const quantity = options.quantity ?? 1; const unitPrice = options.unitPrice ?? product.price; const item: CartItem = { id: crypto.randomUUID?.() ?? Math.random().toString(36), product, quantity, unitPrice, customization: options.customization, notes: options.customization?.preparationNote };
    setState((prev) => {
      if (prev.businessId && prev.businessId !== businessId && prev.items.length > 0) return { businessId, businessName, items: [item] };
      const signature = JSON.stringify(options.customization ?? {}); const existing = prev.items.find((current) => current.product.id === product.id && JSON.stringify(current.customization ?? {}) === signature && current.unitPrice === unitPrice);
      if (existing) return { ...prev, businessId, businessName, items: prev.items.map((current) => current.id === existing.id ? { ...current, quantity: current.quantity + quantity } : current) };
      return { businessId, businessName, items: [...prev.items, item] };
    });
  }, []);
  const removeItem = useCallback((itemId: string) => setState((prev) => { const items = prev.items.filter((item) => item.id !== itemId); return items.length ? { ...prev, items } : { businessId: null, businessName: null, items: [] }; }), []);
  const updateQuantity = useCallback((itemId: string, quantity: number) => { if (quantity <= 0) return; setState((prev) => ({ ...prev, items: prev.items.map((item) => item.id === itemId ? { ...item, quantity } : item) })); }, []);
  const clearCart = useCallback(() => setState({ businessId: null, businessName: null, items: [] }), []);
  const value = useMemo(() => ({ items: state.items, businessId: state.businessId, businessName: state.businessName, itemCount: state.items.reduce((sum, item) => sum + item.quantity, 0), subtotal: state.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0), isEmpty: state.items.length === 0, addItem, removeItem, updateQuantity, clearCart }), [state, addItem, removeItem, updateQuantity, clearCart]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue { const ctx = useContext(CartContext); if (!ctx) throw new Error('useCart must be used within a CartProvider'); return ctx; }
