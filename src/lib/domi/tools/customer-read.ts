import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DomiServerContext } from '@/lib/domi/server-context';
import { executeDomiTool } from '@/lib/domi/tools/execute';
import type { DomiToolPlan, DomiToolResult } from '@/lib/domi/tools/types';

// Nombre conservado por compatibilidad con la ruta de chat existente.
// La ejecución real ya se distribuye según rol, permisos, tenant y registro de herramientas.
export async function executeDomiCustomerTool(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
): Promise<DomiToolResult> {
  return executeDomiTool(supabase, context, plan);
}
