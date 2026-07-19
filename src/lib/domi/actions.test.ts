import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const actions = readFileSync(
  resolve(process.cwd(), 'src/lib/domi/actions.ts'),
  'utf8',
);
const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260719023000_domi_confirmed_actions_and_settings.sql'),
  'utf8',
);

describe('Domi confirmed actions', () => {
  it('persiste acciones pendientes con expiración y pertenencia al usuario', () => {
    expect(actions).toContain(".from('domi_pending_actions')");
    expect(actions).toContain('user_id: args.context.userId');
    expect(actions).toContain('tenant_id: args.context.tenantId');
    expect(actions).toContain("status: 'pending'");
    expect(actions).toContain('expires_at: expiresAt');
  });

  it('exige una reclamación atómica antes de ejecutar', () => {
    expect(actions).toContain(".eq('status', 'pending')");
    expect(actions).toContain("status: 'confirmed'");
    expect(actions).toContain("status: 'executed'");
    expect(actions).toContain('action_already_claimed');
  });

  it('revalida estado y tenant antes de escribir pedidos del negocio', () => {
    expect(actions).toContain(".eq('business_id', context.tenantId)");
    expect(actions).toContain(".eq('status', expectedStatus)");
    expect(actions).toContain('order_changed_before_confirmation');
  });

  it('revalida identidad antes de aceptar o avanzar pedidos del repartidor', () => {
    expect(actions).toContain(".is('courier_id', null)");
    expect(actions).toContain(".eq('courier_id', context.userId)");
    expect(actions).toContain('order_no_longer_available');
  });

  it('limita cambios a transiciones operativas declaradas', () => {
    expect(actions).toContain("pending: ['confirmed', 'cancelled']");
    expect(actions).toContain("confirmed: ['preparing', 'cancelled']");
    expect(actions).toContain("preparing: ['ready', 'cancelled']");
    expect(actions).toContain("assigned: ['accepted']");
    expect(actions).toContain("accepted: ['picked_up']");
    expect(actions).toContain("picked_up: ['in_transit']");
    expect(actions).toContain("in_transit: ['delivered']");
  });

  it('no incluye acciones administrativas o financieras de escritura', () => {
    expect(actions).not.toContain('admin.suspend');
    expect(actions).not.toContain('admin.refund');
    expect(actions).not.toContain('finance.transfer');
    expect(actions).not.toContain('payment.execute');
  });

  it('permite controlar memoria y crear soporte solo después de confirmar', () => {
    expect(actions).toContain("case 'memory.set_enabled'");
    expect(actions).toContain("case 'memory.delete_all'");
    expect(actions).toContain("case 'support.create_ticket'");
    expect(actions).toContain(".from('support_tickets')");
  });

  it('protege las tablas nuevas con RLS y lectura exclusiva del propietario', () => {
    expect(migration).toContain('alter table public.domi_user_settings enable row level security');
    expect(migration).toContain('alter table public.domi_pending_actions enable row level security');
    expect(migration).toContain('using (user_id = (select auth.uid()))');
    expect(migration).toContain('revoke all on public.domi_pending_actions from anon, authenticated');
  });
});
