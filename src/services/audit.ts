// src/services/audit.ts
// Enhanced audit logging service with IP, browser, device, result

'use client';

import { getBrowserClient } from '@/lib/db/supabase';

export interface AuditLog {
  id: string;
  admin_id: string;
  admin_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string | null;
  ip_address: string | null;
  browser: string | null;
  device: string | null;
  os: string | null;
  location_city: string | null;
  location_country: string | null;
  result: 'success' | 'error';
  created_at: string;
}

function getClientInfo() {
  if (typeof window === 'undefined') {
    return { ip: null, browser: null, device: null, os: null };
  }
  const ua = navigator.userAgent;
  const browser = ua.includes('Chrome') ? 'Chrome'
    : ua.includes('Firefox') ? 'Firefox'
    : ua.includes('Safari') ? 'Safari'
    : ua.includes('Edge') ? 'Edge'
    : 'Unknown';
  const os = ua.includes('Windows') ? 'Windows'
    : ua.includes('Mac') ? 'macOS'
    : ua.includes('Linux') ? 'Linux'
    : ua.includes('Android') ? 'Android'
    : ua.includes('iOS') ? 'iOS'
    : 'Unknown';
  const device = ua.includes('Mobile') ? 'Mobile'
    : ua.includes('Tablet') ? 'Tablet'
    : 'Desktop';
  return { ip: null, browser, device, os };
}

export const auditService = {
  async log(
    adminId: string,
    adminName: string | null,
    action: string,
    entityType: string,
    entityId: string | null,
    details: string | null,
    result: 'success' | 'error' = 'success',
  ): Promise<void> {
    const supabase = await getBrowserClient();
    const info = getClientInfo();
    await supabase.from('admin_audit_log').insert({
      admin_id: adminId,
      admin_name: adminName,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      ip_address: info.ip,
      browser: info.browser,
      device: info.device,
      os: info.os,
      result,
    });
  },

  async getRecent(limit = 20): Promise<AuditLog[]> {
    const supabase = await getBrowserClient();
    const { data } = await supabase
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data || []) as AuditLog[];
  },

  async getAll(
    page = 1,
    pageSize = 50,
    filters?: { action?: string; entityType?: string; adminName?: string; result?: string; startDate?: string; endDate?: string; search?: string },
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const supabase = await getBrowserClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('admin_audit_log')
      .select('*', { count: 'exact' });

    if (filters?.action) query = query.eq('action', filters.action);
    if (filters?.entityType) query = query.eq('entity_type', filters.entityType);
    if (filters?.adminName) query = query.ilike('admin_name', `%${filters.adminName}%`);
    if (filters?.result) query = query.eq('result', filters.result);
    if (filters?.startDate) query = query.gte('created_at', filters.startDate);
    if (filters?.endDate) query = query.lte('created_at', filters.endDate);
    if (filters?.search) {
      query = query.or(`admin_name.ilike.%${filters.search}%,action.ilike.%${filters.search}%,entity_type.ilike.%${filters.search}%,details.ilike.%${filters.search}%`);
    }

    const { data, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);
    return { logs: (data || []) as AuditLog[], total: count || 0 };
  },

  async getAllActions(): Promise<string[]> {
    const supabase = await getBrowserClient();
    const { data } = await supabase
      .from('admin_audit_log')
      .select('action')
      .order('action');
    const mapped = ((data ?? []) as { action: string }[]).map((r) => r.action);
    return [...new Set(mapped)];
  },
};
