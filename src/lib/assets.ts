export const ASSETS = {
  hero: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1920&h=800&fit=crop',

  categories: {
    hamburguesas: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=400&fit=crop',
    pizza: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=400&fit=crop',
    sushi: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&h=400&fit=crop',
    pollo: 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=400&h=400&fit=crop',
    postres: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&h=400&fit=crop',
    bebidas: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=400&fit=crop',
    supermercado: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=400&fit=crop',
    farmacia: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop',
  },

  promotions: {
    '50-off': 'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?w=600&h=400&fit=crop',
    envio_gratis: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=600&h=400&fit=crop',
    combos: 'https://images.unsplash.com/photo-1520201163981-8cc95007dd2e?w=600&h=400&fit=crop',
    primera_compra: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=400&fit=crop',
    fin_semana: 'https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=600&h=400&fit=crop',
  },

  businesses: {
    logo: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&h=200&fit=crop',
    banner: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&h=400&fit=crop',
  },

  placeholder: {
    business: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop',
    product: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop',
    logo: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=200&h=200&fit=crop',
  },
} as const;

export function asset(path: string, w = 400, h = 400): string {
  return `${path}?w=${w}&h=${h}&fit=crop`;
}
