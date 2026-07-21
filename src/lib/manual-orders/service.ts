import 'server-only';

import { getServiceClient } from '@/lib/db/supabase';
import type { ManualOrderActor } from '@/lib/manual-orders/security';
import {
  ManualOrderError,
  assertBusinessAccess,
} from '@/lib/manual-orders/security';
import type {
  ManualOrderDraftInput,
  ManualOrderPayload,
  ManualOrderQuote,
  ManualOrderQuoteItem,
} from '@/lib/manual-orders/schema';

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function integerMoney(value: unknown) {
  return Math.max(0, Math.round(number(value)));
}

function roundUp(value: number, increment: number) {
  const safeIncrement = Math.max(1, increment);
  return Math.ceil(value / safeIncrement) * safeIncrement;
}

function fullName(profile: Record<string, unknown>) {
  return [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() || String(profile.email || 'Cliente');
}

export async function getManualOrderBootstrap(actor: ManualOrderActor, requestedBusinessId?: string | null) {
  const supabase = getServiceClient();
  let businessesQuery = supabase
    .from('businesses')
    .select('id,owner_id,name,is_active,is_verified,is_accepting_orders,operations_status,allow_custom_manual_products,allow_manual_delivery_fee_override,metadata')
    .is('deleted_at', null)
    .order('name');
  if (actor.role === 'merchant') businessesQuery = businessesQuery.eq('owner_id', actor.session.user.id);
  const { data: businesses, error } = await businessesQuery.limit(150);
  if (error) throw new ManualOrderError('No se pudieron cargar los negocios.', 500, 'businesses_load_failed');

  const allowedBusinesses = businesses || [];
  const businessId = requestedBusinessId || allowedBusinesses[0]?.id || null;
  if (!businessId) {
    return { actorRole: actor.role, businesses: [], business: null, branches: [], products: [], variants: [], couriers: [] };
  }
  await assertBusinessAccess(supabase, actor, businessId);

  const [branchesResult, productsResult] = await Promise.all([
    supabase
      .from('business_addresses')
      .select('id,business_id,name,street_address,formatted_address,neighborhood,city,state_province,latitude,longitude,place_id,is_primary,is_active,delivery_available,service_radius_km')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('is_primary', { ascending: false }),
    supabase
      .from('products')
      .select('id,business_id,category_id,sku,name,description,price,discount_price,status,quantity_available,preparation_time_minutes,image_url,categories(name)')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('name'),
  ]);
  if (branchesResult.error) throw new ManualOrderError('No se pudieron cargar las sucursales.', 500, 'branches_load_failed');
  if (productsResult.error) throw new ManualOrderError('No se pudo cargar el catálogo.', 500, 'products_load_failed');

  const productIds = (productsResult.data || []).map((product) => product.id);
  const variantsResult = productIds.length
    ? await supabase
        .from('product_variants')
        .select('id,product_id,name,values,price_modifier,sku_suffix,quantity_available,is_active')
        .in('product_id', productIds)
        .order('name')
    : { data: [], error: null };
  if (variantsResult.error) throw new ManualOrderError('No se pudieron cargar las variantes.', 500, 'variants_load_failed');

  let couriers: Record<string, unknown>[] = [];
  if (actor.role === 'admin') {
    const { data: drivers } = await supabase
      .from('drivers')
      .select('id,status,is_active,is_verified,vehicle_type,vehicle_plate')
      .eq('is_active', true)
      .eq('is_verified', true);
    const ids = (drivers || []).map((driver) => driver.id);
    const { data: profiles } = ids.length
      ? await supabase.from('profiles').select('id,first_name,last_name,phone,status').in('id', ids)
      : { data: [] };
    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
    couriers = (drivers || []).map((driver) => {
      const profile = profileMap.get(driver.id) || {};
      return {
        id: driver.id,
        name: fullName(profile),
        phone: profile.phone || '',
        status: driver.status,
        accountStatus: profile.status || null,
        vehicleType: driver.vehicle_type,
        vehiclePlate: driver.vehicle_plate,
        eligible: driver.status === 'available' && profile.status === 'active',
      };
    });
  }

  const business = allowedBusinesses.find((item) => item.id === businessId)
    || await assertBusinessAccess(supabase, actor, businessId);
  return {
    actorRole: actor.role,
    businesses: allowedBusinesses.map((item) => ({
      id: item.id,
      name: item.name,
      active: Boolean(item.is_active),
      verified: Boolean(item.is_verified),
      acceptingOrders: Boolean(item.is_accepting_orders),
      operationsStatus: item.operations_status,
    })),
    business: {
      id: business.id,
      name: business.name,
      active: Boolean(business.is_active),
      verified: Boolean(business.is_verified),
      acceptingOrders: Boolean(business.is_accepting_orders),
      operationsStatus: business.operations_status,
      allowCustomProducts: actor.role === 'admin' || Boolean(business.allow_custom_manual_products),
      allowDeliveryFeeOverride: actor.role === 'admin' || Boolean(business.allow_manual_delivery_fee_override),
    },
    branches: branchesResult.data || [],
    products: (productsResult.data || []).map((product) => ({
      id: product.id,
      businessId: product.business_id,
      categoryId: product.category_id,
      categoryName: (product.categories as { name?: string } | null)?.name || 'Sin categoría',
      sku: product.sku,
      name: product.name,
      description: product.description,
      price: integerMoney(product.price),
      discountPrice: product.discount_price == null ? null : integerMoney(product.discount_price),
      status: product.status,
      quantityAvailable: number(product.quantity_available),
      preparationMinutes: number(product.preparation_time_minutes),
      imageUrl: product.image_url,
    })),
    variants: variantsResult.data || [],
    couriers,
  };
}

export async function searchManualOrderCustomers(actor: ManualOrderActor, query: string, businessId?: string | null) {
  const supabase = getServiceClient();
  const search = query.replace(/[%_,()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (search.length < 2) return [];

  let allowedIds: string[] | null = null;
  if (actor.role === 'merchant') {
    if (!businessId) throw new ManualOrderError('Selecciona el negocio.', 400, 'business_required');
    await assertBusinessAccess(supabase, actor, businessId);
    const { data: rows } = await supabase
      .from('orders')
      .select('customer_id')
      .eq('business_id', businessId)
      .not('customer_id', 'is', null)
      .limit(1000);
    allowedIds = [...new Set((rows || []).map((row) => row.customer_id).filter(Boolean))] as string[];
    if (!allowedIds.length) return [];
  }

  let profileQuery = supabase
    .from('profiles')
    .select('id,first_name,last_name,email,phone,status,created_at')
    .eq('role', 'customer')
    .is('deleted_at', null)
    .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
    .limit(20);
  if (allowedIds) profileQuery = profileQuery.in('id', allowedIds);
  const { data, error } = await profileQuery;
  if (error) throw new ManualOrderError('No se pudieron buscar clientes.', 500, 'customer_search_failed');
  return (data || []).map((profile) => ({
    id: profile.id,
    name: fullName(profile),
    email: profile.email,
    phone: profile.phone,
    status: profile.status,
    createdAt: profile.created_at,
  }));
}

export async function quoteManualOrder(actor: ManualOrderActor, payload: ManualOrderPayload): Promise<ManualOrderQuote> {
  const supabase = getServiceClient();
  const business = await assertBusinessAccess(supabase, actor, payload.businessId);
  const warnings: string[] = [];
  let canConfirm = true;

  const businessOpen = Boolean(business.is_active)
    && Boolean(business.is_verified)
    && Boolean(business.is_accepting_orders)
    && business.operations_status === 'open';
  if (!businessOpen) {
    warnings.push('El negocio está cerrado, inactivo o restringido. Solo un administrador puede continuar con motivo.');
    if (actor.role !== 'admin' || !payload.adminOverride || payload.administrativeReason.length < 5) canConfirm = false;
  }

  const branchQuery = payload.branchId
    ? supabase.from('business_addresses').select('*').eq('id', payload.branchId).eq('business_id', payload.businessId)
    : supabase.from('business_addresses').select('*').eq('business_id', payload.businessId).order('is_primary', { ascending: false }).limit(1);
  const { data: branchRows, error: branchError } = await branchQuery.is('deleted_at', null);
  if (branchError) throw new ManualOrderError('No se pudo validar la sucursal.', 500, 'branch_lookup_failed');
  const branch = Array.isArray(branchRows) ? branchRows[0] : branchRows;
  if (!branch) throw new ManualOrderError('Selecciona una sucursal válida.', 400, 'branch_not_found');
  if (!branch.is_active) {
    warnings.push('La sucursal está inactiva.');
    if (actor.role !== 'admin' || !payload.adminOverride) canConfirm = false;
  }

  const productIds = payload.items.filter((item) => !item.isCustom).map((item) => item.productId);
  const variantIds = payload.items
    .filter((item) => !item.isCustom && item.variantId)
    .map((item) => (item as { variantId?: string | null }).variantId as string);
  const [{ data: products, error: productError }, { data: variants, error: variantError }] = await Promise.all([
    productIds.length
      ? supabase
          .from('products')
          .select('id,business_id,sku,name,price,discount_price,status,quantity_available,preparation_time_minutes,deleted_at')
          .in('id', productIds)
      : Promise.resolve({ data: [], error: null }),
    variantIds.length
      ? supabase
          .from('product_variants')
          .select('id,product_id,name,values,price_modifier,quantity_available,is_active')
          .in('id', variantIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (productError || variantError) throw new ManualOrderError('No se pudo validar el catálogo.', 500, 'catalog_validation_failed');
  const productMap = new Map((products || []).map((product) => [product.id, product]));
  const variantMap = new Map((variants || []).map((variant) => [variant.id, variant]));

  const quoteItems: ManualOrderQuoteItem[] = [];
  let subtotal = 0;
  let maxPreparation = 0;
  for (const item of payload.items) {
    if (item.isCustom) {
      if (!(actor.role === 'admin' || business.allow_custom_manual_products)) {
        throw new ManualOrderError('El negocio no tiene permiso para artículos personalizados.', 403, 'custom_product_forbidden');
      }
      const itemTotal = item.unitPrice * item.quantity;
      quoteItems.push({
        productId: null,
        variantId: null,
        name: item.name,
        sku: null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        itemTotal,
        isCustom: true,
        available: null,
      });
      subtotal += itemTotal;
      warnings.push(`“${item.name}” es personalizado y no se añadirá al catálogo.`);
      continue;
    }

    const product = productMap.get(item.productId);
    if (!product || product.business_id !== payload.businessId || product.deleted_at) {
      throw new ManualOrderError('Uno de los productos no pertenece al negocio.', 400, 'product_tenant_mismatch');
    }
    if (product.status !== 'available') {
      warnings.push(`“${product.name}” no está disponible.`);
      if (actor.role !== 'admin' || !payload.adminOverride) canConfirm = false;
    }
    let available = number(product.quantity_available);
    let unitPrice = number(product.discount_price) >= 0
      && product.discount_price != null
      && number(product.discount_price) < number(product.price)
      ? integerMoney(product.discount_price)
      : integerMoney(product.price);
    if (item.variantId) {
      const variant = variantMap.get(item.variantId);
      if (!variant || variant.product_id !== product.id || !variant.is_active) {
        throw new ManualOrderError(`La variante de “${product.name}” no es válida.`, 400, 'invalid_variant');
      }
      available = number(variant.quantity_available);
      unitPrice += integerMoney(variant.price_modifier);
    }
    if (available < item.quantity) {
      throw new ManualOrderError(`Inventario insuficiente para “${product.name}”.`, 409, 'insufficient_inventory');
    }
    if (available <= item.quantity + 2) warnings.push(`“${product.name}” quedará con inventario bajo.`);
    const itemTotal = unitPrice * item.quantity;
    quoteItems.push({
      productId: product.id,
      variantId: item.variantId || null,
      name: product.name,
      sku: product.sku,
      quantity: item.quantity,
      unitPrice,
      itemTotal,
      isCustom: false,
      available,
    });
    subtotal += itemTotal;
    maxPreparation = Math.max(maxPreparation, number(product.preparation_time_minutes));
  }

  if ((payload.discountAmount > 0 || payload.surchargeAmount > 0) && actor.role !== 'admin') {
    throw new ManualOrderError('Solo administración puede aplicar descuentos o recargos manuales.', 403, 'manual_adjustment_forbidden');
  }
  if (payload.discountAmount > subtotal) {
    throw new ManualOrderError('El descuento supera el subtotal.', 400, 'discount_exceeds_subtotal');
  }

  const [{ data: pricing }, { data: financial }] = await Promise.all([
    supabase
      .from('delivery_pricing_settings')
      .select('base_distance_km,base_fee,extra_per_km,rounding_increment,minimum_duration_minutes')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('platform_financial_settings')
      .select('service_fee_rate,service_fee_min,service_fee_max,service_fee_rounding')
      .eq('is_active', true)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!pricing || !financial) throw new ManualOrderError('No existe configuración financiera activa.', 503, 'pricing_not_configured');

  let deliveryFee = 0;
  let deliveryMinutes = 0;
  if (payload.deliveryType === 'delivery') {
    if (payload.deliveryFeeOverridden) {
      if (!(actor.role === 'admin' || business.allow_manual_delivery_fee_override)) {
        throw new ManualOrderError('No tienes permiso para modificar la tarifa.', 403, 'delivery_override_forbidden');
      }
      deliveryFee = payload.deliveryFee;
      deliveryMinutes = Math.max(number(pricing.minimum_duration_minutes), payload.durationMinutes);
      warnings.push('La tarifa de domicilio fue sobrescrita y quedará auditada.');
    } else if (payload.distanceKm > 0) {
      const raw = number(pricing.base_fee)
        + Math.max(payload.distanceKm - number(pricing.base_distance_km), 0) * number(pricing.extra_per_km);
      deliveryFee = payload.distanceKm <= number(pricing.base_distance_km)
        ? integerMoney(pricing.base_fee)
        : roundUp(raw, number(pricing.rounding_increment));
      deliveryMinutes = Math.max(number(pricing.minimum_duration_minutes), payload.durationMinutes);
    } else {
      deliveryFee = integerMoney(pricing.base_fee);
      deliveryMinutes = number(pricing.minimum_duration_minutes);
      warnings.push('No hay distancia verificada. Se aplicará la tarifa base como respaldo.');
    }
  }

  const discountedBase = Math.max(subtotal - payload.discountAmount, 0);
  const rawService = roundUp(
    discountedBase * number(financial.service_fee_rate) / 100,
    number(financial.service_fee_rounding),
  );
  const serviceFee = subtotal > 0
    ? Math.min(number(financial.service_fee_max), Math.max(number(financial.service_fee_min), rawService))
    : 0;
  const totalAmount = discountedBase
    + payload.surchargeAmount
    + payload.tipAmount
    + deliveryFee
    + serviceFee;
  if (payload.amountPaid > totalAmount) {
    throw new ManualOrderError('El valor pagado no puede superar el total.', 400, 'amount_paid_exceeds_total');
  }

  return {
    items: quoteItems,
    subtotal,
    discountAmount: payload.discountAmount,
    surchargeAmount: payload.surchargeAmount,
    tipAmount: payload.tipAmount,
    deliveryFee,
    serviceFee,
    totalAmount,
    currency: 'COP',
    estimatedMinutes: Math.max(5, maxPreparation + deliveryMinutes),
    warnings: [...new Set(warnings)],
    canConfirm,
  };
}

export async function confirmManualOrder(actor: ManualOrderActor, payload: ManualOrderPayload, idempotencyKey: string) {
  const supabase = getServiceClient();
  await assertBusinessAccess(supabase, actor, payload.businessId);
  const quote = await quoteManualOrder(actor, payload);
  if (!quote.canConfirm) {
    throw new ManualOrderError('Corrige las advertencias antes de confirmar el pedido.', 409, 'confirmation_blocked');
  }
  const normalizedPayload = {
    ...payload,
    deliveryFee: quote.deliveryFee,
  };
  const { data, error } = await supabase.rpc('confirm_manual_order', {
    p_actor_id: actor.session.user.id,
    p_payload: normalizedPayload,
    p_idempotency_key: idempotencyKey,
  });
  if (error) {
    const safeMessage = error.message
      .replace(/DETAIL:.*/s, '')
      .replace(/CONTEXT:.*/s, '')
      .trim();
    throw new ManualOrderError(safeMessage || 'No se pudo confirmar el pedido.', 409, 'manual_order_confirmation_failed');
  }
  return data as Record<string, unknown>;
}

export async function listManualOrderDrafts(actor: ManualOrderActor, businessId?: string | null) {
  const supabase = getServiceClient();
  let query = supabase
    .from('manual_order_drafts')
    .select('id,actor_id,actor_role,business_id,branch_id,title,payload,version,status,expires_at,created_at,updated_at')
    .eq('actor_id', actor.session.user.id)
    .eq('status', 'draft')
    .gt('expires_at', new Date().toISOString())
    .order('updated_at', { ascending: false })
    .limit(50);
  if (businessId) {
    await assertBusinessAccess(supabase, actor, businessId);
    query = query.eq('business_id', businessId);
  }
  const { data, error } = await query;
  if (error) throw new ManualOrderError('No se pudieron cargar los borradores.', 500, 'draft_list_failed');
  return data || [];
}

export async function saveManualOrderDraft(actor: ManualOrderActor, input: ManualOrderDraftInput) {
  const supabase = getServiceClient();
  await assertBusinessAccess(supabase, actor, input.businessId);
  const serialized = JSON.stringify(input.payload);
  if (serialized.length > 100_000) throw new ManualOrderError('El borrador es demasiado grande.', 413, 'draft_too_large');

  if (input.id) {
    const { data, error } = await supabase
      .from('manual_order_drafts')
      .update({
        business_id: input.businessId,
        branch_id: input.branchId || null,
        title: input.title,
        payload: input.payload,
        version: (input.version || 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.id)
      .eq('actor_id', actor.session.user.id)
      .eq('status', 'draft')
      .eq('version', input.version || 1)
      .select('id,version,updated_at')
      .maybeSingle();
    if (error) throw new ManualOrderError('No se pudo actualizar el borrador.', 500, 'draft_update_failed');
    if (!data) throw new ManualOrderError('El borrador cambió en otra sesión. Recárgalo antes de guardar.', 409, 'draft_version_conflict');
    return data;
  }

  const { data, error } = await supabase
    .from('manual_order_drafts')
    .insert({
      actor_id: actor.session.user.id,
      actor_role: actor.role,
      business_id: input.businessId,
      branch_id: input.branchId || null,
      title: input.title,
      payload: input.payload,
    })
    .select('id,version,updated_at')
    .single();
  if (error || !data) throw new ManualOrderError('No se pudo guardar el borrador.', 500, 'draft_create_failed');
  return data;
}

export async function deleteManualOrderDraft(actor: ManualOrderActor, draftId: string) {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('manual_order_drafts')
    .update({ status: 'deleted', updated_at: new Date().toISOString() })
    .eq('id', draftId)
    .eq('actor_id', actor.session.user.id)
    .eq('status', 'draft')
    .select('id')
    .maybeSingle();
  if (error) throw new ManualOrderError('No se pudo eliminar el borrador.', 500, 'draft_delete_failed');
  if (!data) throw new ManualOrderError('El borrador no existe.', 404, 'draft_not_found');
  return data;
}
