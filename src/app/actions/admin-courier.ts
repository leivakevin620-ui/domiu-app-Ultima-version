'use server';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { getServiceClient } from '@/lib/db/supabase';
import { requireAuth } from '@/lib/auth/server-auth';
import { serverAudit } from '@/lib/audit/server-audit';
import { ADMIN_ROLES } from '@/types/auth';

export async function getAllCouriersAdmin(search?: string, filter?: string) {
  const result = await requireAuth();
  if (result.error || !ADMIN_ROLES.includes(result.session.profile.role)) return [];

  const supabase = getServiceClient();
  const { data: drivers } = await supabase
    .from('drivers')
    .select('*')
    .order('total_deliveries', { ascending: false });

  if (!drivers) return [];

  const ids = (drivers as any[]).map((d: any) => d.id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, phone, avatar_url, status')
    .in('id', ids);

  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
  const earningsPromises = ids.map(id =>
    supabase.from('driver_earnings').select('total_earned').eq('driver_id', id)
  );
  const earningsResults = await Promise.all(earningsPromises);
  const earningsMap = new Map<string, number>();
  ids.forEach((id, i) => {
    const data = earningsResults[i].data as any[];
    const total = (data || []).reduce((s: number, e: any) => s + Number(e.total_earned || 0), 0);
    earningsMap.set(id, total);
  });

  const { data: incidents } = await supabase
    .from('courier_incidents')
    .select('driver_id, id, severity, resolved_at');

  const incidentMap = new Map<string, { total: number; pending: number; critical: number }>();
  for (const inc of (incidents || []) as any[]) {
    const current = incidentMap.get(inc.driver_id) || { total: 0, pending: 0, critical: 0 };
    current.total++;
    if (!inc.resolved_at) current.pending++;
    if (inc.severity === 'critical' || inc.severity === 'severe') current.critical++;
    incidentMap.set(inc.driver_id, current);
  }

  let list: any[] = (drivers as any[]).map((d: any) => {
    const p = profileMap.get(d.id) || {};
    const inc = incidentMap.get(d.id) || { total: 0, pending: 0, critical: 0 };
    return {
      id: d.id,
      first_name: p.first_name || '',
      last_name: p.last_name || '',
      email: p.email || '',
      phone: p.phone || '',
      avatar_url: p.avatar_url || null,
      profile_status: p.status || 'active',
      vehicle_type: d.vehicle_type,
      vehicle_plate: d.vehicle_plate,
      status: d.status,
      is_available: d.is_available,
      is_verified: d.is_verified,
      is_active: d.is_active,
      total_deliveries: d.total_deliveries,
      completed_deliveries: d.completed_deliveries,
      rating: d.rating,
      avg_rating: d.avg_rating,
      total_ratings: d.total_ratings,
      total_earnings: earningsMap.get(d.id) || 0,
      incidents: inc,
      created_at: d.created_at,
    };
  });

  if (search) {
    const s = search.toLowerCase();
    list = list.filter(c =>
      c.first_name?.toLowerCase().includes(s) ||
      c.last_name?.toLowerCase().includes(s) ||
      c.email?.toLowerCase().includes(s) ||
      c.vehicle_plate?.toLowerCase().includes(s)
    );
  }

  if (filter && filter !== 'all') {
    if (filter === 'available') list = list.filter(c => c.is_available);
    else if (filter === 'busy') list = list.filter(c => c.status === 'busy');
    else if (filter === 'offline') list = list.filter(c => c.status === 'offline');
    else if (filter === 'verified') list = list.filter(c => c.is_verified);
    else if (filter === 'unverified') list = list.filter(c => !c.is_verified);
    else if (filter === 'suspended') list = list.filter(c => !c.is_active);
    else if (filter === 'incidents') list = list.filter(c => c.incidents.pending > 0);
  }

  return list;
}

export async function getCourierAdminDetail(courierId: string) {
  const result = await requireAuth();
  if (result.error || !ADMIN_ROLES.includes(result.session.profile.role)) return null;

  const supabase = getServiceClient();
  const [driverRes, profileRes, earningsRes, incidentsRes, availabilityRes] = await Promise.all([
    supabase.from('drivers').select('*').eq('id', courierId).single(),
    supabase.from('profiles').select('*').eq('id', courierId).single(),
    supabase.from('driver_earnings').select('*').eq('driver_id', courierId).order('created_at', { ascending: false }).limit(50),
    supabase.from('courier_incidents').select('*').eq('driver_id', courierId).order('created_at', { ascending: false }),
    supabase.from('driver_availability').select('*').eq('driver_id', courierId).order('day_of_week'),
  ]);

  if (driverRes.error || profileRes.error) return null;

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, status, total_amount, created_at')
    .eq('courier_id', courierId)
    .order('created_at', { ascending: false })
    .limit(20);

  return {
    profile: profileRes.data,
    driver: driverRes.data,
    earnings: (earningsRes.data || []) as any[],
    incidents: (incidentsRes.data || []) as any[],
    availability: (availabilityRes.data || []) as any[],
    recentOrders: (orders || []) as any[],
  };
}

export async function verifyCourierAction(courierId: string, verified: boolean) {
  const result = await requireAuth();
  if (result.error || !ADMIN_ROLES.includes(result.session.profile.role)) {
    return { error: 'No autorizado' };
  }

  const supabase = getServiceClient();
  const { error } = await supabase
    .from('drivers')
    .update({ is_verified: verified })
    .eq('id', courierId);

  if (error) return { error: error.message };

  serverAudit.logAction(
    result.session.user.id, result.session.user.email, result.session.profile.role,
    verified ? 'verify_courier' : 'unverify_courier', 'drivers', courierId,
  );

  return { success: true };
}

export async function suspendCourierAction(courierId: string, suspended: boolean) {
  const result = await requireAuth();
  if (result.error || !ADMIN_ROLES.includes(result.session.profile.role)) {
    return { error: 'No autorizado' };
  }

  const supabase = getServiceClient();
  const updates: any = { is_active: !suspended };
  if (suspended) {
    updates.status = 'offline';
    updates.is_available = false;
  }

  const { error } = await supabase
    .from('drivers')
    .update(updates)
    .eq('id', courierId);

  if (error) return { error: error.message };

  serverAudit.logAction(
    result.session.user.id, result.session.user.email, result.session.profile.role,
    suspended ? 'suspend_courier' : 'unsuspend_courier', 'drivers', courierId,
  );

  return { success: true };
}

export async function resolveCourierIncidentAction(incidentId: string, resolutionNotes: string) {
  const result = await requireAuth();
  if (result.error || !ADMIN_ROLES.includes(result.session.profile.role)) {
    return { error: 'No autorizado' };
  }

  const supabase = getServiceClient();
  const { error } = await supabase
    .from('courier_incidents')
    .update({
      resolved_at: new Date().toISOString(),
      resolution_notes: resolutionNotes,
    })
    .eq('id', incidentId);

  if (error) return { error: error.message };

  return { success: true };
}
