import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  cancelDomiAction,
  confirmDomiAction,
  listDomiMemory,
  prepareDomiConfirmedAction,
} from '@/lib/domi/actions';
import type { DomiServerContext } from '@/lib/domi/server-context';
import { executeDomiCustomerTool as executeDomiCustomerReadTool } from '@/lib/domi/tools/customer-read-base';
import { canExecuteDomiTool, DOMI_TOOL_REGISTRY, withDomiToolTimeout } from '@/lib/domi/tools/registry';
import { executeDomiRoleReadTool } from '@/lib/domi/tools/role-read';
import type { DomiToolPlan, DomiToolResult } from '@/lib/domi/tools/types';

const CONFIRMED_ACTION_TOOLS = new Set([
  'merchant.update_order_status',
  'merchant.update_product',
  'courier.accept_order',
  'courier.update_order_status',
  'memory.set_enabled',
  'memory.delete_all',
  'support.create_ticket',
]);

function denied(plan: DomiToolPlan, reason: string): DomiToolResult {
  return {
    name: plan.name,
    success: false,
    message: 'Esta herramienta no está disponible para tu perfil o permisos actuales.',
    data: { reason },
    recordCount: 0,
    suggestedActions: [],
    navigation: [],
    riskLevel: DOMI_TOOL_REGISTRY[plan.name]?.riskLevel || 'low',
  };
}

export async function executeDomiTool(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
  options: { conversationId?: string | null } = {},
): Promise<DomiToolResult> {
  if (!canExecuteDomiTool(context, plan.name)) {
    return denied(plan, 'permission_denied');
  }

  return withDomiToolTimeout(plan.name, async () => {
    if (plan.name === 'action.confirm') return confirmDomiAction(supabase, context, plan);
    if (plan.name === 'action.cancel') return cancelDomiAction(supabase, context, plan);
    if (plan.name === 'memory.list') return listDomiMemory(supabase, context, plan);

    if (CONFIRMED_ACTION_TOOLS.has(plan.name)) {
      return prepareDomiConfirmedAction(
        supabase,
        context,
        plan,
        options.conversationId,
      );
    }

    if (plan.name.startsWith('customer.')) {
      return executeDomiCustomerReadTool(supabase, context, plan);
    }

    return executeDomiRoleReadTool(supabase, context, plan);
  });
}
