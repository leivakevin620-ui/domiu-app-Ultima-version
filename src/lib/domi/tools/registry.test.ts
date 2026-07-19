import { describe, expect, it } from 'vitest';
import type { DomiServerContext } from '@/lib/domi/server-context';
import { canExecuteDomiTool, DOMI_TOOL_REGISTRY } from '@/lib/domi/tools/registry';
import type { DomiRole } from '@/lib/domi/security';

function context(role: DomiRole, permissions: string[]): DomiServerContext {
  return {
    requestId: '550e8400-e29b-41d4-a716-446655440000',
    sessionId: 'session',
    userId: '123e4567-e89b-42d3-a456-426614174000',
    email: 'usuario@domiu.test',
    name: 'Usuario DomiU',
    role,
    sourceRole: role,
    permissions,
    tenantId: role === 'merchant' ? '123e4567-e89b-42d3-a456-426614174001' : 'platform',
    tenantType: role === 'merchant' ? 'business' : role === 'admin' ? 'platform' : 'user',
    tenantLabel: 'DomiU',
    accountStatus: 'active',
    client: {
      path: null,
      module: null,
      screen: null,
      locale: 'es-CO',
      timezone: 'America/Bogota',
      cart: null,
    },
    ipAddress: null,
    userAgent: null,
  };
}

describe('Domi controlled tool registry', () => {
  it('registra herramientas para los cuatro perfiles', () => {
    const roles = new Set(Object.values(DOMI_TOOL_REGISTRY).flatMap((definition) => definition.roles));
    expect(roles).toEqual(new Set(['customer', 'merchant', 'courier', 'admin']));
  });

  it('marca todas las herramientas actuales como lecturas idempotentes de bajo riesgo', () => {
    for (const definition of Object.values(DOMI_TOOL_REGISTRY)) {
      expect(definition.riskLevel).toBe('low');
      expect(definition.requiresConfirmation).toBe(false);
      expect(definition.idempotent).toBe(true);
      expect(definition.timeoutMs).toBeGreaterThan(0);
      expect(definition.permissions.length).toBeGreaterThan(0);
    }
  });

  it('exige rol y todos los permisos declarados', () => {
    const merchant = context('merchant', ['inventory.read']);
    expect(canExecuteDomiTool(merchant, 'merchant.inventory_summary')).toBe(true);
    expect(canExecuteDomiTool(merchant, 'admin.platform_metrics')).toBe(false);
    expect(canExecuteDomiTool(context('merchant', []), 'merchant.inventory_summary')).toBe(false);

    const adminPartial = context('admin', ['operation.read']);
    expect(canExecuteDomiTool(adminPartial, 'admin.platform_metrics')).toBe(false);
    expect(
      canExecuteDomiTool(context('admin', ['operation.read', 'reports.read']), 'admin.platform_metrics'),
    ).toBe(true);
  });

  it('impide que cliente, negocio y repartidor ejecuten herramientas administrativas', () => {
    expect(canExecuteDomiTool(context('customer', ['audit.read']), 'admin.audit_summary')).toBe(false);
    expect(canExecuteDomiTool(context('merchant', ['audit.read']), 'admin.audit_summary')).toBe(false);
    expect(canExecuteDomiTool(context('courier', ['audit.read']), 'admin.audit_summary')).toBe(false);
  });
});
