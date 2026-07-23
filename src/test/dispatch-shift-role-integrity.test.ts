import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('publicación segura de pedidos', () => {
  it('publica mediante acción de servidor y no actualiza el pedido directamente desde el navegador', () => {
    const page = read('src/app/negocio/pedidos/page.tsx');
    const action = read('src/app/actions/business-order-status.ts');

    expect(page).toContain('updateBusinessOrderStatusAction');
    expect(page).not.toContain('businessService.updateOrderStatus(');
    expect(action).toContain("preparing: ['ready', 'cancelled']");
    expect(action).toContain(".eq('status', order.status)");
    expect(action).toContain(".is('courier_id', null)");
    expect(action).toContain('publish_order_to_couriers');
  });
});

describe('aislamiento por jornada del repartidor', () => {
  it('vacía el panel sin jornada y filtra pedidos desde el inicio del turno actual', () => {
    const context = read('src/contexts/CourierContext.tsx');

    expect(context).toContain('operationsService.getCourierShift(courierId)');
    expect(context).toContain('if (!shift.isOpen || !shift.startedAt)');
    expect(context).toContain('clearOperationalLists()');
    expect(context).toContain('belongsToCurrentShift(order.updated_at)');
    expect(context).toContain('belongsToCurrentShift(request.created_at)');
  });

  it('cierra turnos al cerrar operaciones y no reutiliza turnos de otro día', () => {
    const migration = read(
      'supabase/migrations/20260722201000_close_courier_shifts_with_platform_operation.sql',
    );

    expect(migration).toContain('create or replace function public.close_platform_operation');
    expect(migration).toContain("where cs.status = 'open'");
    expect(migration).toContain('create or replace function public.start_courier_shift');
    expect(migration).toContain('and operation_day_id = v_operation_day_id');
    expect(migration).toContain('and cs.operation_day_id is distinct from v_operation_day_id');
  });
});

describe('integridad estricta de roles', () => {
  it('impide que el autorregistro cree silenciosamente un rol distinto', () => {
    const auth = read('src/lib/auth/supabase.ts');
    const profileRoute = read('src/app/api/profile/route.ts');

    expect(auth).toContain("if (credentials.role !== 'customer')");
    expect(auth).toContain("role: 'customer'");
    expect(profileRoute).toContain("body.role !== 'customer'");
    expect(profileRoute).toContain("role: 'customer'");
  });

  it('verifica el rol guardado y exige perfil operativo para repartidores', () => {
    const action = read('src/app/actions/admin-user-roles.ts');

    expect(action).toContain('setExactUserRoleAction');
    expect(action).toContain("if (role === 'courier')");
    expect(action).toContain(".from('drivers')");
    expect(action).toContain('verified?.role !== role');
    expect(action).toContain('await rollback()');
  });
});
