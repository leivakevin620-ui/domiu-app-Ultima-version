import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DomiServerContext } from '@/lib/domi/server-context';
import { executeDomiCustomerTool as executeDomiCustomerReadTool } from '@/lib/domi/tools/customer-read-base';
import { canExecuteDomiTool, withDomiToolTimeout } from '@/lib/domi/tools/registry';
import { executeDomiRoleReadTool } from '@/lib/domi/tools/role-read';
import type { DomiToolPlan, DomiToolResult } from '@/lib/domi/tools/types';

function denied(plan: DomiToolPlan, reason: string): DomiToolResult {
  return {
    name: plan.name,
    success: false,
    message: 'Esta herramienta no está disponible para tu perfil o permisos actuales.',
    data: { reason },
    recordCount: 0,
    suggestedActions: [],
    navigation: [],
  };
}

export async function executeDomiTool(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
): Promise<DomiToolResult> {
  if (!canExecuteDomiTool(context, plan.name)) {
    return denied(plan, 'permission_denied');
  }

  return withDomiToolTimeout(plan.name, async () => {
    if (plan.name.startsWith('customer.')) {
      return executeDomiCustomerReadTool(supabase, context, plan);
    }

    return executeDomiRoleReadTool(supabase, context, plan);
  });
}
