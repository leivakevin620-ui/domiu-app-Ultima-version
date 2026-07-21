'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ShoppingCart, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { isDomiUuid } from '@/lib/domi/client-ui';
import type { MarketplaceProduct, MarketplaceProductMetadata } from '@/services/marketplace';

interface AgentPayload {
  conversationId?: unknown;
  assistant?: {
    clientCommands?: unknown;
    toolData?: unknown;
  };
}

interface Command {
  type: 'cart.add' | 'cart.replace' | 'cart.clear' | 'navigate' | 'speech.stop';
  payload: Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function commandsFromPayload(value: unknown): Command[] {
  if (!value || typeof value !== 'object') return [];
  const payload = value as AgentPayload;
  const toolData = asRecord(payload.assistant?.toolData);
  const raw = Array.isArray(payload.assistant?.clientCommands)
    ? payload.assistant.clientCommands
    : Array.isArray(toolData.clientCommands)
      ? toolData.clientCommands
      : [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .filter((item) => ['cart.add', 'cart.replace', 'cart.clear', 'navigate', 'speech.stop'].includes(String(item.type)))
    .map((item) => ({
      type: item.type as Command['type'],
      payload: asRecord(item.payload),
    }))
    .slice(0, 5);
}

function productFromCommand(payload: Record<string, unknown>): MarketplaceProduct | null {
  const product = asRecord(payload.product);
  if (!isDomiUuid(product.id) || !isDomiUuid(product.business_id)) return null;
  if (typeof product.name !== 'string' || !product.name.trim()) return null;
  const price = Number(product.price);
  if (!Number.isFinite(price) || price < 0) return null;
  return {
    id: product.id,
    business_id: product.business_id,
    name: product.name.trim().slice(0, 180),
    description: typeof product.description === 'string' ? product.description.slice(0, 2000) : '',
    price,
    image_url: typeof product.image_url === 'string' ? product.image_url : null,
    is_available: product.is_available !== false,
    metadata: asRecord(product.metadata) as MarketplaceProductMetadata,
  };
}

export function DomiAgentBridge() {
  const { profile } = useAuth();
  const cart = useCart();
  const [notice, setNotice] = useState('');
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const handleResponse = (event: Event) => {
      if (!profile || profile.role !== 'customer') return;
      const detail = (event as CustomEvent<unknown>).detail;
      const commands = commandsFromPayload(detail);
      for (const command of commands) {
        if (command.type === 'cart.clear') {
          cart.clearCart();
          setNotice('Domi vació el carrito según tu solicitud.');
          continue;
        }
        if (command.type !== 'cart.add' && command.type !== 'cart.replace') continue;
        const product = productFromCommand(command.payload);
        const businessId = command.payload.businessId;
        const businessName = command.payload.businessName;
        const quantity = Number(command.payload.quantity || 1);
        const unitPrice = Number(command.payload.unitPrice ?? product?.price);
        if (
          !product
          || !isDomiUuid(businessId)
          || businessId !== product.business_id
          || typeof businessName !== 'string'
          || !businessName.trim()
          || !Number.isInteger(quantity)
          || quantity < 1
          || quantity > 99
          || !Number.isFinite(unitPrice)
          || unitPrice < 0
        ) continue;

        const options = { quantity, unitPrice };
        if (command.type === 'cart.replace') {
          cart.replaceWithItem(product, businessId, businessName.slice(0, 180), options);
        } else {
          cart.addItem(product, businessId, businessName.slice(0, 180), options);
        }
        setNotice(`${quantity} × ${product.name} quedó ${command.type === 'cart.replace' ? 'preparado' : 'agregado'} en tu carrito.`);
      }
    };

    window.addEventListener('domiu:domi-agent-response', handleResponse);
    return () => window.removeEventListener('domiu:domi-agent-response', handleResponse);
  }, [cart, profile]);

  useEffect(() => {
    if (!notice) return;
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setNotice(''), 6000);
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [notice]);

  if (!notice) return null;
  return (
    <div className="fixed bottom-[calc(9.5rem+env(safe-area-inset-bottom))] right-4 z-[1500] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-[#FFC400]/45 bg-[#1A1D21] p-4 text-white shadow-2xl lg:bottom-24">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-[#1A1D21]">
          <ShoppingCart className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-xs font-black text-[#FFC400]">
            <CheckCircle2 className="h-3.5 w-3.5" /> Carrito actualizado
          </div>
          <p className="mt-1 text-sm leading-relaxed text-white">{notice}</p>
          <a href="/cliente/cart" className="mt-2 inline-flex text-xs font-bold text-[#FFC400] underline underline-offset-4">
            Revisar carrito
          </a>
        </div>
        <button type="button" onClick={() => setNotice('')} className="rounded-lg p-1 text-white hover:bg-white/10" aria-label="Cerrar aviso">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
