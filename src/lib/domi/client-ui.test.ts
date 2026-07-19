import { describe, expect, it } from 'vitest';
import {
  getDomiRoleBasePath,
  normalizeDomiMessages,
  sanitizeDomiCart,
  sanitizeDomiNavigation,
} from '@/lib/domi/client-ui';

describe('Domi client UI security', () => {
  it('mantiene cada perfil dentro de su área autorizada', () => {
    expect(getDomiRoleBasePath('customer')).toBe('/cliente');
    expect(getDomiRoleBasePath('merchant')).toBe('/negocio');
    expect(getDomiRoleBasePath('courier')).toBe('/repartidor');
    expect(getDomiRoleBasePath('admin_financiero')).toBe('/admin');

    expect(
      sanitizeDomiNavigation(
        [
          { label: 'Mis pedidos', href: '/cliente/pedidos' },
          { label: 'Panel administrativo', href: '/admin' },
          { label: 'Sitio externo', href: 'https://example.com' },
        ],
        'customer',
      ),
    ).toEqual([{ label: 'Mis pedidos', href: '/cliente/pedidos' }]);
  });

  it('bloquea URLs externas, rutas escapadas y duplicadas', () => {
    expect(
      sanitizeDomiNavigation(
        [
          { label: 'Negocios', href: '/admin/negocios' },
          { label: 'Duplicado', href: '/admin/negocios' },
          { label: 'Escape', href: '/admin/../cliente' },
          { label: 'Protocol relative', href: '//evil.test/admin' },
          { label: 'Barra inversa', href: '/admin\\usuarios' },
        ],
        'admin',
      ),
    ).toEqual([{ label: 'Negocios', href: '/admin/negocios' }]);
  });

  it('filtra mensajes y acciones inválidas del historial', () => {
    expect(
      normalizeDomiMessages(
        [
          {
            id: '1',
            role: 'assistant',
            content: '  Revisa tus pedidos.  ',
            suggestedActions: [' Ver pedidos ', 7, ''],
            navigation: [{ label: 'Pedidos', href: '/repartidor/pedidos' }],
          },
          { role: 'system', content: 'No debe mostrarse' },
          { role: 'user', content: '   ' },
        ],
        'courier',
      ),
    ).toEqual([
      {
        id: '1',
        role: 'assistant',
        content: 'Revisa tus pedidos.',
        createdAt: undefined,
        suggestedActions: ['Ver pedidos'],
        navigation: [{ label: 'Pedidos', href: '/repartidor/pedidos' }],
      },
    ]);
  });

  it('envía al servidor únicamente UUID y cantidades válidas del carrito', () => {
    expect(
      sanitizeDomiCart({
        businessId: '550e8400-e29b-41d4-a716-446655440000',
        items: [
          {
            product: { id: '123e4567-e89b-42d3-a456-426614174000' },
            quantity: 2,
          },
          { product: { id: 'producto-demo' }, quantity: 1 },
          {
            product: { id: '123e4567-e89b-42d3-a456-426614174001' },
            quantity: 0,
          },
        ],
      }),
    ).toEqual({
      businessId: '550e8400-e29b-41d4-a716-446655440000',
      items: [{ productId: '123e4567-e89b-42d3-a456-426614174000', quantity: 2 }],
    });
  });
});
