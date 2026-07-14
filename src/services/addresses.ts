import { getBrowserClient } from '@/lib/db/supabase';

export interface DeliveryAddress {
  id: string;
  user_id: string;
  type: string;
  label: string | null;
  street_address: string;
  city: string;
  state_province: string | null;
  postal_code: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  is_primary: boolean;
  instructions: string | null;
}

export interface SaveDeliveryAddressInput {
  type?: string;
  label?: string;
  streetAddress: string;
  city: string;
  state?: string;
  postalCode?: string;
  country?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  isPrimary?: boolean;
  instructions?: string;
}

function normalize(row: Record<string, unknown>): DeliveryAddress {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    type: String(row.type || 'home'),
    label: row.label ? String(row.label) : null,
    street_address: String(row.street_address || ''),
    city: String(row.city || ''),
    state_province: row.state_province ? String(row.state_province) : null,
    postal_code: row.postal_code ? String(row.postal_code) : null,
    country: String(row.country || 'Colombia'),
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    is_primary: Boolean(row.is_primary),
    instructions: row.instructions ? String(row.instructions) : null,
  };
}

export const addressService = {
  async list(userId: string): Promise<DeliveryAddress[]> {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from('addresses')
      .select('id,user_id,type,label,street_address,city,state_province,postal_code,country,latitude,longitude,is_primary,instructions')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('is_primary', { ascending: false })
      .order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => normalize(row as Record<string, unknown>));
  },

  async save(userId: string, input: SaveDeliveryAddressInput, addressId?: string): Promise<DeliveryAddress> {
    const supabase = getBrowserClient();
    const isPrimary = input.isPrimary ?? true;

    if (isPrimary) {
      const { error: resetError } = await supabase
        .from('addresses')
        .update({ is_primary: false })
        .eq('user_id', userId)
        .eq('is_primary', true);
      if (resetError) throw new Error(resetError.message);
    }

    const payload = {
      user_id: userId,
      type: input.type || 'home',
      label: input.label?.trim() || null,
      street_address: input.streetAddress.trim(),
      city: input.city.trim() || 'Santa Marta',
      state_province: input.state?.trim() || 'Magdalena',
      postal_code: input.postalCode?.trim() || null,
      country: input.country?.trim() || 'Colombia',
      latitude: input.latitude,
      longitude: input.longitude,
      is_primary: isPrimary,
      instructions: input.instructions?.trim() || null,
      metadata: {
        location_accuracy_meters: input.accuracy ?? null,
        coordinates_source: 'user_device_or_google_places',
      },
      updated_at: new Date().toISOString(),
    };

    const query = addressId
      ? supabase.from('addresses').update(payload).eq('id', addressId).eq('user_id', userId)
      : supabase.from('addresses').insert(payload);

    const { data, error } = await query.select('*').single();
    if (error || !data) throw new Error(error?.message || 'No se pudo guardar la dirección');
    return normalize(data as Record<string, unknown>);
  },

  async setPrimary(userId: string, addressId: string): Promise<void> {
    const supabase = getBrowserClient();
    const { error: resetError } = await supabase
      .from('addresses')
      .update({ is_primary: false })
      .eq('user_id', userId);
    if (resetError) throw new Error(resetError.message);

    const { error } = await supabase
      .from('addresses')
      .update({ is_primary: true, updated_at: new Date().toISOString() })
      .eq('id', addressId)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
  },
};
