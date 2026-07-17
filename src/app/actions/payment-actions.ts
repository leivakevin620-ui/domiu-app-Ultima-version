'use server';

import { z } from 'zod';
import { requireAuth } from '@/lib/auth/server-auth';
import { getServiceClient } from '@/lib/db/supabase';
import { serverAudit } from '@/lib/audit/server-audit';

const verifySchema = z.object({
  orderId: z.string().uuid(),
  decision: z.enum(['approve', 'reject']),
  reason: z.string().trim().max(500).optional(),
});

export async function verifyTransferPaymentAction(input: z.infer<typeof verifySchema>) {
  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues.map((issue) => issue.message).join(', '),
    };
  }

  const auth = await requireAuth();
  if (auth.error) return { success: false as const, error: auth.error.message };
  if (!['merchant', 'admin'].includes(auth.session.profile.role)) {
    return { success: false as const, error: 'No autorizado para verificar pagos' };
  }

  const supabase = getServiceClient();
  const { data: order } = await supabase
    .from('orders')
    .select('id,business_id,customer_id,order_number,payment_method,payment_status,payment_proof_url,total_amount')
    .eq('id', parsed.data.orderId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!order) return { success: false as const, error: 'Pedido no encontrado' };
  if (order.payment_method !== 'transfer') {
    return { success: false as const, error: 'El pedido no utiliza transferencia' };
  }

  if (auth.session.profile.role === 'merchant') {
    const { data: business } = await supabase
      .from('businesses')
      .select('owner_id')
      .eq('id', order.business_id)
      .maybeSingle();
    if (business?.owner_id !== auth.session.user.id) {
      return { success: false as const, error: 'El pedido pertenece a otro negocio' };
    }
  }

  if (!order.payment_proof_url) {
    return { success: false as const, error: 'El cliente todavía no adjuntó comprobante' };
  }
  if (['completed', 'refunded'].includes(order.payment_status)) {
    return { success: false as const, error: 'El pago ya fue cerrado' };
  }

  const nextStatus = parsed.data.decision === 'approve' ? 'completed' : 'failed';
  const now = new Date().toISOString();
  const { error: orderError } = await supabase
    .from('orders')
    .update({
      payment_status: nextStatus,
      metadata: {
        payment_reviewed_at: now,
        payment_reviewed_by: auth.session.user.id,
        payment_decision: parsed.data.decision,
        payment_rejection_reason:
          parsed.data.decision === 'reject' ? parsed.data.reason?.trim() || null : null,
      },
      updated_at: now,
    })
    .eq('id', order.id);
  if (orderError) return { success: false as const, error: orderError.message };

  const { error: transactionError } = await supabase
    .from('payment_transactions')
    .update({
      status: nextStatus,
      verified_by: auth.session.user.id,
      verified_at: now,
      metadata: {
        decision: parsed.data.decision,
        reason: parsed.data.reason?.trim() || null,
        reviewer_role: auth.session.profile.role,
      },
      updated_at: now,
    })
    .eq('order_id', order.id);
  if (transactionError) return { success: false as const, error: transactionError.message };

  await supabase.from('notifications').insert({
    recipient_id: order.customer_id,
    sender_id: auth.session.user.id,
    notification_type: parsed.data.decision === 'approve' ? 'payment_success' : 'payment_failed',
    title: parsed.data.decision === 'approve' ? 'Transferencia aprobada' : 'Transferencia rechazada',
    message:
      parsed.data.decision === 'approve'
        ? `El pago del pedido #${order.order_number} fue verificado.`
        : `El comprobante del pedido #${order.order_number} no pudo ser aprobado.`,
    order_id: order.id,
    reference_id: order.id,
    reference_type: 'payment',
    channels: ['in_app'],
    metadata: { payment_status: nextStatus, reason: parsed.data.reason?.trim() || null },
  });

  await serverAudit.logAction(
    auth.session.user.id,
    auth.session.user.email,
    auth.session.profile.role,
    parsed.data.decision === 'approve' ? 'approve_transfer' : 'reject_transfer',
    'payments',
    order.id,
    { payment_status: nextStatus, amount: order.total_amount },
  );

  return { success: true as const, paymentStatus: nextStatus };
}
