import { describe, expect, it } from 'vitest';
import { classifyDomiAdvancedIntent } from '@/lib/domi/agent/intent-classifier';
import { parseDomiBudget } from '@/lib/domi/agent/text-utils';

const customer = {
  role: 'customer' as const,
  permissions: ['business.search', 'products.search', 'cart.read', 'orders.read', 'memory.manage'],
};

const admin = {
  role: 'admin' as const,
  permissions: ['operation.read', 'reports.read', 'audit.read'],
};

const courier = {
  role: 'courier' as const,
  permissions: ['assignments.read', 'delivery.read'],
};

describe('Domi advanced intent classifier', () => {
  it('interpreta cantidades colombianas con puntos y mil', () => {
    expect(parseDomiBudget('Tengo $30.000 para comer')).toBe(30000);
    expect(parseDomiBudget('máximo 45 mil')).toBe(45000);
    expect(parseDomiBudget('presupuesto 2500')).toBe(2500);
  });

  it('planifica recomendaciones con presupuesto', () => {
    const plan = classifyDomiAdvancedIntent(
      customer,
      'No sé qué comer. Tengo $30.000 y quiero una salchipapa',
    );
    expect(plan?.intent).toBe('budget_recommendation');
    expect(plan?.budget).toBe(30000);
    expect(plan?.query).toContain('salchipapa');
  });

  it('prepara carrito únicamente para cliente', () => {
    expect(classifyDomiAdvancedIntent(customer, 'Agrega la primera opción al carrito')?.intent)
      .toBe('prepare_order_draft');
    expect(classifyDomiAdvancedIntent(courier, 'Agrega la primera opción al carrito'))
      .toBeNull();
  });

  it('reconoce promociones direcciones y métodos de pago', () => {
    expect(classifyDomiAdvancedIntent(customer, 'Qué promociones hay hoy')?.intent)
      .toBe('promotions');
    expect(classifyDomiAdvancedIntent(customer, 'Muéstrame mis direcciones guardadas')?.intent)
      .toBe('addresses');
    expect(classifyDomiAdvancedIntent(customer, 'Cuáles son mis métodos de pago')?.intent)
      .toBe('payment_methods');
  });

  it('reconoce controles de voz proactividad y memoria en todos los perfiles', () => {
    expect(classifyDomiAdvancedIntent(courier, 'Desactiva la voz')?.intent)
      .toBe('voice_settings');
    expect(classifyDomiAdvancedIntent(admin, 'Configura las alertas de Domi')?.intent)
      .toBe('proactive_settings');
    expect(classifyDomiAdvancedIntent(customer, 'Olvida mi preferencia de salsa')?.intent)
      .toBe('memory_forget_specific');
    expect(classifyDomiAdvancedIntent(customer, 'Corrige mi preferencia: ahora sin salsa')?.intent)
      .toBe('memory_correct');
  });

  it('reserva evaluación global para administradores', () => {
    expect(classifyDomiAdvancedIntent(admin, 'Abre el panel de evaluación de Domi')?.intent)
      .toBe('admin_evaluation');
    expect(classifyDomiAdvancedIntent(customer, 'Abre el panel de evaluación de Domi'))
      .toBeNull();
  });
});
