'use server';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { z } from 'zod';
import { getServiceClient } from '@/lib/db/supabase';
import { requireAuth } from '@/lib/auth/server-auth';
import { serverAudit } from '@/lib/audit/server-audit';

const createBusinessSchema = z.object({
  name: z.string().min(3, 'Mínimo 3 caracteres'),
  slug: z.string().min(3, 'Mínimo 3 caracteres').regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones'),
  description: z.string().optional(),
  cuisineType: z.string().optional(),
  businessType: z.string().default('restaurant'),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().optional(),
  ownerId: z.string().uuid('Selecciona un propietario').optional().or(z.literal('')),
  createOwner: z.boolean().default(false),
  ownerName: z.string().optional(),
  ownerEmail: z.string().email('Email inválido').optional().or(z.literal('')),
  ownerPassword: z.string().min(6, 'Mínimo 6 caracteres').optional(),
  address: z.string().min(5, 'Mínimo 5 caracteres'),
  city: z.string().default('Santa Marta'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  isVerified: z.boolean().default(false),
});

const updateBusinessSchema = z.object({
  name: z.string().min(3).optional(),
  description: z.string().optional(),
  cuisineType: z.string().optional(),
  businessType: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().optional(),
  isVerified: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const createCategorySchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  description: z.string().optional(),
});

const createProductSchema = z.object({
  businessId: z.string().uuid(),
  categoryId: z.string().uuid(),
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  description: z.string().optional(),
  price: z.number().positive('Debe ser mayor a 0'),
  costPrice: z.number().optional(),
  discountPrice: z.number().optional(),
  quantityAvailable: z.number().int().min(0).default(0),
  preparationTimeMinutes: z.number().int().min(0).default(15),
  imageUrl: z.string().optional(),
  status: z.enum(['available', 'unavailable', 'discontinued']).default('available'),
  isFeatured: z.boolean().default(false),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;

export async function createBusinessAction(input: CreateBusinessInput) {
  const parsed = createBusinessSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map(e => e.message).join(', ') };
  }

  const result = await requireAuth();
  if (result.error) return { error: result.error.message };
  if (result.session.profile.role !== 'admin') {
    return { error: 'Solo administradores pueden crear negocios' };
  }

  const supabase = getServiceClient();
  const data = parsed.data;
  let ownerId = data.ownerId || null;

  try {
    if (data.createOwner && data.ownerName && data.ownerEmail && data.ownerPassword) {
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('email', data.ownerEmail)
        .maybeSingle();

      if (existingUser) {
        ownerId = existingUser.id;
      } else {
        const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
          email: data.ownerEmail,
          password: data.ownerPassword,
          email_confirm: true,
          user_metadata: { full_name: data.ownerName, source: 'admin_created' },
        });

        if (createUserError || !newUser?.user) {
          const errMsg = createUserError?.message || '';
          if (errMsg.toLowerCase().includes('already registered') || errMsg.toLowerCase().includes('already exists')) {
            const { data: users } = await supabase.auth.admin.listUsers();
            const found = users?.users.find(u => u.email?.toLowerCase() === data.ownerEmail?.toLowerCase());
            if (found) {
              ownerId = found.id;
              const nameParts = data.ownerName.split(' ');
              await supabase.from('profiles').upsert({
                id: ownerId,
                email: data.ownerEmail,
                role: 'merchant',
                first_name: nameParts[0] || data.ownerName,
                last_name: nameParts.slice(1).join(' ') || '',
                status: 'active',
              }, { onConflict: 'id' });
            } else {
              return { error: 'El correo ya existe pero no se pudo asociar el usuario' };
            }
          } else {
            return { error: 'No se pudo crear el usuario propietario: ' + errMsg };
          }
        } else {
          ownerId = newUser.user.id;
          const nameParts = data.ownerName.split(' ');
          const { error: profileError } = await supabase.from('profiles').upsert({
            id: ownerId,
            email: data.ownerEmail,
            role: 'merchant',
            first_name: nameParts[0] || data.ownerName,
            last_name: nameParts.slice(1).join(' ') || '',
            status: 'active',
          });

          if (profileError) {
            await supabase.auth.admin.deleteUser(ownerId);
            return { error: 'No se pudo crear el perfil del propietario' };
          }
        }
      }
    }

    if (!ownerId) {
      return { error: 'Debes seleccionar un propietario o crear uno nuevo' };
    }

    const { data: existingBiz, error: slugCheck } = await supabase
      .from('businesses')
      .select('id')
      .eq('slug', data.slug)
      .maybeSingle();

    if (slugCheck) return { error: 'Error al verificar slug' };
    if (existingBiz) return { error: 'Ya existe un negocio con ese slug' };

    const uniqueSlug = `${data.slug}-${Date.now().toString(36)}`;

    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .insert({
        owner_id: ownerId,
        name: data.name,
        slug: uniqueSlug,
        description: data.description || null,
        cuisine_type: data.cuisineType || null,
        business_type: data.businessType,
        phone: data.phone || null,
        email: data.email || null,
        website: data.website || null,
        is_verified: data.isVerified,
        is_active: true,
      })
      .select()
      .single();

    if (bizError || !business) {
      return { error: 'Error al crear negocio: ' + (bizError?.message || '') };
    }

    const { error: addrError } = await supabase.from('business_addresses').insert({
      business_id: business.id,
      street_address: data.address,
      city: data.city,
      country: 'Colombia',
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      is_primary: true,
      delivery_available: true,
    });

    if (addrError) {
      await supabase.from('businesses').delete().eq('id', business.id);
      return { error: 'Error al crear dirección: ' + addrError.message };
    }

    for (let d = 0; d < 7; d++) {
      await supabase.from('business_hours').insert({
        business_id: business.id,
        day_of_week: d,
        opens_at: '08:00',
        closes_at: '22:00',
        is_closed: false,
      });
    }

    serverAudit.logAction(
      result.session.user.id,
      result.session.user.email,
      result.session.profile.role,
      'create_business',
      'businesses',
      business.id,
      { name: data.name, ownerId, createdOwner: data.createOwner },
    );

    return { success: true, businessId: business.id, slug: business.slug };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    serverAudit.logError(result.session.user.id, result.session.user.email, result.session.profile.role, 'create_business', 'businesses', msg);
    return { error: msg };
  }
}

export async function getBusinessFullDetail(businessId: string) {
  const result = await requireAuth();
  if (result.error) return null;
  if (result.session.profile.role !== 'admin') return null;

  const supabase = getServiceClient();

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single();

  if (!business) return null;

  const { data: owner } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, phone, role, status')
    .eq('id', business.owner_id)
    .single();

  const { data: addresses } = await supabase
    .from('business_addresses')
    .select('*')
    .eq('business_id', businessId)
    .order('is_primary', { ascending: false });

  const { data: hours } = await supabase
    .from('business_hours')
    .select('*')
    .eq('business_id', businessId)
    .order('day_of_week');

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('business_id', businessId)
    .order('name');

  const { data: products } = await supabase
    .from('products')
    .select('*, categories(name)')
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const totalOrdersRes = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId);
  const totalOrders = (totalOrdersRes as unknown as { count: number | null }).count;

  const { data: recentOrders } = await supabase
    .from('orders')
    .select('id, order_number, status, total_amount, created_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(10);

  return {
    business,
    owner,
    addresses,
    hours,
    categories: (categories || []).map((c: any) => ({
      id: c.id, name: c.name, slug: c.slug, description: c.description,
      is_active: c.is_active, display_order: c.display_order, product_count: 0,
    })),
    products: (products || []).map((p: any) => ({
      id: p.id, business_id: p.business_id, category_id: p.category_id,
      name: p.name, slug: p.slug, description: p.description,
      price: Number(p.price), cost_price: p.cost_price ? Number(p.cost_price) : null,
      discount_price: p.discount_price ? Number(p.discount_price) : null,
      discount_percentage: Number(p.discount_percentage) || 0,
      status: p.status, quantity_available: p.quantity_available,
      preparation_time_minutes: p.preparation_time_minutes,
      is_featured: p.is_featured, image_url: p.image_url,
      category_name: p.categories?.name || 'Sin categoría',
      total_sales: p.total_sales || 0,
      created_at: p.created_at,
    })),
    totalOrders: totalOrders || 0,
    recentOrders: (recentOrders || []).map((o: any) => ({
      id: o.id, order_number: o.order_number, status: o.status,
      total_amount: Number(o.total_amount), created_at: o.created_at,
    })),
  };
}

export async function getAllBusinessesAdmin(search?: string, filter?: string) {
  const result = await requireAuth();
  if (result.error) return [];
  if (result.session.profile.role !== 'admin') return [];

  const supabase = getServiceClient();

  const { data } = await supabase
    .from('businesses')
    .select('id, name, slug, owner_id, cuisine_type, business_type, phone, email, is_verified, is_active, rating, total_ratings, created_at, updated_at');

  const list = (data || []) as any[];
  const ownerIds = [...new Set(list.map(b => b.owner_id))];

  const { data: owners } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email')
    .in('id', ownerIds);

  const ownerMap = new Map<string, any>((owners || []).map((o: any) => [o.id, o]));

  const { data: orderCounts } = await supabase
    .from('orders')
    .select('business_id, id')
    .in('business_id', list.map(b => b.id));

  const orderCountMap = new Map<string, number>();
  for (const o of (orderCounts || []) as any[]) {
    orderCountMap.set(o.business_id, (orderCountMap.get(o.business_id) || 0) + 1);
  }

  let resultList: any[] = list.map(b => {
    const owner = ownerMap.get(b.owner_id);
    return {
      id: b.id, name: b.name, slug: b.slug,
      owner_name: owner ? [owner.first_name, owner.last_name].filter(Boolean).join(' ') : null,
      owner_email: owner?.email || '',
      owner_id: b.owner_id,
      cuisine_type: b.cuisine_type, business_type: b.business_type,
      phone: b.phone, email: b.email,
      is_verified: b.is_verified, is_active: b.is_active,
      rating: Number(b.rating) || 0, total_ratings: b.total_ratings || 0,
      total_orders: orderCountMap.get(b.id) || 0,
      created_at: b.created_at, updated_at: b.updated_at,
    };
  });

  if (search) {
    const s = search.toLowerCase();
    resultList = resultList.filter(b =>
      b.name.toLowerCase().includes(s) ||
      (b.owner_name || '').toLowerCase().includes(s) ||
      b.slug.toLowerCase().includes(s)
    );
  }

  if (filter && filter !== 'all') {
    if (filter === 'verified') resultList = resultList.filter(b => b.is_verified);
    else if (filter === 'pending') resultList = resultList.filter(b => !b.is_verified && b.is_active);
    else if (filter === 'suspended') resultList = resultList.filter(b => !b.is_active);
  }

  return resultList;
}

export async function updateBusinessAction(businessId: string, input: UpdateBusinessInput) {
  const parsed = updateBusinessSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map(e => e.message).join(', ') };
  }

  const result = await requireAuth();
  if (result.error) return { error: result.error.message };
  if (result.session.profile.role !== 'admin') {
    return { error: 'Solo administradores pueden modificar negocios' };
  }

  const supabase = getServiceClient();
  const data = parsed.data;
  const updates: any = {};

  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.cuisineType !== undefined) updates.cuisine_type = data.cuisineType;
  if (data.businessType !== undefined) updates.business_type = data.businessType;
  if (data.phone !== undefined) updates.phone = data.phone;
  if (data.email !== undefined) updates.email = data.email;
  if (data.website !== undefined) updates.website = data.website;
  if (data.isVerified !== undefined) updates.is_verified = data.isVerified;
  if (data.isActive !== undefined) updates.is_active = data.isActive;
  updates.updated_at = new Date().toISOString();

  if (Object.keys(updates).length === 0) {
    return { error: 'No hay campos para actualizar' };
  }

  const { error: updateError } = await supabase
    .from('businesses')
    .update(updates)
    .eq('id', businessId);

  if (updateError) return { error: 'Error al actualizar: ' + updateError.message };

  serverAudit.logAction(
    result.session.user.id,
    result.session.user.email,
    result.session.profile.role,
    'update_business',
    'businesses',
    businessId,
    updates,
  );

  return { success: true };
}

export async function deleteBusinessAction(businessId: string) {
  const result = await requireAuth();
  if (result.error) return { error: result.error.message };
  if (result.session.profile.role !== 'admin') {
    return { error: 'Solo administradores pueden eliminar negocios' };
  }

  const supabase = getServiceClient();

  const { error } = await supabase
    .from('businesses')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', businessId);

  if (error) return { error: 'Error al eliminar: ' + error.message };

  serverAudit.logAction(
    result.session.user.id,
    result.session.user.email,
    result.session.profile.role,
    'delete_business',
    'businesses',
    businessId,
    { action: 'soft_delete' },
  );

  return { success: true };
}

export async function createCategoryAction(input: z.infer<typeof createCategorySchema>) {
  const parsed = createCategorySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues.map(e => e.message).join(', ') };

  const result = await requireAuth();
  if (result.error) return { error: result.error.message };
  if (result.session.profile.role !== 'admin') return { error: 'Acceso denegado' };

  const supabase = getServiceClient();
  const slug = input.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const { data: cat, error } = await supabase
    .from('categories')
    .insert({ business_id: input.businessId, name: input.name, slug, description: input.description || null })
    .select()
    .single();

  if (error) return { error: 'Error al crear categoría: ' + error.message };
  return { success: true, category: cat };
}

export async function createProductAction(input: CreateProductInput) {
  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues.map(e => e.message).join(', ') };

  const result = await requireAuth();
  if (result.error) return { error: result.error.message };
  if (result.session.profile.role !== 'admin') return { error: 'Acceso denegado' };

  const supabase = getServiceClient();
  const slug = input.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now().toString(36);
  const sku = `ADM-${Date.now().toString(36).toUpperCase()}`;

  const { data: product, error } = await supabase
    .from('products')
    .insert({
      business_id: input.businessId,
      category_id: input.categoryId,
      name: input.name,
      slug,
      sku,
      description: input.description || null,
      price: input.price,
      cost_price: input.costPrice || null,
      discount_price: input.discountPrice || null,
      quantity_available: input.quantityAvailable,
      preparation_time_minutes: input.preparationTimeMinutes,
      image_url: input.imageUrl || null,
      status: input.status,
      is_featured: input.isFeatured,
    })
    .select()
    .single();

  if (error) return { error: 'Error al crear producto: ' + error.message };
  return { success: true, product };
}

export async function updateProductAction(productId: string, updates: Record<string, any>) {
  const result = await requireAuth();
  if (result.error) return { error: result.error.message };
  if (result.session.profile.role !== 'admin') return { error: 'Acceso denegado' };

  const supabase = getServiceClient();
  const allowedFields = ['name', 'description', 'price', 'cost_price', 'discount_price', 'quantity_available', 'preparation_time_minutes', 'image_url', 'status', 'is_featured', 'category_id'];
  const clean: any = {};
  for (const [k, v] of Object.entries(updates)) {
    if (allowedFields.includes(k)) clean[k] = v;
  }

  if (Object.keys(clean).length === 0) return { error: 'No hay campos válidos' };

  const { error } = await supabase.from('products').update(clean).eq('id', productId);
  if (error) return { error: 'Error al actualizar: ' + error.message };
  return { success: true };
}

export async function deleteProductAction(productId: string) {
  const result = await requireAuth();
  if (result.error) return { error: result.error.message };
  if (result.session.profile.role !== 'admin') return { error: 'Acceso denegado' };

  const supabase = getServiceClient();
  const { error } = await supabase
    .from('products')
    .update({ deleted_at: new Date().toISOString(), status: 'discontinued' })
    .eq('id', productId);

  if (error) return { error: 'Error al eliminar: ' + error.message };
  return { success: true };
}

export async function updateBusinessHoursAction(businessId: string, hours: Array<{ day_of_week: number; opens_at: string; closes_at: string; is_closed: boolean }>) {
  const result = await requireAuth();
  if (result.error) return { error: result.error.message };
  if (result.session.profile.role !== 'admin') return { error: 'Acceso denegado' };

  const supabase = getServiceClient();

  for (const h of hours) {
    const { error } = await supabase
      .from('business_hours')
      .upsert({
        business_id: businessId,
        day_of_week: h.day_of_week,
        opens_at: h.opens_at,
        closes_at: h.closes_at,
        is_closed: h.is_closed,
      }, { onConflict: 'business_id,day_of_week' });

    if (error) return { error: `Error en día ${h.day_of_week}: ${error.message}` };
  }

  return { success: true };
}

export async function updateBusinessAddressAction(addressId: string, updates: Record<string, any>) {
  const result = await requireAuth();
  if (result.error) return { error: result.error.message };
  if (result.session.profile.role !== 'admin') return { error: 'Acceso denegado' };

  const supabase = getServiceClient();
  const allowed = ['street_address', 'city', 'latitude', 'longitude', 'is_primary', 'delivery_available', 'phone'];
  const clean: any = {};
  for (const [k, v] of Object.entries(updates)) {
    if (allowed.includes(k)) clean[k] = v;
  }

  const { error } = await supabase.from('business_addresses').update(clean).eq('id', addressId);
  if (error) return { error: 'Error al actualizar dirección: ' + error.message };
  return { success: true };
}

export async function getAvailableOwners() {
  const result = await requireAuth();
  if (result.error) return [];
  if (result.session.profile.role !== 'admin') return [];

  const supabase = getServiceClient();
  const { data } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, role')
    .in('role', ['merchant', 'customer'])
    .order('first_name');

  return (data || []).map((p: any) => ({
    id: p.id,
    name: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email,
    email: p.email,
    role: p.role,
  }));
}

export async function getBusinessOrdersAdmin(businessId: string, limit = 50) {
  const result = await requireAuth();
  if (result.error) return [];
  if (result.session.profile.role !== 'admin') return [];

  const supabase = getServiceClient();
  const { data } = await supabase
    .from('orders')
    .select('id, order_number, customer_id, status, payment_status, total_amount, courier_id, special_instructions, created_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(limit);

  const orders = (data || []) as any[];
  const customerIds = [...new Set(orders.map(o => o.customer_id))];
  const courierIds = [...new Set(orders.map(o => o.courier_id).filter(Boolean))];

  const [custRes, courRes] = await Promise.all([
    supabase.from('profiles').select('id, first_name, last_name').in('id', customerIds),
    courierIds.length > 0
      ? supabase.from('profiles').select('id, first_name, last_name').in('id', courierIds)
      : { data: [] },
  ]);

  const custMap = new Map((custRes.data || []).map((c: any) => [c.id, [c.first_name, c.last_name].filter(Boolean).join(' ')]));
  const courMap = new Map((courRes.data || []).map((c: any) => [c.id, [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Repartidor']));

  return orders.map((o: any) => ({
    id: o.id,
    order_number: o.order_number,
    customer_name: custMap.get(o.customer_id) || 'Cliente',
    status: o.status,
    payment_status: o.payment_status,
    total_amount: Number(o.total_amount),
    courier_name: o.courier_id ? courMap.get(o.courier_id) || 'Asignado' : null,
    special_instructions: o.special_instructions,
    created_at: o.created_at,
  }));
}
