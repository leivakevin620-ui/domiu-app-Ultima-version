'use client';

import React, { useMemo, useState } from 'react';
import { X, Minus, Plus } from 'lucide-react';
import type { MarketplaceProduct } from '@/services/marketplace';
import type { CartCustomization } from '@/contexts/CartContext';

interface Props {
  product: MarketplaceProduct;
  open: boolean;
  onClose: () => void;
  onConfirm: (customization: CartCustomization, unitPrice: number) => void;
}

export function ProductCustomizationDialog({ product, open, onClose, onConfirm }: Props) {
  const config = product.metadata;
  const included = config?.included_sauces ?? 0;
  const sauces = config?.sauce_options ?? [];
  const styles = config?.style_options ?? [];
  const extras = config?.extras ?? [];
  const [style, setStyle] = useState('');
  const [selectedSauces, setSelectedSauces] = useState<string[]>([]);
  const [saucePresentation, setSaucePresentation] = useState<'banadas' | 'aparte'>('banadas');
  const [extraQuantities, setExtraQuantities] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const extrasTotal = useMemo(
    () => extras.reduce((sum, extra) => sum + extra.price * (extraQuantities[extra.name] ?? 0), 0),
    [extras, extraQuantities],
  );
  const total = product.price + extrasTotal;

  if (!open) return null;

  const toggleSauce = (sauce: string) => {
    setError('');
    setSelectedSauces((current) => {
      if (current.includes(sauce)) return current.filter((item) => item !== sauce);
      if (current.length >= included) return current;
      return [...current, sauce];
    });
  };

  const submit = () => {
    if (config?.requires_style && !style) return setError('Escoge el estilo de preparación.');
    if (selectedSauces.length !== included) return setError(`Debes escoger exactamente ${included} salsas.`);
    onConfirm({
      style,
      sauces: selectedSauces,
      saucePresentation,
      extras: extras.filter((extra) => (extraQuantities[extra.name] ?? 0) > 0).map((extra) => ({ ...extra, quantity: extraQuantities[extra.name] })),
      preparationNote: note.trim(),
    }, total);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-background p-5 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div><h2 className="text-xl font-bold">Personaliza {product.name}</h2><p className="text-sm text-muted-foreground">Completa las opciones antes de agregar.</p></div>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        <section className="mb-6"><h3 className="mb-3 font-semibold">1. Escoge el estilo</h3><div className="grid gap-2 sm:grid-cols-2">{styles.map((option) => <button key={option} onClick={() => setStyle(option)} className={`rounded-2xl border p-3 text-left text-sm ${style === option ? 'border-primary bg-primary/10 font-semibold' : 'border-border'}`}>{option}</button>)}</div></section>

        <section className="mb-6"><div className="mb-3 flex justify-between"><h3 className="font-semibold">2. Escoge tus salsas</h3><span className="text-sm text-muted-foreground">{selectedSauces.length}/{included}</span></div><div className="grid gap-2 sm:grid-cols-2">{sauces.map((sauce) => <button key={sauce} onClick={() => toggleSauce(sauce)} className={`rounded-2xl border p-3 text-left text-sm ${selectedSauces.includes(sauce) ? 'border-primary bg-primary/10 font-semibold' : 'border-border'}`}>{sauce}</button>)}</div></section>

        <section className="mb-6"><h3 className="mb-3 font-semibold">3. ¿Cómo deseas las salsas?</h3><div className="grid gap-2 sm:grid-cols-2"><button onClick={() => setSaucePresentation('banadas')} className={`rounded-2xl border p-3 text-sm ${saucePresentation === 'banadas' ? 'border-primary bg-primary/10 font-semibold' : 'border-border'}`}>Alitas bañadas en salsa</button><button onClick={() => setSaucePresentation('aparte')} className={`rounded-2xl border p-3 text-sm ${saucePresentation === 'aparte' ? 'border-primary bg-primary/10 font-semibold' : 'border-border'}`}>Salsas aparte</button></div></section>

        <section className="mb-6"><h3 className="mb-3 font-semibold">4. Adicionales</h3><div className="space-y-2">{extras.map((extra) => { const quantity = extraQuantities[extra.name] ?? 0; return <div key={extra.name} className="flex items-center justify-between rounded-2xl border p-3"><div><p className="text-sm font-medium">{extra.name}</p><p className="text-xs text-muted-foreground">+ ${extra.price.toLocaleString('es-CO')}</p></div><div className="flex items-center gap-2"><button onClick={() => setExtraQuantities((p) => ({ ...p, [extra.name]: Math.max(0, quantity - 1) }))} className="rounded-lg border p-1.5"><Minus className="h-4 w-4" /></button><span className="w-6 text-center text-sm font-bold">{quantity}</span><button onClick={() => setExtraQuantities((p) => ({ ...p, [extra.name]: quantity + 1 }))} className="rounded-lg bg-primary p-1.5 text-primary-foreground"><Plus className="h-4 w-4" /></button></div></div>; })}</div></section>

        <section className="mb-5"><h3 className="mb-2 font-semibold">5. Nota de preparación</h3><textarea value={note} onChange={(event) => setNote(event.target.value.slice(0, 250))} rows={3} className="w-full rounded-2xl border bg-background p-3 text-sm" placeholder="Ej: bien crocantes, poca salsa, sin picante, papas sin sal..." /><p className="mt-1 text-right text-xs text-muted-foreground">{note.length}/250</p></section>

        {error && <p className="mb-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <button onClick={submit} className="w-full rounded-2xl bg-primary py-4 font-bold text-primary-foreground">Agregar al carrito — ${total.toLocaleString('es-CO')}</button>
      </div>
    </div>
  );
}
