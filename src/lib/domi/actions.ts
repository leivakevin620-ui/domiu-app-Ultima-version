import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DomiServerContext } from '@/lib/domi/server-context';
import { updateDomiUserSettings } from '@/lib/domi/user-settings';
import type {
  DomiConfirmedActionName,
  DomiPendingActionView,
  DomiToolPlan,
  DomiToolResult,
} from '@/lib/domi/tools/types';
import type { DomiRiskLevel } from '@/lib/domi/security';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTION_TTL_MS = 10 * 60_000;

const MERCHANT_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
};

const COURIER_TRANSITIONS: Record<string, readonly string[]> = {
  assigned: ['accepted'],
  accepted: ['picked_up'],
  picked_up: ['in_transit'],
  in_transit: ['delivered'],
};

interface PendingActionRow {
  id: string;
  user_id: string;
  conversation_id: string | null;
  role: string;
  tenant_id: string;
  action_name: DomiConfirmedActionName;
  action_arguments: Record<string, unknown>;
  summary: string;
  risk_level: DomiRiskLevel;
  status: 'pending' | 'confirmed' | 'cancelled' | 'executed' | 'expired' | 'failed';
  expires_at: string;
  result: Record<string, unknown> | null;
  error_message: string | null;
}

function text(value: unknown, max = 240) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim());
}

function navigationForRole(role: DomiServerContext['role']) {
  if (role === 'merchant') return '/negocio';
  if (role === 'courier') return '/repartidor';
  if (role === 'admin') return '/admin';
  return '/cliente';
}

function pendingResult(
  plan: DomiToolPlan,
  pending: DomiPendingActionView,
  navigation: Array<{ label: string; href: string }> = [],
): DomiToolResult {
  return {
    name: plan.name,
    success: true,
    message: `${pending.summary} Esta acción requiere tu confirmación explícita y caduca en 10 minutos.`,
    data: { pendingAction: pending },
    recordCount: 1,
    suggestedActions: [
      `Confirmar acción ${pending.id}`,
      `Cancelar acción ${pending.id}`,
    ],
    navigation,
    requiresConfirmation: true,
    riskLevel: pending.riskLevel,
  };
}

function blocked(plan: DomiToolPlan, message: string, reason: string): DomiToolResult {
  return {
    name: plan.name,
    success: false,
    message,
    data: { reason },
    recordCount: 0,
    suggestedActions: [],
    navigation: [],
    riskLevel: 'medium',
  };
}

async function createPendingAction(args: {
  supabase: SupabaseClient;
  context: DomiServerContext;
  conversationId?: string | null;
  actionName: DomiConfirmedActionName;
  actionArguments: Record<string, unknown>;
  summary: string;
  riskLevel?: DomiRiskLevel;
}): Promise<DomiPendingActionView> {
  const expiresAt = new Date(Date.now() + ACTION_TTL_MS).toISOString();
  const { data, error } = await args.supabase
    .from('domi_pending_actions')
    .insert({
      user_id: args.context.userId,
      conversation_id: args.conversationId || null,
      role: args.context.role,
      tenant_id: args.context.tenantId,
      action_name: args.actionName,
      action_arguments: args.actionArguments,
      summary: args.summary.slice(0, 500),
      risk_level: args.riskLevel || 'medium',
      status: 'pending',
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .select('id,action_name,summary,risk_level,expires_at')
    .single();

  if (error || !data) throw new Error('domi_pending_action_create_failed');
  return {
    id: String(data.id),
    actionName: data.action_name as DomiConfirmedActionName,
    summary: String(data.summary),
    riskLevel: data.risk_level as DomiRiskLevel,
    expiresAt: String(data.expires_at),
  };
}

async function findOrderByReference(
  supabase: SupabaseClient,
  reference: string,
  filters: { businessId?: string; courierId?: string; unassigned?: boolean },
) {
  const select = 'id,order_number,order_code,business_id,courier_id,status,updated_at';
  const build = () => {
    let query = supabase.from('orders').select(select).is('deleted_at', null);
    if (filters.businessId) query = query.eq('business_id', filters.businessId);
    if (filters.courierId) query = query.eq('courier_id', filters.courierId);
    if (filters.unassigned) query = query.is('courier_id', null);
    return query;
  };

  if (validUuid(reference)) {
    const { data, error } = await build().eq('id', reference).maybeSingle();
    if (error) throw new Error('domi_order_lookup_failed');
    return data as Record<string, unknown> | null;
  }

  const safeReference = text(reference, 32).replace(/[^A-Za-z0-9-]/g, '');
  if (!safeReference) return null;

  const byNumber = await build().eq('order_number', safeReference).limit(1).maybeSingle();
  if (byNumber.error) throw new Error('domi_order_lookup_failed');
  if (byNumber.data) return byNumber.data as Record<string, unknown>;

  const byCode = await build().eq('order_code', safeReference).limit(1).maybeSingle();
  if (byCode.error) throw new Error('domi_order_lookup_failed');
  return byCode.data as Record<string, unknown> | null;
}

async function findProductByReference(
  supabase: SupabaseClient,
  businessId: string,
  reference: string,
) {
  const select = 'id,name,sku,status,quantity_available,updated_at,business_id';
  if (validUuid(reference)) {
    const { data, error } = await supabase
      .from('products')
      .select(select)
      .eq('id', reference)
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw new Error('domi_product_lookup_failed');
    return data as Record<string, unknown> | null;
  }

  const cleaned = text(reference, 100).replace(/[%_]/g, '');
  if (!cleaned) return null;

  const bySku = await supabase
    .from('products')
    .select(select)
    .eq('business_id', businessId)
    .eq('sku', cleaned)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  if (bySku.error) throw new Error('domi_product_lookup_failed');
  if (bySku.data) return bySku.data as Record<string, unknown>;

  const { data, error } = await supabase
    .from('products')
    .select(select)
    .eq('business_id', businessId)
    .ilike('name', cleaned)
    .is('deleted_at', null)
    .limit(2);
  if (error) throw new Error('domi_product_lookup_failed');
  if (!data || data.length !== 1) return null;
  return data[0] as Record<string, unknown>;
}

async function prepareMerchantOrderStatus(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
  conversationId?: string | null,
) {
  if (context.role !== 'merchant' || context.tenantType !== 'business') {
    return blocked(plan, 'No encontré un negocio autorizado para esta cuenta.', 'tenant_missing');
  }

  const reference = text(plan.arguments.reference, 40);
  const targetStatus = text(plan.arguments.targetStatus, 24);
  const order = await findOrderByReference(supabase, reference, { businessId: context.tenantId });
  if (!order) return blocked(plan, 'No encontré ese pedido dentro de tu negocio.', 'order_not_found');

  const currentStatus = text(order.status, 24);
  if (!MERCHANT_TRANSITIONS[currentStatus]?.includes(targetStatus)) {
    return blocked(
      plan,
      `El pedido ${text(order.order_number)} está ${currentStatus} y no puede pasar directamente a ${targetStatus}.`,
      'invalid_transition',
    );
  }

  const summary = `Voy a cambiar el pedido ${text(order.order_number)} de ${currentStatus} a ${targetStatus}.`;
  const pending = await createPendingAction({
    supabase,
    context,
    conversationId,
    actionName: 'merchant.update_order_status',
    actionArguments: {
      orderId: text(order.id),
      orderNumber: text(order.order_number),
      expectedStatus: currentStatus,
      targetStatus,
    },
    summary,
  });
  return pendingResult(plan, pending, [{ label: 'Abrir pedidos', href: '/negocio/pedidos' }]);
}

async function prepareMerchantProductUpdate(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
  conversationId?: string | null,
) {
  if (context.role !== 'merchant' || context.tenantType !== 'business') {
    return blocked(plan, 'No encontré un negocio autorizado para esta cuenta.', 'tenant_missing');
  }

  const reference = text(plan.arguments.reference, 100);
  const product = await findProductByReference(supabase, context.tenantId, reference);
  if (!product) {
    return blocked(
      plan,
      'No encontré un único producto con esa referencia. Usa el nombre exacto, SKU o identificador.',
      'product_not_found_or_ambiguous',
    );
  }

  const targetStatus = text(plan.arguments.targetStatus, 24);
  const targetQuantity = numberValue(plan.arguments.targetQuantity);
  const updates: Record<string, unknown> = {};
  const changes: string[] = [];

  if (['available', 'unavailable', 'discontinued'].includes(targetStatus)) {
    updates.status = targetStatus;
    changes.push(`estado a ${targetStatus}`);
  }
  if (targetQuantity !== null && Number.isInteger(targetQuantity) && targetQuantity >= 0 && targetQuantity <= 100000) {
    updates.quantity_available = targetQuantity;
    changes.push(`existencias a ${targetQuantity}`);
  }
  if (!changes.length) return blocked(plan, 'No encontré un cambio de inventario válido.', 'invalid_product_update');

  const summary = `Voy a actualizar ${text(product.name)}: ${changes.join(' y ')}.`;
  const pending = await createPendingAction({
    supabase,
    context,
    conversationId,
    actionName: 'merchant.update_product',
    actionArguments: {
      productId: text(product.id),
      productName: text(product.name),
      expectedUpdatedAt: text(product.updated_at),
      updates,
    },
    summary,
  });
  return pendingResult(plan, pending, [{ label: 'Abrir productos', href: '/negocio/productos' }]);
}

async function prepareCourierAcceptOrder(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
  conversationId?: string | null,
) {
  if (context.role !== 'courier') return blocked(plan, 'Esta acción es exclusiva para repartidores.', 'wrong_role');
  const reference = text(plan.arguments.reference, 40);
  const order = await findOrderByReference(supabase, reference, { unassigned: true });
  if (!order || !['confirmed', 'ready'].includes(text(order.status))) {
    return blocked(plan, 'Ese pedido ya no está disponible para aceptar.', 'order_unavailable');
  }

  const summary = `Voy a asignarte el pedido ${text(order.order_number)}.`;
  const pending = await createPendingAction({
    supabase,
    context,
    conversationId,
    actionName: 'courier.accept_order',
    actionArguments: {
      orderId: text(order.id),
      orderNumber: text(order.order_number),
      expectedStatus: text(order.status),
    },
    summary,
  });
  return pendingResult(plan, pending, [{ label: 'Abrir pedidos', href: '/repartidor/pedidos' }]);
}

async function prepareCourierOrderStatus(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
  conversationId?: string | null,
) {
  if (context.role !== 'courier') return blocked(plan, 'Esta acción es exclusiva para repartidores.', 'wrong_role');
  const reference = text(plan.arguments.reference, 40);
  const targetStatus = text(plan.arguments.targetStatus, 24);
  const order = await findOrderByReference(supabase, reference, { courierId: context.userId });
  if (!order) return blocked(plan, 'No encontré ese pedido entre tus asignaciones.', 'order_not_assigned');

  const currentStatus = text(order.status, 24);
  if (!COURIER_TRANSITIONS[currentStatus]?.includes(targetStatus)) {
    return blocked(
      plan,
      `El pedido ${text(order.order_number)} está ${currentStatus} y no puede pasar directamente a ${targetStatus}.`,
      'invalid_transition',
    );
  }

  const summary = `Voy a cambiar el pedido ${text(order.order_number)} de ${currentStatus} a ${targetStatus}.`;
  const pending = await createPendingAction({
    supabase,
    context,
    conversationId,
    actionName: 'courier.update_order_status',
    actionArguments: {
      orderId: text(order.id),
      orderNumber: text(order.order_number),
      expectedStatus: currentStatus,
      targetStatus,
    },
    summary,
  });
  return pendingResult(plan, pending, [{ label: 'Abrir mis pedidos', href: '/repartidor/pedidos' }]);
}

async function prepareMemorySetting(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
  conversationId?: string | null,
) {
  const enabled = plan.arguments.enabled === true;
  const summary = enabled
    ? 'Voy a activar nuevamente tu memoria personal de Domi.'
    : 'Voy a desactivar tu memoria personal. Domi dejará de guardar preferencias nuevas, pero las existentes seguirán disponibles hasta que las elimines.';
  const pending = await createPendingAction({
    supabase,
    context,
    conversationId,
    actionName: 'memory.set_enabled',
    actionArguments: { enabled },
    summary,
  });
  return pendingResult(plan, pending);
}

async function prepareDeleteMemory(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
  conversationId?: string | null,
) {
  const { count, error } = await supabase
    .from('domi_user_memory')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', context.userId);
  if (error) throw new Error('domi_memory_count_failed');
  if (!count) {
    return {
      name: plan.name,
      success: true,
      message: 'No tengo recuerdos personales guardados para tu cuenta.',
      data: { memoryCount: 0 },
      recordCount: 0,
      suggestedActions: [],
      navigation: [],
      riskLevel: 'low' as const,
    };
  }

  const summary = `Voy a eliminar permanentemente ${count} recuerdo${count === 1 ? '' : 's'} de tu memoria personal de Domi.`;
  const pending = await createPendingAction({
    supabase,
    context,
    conversationId,
    actionName: 'memory.delete_all',
    actionArguments: { expectedCount: count },
    summary,
    riskLevel: 'medium',
  });
  return pendingResult(plan, pending);
}

async function prepareSupportTicket(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
  conversationId?: string | null,
) {
  const description = text(plan.arguments.description, 1200);
  if (description.length < 8) {
    return blocked(plan, 'Describe brevemente el problema que deseas enviar a soporte.', 'description_required');
  }
  const subject = text(plan.arguments.subject, 120) || 'Solicitud creada desde Domi';
  const priority = ['low', 'normal', 'high', 'urgent'].includes(text(plan.arguments.priority, 16))
    ? text(plan.arguments.priority, 16)
    : 'normal';
  const ticketType = text(plan.arguments.ticketType, 40) || 'domi_assistance';

  const summary = `Voy a crear un ticket de soporte con el asunto “${subject}” y prioridad ${priority}.`;
  const pending = await createPendingAction({
    supabase,
    context,
    conversationId,
    actionName: 'support.create_ticket',
    actionArguments: {
      subject,
      description,
      priority,
      ticketType,
      businessId: context.role === 'merchant' ? context.tenantId : null,
      courierId: context.role === 'courier' ? context.userId : null,
    },
    summary,
  });
  return pendingResult(plan, pending, [{ label: 'Abrir soporte', href: `${navigationForRole(context.role)}/soporte` }]);
}

export async function prepareDomiConfirmedAction(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
  conversationId?: string | null,
): Promise<DomiToolResult> {
  switch (plan.name) {
    case 'merchant.update_order_status':
      return prepareMerchantOrderStatus(supabase, context, plan, conversationId);
    case 'merchant.update_product':
      return prepareMerchantProductUpdate(supabase, context, plan, conversationId);
    case 'courier.accept_order':
      return prepareCourierAcceptOrder(supabase, context, plan, conversationId);
    case 'courier.update_order_status':
      return prepareCourierOrderStatus(supabase, context, plan, conversationId);
    case 'memory.set_enabled':
      return prepareMemorySetting(supabase, context, plan, conversationId);
    case 'memory.delete_all':
      return prepareDeleteMemory(supabase, context, plan, conversationId);
    case 'support.create_ticket':
      return prepareSupportTicket(supabase, context, plan, conversationId);
    default:
      return blocked(plan, 'La acción solicitada no está disponible.', 'unsupported_action');
  }
}

export async function listDomiMemory(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
): Promise<DomiToolResult> {
  const { data, error } = await supabase
    .from('domi_user_memory')
    .select('id,memory_key,memory_value,memory_type,source,created_at,updated_at')
    .eq('user_id', context.userId)
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) throw new Error('domi_memory_read_failed');

  const memories = ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const value = row.memory_value && typeof row.memory_value === 'object'
      ? row.memory_value as Record<string, unknown>
      : {};
    return {
      id: text(row.id),
      text: text(value.text, 180),
      type: text(row.memory_type, 32),
      source: text(row.source, 32),
      updatedAt: text(row.updated_at),
    };
  }).filter((memory) => memory.text);

  return {
    name: plan.name,
    success: true,
    message: memories.length
      ? `Recuerdo ${memories.length} preferencia${memories.length === 1 ? '' : 's'}: ${memories.map((memory, index) => `${index + 1}. ${memory.text}`).join(' ')}`
      : 'No tengo recuerdos personales guardados para tu cuenta.',
    data: { memories },
    recordCount: memories.length,
    suggestedActions: memories.length ? ['Borrar toda mi memoria', 'Desactivar la memoria'] : ['Activar la memoria'],
    navigation: [],
    riskLevel: 'low',
  };
}

async function executeMerchantOrderStatus(
  supabase: SupabaseClient,
  context: DomiServerContext,
  action: PendingActionRow,
) {
  const args = action.action_arguments;
  const orderId = text(args.orderId);
  const expectedStatus = text(args.expectedStatus);
  const targetStatus = text(args.targetStatus);
  if (context.role !== 'merchant' || context.tenantId !== action.tenant_id) throw new Error('action_context_mismatch');
  if (!MERCHANT_TRANSITIONS[expectedStatus]?.includes(targetStatus)) throw new Error('invalid_transition');

  const { data, error } = await supabase
    .from('orders')
    .update({ status: targetStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('business_id', context.tenantId)
    .eq('status', expectedStatus)
    .is('deleted_at', null)
    .select('id,order_number,status')
    .maybeSingle();
  if (error || !data) throw new Error('order_changed_before_confirmation');
  await supabase.from('order_tracking').insert({
    order_id: orderId,
    status: targetStatus,
    notes: `Estado actualizado por Domi con confirmación de ${context.name}`,
  });
  return { orderId, orderNumber: data.order_number, status: data.status };
}

async function executeMerchantProductUpdate(
  supabase: SupabaseClient,
  context: DomiServerContext,
  action: PendingActionRow,
) {
  const args = action.action_arguments;
  const updates = args.updates && typeof args.updates === 'object'
    ? args.updates as Record<string, unknown>
    : {};
  const allowedUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (['available', 'unavailable', 'discontinued'].includes(text(updates.status))) {
    allowedUpdates.status = text(updates.status);
  }
  const quantity = numberValue(updates.quantity_available);
  if (quantity !== null && Number.isInteger(quantity) && quantity >= 0 && quantity <= 100000) {
    allowedUpdates.quantity_available = quantity;
  }
  if (Object.keys(allowedUpdates).length === 1) throw new Error('invalid_product_update');
  if (context.role !== 'merchant' || context.tenantId !== action.tenant_id) throw new Error('action_context_mismatch');

  let query = supabase
    .from('products')
    .update(allowedUpdates)
    .eq('id', text(args.productId))
    .eq('business_id', context.tenantId)
    .is('deleted_at', null);
  const expectedUpdatedAt = text(args.expectedUpdatedAt);
  if (expectedUpdatedAt) query = query.eq('updated_at', expectedUpdatedAt);
  const { data, error } = await query.select('id,name,status,quantity_available').maybeSingle();
  if (error || !data) throw new Error('product_changed_before_confirmation');
  return {
    productId: data.id,
    productName: data.name,
    status: data.status,
    quantity: data.quantity_available,
  };
}

async function executeCourierAcceptOrder(
  supabase: SupabaseClient,
  context: DomiServerContext,
  action: PendingActionRow,
) {
  const args = action.action_arguments;
  if (context.role !== 'courier' || action.tenant_id !== context.tenantId) throw new Error('action_context_mismatch');
  const { data, error } = await supabase
    .from('orders')
    .update({ courier_id: context.userId, status: 'assigned', updated_at: new Date().toISOString() })
    .eq('id', text(args.orderId))
    .is('courier_id', null)
    .eq('status', text(args.expectedStatus))
    .is('deleted_at', null)
    .select('id,order_number,status')
    .maybeSingle();
  if (error || !data) throw new Error('order_no_longer_available');
  await supabase.from('order_tracking').insert({
    order_id: data.id,
    status: 'assigned',
    notes: `Pedido aceptado por ${context.name} mediante Domi`,
  });
  return { orderId: data.id, orderNumber: data.order_number, status: data.status };
}

async function executeCourierOrderStatus(
  supabase: SupabaseClient,
  context: DomiServerContext,
  action: PendingActionRow,
) {
  const args = action.action_arguments;
  const expectedStatus = text(args.expectedStatus);
  const targetStatus = text(args.targetStatus);
  if (context.role !== 'courier' || action.tenant_id !== context.tenantId) throw new Error('action_context_mismatch');
  if (!COURIER_TRANSITIONS[expectedStatus]?.includes(targetStatus)) throw new Error('invalid_transition');

  const updates: Record<string, unknown> = { status: targetStatus, updated_at: new Date().toISOString() };
  if (targetStatus === 'delivered') updates.actual_delivery_time = new Date().toISOString();
  const { data, error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', text(args.orderId))
    .eq('courier_id', context.userId)
    .eq('status', expectedStatus)
    .is('deleted_at', null)
    .select('id,order_number,status')
    .maybeSingle();
  if (error || !data) throw new Error('order_changed_before_confirmation');
  await supabase.from('order_tracking').insert({
    order_id: data.id,
    status: targetStatus,
    notes: `Estado actualizado por ${context.name} mediante Domi`,
  });
  return { orderId: data.id, orderNumber: data.order_number, status: data.status };
}

async function executeAction(
  supabase: SupabaseClient,
  context: DomiServerContext,
  action: PendingActionRow,
) {
  switch (action.action_name) {
    case 'merchant.update_order_status':
      return executeMerchantOrderStatus(supabase, context, action);
    case 'merchant.update_product':
      return executeMerchantProductUpdate(supabase, context, action);
    case 'courier.accept_order':
      return executeCourierAcceptOrder(supabase, context, action);
    case 'courier.update_order_status':
      return executeCourierOrderStatus(supabase, context, action);
    case 'memory.set_enabled': {
      const enabled = action.action_arguments.enabled === true;
      const settings = await updateDomiUserSettings(supabase, context.userId, { memoryEnabled: enabled });
      return { memoryEnabled: settings.memoryEnabled };
    }
    case 'memory.delete_all': {
      const { error, count } = await supabase
        .from('domi_user_memory')
        .delete({ count: 'exact' })
        .eq('user_id', context.userId);
      if (error) throw new Error('domi_memory_delete_failed');
      return { deletedCount: Number(count || 0) };
    }
    case 'support.create_ticket': {
      const args = action.action_arguments;
      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: context.userId,
          role: context.sourceRole,
          business_id: validUuid(args.businessId) ? args.businessId : null,
          courier_id: validUuid(args.courierId) ? args.courierId : null,
          ticket_type: text(args.ticketType, 40) || 'domi_assistance',
          priority: text(args.priority, 16) || 'normal',
          subject: text(args.subject, 120) || 'Solicitud creada desde Domi',
          description: text(args.description, 1200),
          status: 'open',
        })
        .select('id,status,priority,subject')
        .single();
      if (error || !data) throw new Error('support_ticket_create_failed');
      return { ticketId: data.id, status: data.status, priority: data.priority, subject: data.subject };
    }
    default:
      throw new Error('unsupported_pending_action');
  }
}

async function getPendingAction(
  supabase: SupabaseClient,
  context: DomiServerContext,
  actionId: string,
) {
  if (!validUuid(actionId)) return null;
  const { data, error } = await supabase
    .from('domi_pending_actions')
    .select('id,user_id,conversation_id,role,tenant_id,action_name,action_arguments,summary,risk_level,status,expires_at,result,error_message')
    .eq('id', actionId)
    .eq('user_id', context.userId)
    .maybeSingle();
  if (error) throw new Error('domi_pending_action_read_failed');
  return data as PendingActionRow | null;
}

export async function confirmDomiAction(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
): Promise<DomiToolResult> {
  const actionId = text(plan.arguments.actionId, 40);
  const action = await getPendingAction(supabase, context, actionId);
  if (!action) return blocked(plan, 'No encontré esa acción pendiente para tu cuenta.', 'action_not_found');

  if (action.status === 'executed') {
    return {
      name: plan.name,
      success: true,
      message: `La acción ya fue ejecutada: ${action.summary}`,
      data: { actionId, result: action.result, idempotent: true },
      recordCount: 1,
      suggestedActions: [],
      navigation: [],
      riskLevel: action.risk_level,
    };
  }
  if (action.status !== 'pending') {
    return blocked(plan, `La acción ya está ${action.status} y no puede confirmarse.`, 'action_not_pending');
  }
  if (Date.parse(action.expires_at) <= Date.now()) {
    await supabase
      .from('domi_pending_actions')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', action.id)
      .eq('status', 'pending');
    return blocked(plan, 'La confirmación caducó. Solicita nuevamente la acción.', 'action_expired');
  }
  if (action.role !== context.role || action.tenant_id !== context.tenantId) {
    return blocked(plan, 'La acción no pertenece a tu perfil o contexto actual.', 'action_context_mismatch');
  }

  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from('domi_pending_actions')
    .update({ status: 'confirmed', confirmed_at: now, updated_at: now })
    .eq('id', action.id)
    .eq('user_id', context.userId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (claimError) throw new Error('domi_pending_action_claim_failed');
  if (!claimed) return blocked(plan, 'La acción fue procesada por otra solicitud.', 'action_already_claimed');

  try {
    const result = await executeAction(supabase, context, action);
    await supabase
      .from('domi_pending_actions')
      .update({
        status: 'executed',
        result,
        executed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', action.id);

    return {
      name: plan.name,
      success: true,
      message: `Acción completada: ${action.summary}`,
      data: { actionId: action.id, actionName: action.action_name, result },
      recordCount: 1,
      suggestedActions: [],
      navigation: [],
      riskLevel: action.risk_level,
    };
  } catch (cause) {
    const errorMessage = cause instanceof Error ? cause.message : 'action_execution_failed';
    await supabase
      .from('domi_pending_actions')
      .update({
        status: 'failed',
        error_message: errorMessage.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq('id', action.id);
    return blocked(
      plan,
      'La acción no se ejecutó porque los datos cambiaron o dejaron de ser válidos. Vuelve a consultarlos antes de intentarlo.',
      errorMessage,
    );
  }
}

export async function cancelDomiAction(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
): Promise<DomiToolResult> {
  const actionId = text(plan.arguments.actionId, 40);
  const action = await getPendingAction(supabase, context, actionId);
  if (!action) return blocked(plan, 'No encontré esa acción pendiente para tu cuenta.', 'action_not_found');
  if (action.status === 'cancelled') {
    return {
      name: plan.name,
      success: true,
      message: 'La acción ya estaba cancelada.',
      data: { actionId, idempotent: true },
      recordCount: 1,
      suggestedActions: [],
      navigation: [],
      riskLevel: action.risk_level,
    };
  }
  if (action.status !== 'pending') {
    return blocked(plan, `La acción ya está ${action.status} y no puede cancelarse.`, 'action_not_pending');
  }

  const { data, error } = await supabase
    .from('domi_pending_actions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', action.id)
    .eq('user_id', context.userId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (error) throw new Error('domi_pending_action_cancel_failed');
  if (!data) return blocked(plan, 'La acción fue procesada por otra solicitud.', 'action_already_processed');

  return {
    name: plan.name,
    success: true,
    message: `Acción cancelada: ${action.summary}`,
    data: { actionId: action.id, actionName: action.action_name },
    recordCount: 1,
    suggestedActions: [],
    navigation: [],
    riskLevel: action.risk_level,
  };
}
