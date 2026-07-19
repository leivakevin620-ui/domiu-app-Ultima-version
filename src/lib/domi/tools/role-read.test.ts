import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'src/lib/domi/tools/role-read.ts'),
  'utf8',
);

describe('Domi multirole read isolation', () => {
  it('limita todas las consultas del negocio al tenant autenticado', () => {
    expect(source).toContain(".eq('business_id', context.tenantId)");
    expect(source).toContain("context.tenantType === 'business'");
    expect(source).toContain("context.tenantId !== context.userId");
  });

  it('limita asignaciones, ganancias e historial al repartidor autenticado', () => {
    expect(source).toContain(".eq('courier_id', context.userId)");
    expect(source).toContain(".eq('driver_id', context.userId)");
    expect(source).toContain(".is('courier_id', null)");
  });

  it('no incluye dirección de entrega en la herramienta de pedidos disponibles', () => {
    const availableStart = source.indexOf('async function courierAvailableOrders');
    const assignmentsStart = source.indexOf('async function courierAssignments');
    const availableSection = source.slice(availableStart, assignmentsStart);

    expect(availableSection).not.toContain('delivery_address_id');
    expect(availableSection).not.toContain(".from('addresses')");
    expect(availableSection).not.toContain('customer_phone');
  });

  it('enmascara correos antes de devolver auditorías administrativas', () => {
    expect(source).toContain('function maskEmail');
    expect(source).toContain('user: maskEmail(event.user_email)');
    expect(source).toContain('personalDataMasked: true');
  });

  it('mantiene las herramientas de esta fase como consultas de lectura', () => {
    expect(source).not.toMatch(/\.insert\s*\(/);
    expect(source).not.toMatch(/\.update\s*\(/);
    expect(source).not.toMatch(/\.delete\s*\(/);
    expect(source).not.toMatch(/\.upsert\s*\(/);
  });
});
