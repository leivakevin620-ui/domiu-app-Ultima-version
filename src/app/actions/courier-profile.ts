'use server';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { z } from 'zod';
import { getServiceClient } from '@/lib/db/supabase';
import { requireAuth } from '@/lib/auth/server-auth';
import { serverAudit } from '@/lib/audit/server-audit';
import { ADMIN_ROLES } from '@/types/auth';

const updateProfileSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  phone: z.string().optional(),
  bio: z.string().max(300).optional(),
});

const updateVehicleSchema = z.object({
  vehicle_type: z.enum(['bike', 'motorcycle', 'car', 'van']).optional(),
  vehicle_plate: z.string().optional(),
  vehicle_model: z.string().optional(),
  vehicle_brand: z.string().optional(),
  vehicle_color: z.string().optional(),
});

const updateAvailabilitySchema = z.object({
  schedule: z.array(z.object({
    day_of_week: z.number().min(0).max(6),
    starts_at: z.string().optional(),
    ends_at: z.string().optional(),
    is_working: z.boolean(),
  })),
});

const reportIncidentSchema = z.object({
  incident_type: z.enum(['accident', 'traffic_violation', 'customer_complaint', 'order_issue', 'vehicle_issue', 'other']),
  description: z.string().min(10).max(1000),
  severity: z.enum(['minor', 'moderate', 'severe', 'critical']).default('minor'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  order_id: z.string().uuid().optional(),
});

const updateEmergencyContactSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(7),
  relationship: z.string().min(1),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type ReportIncidentInput = z.infer<typeof reportIncidentSchema>;

async function checkCourierOrAdmin(userId: string, session: any) {
  const isOwner = session.user.id === userId;
  const isAdmin = ADMIN_ROLES.includes(session.profile.role);
  return isOwner || isAdmin;
}

export async function getCourierFullProfileAction(userId: string) {
  const result = await requireAuth();
  if (result.error) return { error: result.error.message };

  if (!await checkCourierOrAdmin(userId, result.session)) {
    return { error: 'No autorizado' };
  }

  const supabase = getServiceClient();

  const [profileRes, driverRes, earningsRes, incidentsRes, availabilityRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('drivers').select('*').eq('id', userId).single(),
    supabase.from('driver_earnings').select('*').eq('driver_id', userId).order('created_at', { ascending: false }),
    supabase.from('courier_incidents').select('*').eq('driver_id', userId).order('created_at', { ascending: false }).limit(10),
    supabase.from('driver_availability').select('*').eq('driver_id', userId).order('day_of_week'),
  ]);

  if (profileRes.error) return { error: 'Perfil no encontrado' };
  if (driverRes.error) return { error: 'Perfil de repartidor no encontrado' };

  const profile = profileRes.data;
  const driver = driverRes.data;
  const earnings = (earningsRes.data || []) as any[];
  const incidents = (incidentsRes.data || []) as any[];
  const availability = (availabilityRes.data || []) as any[];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getTime() - now.getDay() * 86400000).toISOString();

  const todayEarnings = earnings
    .filter((e: any) => e.created_at >= todayStart)
    .reduce((s: number, e: any) => s + Number(e.total_earned || 0), 0);
  const weekEarnings = earnings
    .filter((e: any) => e.created_at >= weekStart)
    .reduce((s: number, e: any) => s + Number(e.total_earned || 0), 0);

  const totalEarnings = earnings.reduce((s: number, e: any) => s + Number(e.total_earned || 0), 0);

  const pendingIncidents = incidents.filter((i: any) => !i.resolved_at).length;

  return {
    success: true,
    profile: {
      id: profile.id,
      first_name: profile.first_name,
      last_name: profile.last_name,
      email: profile.email,
      phone: profile.phone,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      created_at: profile.created_at,
      metadata: profile.metadata || {},
    },
    driver: {
      id: driver.id,
      license_number: driver.license_number,
      license_expiry: driver.license_expiry,
      vehicle_type: driver.vehicle_type,
      vehicle_plate: driver.vehicle_plate,
      vehicle_model: driver.vehicle_model,
      status: driver.status,
      is_available: driver.is_available,
      is_verified: driver.is_verified,
      is_active: driver.is_active,
      total_deliveries: driver.total_deliveries,
      completed_deliveries: driver.completed_deliveries,
      rating: driver.rating,
      avg_rating: driver.avg_rating,
      total_ratings: driver.total_ratings,
      bank_account: driver.bank_account,
      metadata: driver.metadata || {},
    },
    earnings: {
      total: totalEarnings,
      today: todayEarnings,
      week: weekEarnings,
    },
    incidents: incidents.map((i: any) => ({
      id: i.id,
      incident_type: i.incident_type,
      description: i.description,
      severity: i.severity,
      order_id: i.order_id,
      resolved_at: i.resolved_at,
      resolution_notes: i.resolution_notes,
      created_at: i.created_at,
    })),
    availability,
    pendingIncidents,
  };
}

export async function updateCourierProfileAction(userId: string, input: UpdateProfileInput) {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map(e => e.message).join(', ') };
  }

  const result = await requireAuth();
  if (result.error) return { error: result.error.message };

  if (!await checkCourierOrAdmin(userId, result.session)) {
    return { error: 'No autorizado para actualizar este perfil' };
  }

  const supabase = getServiceClient();
  const updates: any = {};
  if (parsed.data.first_name !== undefined) updates.first_name = parsed.data.first_name;
  if (parsed.data.last_name !== undefined) updates.last_name = parsed.data.last_name;
  if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;
  if (parsed.data.bio !== undefined) updates.bio = parsed.data.bio;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
    if (error) return { error: 'Error al actualizar perfil: ' + error.message };
  }

  serverAudit.logAction(
    result.session.user.id, result.session.user.email, result.session.profile.role,
    'update_courier_profile', 'profiles', userId, updates,
  );

  return { success: true };
}

export async function uploadCourierAvatarAction(formData: FormData) {
  const result = await requireAuth();
  if (result.error) return { error: result.error.message };

  const userId = result.session.user.id;
  const file = formData.get('avatar') as File;
  if (!file) return { error: 'No se seleccionó ninguna imagen' };

  if (!file.type.startsWith('image/')) return { error: 'Solo se permiten imágenes' };
  if (file.size > 2 * 1024 * 1024) return { error: 'La imagen debe ser menor a 2MB' };

  const ext = file.name.split('.').pop() || 'png';
  const fileName = `${userId}/avatar-${Date.now()}.${ext}`;

  const supabase = getServiceClient();
  const { error: uploadError } = await supabase.storage
    .from('user-avatars')
    .upload(fileName, file, { upsert: true });

  if (uploadError) return { error: 'Error al subir imagen: ' + uploadError.message };

  const { data: urlData } = supabase.storage
    .from('user-avatars')
    .getPublicUrl(fileName);

  const avatarUrl = urlData?.publicUrl || null;

  if (avatarUrl) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId);

    if (updateError) return { error: 'Error al actualizar avatar: ' + updateError.message };
  }

  serverAudit.logAction(
    result.session.user.id, result.session.user.email, result.session.profile.role,
    'upload_courier_avatar', 'profiles', userId,
  );

  return { success: true, avatarUrl };
}

export async function updateCourierVehicleAction(userId: string, input: UpdateVehicleInput) {
  const parsed = updateVehicleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map(e => e.message).join(', ') };
  }

  const result = await requireAuth();
  if (result.error) return { error: result.error.message };

  if (!await checkCourierOrAdmin(userId, result.session)) {
    return { error: 'No autorizado' };
  }

  const supabase = getServiceClient();
  const updates: any = {};
  if (parsed.data.vehicle_type !== undefined) updates.vehicle_type = parsed.data.vehicle_type;
  if (parsed.data.vehicle_plate !== undefined) updates.vehicle_plate = parsed.data.vehicle_plate;
  if (parsed.data.vehicle_model !== undefined) updates.vehicle_model = parsed.data.vehicle_model;

  const metadataUpdates: any = {};
  if (parsed.data.vehicle_brand !== undefined) metadataUpdates.vehicle_brand = parsed.data.vehicle_brand;
  if (parsed.data.vehicle_color !== undefined) metadataUpdates.vehicle_color = parsed.data.vehicle_color;

  if (Object.keys(metadataUpdates).length > 0) {
    const { data: current } = await supabase.from('drivers').select('metadata').eq('id', userId).single();
    if (current) {
      updates.metadata = { ...(current.metadata || {}), ...metadataUpdates };
    }
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('drivers').update(updates).eq('id', userId);
    if (error) return { error: 'Error al actualizar vehículo: ' + error.message };
  }

  serverAudit.logAction(
    result.session.user.id, result.session.user.email, result.session.profile.role,
    'update_courier_vehicle', 'drivers', userId, updates,
  );

  return { success: true };
}

export async function updateCourierAvailabilityAction(userId: string, input: z.infer<typeof updateAvailabilitySchema>) {
  const parsed = updateAvailabilitySchema.safeParse(input);
  if (!parsed.success) return { error: 'Horario inválido' };

  const result = await requireAuth();
  if (result.error) return { error: result.error.message };
  if (!await checkCourierOrAdmin(userId, result.session)) return { error: 'No autorizado' };

  const supabase = getServiceClient();

  for (const day of parsed.data.schedule) {
    const { error } = await supabase
      .from('driver_availability')
      .upsert({
        driver_id: userId,
        day_of_week: day.day_of_week,
        starts_at: day.starts_at || null,
        ends_at: day.ends_at || null,
        is_working: day.is_working,
      }, { onConflict: 'driver_id,day_of_week' });

    if (error) return { error: `Error en día ${day.day_of_week}: ${error.message}` };
  }

  return { success: true };
}

export async function setCourierOnlineStatusAction(status: string) {
  const result = await requireAuth();
  if (result.error) return { success: false, error: result.error.message };

  const userId = result.session.user.id;
  if (result.session.profile.role !== 'courier') {
    return { success: false, error: 'Solo repartidores pueden cambiar su estado' };
  }

  const validStatuses = ['available', 'busy', 'offline', 'on_break'];
  if (!validStatuses.includes(status)) return { success: false, error: 'Estado inválido' };

  const supabase = getServiceClient();
  const isActive = status !== 'offline';
  const isAvailable = status === 'available';

  const { error } = await supabase
    .from('drivers')
    .update({ status, is_active: isActive, is_available: isAvailable })
    .eq('id', userId);

  if (error) return { success: false, error: 'Error al cambiar estado: ' + error.message };

  serverAudit.logAction(
    result.session.user.id, result.session.user.email, result.session.profile.role,
    'set_courier_status', 'drivers', userId, { status },
  );

  return { success: true };
}

export async function uploadCourierDocumentAction(userId: string, formData: FormData) {
  const result = await requireAuth();
  if (result.error) return { error: result.error.message };

  if (!await checkCourierOrAdmin(userId, result.session)) {
    return { error: 'No autorizado' };
  }

  const file = formData.get('document') as File;
  const docType = formData.get('docType') as string;

  if (!file) return { error: 'No se seleccionó ningún archivo' };
  if (!docType) return { error: 'Tipo de documento requerido' };

  const allowedTypes = ['cedula', 'license', 'soat', 'tecnomecanica', 'other'];
  if (!allowedTypes.includes(docType)) return { error: 'Tipo de documento inválido' };

  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) return { error: 'El archivo debe ser menor a 5MB' };

  const ext = file.name.split('.').pop() || 'pdf';
  const fileName = `${userId}/${docType}-${Date.now()}.${ext}`;

  const supabase = getServiceClient();
  const { error: uploadError } = await supabase.storage
    .from('courier-documents')
    .upload(fileName, file, { upsert: true });

  if (uploadError) return { error: 'Error al subir documento: ' + uploadError.message };

  const { data: urlData } = supabase.storage
    .from('courier-documents')
    .getPublicUrl(fileName);

  const docUrl = urlData?.publicUrl || null;

  if (docUrl) {
    const { data: current } = await supabase.from('drivers').select('metadata').eq('id', userId).single();
    const docs = current?.metadata?.documents || {};
    docs[docType] = docUrl;
    const { error: metaError } = await supabase
      .from('drivers')
      .update({ metadata: { ...((current as any)?.metadata || {}), documents: docs } })
      .eq('id', userId);

    if (metaError) return { error: 'Error al guardar documento: ' + metaError.message };
  }

  return { success: true, documentUrl: docUrl };
}

export async function reportCourierIncidentAction(input: ReportIncidentInput) {
  const parsed = reportIncidentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map(e => e.message).join(', ') };
  }

  const result = await requireAuth();
  if (result.error) return { error: result.error.message };

  const userId = result.session.user.id;
  const supabase = getServiceClient();

  const location = parsed.data.latitude && parsed.data.longitude
    ? { latitude: parsed.data.latitude, longitude: parsed.data.longitude }
    : null;

  const { error } = await supabase.from('courier_incidents').insert({
    driver_id: userId,
    incident_type: parsed.data.incident_type,
    description: parsed.data.description,
    severity: parsed.data.severity,
    location,
    order_id: parsed.data.order_id || null,
  });

  if (error) return { error: 'Error al reportar incidencia: ' + error.message };

  return { success: true };
}

export async function updateCourierEmergencyContactAction(userId: string, input: z.infer<typeof updateEmergencyContactSchema>) {
  const parsed = updateEmergencyContactSchema.safeParse(input);
  if (!parsed.success) return { error: 'Datos de contacto inválidos' };

  const result = await requireAuth();
  if (result.error) return { error: result.error.message };
  if (!await checkCourierOrAdmin(userId, result.session)) return { error: 'No autorizado' };

  const supabase = getServiceClient();
  const { data: current } = await supabase.from('drivers').select('metadata').eq('id', userId).single();
  if (current) {
    const { error } = await supabase
      .from('drivers')
      .update({ metadata: { ...(current.metadata || {}), emergency_contact: parsed.data } })
      .eq('id', userId);

    if (error) return { error: 'Error al guardar contacto: ' + error.message };
  }

  return { success: true };
}

export async function updateCourierBankAccountAction(userId: string, bankAccount: { bank_name: string; account_number: string; account_holder: string }) {
  const result = await requireAuth();
  if (result.error) return { error: result.error.message };
  if (!await checkCourierOrAdmin(userId, result.session)) return { error: 'No autorizado' };

  const supabase = getServiceClient();
  const { error } = await supabase
    .from('drivers')
    .update({ bank_account: bankAccount })
    .eq('id', userId);

  if (error) return { error: 'Error al guardar datos bancarios: ' + error.message };

  return { success: true };
}

export async function getCourierOrdersHistoryAction(userId: string, limit = 20) {
  const result = await requireAuth();
  if (result.error) return { error: result.error.message, data: [] };
  if (!await checkCourierOrAdmin(userId, result.session)) return { error: 'No autorizado', data: [] };

  const supabase = getServiceClient();
  const { data } = await supabase
    .from('orders')
    .select('id, order_number, status, total_amount, created_at, updated_at, business_id, customer_id')
    .eq('courier_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  const orders = (data || []) as any[];
  const bizIds = [...new Set(orders.map(o => o.business_id))];
  const custIds = [...new Set(orders.map(o => o.customer_id))];

  const [bizRes, custRes] = await Promise.all([
    supabase.from('businesses').select('id, name').in('id', bizIds),
    supabase.from('profiles').select('id, first_name, last_name').in('id', custIds),
  ]);

  const bizMap = new Map((bizRes.data || []).map((b: any) => [b.id, b.name]));
  const custMap = new Map((custRes.data || []).map((c: any) => [c.id, [c.first_name, c.last_name].filter(Boolean).join(' ')]));

  return {
    success: true,
    data: orders.map((o: any) => ({
      id: o.id,
      order_number: o.order_number,
      status: o.status,
      total_amount: Number(o.total_amount),
      business_name: bizMap.get(o.business_id) || '—',
      customer_name: custMap.get(o.customer_id) || 'Cliente',
      created_at: o.created_at,
      updated_at: o.updated_at,
    })),
  };
}

export async function getCourierEarningsHistoryAction(userId: string, days = 90) {
  const result = await requireAuth();
  if (result.error) return { error: result.error.message, data: [] };
  if (!await checkCourierOrAdmin(userId, result.session)) return { error: 'No autorizado', data: [] };

  const supabase = getServiceClient();
  const start = new Date();
  start.setDate(start.getDate() - days);

  const { data } = await supabase
    .from('driver_earnings')
    .select('*')
    .eq('driver_id', userId)
    .gte('created_at', start.toISOString())
    .order('created_at', { ascending: true });

  return { success: true, data: (data || []) as any[] };
}
