import type { DomiServerContext } from '@/lib/domi/server-context';
import type { DomiRiskLevel, DomiRole } from '@/lib/domi/security';

export type DomiToolName =
  | 'customer.search_catalog'
  | 'customer.cart_summary'
  | 'customer.list_orders'
  | 'customer.track_order'
  | 'merchant.list_orders'
  | 'merchant.inventory_summary'
  | 'merchant.sales_summary'
  | 'merchant.reviews_summary'
  | 'courier.available_orders'
  | 'courier.assignments'
  | 'courier.earnings_summary'
  | 'courier.delivery_history'
  | 'admin.platform_metrics'
  | 'admin.order_summary'
  | 'admin.business_summary'
  | 'admin.courier_summary'
  | 'admin.audit_summary';

export interface DomiToolPlan {
  name: DomiToolName;
  intent: string;
  arguments: Record<string, unknown>;
}

export interface DomiNavigationLink {
  label: string;
  href: string;
}

export interface DomiToolResult {
  name: DomiToolName;
  success: boolean;
  message: string;
  data: Record<string, unknown>;
  recordCount: number;
  suggestedActions: string[];
  navigation: DomiNavigationLink[];
}

export interface DomiToolExecutionInput {
  context: DomiServerContext;
  plan: DomiToolPlan;
}

export interface DomiToolDefinition {
  name: DomiToolName;
  description: string;
  roles: readonly DomiRole[];
  permissions: readonly string[];
  riskLevel: DomiRiskLevel;
  requiresConfirmation: boolean;
  timeoutMs: number;
  idempotent: boolean;
}
