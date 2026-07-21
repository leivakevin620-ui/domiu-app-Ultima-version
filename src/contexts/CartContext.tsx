'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { MarketplaceProduct } from '@/services/marketplace';

export interface CartCustomization {
  [key: string]: unknown;
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

interface CartState {
  businessId: string | null;
  businessName: string | null;
  items: CartItem[];
}

interface AddItemOptions {
  quantity?: number;
  unitPrice?: number;
  customization?: CartCustomization;
}

interface CartContextValue {
  items: CartItem[];
  businessId: string | null;
  businessName: string | null;
  itemCount: number;
  subtotal: number;
  isEmpty: boolean;
  addItem: (
    product: MarketplaceProduct,
    businessId: string,
    businessName: string,
    options?: AddItemOptions,
  ) => void;
  replaceWithItem: (
    product: MarketplaceProduct,
    businessId: string,
    businessName: string,
    options?: AddItemOptions,
  ) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
}

const EMPTY_CART: CartState = {
  businessId: null,
  businessName: null,
  items: [],
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'domiu-cart';

function loadCart(): CartState {
  if (typeof window === 'undefined') return EMPTY_CART;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_CART;

    const parsed = JSON.parse(raw) as CartState;
    if (!Array.isArray(parsed.items)) return EMPTY_CART;

    return {
      businessId: parsed.businessId ?? null,
      businessName: parsed.businessName ?? null,
      items: parsed.items.map((item) => ({
        ...item,
        unitPrice: item.unitPrice ?? item.product.price,
      })),
    };
  } catch {
    return EMPTY_CART;
  }
}

function saveCart(state: CartState) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // El carrito sigue funcionando en memoria si el navegador bloquea localStorage.
  }
}

function createCartItem(product: MarketplaceProduct, options: AddItemOptions = {}): CartItem {
  const quantity = Math.max(1, Math.min(99, Math.floor(options.quantity ?? 1)));
  const unitPrice = options.unitPrice ?? product.price;
  return {
    id: crypto.randomUUID?.() ?? Math.random().toString(36),
    product,
    quantity,
    unitPrice,
    customization: options.customization,
    notes: options.customization?.preparationNote,
  };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CartState>(EMPTY_CART);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setState(loadCart());
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveCart(state);
  }, [state, hydrated]);

  const addItem = useCallback(
    (
      product: MarketplaceProduct,
      businessId: string,
      businessName: string,
      options: AddItemOptions = {},
    ) => {
      const item = createCartItem(product, options);

      setState((previous) => {
        if (
          previous.businessId &&
          previous.businessId !== businessId &&
          previous.items.length > 0
        ) {
          return { businessId, businessName, items: [item] };
        }

        const signature = JSON.stringify(options.customization ?? {});
        const existing = previous.items.find(
          (current) =>
            current.product.id === product.id &&
            JSON.stringify(current.customization ?? {}) === signature &&
            current.unitPrice === item.unitPrice,
        );

        if (existing) {
          return {
            ...previous,
            businessId,
            businessName,
            items: previous.items.map((current) =>
              current.id === existing.id
                ? { ...current, quantity: Math.min(99, current.quantity + item.quantity) }
                : current,
            ),
          };
        }

        return {
          businessId,
          businessName,
          items: [...previous.items, item],
        };
      });
    },
    [],
  );

  const replaceWithItem = useCallback(
    (
      product: MarketplaceProduct,
      businessId: string,
      businessName: string,
      options: AddItemOptions = {},
    ) => {
      setState({
        businessId,
        businessName,
        items: [createCartItem(product, options)],
      });
    },
    [],
  );

  const removeItem = useCallback((itemId: string) => {
    setState((previous) => {
      const items = previous.items.filter((item) => item.id !== itemId);
      return items.length ? { ...previous, items } : EMPTY_CART;
    });
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) return;

    setState((previous) => ({
      ...previous,
      items: previous.items.map((item) =>
        item.id === itemId ? { ...item, quantity: Math.min(99, quantity) } : item,
      ),
    }));
  }, []);

  const clearCart = useCallback(() => setState(EMPTY_CART), []);

  const value = useMemo(
    () => ({
      items: state.items,
      businessId: state.businessId,
      businessName: state.businessName,
      itemCount: state.items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: state.items.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0,
      ),
      isEmpty: state.items.length === 0,
      addItem,
      replaceWithItem,
      removeItem,
      updateQuantity,
      clearCart,
    }),
    [state, addItem, replaceWithItem, removeItem, updateQuantity, clearCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
}
