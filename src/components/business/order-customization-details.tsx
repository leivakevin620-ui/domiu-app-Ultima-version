'use client';

import React, { useEffect, useState } from 'react';
import { getBrowserClient } from '@/lib/db/supabase';

type Item = { id: string; quantity: number; unit_price: number; special_instructions: string | null; variant_selections: Record<string, unknown> | null; products: { name: string } | null };

export function OrderCustomizationDetails({ orderId }: { orderId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => { (async () => { const supabase = await getBrowserClient(); const { data } = await supabase.from('order_items').select('id,quantity,unit_price,special_instructions,variant_selections,products(name)').eq('order_id', orderId); setItems((data ?? []) as unknown as Item[]); })(); }, [orderId]);
  return <div className="mt-2 space-y-3">{items.map((item) => { const config = item.variant_selections ?? {}; const sauces = Array.isArray(config.sauces) ? config.sauces as string[] : []; const extras = Array.isArray(config.extras) ? config.extras as Array<{ name: string; quantity: number }> : []; return <div key={item.id} className="rounded-lg bg-muted/40 p-2 text-[11px]"><div className="flex justify-between font-semibold"><span>{item.quantity}x {item.products?.name ?? 'Producto'}</span><span>${(Number(item.unit_price) * item.quantity).toLocaleString('es-CO')}</span></div>{typeof config.style === 'string' && <p><strong>Estilo:</strong> {config.style}</p>}{sauces.length > 0 && <p><strong>Salsas:</strong> {sauces.join(', ')}</p>}{typeof config.saucePresentation === 'string' && <p><strong>Entrega de salsa:</strong> {config.saucePresentation === 'aparte' ? 'Aparte' : 'Alitas bañadas'}</p>}{extras.length > 0 && <p><strong>Adicionales:</strong> {extras.map((extra) => `${extra.quantity}x ${extra.name}`).join(', ')}</p>}{item.special_instructions && <p className="mt-1 rounded bg-warning/10 p-1.5"><strong>Nota de preparación:</strong> {item.special_instructions}</p>}</div>; })}</div>;
}
