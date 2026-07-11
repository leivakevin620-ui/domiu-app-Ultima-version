'use server';

import { z } from 'zod';
import { requireAuth } from '@/lib/auth/server-auth';
import { getServiceClient } from '@/lib/db/supabase';
import { resolveServerTenantContext } from '@/lib/tenancy/server-tenant';

const orderInputSchema = z.object({
  businessId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    productName: z.string().min(1),
    quantity: z.number().int().positive(),
    unitPrice: z.number().nonnegative(),
  })).min(1),
  subtotal: z.number().nonnegative(),
  deliveryFee: z.number().nonnegative(),
  taxAmount: z.number().nonnegative(),
  totalAmount: z.number().nonnegative(),
  deliveryAddress: z.string().min(5),
  instructions: z.string().max(1000).optional().default(''),
});

export type CreateTenantOrderInput = z.infer<typeof orderInputSchema>;

export interface CreateTenantOrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
}

export async function createTenantOrderAction(
  rawInput: CreateTenantOrderInput,
): Promise<CreateTenantOrderResult> {
  try {
    const parsed = orderInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues.map((issue) => issue.message).join(', ') };
    }

    const auth = await requireAuth();
    if (auth.error) return { success: false, error: auth.error.message };

    const input = parsed.data;
    const userId = auth.session.user.id;
    const supabase = getServiceClient();
    const tenant = await resolveServerTenantContext({ userId, businessId: input.businessId });

    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, tenant_id, is_active')
      .eq('id', input.businessId)
      .eq('tenant_id', tenant.tenantId)
      .maybeSingle();

    if (businessError || !business) return { success: false, error: 'Negocio no encontrado' };
    if (!business.is_active) return { success: false, error: 'El negocio no está disponible' };

    const productIds = input.items.map((item) => item.productId);
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, business_id, tenant_id, price, is_available')
      .in('id', productIds)
      .eq('business_id', input.businessId)
      .eq('tenant_id', tenant.tenantId);

    if (productsError || !products || products.length !== productIds.length) {
      return { success: false, error: 'Uno o más productos no pertenecen al negocio o tenant seleccionado' };
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product?.is_available) return { success: false, error: 'Uno o más productos no están disponibles' };
      if (Number(product.price) !== item.unitPrice) return { success: false, error: 'El precio de uno o más productos cambió' };
    }

    const calculatedSubtotal = input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    if (Math.abs(calculatedSubtotal - input.subtotal) > 0.01) {
      return { success: false, error: 'El subtotal del pedido no es válido' };
    }

    const calculatedTotal = input.subtotal + input.deliveryFee + input.taxAmount;
    if (Math.abs(calculatedTotal - input.totalAmount) > 0.01) {
      return { success: false, error: 'El total del pedido no es válido' };
    }

    const { data: existingAddress } = await supabase
      .from('addresses')
      .select('id')
      .eq('user_id', userId)
      .eq('tenant_id', tenant.tenantId)
      .eq('is_primary', true)
      .maybeSingle();

    let addressId = existingAddress?.id as string | undefined;
    if (!addressId) {
      const { data: address, error: addressError } = await supabase
        .from('addresses')
        .insert({
          tenant_id: tenant.tenantId,
          user_id: userId,
          type: 'home',
          street_address: input.deliveryAddress,
          city: 'Ciudad',
          country: 'Colombia',
          is_primary: true,
        })
        .select('id')
        .single();

      if (addressError || !address) return { success: false, error: 'No se pudo crear la dirección' };
      addressId = address.id;
    }

    const orderNumber = `DOM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        tenant_id: tenant.tenantId,
        order_number: orderNumber,
        customer_id: userId,
        business_id: input.businessId,
        delivery_address_id: addressId,
        status: 'pending',
        payment_status: 'pending',
        subtotal: input.subtotal,
        delivery_fee: input.deliveryFee,
        tax_amount: input.taxAmount,
        total_amount: input.totalAmount,
        special_instructions: input.instructions || null,
      })
      .select('id')
      .single();

    if (orderError || !order) return { success: false, error: orderError?.message || 'No se pudo crear el pedido' };

    const orderItems = input.items.map((item) => ({
      tenant_id: tenant.tenantId,
      order_id: order.id,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      item_total: item.unitPrice * item.quantity,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
    if (itemsError) {
      await supabase.from('orders').delete().eq('id', order.id);
      return { success: false, error: 'No se pudieron registrar los productos del pedido' };
    }

    await supabase.from('order_tracking').insert({
      tenant_id: tenant.tenantId,
      order_id: order.id,
      status: 'pending',
      notes: 'Orden creada',
    });

    return { success: true, orderId: order.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}
