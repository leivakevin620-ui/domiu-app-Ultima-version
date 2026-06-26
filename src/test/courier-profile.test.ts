import { describe, it, expect } from 'vitest';
import { getCourierLevel, getNextLevel, COURIER_LEVELS } from '@/services/courier-pro';
import { getInitials, formatCurrency } from '@/components/courier/profile/shared';

function calculateProScore(deliveries: number, rating: number, isVerified: boolean, seniorityMonths: number) {
  const scoreWeights = { deliveries: 0.25, rating: 0.35, verified: 0.20, seniority: 0.20 };
  const normalizedDeliveries = Math.min(deliveries / 1000, 1);
  const normalizedRating = rating / 5;
  const verifiedScore = isVerified ? 1 : 0;
  const normalizedSeniority = Math.min(seniorityMonths / 24, 1);
  return Math.round(
    (normalizedDeliveries * scoreWeights.deliveries +
      normalizedRating * scoreWeights.rating +
      verifiedScore * scoreWeights.verified +
      normalizedSeniority * scoreWeights.seniority) * 100
  );
}

function validateVehicleType(type: string) {
  const validTypes = ['motorcycle', 'bike', 'car', 'truck', 'scooter'];
  return validTypes.includes(type);
}

function validatePlate(plate: string) {
  return /^[A-Za-z0-9]{5,7}$/.test(plate);
}

function validateAvatarFile(file: { type: string; size: number }) {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  return validTypes.includes(file.type) && file.size <= 2 * 1024 * 1024;
}

function generateNavigationUrl(lat?: number | null, lng?: number | null, address?: string | null): string {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  if (address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  }
  return '';
}

function toggleChecklistItem(items: Record<string, boolean>, key: string): Record<string, boolean> {
  return { ...items, [key]: !items[key] };
}

function validateIncidentPayload(payload: { incident_type: string; severity: string; description?: string }) {
  const validTypes = ['accident', 'traffic_violation', 'customer_complaint', 'order_issue', 'vehicle_issue', 'other'];
  const validSeverities = ['minor', 'moderate', 'severe', 'critical'];
  return validTypes.includes(payload.incident_type) && validSeverities.includes(payload.severity);
}

function aggregateEarnings(earnings: { total_earned: number }[]) {
  return earnings.reduce((sum, e) => sum + e.total_earned, 0);
}

function getPublicPreview(fields: Record<string, unknown>): Record<string, unknown> {
  const publicFields = ['avatar_url', 'first_name', 'last_name', 'avg_rating', 'vehicle_type', 'vehicle_plate', 'status', 'is_verified', 'completed_deliveries'];
  const sensitiveFields = ['email', 'phone', 'bank_account', 'emergency_contact', 'license_number', 'metadata.document'];
  const preview: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (publicFields.includes(key) && !sensitiveFields.includes(key)) {
      preview[key] = value;
    }
  }
  if (preview.vehicle_plate && typeof preview.vehicle_plate === 'string') {
    preview.vehicle_plate = preview.vehicle_plate.slice(0, 3) + '***';
  }
  return preview;
}

function canEditProfile(userId: string | null, profileId: string | null): boolean {
  if (!userId || !profileId) return false;
  return userId === profileId;
}

function canViewAdminDetail(userRole: string | null): boolean {
  if (!userRole) return false;
  const adminRoles = ['super_admin', 'admin_general', 'admin_financiero', 'admin_operativo', 'admin_comercial', 'admin_soporte', 'admin'];
  return adminRoles.includes(userRole);
}

describe('Pro Score Calculation', () => {
  it('returns Novato for 0 deliveries', () => {
    expect(getCourierLevel(0).title).toBe('Novato');
  });

  it('returns Bronce for 10-49 deliveries', () => {
    expect(getCourierLevel(10).title).toBe('Bronce');
    expect(getCourierLevel(49).title).toBe('Bronce');
  });

  it('returns Plata for 50-149 deliveries', () => {
    expect(getCourierLevel(50).title).toBe('Plata');
    expect(getCourierLevel(149).title).toBe('Plata');
  });

  it('returns Oro for 150-349 deliveries', () => {
    expect(getCourierLevel(150).title).toBe('Oro');
    expect(getCourierLevel(349).title).toBe('Oro');
  });

  it('returns Platino for 350-599 deliveries', () => {
    expect(getCourierLevel(350).title).toBe('Platino');
  });

  it('returns Diamante for 600-999 deliveries', () => {
    expect(getCourierLevel(600).title).toBe('Diamante');
  });

  it('returns Élite for 1000+ deliveries', () => {
    expect(getCourierLevel(1000).title).toBe('Élite');
    expect(getCourierLevel(9999).title).toBe('Élite');
  });

  it('next level returns the correct following level', () => {
    expect(getNextLevel(0)?.title).toBe('Bronce');
    expect(getNextLevel(10)?.title).toBe('Plata');
    expect(getNextLevel(50)?.title).toBe('Oro');
    expect(getNextLevel(150)?.title).toBe('Platino');
    expect(getNextLevel(350)?.title).toBe('Diamante');
    expect(getNextLevel(600)?.title).toBe('Élite');
    expect(getNextLevel(1000)).toBeNull();
  });

  it('levels have correct ordering and minDeliveries', () => {
    for (let i = 1; i < COURIER_LEVELS.length; i++) {
      expect(COURIER_LEVELS[i].minDeliveries).toBeGreaterThan(COURIER_LEVELS[i - 1].minDeliveries);
      expect(COURIER_LEVELS[i].level).toBe(COURIER_LEVELS[i - 1].level + 1);
    }
  });

  it('calculateProScore returns 0 for worst case', () => {
    expect(calculateProScore(0, 0, false, 0)).toBe(0);
  });

  it('calculateProScore returns 100 for best case', () => {
    expect(calculateProScore(1000, 5, true, 24)).toBeGreaterThanOrEqual(95);
    expect(calculateProScore(1000, 5, true, 24)).toBeLessThanOrEqual(100);
  });

  it('calculateProScore increases with verified status', () => {
    const unverified = calculateProScore(100, 4, false, 6);
    const verified = calculateProScore(100, 4, true, 6);
    expect(verified).toBeGreaterThan(unverified);
  });

  it('calculateProScore increases with more deliveries', () => {
    const low = calculateProScore(10, 4, true, 6);
    const high = calculateProScore(500, 4, true, 6);
    expect(high).toBeGreaterThan(low);
  });
});

describe('Vehicle Validation', () => {
  it('accepts valid vehicle types', () => {
    expect(validateVehicleType('motorcycle')).toBe(true);
    expect(validateVehicleType('bike')).toBe(true);
    expect(validateVehicleType('car')).toBe(true);
    expect(validateVehicleType('truck')).toBe(true);
    expect(validateVehicleType('scooter')).toBe(true);
  });

  it('rejects invalid vehicle types', () => {
    expect(validateVehicleType('')).toBe(false);
    expect(validateVehicleType('plane')).toBe(false);
    expect(validateVehicleType('boat')).toBe(false);
  });

  it('accepts valid plates (5-7 alphanumeric)', () => {
    expect(validatePlate('ABC123')).toBe(true);
    expect(validatePlate('AB1234')).toBe(true);
    expect(validatePlate('ABC12')).toBe(true);
    expect(validatePlate('ABC1234')).toBe(true);
  });

  it('rejects invalid plates', () => {
    expect(validatePlate('')).toBe(false);
    expect(validatePlate('AB')).toBe(false);
    expect(validatePlate('ABCD1234')).toBe(false);
    expect(validatePlate('ABC-123')).toBe(false);
  });
});

describe('Avatar File Validation', () => {
  it('accepts valid image types under 2MB', () => {
    expect(validateAvatarFile({ type: 'image/jpeg', size: 1 * 1024 * 1024 })).toBe(true);
    expect(validateAvatarFile({ type: 'image/png', size: 500 * 1024 })).toBe(true);
    expect(validateAvatarFile({ type: 'image/webp', size: 2 * 1024 * 1024 })).toBe(true);
  });

  it('rejects files over 2MB', () => {
    expect(validateAvatarFile({ type: 'image/jpeg', size: 3 * 1024 * 1024 })).toBe(false);
    expect(validateAvatarFile({ type: 'image/png', size: 2.5 * 1024 * 1024 })).toBe(false);
  });

  it('rejects invalid file types', () => {
    expect(validateAvatarFile({ type: 'application/pdf', size: 1024 })).toBe(false);
    expect(validateAvatarFile({ type: 'image/gif', size: 1024 })).toBe(false);
    expect(validateAvatarFile({ type: 'text/plain', size: 1024 })).toBe(false);
  });
});

describe('Navigation URL Generation', () => {
  it('generates Google Maps URL with lat/lng', () => {
    const url = generateNavigationUrl(19.4326, -99.1332);
    expect(url).toBe('https://www.google.com/maps/dir/?api=1&destination=19.4326,-99.1332');
  });

  it('generates Google Maps URL with address', () => {
    const url = generateNavigationUrl(null, null, 'Calle 123, Bogotá');
    expect(url).toBe('https://www.google.com/maps/dir/?api=1&destination=Calle%20123%2C%20Bogot%C3%A1');
  });

  it('returns empty string without coordinates or address', () => {
    expect(generateNavigationUrl()).toBe('');
  });

  it('favors lat/lng over address when both provided', () => {
    const url = generateNavigationUrl(4.71, -74.07, 'Calle 123');
    expect(url).toContain('destination=4.71,-74.07');
  });
});

describe('Checklist Status', () => {
  it('toggles unchecked item to checked', () => {
    const items = { item1: false, item2: true };
    const result = toggleChecklistItem(items, 'item1');
    expect(result.item1).toBe(true);
    expect(result.item2).toBe(true);
  });

  it('toggles checked item to unchecked', () => {
    const items = { item1: true };
    const result = toggleChecklistItem(items, 'item1');
    expect(result.item1).toBe(false);
  });

  it('does not mutate original object', () => {
    const items = { item1: false };
    const result = toggleChecklistItem(items, 'item1');
    expect(items.item1).toBe(false);
    expect(result.item1).toBe(true);
  });
});

describe('Incident Payload', () => {
  it('accepts valid incident types', () => {
    expect(validateIncidentPayload({ incident_type: 'accident', severity: 'minor' })).toBe(true);
    expect(validateIncidentPayload({ incident_type: 'customer_complaint', severity: 'severe' })).toBe(true);
    expect(validateIncidentPayload({ incident_type: 'other', severity: 'critical' })).toBe(true);
  });

  it('rejects invalid incident types', () => {
    expect(validateIncidentPayload({ incident_type: 'fraud', severity: 'minor' })).toBe(false);
    expect(validateIncidentPayload({ incident_type: '', severity: 'minor' })).toBe(false);
  });

  it('accepts all valid severities', () => {
    ['minor', 'moderate', 'severe', 'critical'].forEach((sev) => {
      expect(validateIncidentPayload({ incident_type: 'accident', severity: sev })).toBe(true);
    });
  });

  it('rejects invalid severity', () => {
    expect(validateIncidentPayload({ incident_type: 'accident', severity: 'extreme' })).toBe(false);
    expect(validateIncidentPayload({ incident_type: 'accident', severity: '' })).toBe(false);
  });
});

describe('Earnings Aggregation', () => {
  it('sums total_earned across entries', () => {
    const earnings = [
      { total_earned: 15000 },
      { total_earned: 25000 },
      { total_earned: 10000 },
    ];
    expect(aggregateEarnings(earnings)).toBe(50000);
  });

  it('returns 0 for empty array', () => {
    expect(aggregateEarnings([])).toBe(0);
  });

  it('handles single entry', () => {
    expect(aggregateEarnings([{ total_earned: 30000 }])).toBe(30000);
  });
});

describe('Privacy Preview', () => {
  it('includes public fields', () => {
    const result = getPublicPreview({
      first_name: 'Juan',
      last_name: 'Pérez',
      avg_rating: 4.5,
      vehicle_type: 'motorcycle',
    });
    expect(result.first_name).toBe('Juan');
    expect(result.last_name).toBe('Pérez');
    expect(result.avg_rating).toBe(4.5);
    expect(result.vehicle_type).toBe('motorcycle');
  });

  it('excludes sensitive fields', () => {
    const result = getPublicPreview({
      first_name: 'Juan',
      email: 'juan@test.com',
      phone: '3001234567',
      bank_account: { bank: 'Bancolombia', account: '1234' },
      emergency_contact: { name: 'María', phone: '3007654321' },
    });
    expect(result.first_name).toBe('Juan');
    expect(result.email).toBeUndefined();
    expect(result.phone).toBeUndefined();
    expect(result.bank_account).toBeUndefined();
    expect(result.emergency_contact).toBeUndefined();
  });

  it('masks plate to partial', () => {
    const result = getPublicPreview({ vehicle_plate: 'ABC123' });
    expect(result.vehicle_plate).toBe('ABC***');
  });

  it('returns empty object for only sensitive fields', () => {
    const result = getPublicPreview({ email: 'juan@test.com', phone: '3001234567' });
    expect(Object.keys(result)).toHaveLength(0);
  });
});

describe('Access Control', () => {
  it('allows profile owner to edit', () => {
    expect(canEditProfile('user-1', 'user-1')).toBe(true);
  });

  it('prevents other users from editing', () => {
    expect(canEditProfile('user-1', 'user-2')).toBe(false);
  });

  it('returns false when userId is null', () => {
    expect(canEditProfile(null, 'user-1')).toBe(false);
  });

  it('allows admin roles to view detail', () => {
    expect(canViewAdminDetail('super_admin')).toBe(true);
    expect(canViewAdminDetail('admin_general')).toBe(true);
    expect(canViewAdminDetail('admin_operativo')).toBe(true);
    expect(canViewAdminDetail('admin')).toBe(true);
  });

  it('prevents non-admin roles from viewing detail', () => {
    expect(canViewAdminDetail('courier')).toBe(false);
    expect(canViewAdminDetail('customer')).toBe(false);
    expect(canViewAdminDetail('merchant')).toBe(false);
  });

  it('returns false when role is null', () => {
    expect(canViewAdminDetail(null)).toBe(false);
  });
});

describe('Utility Functions', () => {
  describe('getInitials', () => {
    it('returns initials from first and last name', () => {
      expect(getInitials('Juan', 'Pérez')).toBe('JP');
    });

    it('returns single initial when only first name', () => {
      expect(getInitials('Juan')).toBe('J');
    });

    it('falls back to email initial', () => {
      expect(getInitials(null, null, 'juan@test.com')).toBe('J');
    });

    it('returns ? when nothing provided', () => {
      expect(getInitials()).toBe('?');
    });
  });

  describe('formatCurrency', () => {
    it('formats number as COP currency', () => {
      const result = formatCurrency(50000);
      expect(result).toContain('$');
      expect(result).toContain('50');
    });

    it('handles zero', () => {
      expect(formatCurrency(0)).toContain('$0');
    });
  });
});
