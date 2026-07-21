import { z } from 'zod';

export const manualOrderPanelSchema = z.enum(['admin', 'business']);
export const salesChannelSchema = z.enum([
  'whatsapp',
  'phone',
  'in_person',
  'instagram',
  'facebook',
  'direct_message',
  'other',
]);
export const deliveryTypeSchema = z.enum(['delivery', 'pickup']);
export const manualOrderPaymentMethodSchema = z.enum([
  'cash',
  'transfer',
  'credit_card',
  'debit_card',
  'wallet',
]);

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => value || undefined);

export const manualOrderItemSchema = z
  .object({
    productId: z.string().uuid().optional(),
    isCustomItem: z.boolean().default(false),
    customName: optionalText(160),
    customDescription: optionalText(500),
    quantity: z.number().int().min(1).max(99),
    customUnitPrice: z.number().int().min(0).max(100_000_000).optional(),
    instructions: optionalText(500),
    variant: z.record(z.string(), z.unknown()).optional(),
    modifiers: z.array(z.record(z.string(), z.unknown())).max(30).optional(),
  })
  .superRefine((item, context) => {
    if (item.isCustomItem) {
      if (!item.customName) {
        context.addIssue({ code: 'custom', path: ['customName'], message: 'El artículo personalizado necesita nombre' });
      }
      if (item.customUnitPrice == null) {
        context.addIssue({ code: 'custom', path: ['customUnitPrice'], message: 'El artículo personalizado necesita precio' });
      }
      if (item.productId) {
        context.addIssue({ code: 'custom', path: ['productId'], message: 'Un artículo personalizado no puede usar productId' });
      }
    } else if (!item.productId) {
      context.addIssue({ code: 'custom', path: ['productId'], message: 'Selecciona un producto válido' });
    }
  });

export const manualOrderRequestSchema = z
  .object({
    panel: manualOrderPanelSchema,
    businessId: z.string().uuid(),
    branchId: z.string().uuid().optional(),
    idempotencyKey: z.string().uuid(),
    customer: z.object({
      kind: z.enum(['registered', 'guest']),
      customerId: z.string().uuid().optional(),
      name: z.string().trim().min(2).max(160),
      phone: z.string().trim().min(7).max(24),
      email: z.string().trim().email().max(254).optional().or(z.literal('')).transform((value) => value || undefined),
      notes: optionalText(500),
    }),
    delivery: z.object({
      type: deliveryTypeSchema,
      address: optionalText(240),
      complement: optionalText(160),
      neighborhood: optionalText(120),
      city: optionalText(120),
      reference: optionalText(500),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
      distanceKm: z.number().min(0).max(500).optional(),
    }),
    deliveryFee: z.object({
      source: z.enum(['automatic', 'manual', 'not_applicable']),
      amount: z.number().int().min(0).max(10_000_000),
      overrideReason: optionalText(500),
    }),
    salesChannel: salesChannelSchema,
    salesChannelDetail: optionalText(120),
    paymentMethod: manualOrderPaymentMethodSchema,
    paymentStatus: z.enum(['pending', 'completed']).default('pending'),
    paidAmount: z.number().int().min(0).max(100_000_000).default(0),
    initialStatus: z.enum(['pending', 'confirmed']).default('confirmed'),
    courierId: z.string().uuid().optional(),
    adminReason: optionalText(500),
    preparationNotes: optionalText(1_000),
    courierNotes: optionalText(1_000),
    internalNotes: optionalText(1_000),
    tipAmount: z.number().int().min(0).max(10_000_000).default(0),
    surchargeAmount: z.number().int().min(0).max(10_000_000).default(0),
    items: z.array(manualOrderItemSchema).min(1).max(100),
  })
  .superRefine((input, context) => {
    if (input.customer.kind === 'registered' && !input.customer.customerId) {
      context.addIssue({ code: 'custom', path: ['customer', 'customerId'], message: 'Selecciona el cliente registrado' });
    }
    if (input.customer.kind === 'guest' && input.customer.customerId) {
      context.addIssue({ code: 'custom', path: ['customer', 'customerId'], message: 'Un invitado no debe incluir customerId' });
    }
    if (input.delivery.type === 'delivery' && !input.delivery.address) {
      context.addIssue({ code: 'custom', path: ['delivery', 'address'], message: 'La dirección es obligatoria para domicilio' });
    }
    if (input.delivery.type === 'pickup' && input.deliveryFee.amount !== 0) {
      context.addIssue({ code: 'custom', path: ['deliveryFee', 'amount'], message: 'Recoger en el local no puede cobrar domicilio' });
    }
    if (input.delivery.type === 'pickup' && input.deliveryFee.source !== 'not_applicable') {
      context.addIssue({ code: 'custom', path: ['deliveryFee', 'source'], message: 'La tarifa no aplica al recoger en el local' });
    }
    if (input.deliveryFee.source === 'manual' && !input.deliveryFee.overrideReason) {
      context.addIssue({ code: 'custom', path: ['deliveryFee', 'overrideReason'], message: 'Explica por qué se modificó la tarifa' });
    }
    if (input.deliveryFee.source === 'automatic' && (!input.delivery.distanceKm || input.delivery.distanceKm <= 0)) {
      context.addIssue({ code: 'custom', path: ['delivery', 'distanceKm'], message: 'La tarifa automática requiere distancia válida' });
    }
    if (input.salesChannel === 'other' && !input.salesChannelDetail) {
      context.addIssue({ code: 'custom', path: ['salesChannelDetail'], message: 'Describe el canal de origen' });
    }
    if (input.panel === 'admin' && !input.adminReason) {
      context.addIssue({ code: 'custom', path: ['adminReason'], message: 'El motivo administrativo de creación es obligatorio' });
    }
    if (input.panel === 'business' && input.courierId) {
      context.addIssue({ code: 'custom', path: ['courierId'], message: 'El comercio no puede asignar repartidor desde este flujo' });
    }
    if (input.panel === 'business' && input.adminReason) {
      context.addIssue({ code: 'custom', path: ['adminReason'], message: 'El motivo administrativo solo aplica al panel admin' });
    }
  });

export type ManualOrderRequest = z.infer<typeof manualOrderRequestSchema>;
export type ManualOrderPanel = z.infer<typeof manualOrderPanelSchema>;

export interface ResolvedManualOrderItem {
  productId?: string;
  name: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  isCustomItem: boolean;
  instructions?: string;
  variant?: Record<string, unknown>;
  modifiers?: Record<string, unknown>[];
}

export interface ManualOrderTotals {
  subtotal: number;
  deliveryFee: number;
  tipAmount: number;
  surchargeAmount: number;
  total: number;
  paidAmount: number;
  outstandingAmount: number;
}

export function normalizeManualOrderPhone(value: string): string {
  return value.replace(/[^\d+]/g, '').slice(0, 24);
}

export function calculateManualOrderTotals(
  items: ResolvedManualOrderItem[],
  values: Pick<ManualOrderRequest, 'tipAmount' | 'surchargeAmount' | 'paidAmount'> & { deliveryFee: number },
): ManualOrderTotals {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const total = Math.max(0, subtotal + values.deliveryFee + values.tipAmount + values.surchargeAmount);
  if (!Number.isSafeInteger(total) || total > 1_000_000_000) {
    throw new Error('manual_order_total_out_of_range');
  }
  if (values.paidAmount > total) {
    throw new Error('manual_order_paid_amount_exceeds_total');
  }
  return {
    subtotal,
    deliveryFee: values.deliveryFee,
    tipAmount: values.tipAmount,
    surchargeAmount: values.surchargeAmount,
    total,
    paidAmount: values.paidAmount,
    outstandingAmount: total - values.paidAmount,
  };
}

export function getManualOrderErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || '');
  const known: Record<string, string> = {
    manual_order_items_required: 'Agrega al menos un producto.',
    manual_order_invalid_quantity: 'Una cantidad del pedido no es válida.',
    manual_order_invalid_custom_item: 'Revisa el artículo personalizado.',
    manual_order_product_not_found: 'Uno de los productos ya no existe.',
    manual_order_cross_business_product: 'No puedes mezclar productos de negocios diferentes.',
    manual_order_product_unavailable: 'Uno de los productos ya no está disponible.',
    manual_order_insufficient_stock: 'No hay inventario suficiente para completar el pedido.',
    manual_order_stock_changed: 'El inventario cambió mientras confirmabas. Revisa las cantidades.',
    manual_order_invalid_paid_amount: 'El valor pagado no es válido.',
    manual_order_total_out_of_range: 'El total del pedido está fuera del rango permitido.',
    manual_order_paid_amount_exceeds_total: 'El valor pagado no puede superar el total.',
    manual_order_idempotency_required: 'No se pudo proteger la creación contra duplicados.',
    manual_order_idempotency_conflict: 'Esta confirmación ya fue usada con datos diferentes. Recarga el formulario.',
  };
  const key = Object.keys(known).find((candidate) => raw.includes(candidate));
  if (key) return known[key];

  const safeMessages = [
    'No tienes permiso para crear pedidos manuales',
    'Negocio no encontrado o no autorizado',
    'El negocio está inactivo',
    'Cliente registrado no encontrado',
    'El cliente registrado está suspendido o inactivo',
    'Los artículos personalizados no están habilitados para este negocio',
    'Para marcar el pago como completado, el valor pagado debe ser igual al total',
    'Solo administración puede asignar un repartidor en la creación',
    'El repartidor seleccionado no está disponible',
    'El motivo administrativo de creación es obligatorio',
  ];
  const safe = safeMessages.find((message) => raw.includes(message));
  return safe || 'No se pudo crear el pedido manual. Revisa los datos e inténtalo nuevamente.';
}
