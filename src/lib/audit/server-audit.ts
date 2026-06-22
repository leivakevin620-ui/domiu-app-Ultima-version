import 'server-only';
import { getServiceClient } from '@/lib/db/supabase';

export interface AuditEntry {
  userId: string;
  userEmail?: string;
  userRole?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
  result: 'success' | 'error';
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export const serverAudit = {
  async log(entry: AuditEntry): Promise<void> {
    try {
      const supabase = getServiceClient();
      await supabase.from('audit_log').insert({
        user_id: entry.userId,
        user_email: entry.userEmail || null,
        user_role: entry.userRole || null,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId || null,
        details: entry.details ? JSON.stringify(entry.details) : null,
        result: entry.result,
        error_message: entry.errorMessage || null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      });
    } catch {
      // Audit logging should never break the main operation
    }
  },

  async logAction(
    userId: string,
    userEmail: string | undefined,
    userRole: string | undefined,
    action: string,
    entityType: string,
    entityId?: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    return this.log({
      userId,
      userEmail,
      userRole,
      action,
      entityType,
      entityId,
      details,
      result: 'success',
    });
  },

  async logError(
    userId: string,
    userEmail: string | undefined,
    userRole: string | undefined,
    action: string,
    entityType: string,
    errorMessage: string,
    entityId?: string,
  ): Promise<void> {
    return this.log({
      userId,
      userEmail,
      userRole,
      action,
      entityType,
      entityId,
      result: 'error',
      errorMessage,
    });
  },
};
