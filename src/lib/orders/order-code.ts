export function generateOrderCode(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `DOMI-${y}${m}${d}-${h}${min}${s}-${rand}`;
}

import type { SupabaseClient } from '@supabase/supabase-js';

export async function generateUniqueOrderCode(
  supabase: SupabaseClient,
  maxRetries = 5,
): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const code = generateOrderCode();
    const { data } = await supabase
      .from('orders')
      .select('id')
      .eq('order_code', code)
      .maybeSingle();
    if (!data) return code;
  }
  const fallback = `DOMI-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  return fallback;
}
