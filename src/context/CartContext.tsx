"use client";

import { createContext, useContext, useReducer, ReactNode } from "react";

export type CartItem = {
  id: string;
  productId: string;
  negocioId: string;
  negocioNombre: string;
  nombre: string;
  precio: number;
  cantidad: number;
  descripcion: string;
};

type CartState = {
  items: CartItem[];
  negocioId: string | null;
  negocioNombre: string;
};

type CartAction =
  | { type: "ADD_ITEM"; payload: { productId: string; negocioId: string; negocioNombre: string; nombre: string; precio: number; descripcion: string } }
  | { type: "REMOVE_ITEM"; payload: { productId: string } }
  | { type: "UPDATE_QUANTITY"; payload: { productId: string; cantidad: number } }
  | { type: "CLEAR_CART" };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const existing = state.items.find(i => i.productId === action.payload.productId);
      if (existing) {
        return { ...state, items: state.items.map(i => i.productId === action.payload.productId ? { ...i, cantidad: i.cantidad + 1 } : i) };
      }
      return {
        ...state,
        negocioId: action.payload.negocioId,
        negocioNombre: action.payload.negocioNombre,
        items: [...state.items, { id: crypto.randomUUID(), ...action.payload, cantidad: 1 }],
      };
    }
    case "REMOVE_ITEM":
      return { ...state, items: state.items.filter(i => i.productId !== action.payload.productId) };
    case "UPDATE_QUANTITY": {
      if (action.payload.cantidad <= 0) {
        return { ...state, items: state.items.filter(i => i.productId !== action.payload.productId) };
      }
      return { ...state, items: state.items.map(i => i.productId === action.payload.productId ? { ...i, cantidad: action.payload.cantidad } : i) };
    }
    case "CLEAR_CART":
      return { items: [], negocioId: null, negocioNombre: "" };
    default:
      return state;
  }
}

const CartContext = createContext<{
  items: CartItem[];
  negocioId: string | null;
  negocioNombre: string;
  addItem: (item: Omit<CartItem, "id" | "cantidad">) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, cantidad: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
} | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], negocioId: null, negocioNombre: "" });

  const addItem = (item: Omit<CartItem, "id" | "cantidad">) => dispatch({ type: "ADD_ITEM", payload: item });
  const removeItem = (productId: string) => dispatch({ type: "REMOVE_ITEM", payload: { productId } });
  const updateQuantity = (productId: string, cantidad: number) => dispatch({ type: "UPDATE_QUANTITY", payload: { productId, cantidad } });
  const clearCart = () => dispatch({ type: "CLEAR_CART" });
  const totalItems = state.items.reduce((sum, i) => sum + i.cantidad, 0);
  const subtotal = state.items.reduce((sum, i) => sum + i.precio * i.cantidad, 0);

  return (
    <CartContext.Provider value={{ ...state, addItem, removeItem, updateQuantity, clearCart, totalItems, subtotal }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
