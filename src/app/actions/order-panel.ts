'use server';

import { z } from 'zod';
import { getServiceClient } from '@/lib/db/supabase';
import { requireAuth } from '@/lib/auth/server-auth';
import { PermissionManager } from '@/lib/auth/permissions';
import { isAdminRole, isBusinessRole, type UserRole } from '@/types/auth';
import { serverAudit } from '@/lib/audit/server-audit';
import type {
  AdminPanelOrder,
  BusinessPanelOrder,
  PanelOrderItem,
} from '@/lib/orders/order-panel-types';

type UnknownRow = Record<string, unknown>;

const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'assigned',
  'accepted',
  'picked_up',
  'in_transit',
  'delivered',
  'cancelled',
  'refunded',
] as const;

const orderStatusSchema = z.enum(ORDER_STATUSES);

const BUSINESS_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['cancelled'],
};

const ADMIN_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ['confirmed', 'assigned', 'cancelled'],
  confirmed: ['preparing', 'assigned', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['assigned', 'cancelled'],
  assigned: ['accepted', 'cancelled'],
  accepted: ['picked_up', 'cancelled'],
  picked_up: ['in_transit'],
  in_transit: ['delivered'],
  delivered: ['refunded'],
};

function asObject(value: unknown): UnknownRow {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRow)
    : {};
}

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fullName(profile: UnknownRow | undefined): string {
  if (!profile) return '';
  const name = [profile.first_name, profile.last_name]
    .filter(Boolean)
    .map(String)
    .join(' ')
    .trim();
  return name || String(profile.email || '');
}

function buildAddress(snapshot: UnknownRow, address: UnknownRow | undefined): string {
  const snapshotAddress = String(snapshot.address || '').trim();
  if (snapshotAddress) {
    return [
      snapshotAddress,
      snapshot.complement,
      snapshot.neighborhood,
      snapshot.city,
    ]
      .filter(Boolean)
      .map(String)
      .join(', ');
  }

  if (!address) return 'Recoger en el local';
  return [address.street_address, address.city, address.state_province]
    .filter(Boolean)
    .map(String)
    .join(', ');
}

async function requireBusinessActor() {
  const auth = await requireAuth();
  if (auth.error) throw new Error(auth.error.message);
  const role = auth.session.profile.role;
  if (
    !isBusinessRole(role) ||
    !PermissionManager.hasPermission(role as UserRole, 'manage_orders')
  ) {
    throw new Error('No tienes permiso para administrar pedidos');
  }
  return auth.session;
}

async function requireAdminActor() {
  const auth = await requireAuth();
  if (auth.error) throw new Error(auth.error.message);
  const role = auth.session.profile.role;
  if (
    !isAdminRole(role) ||
    !PermissionManager.hasPermission(role as UserRole, 'manage_orders')
  ) {
    throw new Error('No tienes permiso para administrar pedidos');
  }
  return auth.session;
}

async function resolveOrderRelations(orders: UnknownRow[]) {
  const supabase = getServiceClient();
  const orderIds = orders.map((order) => String(order.id));
  const customerIds = [
    ...new Set(
      orders
        .map((order) => (order.customer_id ? String(order.customer_id) : ''))
        .filter(Boolean),
    ),
  ];
  const courierIds = [
    ...new Set(
      orders
        .map((order) => (order.courier_id ? String(order.courier_id) : ''))
        .filter(Boolean),
    ),
  ];
  const addressIds = [
    ...new Set(
      orders
        .map((order) =>
          order.delivery_address_id ? String(order.delivery_address_id) : '',
        )
        .filter(Boolean),
    ),
  ];
  const businessIds = [
    ...new Set(orders.map((order) => String(order.business_id)).filter(Boolean)),
  ];

  const [customerResult, courierResult, addressResult, businessResult, itemResult] =
    await Promise.all([
      customerIds.length
        ? supabase
            .from('profiles')
            .select('id,first_name,last_name,email,phone')
            .in('id', customerIds)
        : Promise.resolve({ data: [], error: null }),
      courierIds.length
        ? supabase
            .from('profiles')
            .select('id,first_name,last_name,email,phone')
            .in('id', courierIds)
        : Promise.resolve({ data: [], error: null }),
      addressIds.length
        ? supabase
            .from('addresses')
            .select(
              'id,street_address,city,state_province,latitude,longitude,instructions',
            )
            .in('id', addressIds)
        : Promise.resolve({ data: [], error: null }),
      businessIds.length
        ? supabase.from('businesses').select('id,name').in('id', businessIds)
        : Promise.resolve({ data: [], error: null }),
      orderIds.length
        ? supabase
            .from('order_items')
            .select(
              'id,order_id,product_id,quantity,unit_price,item_total,variant_selections,special_instructions,is_custom_item,product_name_snapshot,variant_snapshot,products(name)',
            )
            .in('order_id', orderIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  const firstError = [
    customerResult.error,
    courierResult.error,
    addressResult.error,
    businessResult.error,
    itemResult.error,
  ].find(Boolean);
  if (firstError) throw firstError;

  const customerMap = new Map(
    ((customerResult.data || []) as UnknownRow[]).map((row) => [String(row.id), row]),
  );
  const courierMap = new Map(
    ((courierResult.data || []) as UnknownRow[]).map((row) => [String(row.id), row]),
  );
  const addressMap = new Map(
    ((addressResult.data || []) as UnknownRow[]).map((row) => [String(row.id), row]),
  );
  const businessMap = new Map(
    ((businessResult.data || []) as UnknownRow[]).map((row) => [String(row.id), row]),
  );
  const itemMap = new Map<string, PanelOrderItem[]>();

  for (const row of (itemResult.data || []) as unknown as UnknownRow[]) {
    const orderId = String(row.order_id);
    const product = asObject(row.products);
    const variant = row.variant_snapshot || row.variant_selections;
    const current = itemMap.get(orderId) || [];
    current.push({
      id: String(row.id),
      productId: row.product_id ? String(row.product_id) : null,
      name:
        String(row.product_name_snapshot || '').trim() ||
        String(product.name || 'Producto'),
      quantity: asNumber(row.quantity),
      unitPrice: asNumber(row.unit_price),
      itemTotal: asNumber(row.item_total),
      isCustomItem: Boolean(row.is_custom_item),
      variantSelections:
        variant && typeof variant === 'object'
          ? (variant as Record<string, unknown>)
          : null,
      specialInstructions: row.special_instructions
        ? String(row.special_instructions)
        : null,
    });
    itemMap.set(orderId, current);
  }

  return { customerMap, courierMap, addressMap, businessMap, itemMap };
}

export async function getBusinessOrdersForPanelAction(): Promise<{
  success: boolean;
  orders: BusinessPanelOrder[];
  error?: string;
}> {
  try {
    const session = await requireBusinessActor();
    const supabase = getServiceClient();
    const { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', session.user.id)
      .is('deleted_at', null);
    if (businessError) throw businessError;

    const businessIds = (businesses || []).map((business) => String(business.id));
    if (businessIds.length === 0) return { success: true, orders: [] };

    const { data, error } = await supabase
      .from('orders')
      .select(
        'id,order_number,customer_id,business_id,courier_id,delivery_address_id,status,payment_status,payment_method,subtotal,delivery_fee,total_amount,paid_amount,outstanding_amount,special_instructions,created_at,updated_at,metadata,guest_customer_snapshot,delivery_snapshot,created_manually,sales_channel,delivery_type',
      )
      .in('business_id', businessIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(250);
    if (error) throw error;

    const orders = (data || []) as unknown as UnknownRow[];
    const relations = await resolveOrderRelations(orders);

    return {
      success: true,
      orders: orders.map((order) => {
        const metadata = asObject(order.metadata);
        const snapshot = Object.keys(asObject(order.guest_customer_snapshot)).length
          ? asObject(order.guest_customer_snapshot)
          : asObject(metadata.customer_snapshot);
        const profile = order.customer_id
          ? relations.customerMap.get(String(order.customer_id))
          : undefined;
        const courier = order.courier_id
          ? relations.courierMap.get(String(order.courier_id))
          : undefined;
        const address = order.delivery_address_id
          ? relations.addressMap.get(String(order.delivery_address_id))
          : undefined;
        const deliverySnapshot = asObject(order.delivery_snapshot);
        const isGuest = !order.customer_id;

        return {
          id: String(order.id),
          orderNumber: String(order.order_number),
          customerId: order.customer_id ? String(order.customer_id) : null,
          customerName:
            String(snapshot.name || '').trim() || fullName(profile) || 'Cliente invitado',
          customerEmail: String(snapshot.email || profile?.email || ''),
          customerPhone: snapshot.phone
            ? String(snapshot.phone)
            : profile?.phone
              ? String(profile.phone)
              : null,
          customerKind: isGuest ? 'guest' : 'registered',
          status: String(order.status),
          paymentStatus: String(order.payment_status || 'pending'),
          paymentMethod: order.payment_method ? String(order.payment_method) : null,
          subtotal: asNumber(order.subtotal),
          deliveryFee: asNumber(order.delivery_fee),
          totalAmount: asNumber(order.total_amount),
          paidAmount: asNumber(order.paid_amount),
          outstandingAmount: asNumber(order.outstanding_amount),
          items: relations.itemMap.get(String(order.id)) || [],
          createdAt: String(order.created_at),
          updatedAt: String(order.updated_at),
          deliveryType:
            String(order.delivery_type) === 'pickup' ? 'pickup' : 'delivery',
          deliveryAddress: buildAddress(deliverySnapshot, address),
          deliveryInstructions:
            String(deliverySnapshot.reference || '').trim() ||
            (address?.instructions ? String(address.instructions) : null),
          deliveryLatitude:
            deliverySnapshot.latitude == null
              ? address?.latitude == null
                ? null
                : asNumber(address.latitude)
              : asNumber(deliverySnapshot.latitude),
          deliveryLongitude:
            deliverySnapshot.longitude == null
              ? address?.longitude == null
                ? null
                : asNumber(address.longitude)
              : asNumber(deliverySnapshot.longitude),
          specialInstructions: order.special_instructions
            ? String(order.special_instructions)
            : null,
          courierId: order.courier_id ? String(order.courier_id) : null,
          courierName: fullName(courier) || null,
          createdManually: Boolean(order.created_manually),
          salesChannel: String(order.sales_channel || 'app'),
        } satisfies BusinessPanelOrder;
      }),
    };
  } catch (error) {
    return {
      success: false,
      orders: [],
      error:
        error instanceof Error
          ? error.message
          : 'No se pudieron cargar los pedidos del negocio',
    };
  }
}

export async function getAdminOrdersForPanelAction(
  search = '',
  statusFilter = 'all',
): Promise<{ success: boolean; orders: AdminPanelOrder[]; error?: string }> {
  try {
    await requireAdminActor();
    const safeSearch = search.trim().slice(0, 80).toLowerCase();
    const safeStatus =
      statusFilter === 'all' ? null : orderStatusSchema.parse(statusFilter);
    const supabase = getServiceClient();

    let query = supabase
      .from('orders')
      .select(
        'id,order_number,customer_id,business_id,courier_id,status,payment_status,total_amount,created_at,order_type,courier_earnings,platform_earnings,metadata,guest_customer_snapshot,created_manually,sales_channel,delivery_type',
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(250);
    if (safeStatus) query = query.eq('status', safeStatus);

    const { data, error } = await query;
    if (error) throw error;
    const orders = (data || []) as unknown as UnknownRow[];
    const relations = await resolveOrderRelations(orders);

    let mapped = orders.map((order) => {
      const metadata = asObject(order.metadata);
      const snapshot = Object.keys(asObject(order.guest_customer_snapshot)).length
        ? asObject(order.guest_customer_snapshot)
        : asObject(metadata.customer_snapshot);
      const profile = order.customer_id
        ? relations.customerMap.get(String(order.customer_id))
        : undefined;
      const courier = order.courier_id
        ? relations.courierMap.get(String(order.courier_id))
        : undefined;
      const business = relations.businessMap.get(String(order.business_id));

      return {
        id: String(order.id),
        orderNumber: String(order.order_number),
        customerName:
          String(snapshot.name || '').trim() || fullName(profile) || 'Cliente invitado',
        businessName: String(business?.name || 'Negocio no disponible'),
        status: String(order.status),
        paymentStatus: String(order.payment_status || 'pending'),
        totalAmount: asNumber(order.total_amount),
        courierName: fullName(courier) || null,
        createdAt: String(order.created_at),
        orderType: order.order_type ? String(order.order_type) : null,
        courierEarnings:
          order.courier_earnings == null ? null : asNumber(order.courier_earnings),
        platformEarnings:
          order.platform_earnings == null
            ? null
            : asNumber(order.platform_earnings),
        createdManually: Boolean(order.created_manually),
        salesChannel: String(order.sales_channel || 'app'),
        deliveryType: String(order.delivery_type || 'delivery'),
      } satisfies AdminPanelOrder;
    });

    if (safeSearch) {
      mapped = mapped.filter((order) =>
        [order.orderNumber, order.customerName || '', order.businessName]
          .join(' ')
          .toLowerCase()
          .includes(safeSearch),
      );
    }

    return { success: true, orders: mapped };
  } catch (error) {
    return {
      success: false,
      orders: [],
      error:
        error instanceof Error
          ? error.message
          : 'No se pudieron cargar los pedidos administrativos',
    };
  }
}

async function updateOrderStatus(
  orderId: string,
  nextStatus: string,
  actorType: 'admin' | 'business',
) {
  const id = z.string().uuid().parse(orderId);
  const next = orderStatusSchema.parse(nextStatus);
  const session =
    actorType === 'admin' ? await requireAdminActor() : await requireBusinessActor();
  const supabase = getServiceClient();

  const { data: order, error } = await supabase
    .from('orders')
    .select('id,business_id,status,order_number')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error || !order) throw new Error('Pedido no encontrado');

  if (actorType === 'business') {
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', order.business_id)
      .eq('owner_id', session.user.id)
      .maybeSingle();
    if (businessError || !business) throw new Error('Pedido no autorizado');
  }

  const current = String(order.status);
  const transitions =
    actorType === 'admin' ? ADMIN_TRANSITIONS[current] || [] : BUSINESS_TRANSITIONS[current] || [];
  if (!transitions.includes(next)) {
    throw new Error(`Transición no permitida: ${current} → ${next}`);
  }

  const { data: updated, error: updateError } = await supabase
    .from('orders')
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', current)
    .select('id,status')
    .maybeSingle();
  if (updateError) throw updateError;
  if (!updated) throw new Error('El pedido cambió de estado. Actualiza e inténtalo otra vez');

  await serverAudit.logAction(
    session.user.id,
    session.user.email,
    session.profile.role,
    actorType === 'admin'
      ? 'admin_order_status_changed'
      : 'business_order_status_changed',
    'orders',
    id,
    {
      orderNumber: order.order_number,
      previousStatus: current,
      nextStatus: next,
    },
  );

  return { success: true };
}

export async function updateBusinessOrderStatusAction(
  orderId: string,
  nextStatus: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    return await updateOrderStatus(orderId, nextStatus, 'business');
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'No se pudo actualizar el pedido',
    };
  }
}

export async function updateAdminOrderStatusAction(
  orderId: string,
  nextStatus: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    return await updateOrderStatus(orderId, nextStatus, 'admin');
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'No se pudo actualizar el pedido',
    };
  }
}
