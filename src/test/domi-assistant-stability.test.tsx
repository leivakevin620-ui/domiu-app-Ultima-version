import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: {
    profile: null as Record<string, unknown> | null,
    isLoading: true,
    retrySession: vi.fn(),
  },
  cart: {
    businessId: null,
    businessName: null,
    items: [],
    itemCount: 0,
    subtotal: 0,
    isEmpty: true,
    addItem: vi.fn(),
    removeItem: vi.fn(),
    updateQuantity: vi.fn(),
    clearCart: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('@/contexts/CartContext', () => ({
  useCart: () => mocks.cart,
}));

import { DomiAssistantStable } from '@/components/domi/DomiAssistantStable';

function customerProfile() {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'cliente@domiu.test',
    role: 'customer',
    admin_role: null,
    first_name: 'Kevin',
    last_name: 'Leiva',
    phone: null,
    status: 'active',
    avatar_url: null,
    verified_at: null,
    phone_verified_at: null,
    email_verified_at: null,
    last_login_at: null,
    metadata: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

afterEach(() => {
  cleanup();
  mocks.auth.profile = null;
  mocks.auth.isLoading = true;
  mocks.auth.retrySession.mockClear();
});

describe('DomiAssistantStable', () => {
  it('mantiene el mismo orden de hooks al cargar, autenticar y cerrar sesión', async () => {
    const { rerender } = render(<DomiAssistantStable />);
    expect(screen.queryByRole('button', { name: 'Abrir Domi' })).not.toBeInTheDocument();

    mocks.auth.profile = customerProfile();
    mocks.auth.isLoading = false;

    expect(() => rerender(<DomiAssistantStable />)).not.toThrow();
    expect(await screen.findByRole('button', { name: 'Abrir Domi' })).toBeInTheDocument();

    mocks.auth.profile = null;
    expect(() => rerender(<DomiAssistantStable />)).not.toThrow();
    expect(screen.queryByRole('button', { name: 'Abrir Domi' })).not.toBeInTheDocument();
  });
});
