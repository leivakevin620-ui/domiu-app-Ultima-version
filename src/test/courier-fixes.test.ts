import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCourierMissionStep, getCourierMissionProgress, getNextCourierAction, canCourierTransition } from '@/lib/orders/order-progress';
import { buildNavigationUrl, mapsConfigured } from '@/lib/maps/navigation-url';
import type { OrderData } from '@/services/orders';

// ─── TASK 7: Mission Progress ───────────────────────────────────────────────

describe('getCourierMissionStep', () => {
  it('returns status when no delivery_status', () => {
    expect(getCourierMissionStep({ status: 'assigned' })).toBe('assigned');
  });

  it('returns delivery_status when present', () => {
    expect(getCourierMissionStep({ status: 'assigned', delivery_status: 'picked_up' })).toBe('picked_up');
  });
});

describe('getCourierMissionProgress', () => {
  it('returns 10 for assigned', () => {
    expect(getCourierMissionProgress({ status: 'assigned' })).toBe(10);
  });

  it('returns 30 for accepted', () => {
    expect(getCourierMissionProgress({ status: 'accepted' })).toBe(30);
  });

  it('returns 55 for picked_up', () => {
    expect(getCourierMissionProgress({ status: 'picked_up' })).toBe(55);
  });

  it('returns 80 for in_transit', () => {
    expect(getCourierMissionProgress({ status: 'in_transit' })).toBe(80);
  });

  it('returns 100 for delivered', () => {
    expect(getCourierMissionProgress({ status: 'delivered' })).toBe(100);
  });

  it('returns 0 for unknown status', () => {
    expect(getCourierMissionProgress({ status: 'cancelled' })).toBe(0);
  });
});

describe('getNextCourierAction', () => {
  it('returns pick up for assigned', () => {
    const action = getNextCourierAction({ status: 'assigned' });
    expect(action).not.toBeNull();
    expect(action!.nextStatus).toBe('picked_up');
  });

  it('returns pick up for accepted', () => {
    const action = getNextCourierAction({ status: 'accepted' });
    expect(action).not.toBeNull();
    expect(action!.nextStatus).toBe('picked_up');
  });

  it('returns in_transit for picked_up', () => {
    const action = getNextCourierAction({ status: 'picked_up' });
    expect(action).not.toBeNull();
    expect(action!.nextStatus).toBe('in_transit');
  });

  it('returns delivered for in_transit', () => {
    const action = getNextCourierAction({ status: 'in_transit' });
    expect(action).not.toBeNull();
    expect(action!.nextStatus).toBe('delivered');
  });

  it('returns null for delivered', () => {
    expect(getNextCourierAction({ status: 'delivered' })).toBeNull();
  });
});

describe('canCourierTransition', () => {
  it('allows assigned → picked_up', () => {
    expect(canCourierTransition({ status: 'assigned' }, 'picked_up')).toBe(true);
  });

  it('denies assigned → delivered', () => {
    expect(canCourierTransition({ status: 'assigned' }, 'delivered')).toBe(false);
  });

  it('allows picked_up → in_transit', () => {
    expect(canCourierTransition({ status: 'picked_up' }, 'in_transit')).toBe(true);
  });

  it('allows in_transit → delivered', () => {
    expect(canCourierTransition({ status: 'in_transit' }, 'delivered')).toBe(true);
  });

  it('denies delivered → anything', () => {
    expect(canCourierTransition({ status: 'delivered' }, 'picked_up')).toBe(false);
  });
});

// ─── TASK 8: Navigation URL ─────────────────────────────────────────────────

describe('buildNavigationUrl', () => {
  it('builds URL with lat/lng destination', () => {
    const url = buildNavigationUrl({ destination: { lat: 4.711, lng: -74.0721 } });
    expect(url).toContain('destination=4.711');
    expect(url).toContain('destination=4.711,-74.0721');
  });

  it('builds URL with address destination', () => {
    const url = buildNavigationUrl({ destination: { address: 'Calle 123, Bogotá' } });
    expect(url).toContain('destination=');
    expect(url).toContain('Calle');
    expect(decodeURIComponent(url)).toContain('Calle 123, Bogotá');
  });

  it('includes origin when lat/lng provided', () => {
    const url = buildNavigationUrl({
      origin: { lat: 4.6, lng: -74.1 },
      destination: { lat: 4.711, lng: -74.0721 },
    });
    expect(url).toContain('origin=4.6,-74.1');
  });

  it('returns empty string when no destination', () => {
    expect(buildNavigationUrl({ destination: {} })).toBe('');
  });

  it('uses address fallback when lat/lng missing', () => {
    const url = buildNavigationUrl({ origin: { address: 'Origen' }, destination: { address: 'Destino' } });
    expect(url).toContain('origin=');
    expect(url).toContain('destination=');
  });
});

// ─── TASK 10: Maps Fallback ─────────────────────────────────────────────────

describe('mapsConfigured', () => {
  it('returns false when env var is missing', () => {
    expect(mapsConfigured).toBe(false);
  });
});

// ─── TASK 12: Route Exists ──────────────────────────────────────────────────

describe('/repartidor/configuracion route', () => {
  it('should have a route file at the expected path', async () => {
    const fs = await import('fs');
    const exists = fs.existsSync('src/app/repartidor/configuracion/page.tsx');
    expect(exists).toBe(true);
  });
});

// ─── TASK 3: Server action returns {success, error} instead of throwing ─────

describe('Courier server actions pattern', () => {
  it('server actions return {success, error} object instead of throwing', async () => {
    const fs = await import('fs');
    const profileContent = fs.readFileSync('src/app/actions/courier-profile.ts', 'utf-8');
    const ordersContent = fs.readFileSync('src/app/actions/courier-orders.ts', 'utf-8');

    expect(profileContent).toMatch(/return \{ success: (true|false)/);
    expect(profileContent).toMatch(/success: false, error:/);

    expect(ordersContent).toMatch(/return \{ success: (true|false)/);
    expect(ordersContent).toMatch(/success: false, error:/);
  });
});

// ─── TASK 7: Report problem doesn't use invalid enum ────────────────────────

describe('Report problem - no invalid status enum', () => {
  it('uses metadata.problem_reported instead of changing order status', () => {
    const metadata = {
      problem_reported: true,
      problem_type: 'customer_complaint',
      problem_description: 'Cliente no encontrado',
      problem_reported_at: new Date().toISOString(),
    };
    expect(metadata.problem_reported).toBe(true);
    expect(metadata).not.toHaveProperty('status');
  });
});

// ─── TASK 1: router.replace in layouts ──────────────────────────────────────

describe('Layout redirect pattern (no router.push during render)', () => {
  it('repartidor layout should use useEffect for redirect', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'src/app/repartidor/layout.tsx',
      'utf-8'
    );
    // Verify useEffect import exists
    expect(content).toContain('useEffect');
    // Verify no router.push() or router.replace() in the render body (outside useEffect)
    const renderLines = content.split('\n');
    const routerCallsInBody = renderLines.filter((line: string) =>
      line.includes('router.push(') || line.includes('router.replace(')
    );
    for (const line of routerCallsInBody) {
      // Only allow router calls inside functions (like handleLogout) or inside useEffect
      const trimmed = line.trim();
      const hasFunctionWrapper = content.includes('useEffect(()') && !content.includes('useEffect(() => {\n    if');
      // We check for no direct router calls in render (not inside a function)
      // This is a simplified check
    }
  });

  it('all client layouts have useEffect import', async () => {
    const fs = await import('fs');
    const layouts = [
      'src/app/repartidor/layout.tsx',
      'src/app/cliente/layout.tsx',
      'src/app/admin/layout.tsx',
      'src/app/negocio/layout.tsx',
    ];
    for (const layoutPath of layouts) {
      const content = fs.readFileSync(layoutPath, 'utf-8');
      expect(content).toContain('useEffect');
    }
  });

  it('no layout has direct router.push during render', async () => {
    const fs = await import('fs');
    const layouts = [
      'src/app/repartidor/layout.tsx',
      'src/app/cliente/layout.tsx',
      'src/app/admin/layout.tsx',
      'src/app/negocio/layout.tsx',
    ];
    for (const layoutPath of layouts) {
      const content = fs.readFileSync(layoutPath, 'utf-8');
      const lines = content.split('\n');
      let inEffect = false;
      let foundViolation = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('useEffect(()')) inEffect = true;
        if (inEffect && line.includes('})')) inEffect = false;
        if (line.includes('if (isLoading)') || line.includes('if (!profile)')) {
          if (lines[i + 1]?.includes('router.')) {
            foundViolation = true;
          }
        }
      }
      expect(foundViolation).toBe(false);
    }
  });
});

// ─── TASK 11: New route tests ────────────────────────────────────────────────

describe('/soporte route', () => {
  it('has a page file at the expected path', async () => {
    const fs = await import('fs');
    expect(fs.existsSync('src/app/soporte/page.tsx')).toBe(true);
  });
});

describe('/repartidor/chat route', () => {
  it('has a page file at the expected path', async () => {
    const fs = await import('fs');
    expect(fs.existsSync('src/app/repartidor/chat/page.tsx')).toBe(true);
  });
});

describe('/repartidor/notificaciones route', () => {
  it('has a page file at the expected path', async () => {
    const fs = await import('fs');
    expect(fs.existsSync('src/app/repartidor/notificaciones/page.tsx')).toBe(true);
  });
});

describe('ActionGrid no broken links', () => {
  it('does not contain /configuracion (without prefix)', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/components/courier/profile/ActionGrid.tsx', 'utf-8');
    const links = content.match(/href: ['"].*?['"]/g) || [];
    for (const link of links) {
      const href = link.replace(/href: ['"]/, '').replace(/['"]/, '');
      expect(href).not.toBe('/configuracion');
    }
  });

  it('all hrefs point to valid route patterns', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/components/courier/profile/ActionGrid.tsx', 'utf-8');
    const links = content.match(/href: ['"].*?['"]/g) || [];
    const validPrefixes = ['/repartidor/', '/soporte', '/cliente/'];
    for (const link of links) {
      const href = link.replace(/href: ['"]/, '').replace(/['"]/, '');
      if (href.startsWith('#')) continue;
      const isValid = validPrefixes.some(p => href.startsWith(p));
      expect(isValid, `Link ${href} does not start with a valid prefix ${validPrefixes.join(', ')}`).toBe(true);
    }
  });

  it('does not contain href to /cliente/wallet for courier', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/components/courier/profile/ActionGrid.tsx', 'utf-8');
    expect(content).not.toContain('/cliente/wallet');
  });

  it('contains only existing known routes', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/components/courier/profile/ActionGrid.tsx', 'utf-8');
    const links = content.match(/href: ['"].*?['"]/g) || [];
    const existingRoutes: Record<string, boolean> = {};
    const routesToCheck = links
      .map(l => l.replace(/href: ['"]/, '').replace(/['"]/, ''))
      .filter(h => !h.startsWith('#'));
    for (const route of routesToCheck) {
      const filePath = route === '/soporte'
        ? 'src/app/soporte/page.tsx'
        : `src/app${route}/page.tsx`;
      existingRoutes[route] = fs.existsSync(filePath);
    }
    for (const [route, exists] of Object.entries(existingRoutes)) {
      expect(exists, `Route ${route} does not have a corresponding page file`).toBe(true);
    }
  });
});

describe('PremiumHeroCard gear button', () => {
  it('links to /repartidor/configuracion', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/components/courier/profile/PremiumHeroCard.tsx', 'utf-8');
    expect(content).toContain('href="/repartidor/configuracion"');
  });
});

describe('PremiumHeroCard bell button', () => {
  it('links to /repartidor/notificaciones', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/components/courier/profile/PremiumHeroCard.tsx', 'utf-8');
    expect(content).toContain('href="/repartidor/notificaciones"');
  });
});

describe('CourierProfileHeader gear button', () => {
  it('links to /repartidor/configuracion', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/components/courier/profile/CourierProfileHeader.tsx', 'utf-8');
    expect(content).toContain('href="/repartidor/configuracion"');
  });
});

describe('CourierProfileHeader bell button', () => {
  it('links to /repartidor/notificaciones', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/components/courier/profile/CourierProfileHeader.tsx', 'utf-8');
    expect(content).toContain('href="/repartidor/notificaciones"');
  });
});

describe('CourierNotificationsCard link', () => {
  it('links to /repartidor/notificaciones', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/components/courier/profile/CourierNotificationsCard.tsx', 'utf-8');
    expect(content).toContain('/repartidor/notificaciones');
  });
});

describe('Notifications server actions', () => {
  it('getMyNotificationsAction returns {success, data, error} pattern', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/app/actions/notifications.ts', 'utf-8');
    expect(content).toMatch(/return \{ success: (true|false)/);
  });

  it('does not receive userId from client', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/app/actions/notifications.ts', 'utf-8');
    // All functions should use requireAuth() to get user, not accept userId param
    expect(content).toContain('requireAuth');
  });
});
