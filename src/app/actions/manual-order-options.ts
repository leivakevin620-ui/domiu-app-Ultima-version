'use server';

import { z } from 'zod';
import { requireAuth } from '@/lib/auth/server-auth';
import { PermissionManager } from '@/lib/auth/permissions';
import { getServiceClient } from '@/lib/db/supabase';
import {
  isAdminRole,
  isBusinessRole,
  type UserRole,
} from '@/types/auth';
import {
  manualOrderPanelSchema,
  type ManualOrderPanel,
} from '@/lib/orders/manual-order-domain';

export interface ManualOrderBranchOption {
  id: string;
  businessId: string;
  name: string;
  address: string;
  city: string;
  isPrimary: boolean;
  deliveryAvailable: boolean;
  latitude: number | null;
  longitude: number | null;
  serviceRadiusKm: number | null;
}

export interface ManualOrderCourierOption {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  vehiclePlate: string;
  status: string;
  isAvailable: boolean;
  rating: number | null;
}

type UnknownRow = Record<string, unknown>;

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function fullName(profile: UnknownRow | undefined): string {
  if (!profile) return 'Repartidor';
  return (
    [profile.first_name, profile.last_name]
      .filter(Boolean)
      .map(String)
      .join(' ')
      .trim() || String(profile.email || 'Repartidor')
  );
}

async function requireOptionsActor(panel: ManualOrderPanel) {
  const auth = await requireAuth();
  if (auth.error) throw new Error(auth.error.message);

  const role = auth.session.profile.role;
  const hasPermission = PermissionManager.hasPermission(
    role as UserRole,
    'manage_orders',
  );

  if (
    !hasPermission ||
    (panel === 'admin' && !isAdminRole(role)) ||
    (panel === 'business' && !isBusinessRole(role))
  ) {
    throw new Error('No tienes permiso para consultar estas opciones');
  }

  return auth.session;
}

async function assertBusinessAccess(
  panel: ManualOrderPanel,
  actorId: string,
  businessId: string,
) {
  const supabase = getServiceClient();
  let query = supabase
    .from('businesses')
    .select('id')
    .eq('id', businessId)
    .eq('is_active', true)
    .is('deleted_at', null);

  if (panel === 'business') query = query.eq('owner_id', actorId);

  const { data, error } = await query.maybeSingle();
  if (error || !data) throw new Error('Negocio no encontrado o no autorizado');
}

export async function getManualOrderBranchesAction(
  rawPanel: ManualOrderPanel,
  rawBusinessId: string,
): Promise<{
  success: boolean;
  branches: ManualOrderBranchOption[];
  error?: string;
}> {
  try {
    const panel = manualOrderPanelSchema.parse(rawPanel);
    const businessId = z.string().uuid().parse(rawBusinessId);
    const session = await requireOptionsActor(panel);
    await assertBusinessAccess(panel, session.user.id, businessId);

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('business_addresses')
      .select(
        'id,business_id,name,street_address,formatted_address,city,is_primary,delivery_available,latitude,longitude,service_radius_km,is_active',
      )
      .eq('business_id', businessId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('is_primary', { ascending: false })
      .order('name');
    if (error) throw error;

    return {
      success: true,
      branches: ((data || []) as unknown as UnknownRow[]).map((row) => ({
        id: String(row.id),
        businessId: String(row.business_id),
        name: String(row.name || 'Sucursal'),
        address:
          String(row.formatted_address || '').trim() ||
          String(row.street_address || '').trim() ||
          'Dirección no configurada',
        city: String(row.city || ''),
        isPrimary: Boolean(row.is_primary),
        deliveryAvailable: row.delivery_available !== false,
        latitude: asNumber(row.latitude),
        longitude: asNumber(row.longitude),
        serviceRadiusKm: asNumber(row.service_radius_km),
      })),
    };
  } catch (error) {
    return {
      success: false,
      branches: [],
      error:
        error instanceof Error
          ? error.message
          : 'No se pudieron cargar las sucursales',
    };
  }
}

export async function getManualOrderCouriersAction(
  rawPanel: ManualOrderPanel,
): Promise<{
  success: boolean;
  couriers: ManualOrderCourierOption[];
  error?: string;
}> {
  try {
    const panel = manualOrderPanelSchema.parse(rawPanel);
    await requireOptionsActor(panel);

    if (panel !== 'admin') return { success: true, couriers: [] };

    const supabase = getServiceClient();
    const { data: drivers, error: driversError } = await supabase
      .from('drivers')
      .select(
        'id,vehicle_type,vehicle_plate,status,is_active,is_available,is_verified,rating',
      )
      .eq('is_active', true)
      .eq('is_verified', true)
      .is('deleted_at', null)
      .in('status', ['available', 'busy'])
      .order('is_available', { ascending: false })
      .order('rating', { ascending: false });
    if (driversError) throw driversError;

    const ids = (drivers || []).map((driver) => String(driver.id));
    const { data: profiles, error: profilesError } = ids.length
      ? await supabase
          .from('profiles')
          .select('id,first_name,last_name,email,phone,status')
          .in('id', ids)
          .eq('status', 'active')
      : { data: [], error: null };
    if (profilesError) throw profilesError;

    const profileMap = new Map(
      ((profiles || []) as unknown as UnknownRow[]).map((profile) => [
        String(profile.id),
        profile,
      ]),
    );

    return {
      success: true,
      couriers: ((drivers || []) as unknown as UnknownRow[])
        .filter((driver) => profileMap.has(String(driver.id)))
        .map((driver) => {
          const profile = profileMap.get(String(driver.id));
          return {
            id: String(driver.id),
            name: fullName(profile),
            phone: String(profile?.phone || ''),
            vehicleType: String(driver.vehicle_type || 'No informado'),
            vehiclePlate: String(driver.vehicle_plate || ''),
            status: String(driver.status || 'unknown'),
            isAvailable: Boolean(driver.is_available),
            rating: asNumber(driver.rating),
          };
        }),
    };
  } catch (error) {
    return {
      success: false,
      couriers: [],
      error:
        error instanceof Error
          ? error.message
          : 'No se pudieron cargar los repartidores',
    };
  }
}
