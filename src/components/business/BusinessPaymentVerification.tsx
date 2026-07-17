'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, FileWarning, Landmark, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getBrowserClient } from '@/lib/db/supabase';
import { verifyTransferPaymentAction } from '@/app/actions/payment-actions';

type PaymentRow = {
  method: string;
  status: string;
  providerReference: string | null;
  proofPath: string | null;
  signedUrl: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pago pendiente',
  pending_verification: 'Pendiente de verificación',
  completed: 'Pago aprobado',
  failed: 'Pago rechazado',
  refunded: 'Pago reembolsado',
};

export function BusinessPaymentVerification({
  orderId,
  onUpdated,
}: {
  orderId: string;
  onUpdated?: () => void;
}) {
  const [payment, setPayment] = useState<PaymentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<'approve' | 'reject' | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getBrowserClient();
      const { data, error } = await supabase
        .from('payment_transactions')
        .select('method,status,provider_reference,proof_url')
        .eq('order_id', orderId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        setPayment(null);
        return;
      }
      let signedUrl: string | null = null;
      if (data.proof_url) {
        const { data: signed } = await supabase.storage
          .from('payment-proofs')
          .createSignedUrl(String(data.proof_url), 300);
        signedUrl = signed?.signedUrl || null;
      }
      setPayment({
        method: String(data.method),
        status: String(data.status),
        providerReference: data.provider_reference ? String(data.provider_reference) : null,
        proofPath: data.proof_url ? String(data.proof_url) : null,
        signedUrl,
      });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo cargar el pago');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (decision: 'approve' | 'reject') => {
    if (reviewing) return;
    if (decision === 'reject' && !reason.trim()) {
      toast.error('Escribe el motivo del rechazo');
      return;
    }
    setReviewing(decision);
    try {
      const result = await verifyTransferPaymentAction({
        orderId,
        decision,
        reason: decision === 'reject' ? reason.trim() : undefined,
      });
      if (!result.success) throw new Error(result.error);
      toast.success(decision === 'approve' ? 'Transferencia aprobada' : 'Transferencia rechazada');
      setReason('');
      await load();
      onUpdated?.();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo verificar el pago');
    } finally {
      setReviewing(null);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando pago…</div>;
  }
  if (!payment) return null;

  const isTransfer = payment.method === 'transfer';
  const pendingReview = payment.status === 'pending_verification';

  return (
    <section className={`rounded-xl border p-3 ${pendingReview ? 'border-warning/30 bg-warning/5' : 'bg-muted/30'}`}>
      <div className="flex items-start gap-2">
        <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Pago del pedido</p>
          <p className="mt-1 text-xs font-black">{isTransfer ? 'Transferencia' : 'Efectivo'} · {STATUS_LABELS[payment.status] || payment.status}</p>
          {payment.providerReference && <p className="mt-1 text-xs text-muted-foreground">Referencia: {payment.providerReference}</p>}
        </div>
      </div>

      {isTransfer && payment.signedUrl && (
        <a href={payment.signedUrl} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs font-bold"><ExternalLink className="h-3.5 w-3.5" />Abrir comprobante privado</a>
      )}
      {isTransfer && !payment.proofPath && (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive"><FileWarning className="h-4 w-4" />El cliente todavía no adjuntó comprobante.</p>
      )}

      {pendingReview && payment.proofPath && (
        <div className="mt-3 space-y-2">
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} placeholder="Motivo, obligatorio solo al rechazar" className="w-full rounded-lg border bg-background px-3 py-2 text-xs" />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void review('reject')} disabled={Boolean(reviewing)} className="flex items-center justify-center gap-1 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive disabled:opacity-50"><XCircle className="h-3.5 w-3.5" />{reviewing === 'reject' ? 'Rechazando…' : 'Rechazar'}</button>
            <button type="button" onClick={() => void review('approve')} disabled={Boolean(reviewing)} className="flex items-center justify-center gap-1 rounded-lg bg-success px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5" />{reviewing === 'approve' ? 'Aprobando…' : 'Aprobar'}</button>
          </div>
        </div>
      )}
    </section>
  );
}
