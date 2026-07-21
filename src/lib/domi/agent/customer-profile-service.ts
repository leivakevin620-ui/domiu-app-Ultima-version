import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DomiAdvancedResult } from '@/lib/domi/agent/types';

export async function getDomiAddresses(
  supabase: SupabaseClient,
  userId: string,
): Promise<DomiAdvancedResult> {
  const { data, error } = await supabase
    .from('addresses')
    .select('id,type,label,street_address,formatted_address,city,neighborhood,is_primary,instructions')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('is_primary', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(10);
  if (error) throw new Error('domi_addresses_read_failed');

  const addresses = data ?? [];
  if (!addresses.length) {
    return {
      intent: 'addresses',
      tool: 'agent.address_service',
      message: 'No tienes direcciones guardadas todavía. Agrega una dirección desde tu perfil antes de preparar el pedido.',
      data: { addresses: [] },
      recordCount: 0,
      suggestedActions: [],
      navigation: [{ label: 'Agregar dirección', href: '/cliente/configuracion/direcciones' }],
    };
  }

  const lines = addresses.map((address, index) => {
    const name = address.label || address.type || `Dirección ${index + 1}`;
    const location = address.formatted_address || address.street_address;
    return `${index + 1}. ${name}${address.is_primary ? ' (principal)' : ''}: ${location}${address.neighborhood ? `, ${address.neighborhood}` : ''}.`;
  });
  return {
    intent: 'addresses',
    tool: 'agent.address_service',
    message: `Estas son tus direcciones autorizadas:\n\n${lines.join('\n')}\n\nLa dirección debe confirmarse nuevamente antes del pago.`,
    data: { addresses },
    recordCount: addresses.length,
    suggestedActions: ['Usar mi dirección principal', 'Preparar un pedido'],
    navigation: [{ label: 'Administrar direcciones', href: '/cliente/configuracion/direcciones' }],
  };
}

export async function getDomiPaymentMethods(
  supabase: SupabaseClient,
  userId: string,
): Promise<DomiAdvancedResult> {
  const { data, error } = await supabase
    .from('customer_payment_methods')
    .select('id,type,brand,last_four,is_default,is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .limit(10);
  if (error) throw new Error('domi_payment_methods_read_failed');

  const methods = data ?? [];
  const labels = methods.map((method) => {
    const ending = method.last_four ? ` terminada en ${method.last_four}` : '';
    return `${method.type}${method.brand ? ` ${method.brand}` : ''}${ending}${method.is_default ? ' (principal)' : ''}`;
  });
  const message = labels.length
    ? `Tienes disponibles: ${labels.join(', ')}. También puede aparecer efectivo si el negocio lo acepta. Domi nunca ingresará claves ni confirmará el pago; debes elegir y pagar manualmente en checkout.`
    : 'No tienes métodos guardados. Puedes seleccionar efectivo o registrar un método desde la pantalla de pago, según lo que permita el negocio. Domi nunca confirmará el pago por ti.';

  return {
    intent: 'payment_methods',
    tool: 'agent.payment_method_service',
    message,
    data: { methods },
    recordCount: methods.length,
    suggestedActions: ['Preparar un pedido'],
    navigation: [{ label: 'Administrar métodos de pago', href: '/cliente/metodos-pago' }],
  };
}
