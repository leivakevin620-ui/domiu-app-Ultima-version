import { getBrowserClient } from '@/lib/db/supabase';

export interface MarketplaceBusiness {
  id: string;
  slug: string;
  name: string;
  description: string;
  logo_url: string | null;
  banner_url: string | null;
  category_id: string;
  category_name: string;
  rating: number;
  review_count: number;
  delivery_time: string;
  delivery_fee: string;
  is_open: boolean;
  is_featured: boolean;
  distance?: string;
}

export interface MarketplaceCategory {
  id: string;
  name: string;
  icon: string;
  business_count: number;
}

export interface MarketplaceProduct {
  id: string;
  business_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  is_available: boolean;
  category_name?: string;
}

const CUISINE_MAP: Record<string, { icon: string; id: string }> = {
  'Comida Rápida': { icon: '🍔', id: 'cat-1' },
  'Pizza': { icon: '🍕', id: 'cat-2' },
  'Sushi': { icon: '🍣', id: 'cat-3' },
  'Café': { icon: '☕', id: 'cat-4' },
  'Saludable': { icon: '🥗', id: 'cat-5' },
  'Mexicana': { icon: '🌮', id: 'cat-6' },
  'Helados': { icon: '🍦', id: 'cat-7' },
  'Mariscos': { icon: '🦐', id: 'cat-8' },
  'Italiana': { icon: '🍝', id: 'cat-9' },
  'Asiática': { icon: '🥟', id: 'cat-10' },
};

function mapBusinessToUI(biz: any): MarketplaceBusiness {
  const cuisineInfo = biz.cuisine_type ? CUISINE_MAP[biz.cuisine_type] : undefined;
  return {
    id: biz.id,
    slug: biz.slug,
    name: biz.name,
    description: biz.description ?? '',
    logo_url: biz.logo_url,
    banner_url: biz.banner_url,
    category_id: cuisineInfo?.id ?? 'cat-other',
    category_name: biz.cuisine_type ?? 'Otros',
    rating: biz.rating,
    review_count: biz.total_ratings,
    delivery_time: biz.metadata?.delivery_time ?? '20-35 min',
    delivery_fee: biz.metadata?.delivery_fee ?? '$2.50',
    is_open: biz.is_active,
    is_featured: biz.is_verified || false,
  };
}

function mapProductToUI(prod: any): MarketplaceProduct {
  return {
    id: prod.id,
    business_id: prod.business_id,
    name: prod.name,
    description: prod.description ?? '',
    price: prod.discount_price ?? prod.price,
    image_url: null,
    is_available: prod.status === 'available' || prod.status === ('discontinued' as any),
    category_name: undefined,
  };
}

async function getClient() {
  return getBrowserClient();
}

export const marketplaceService = {
  getCategories: async (): Promise<MarketplaceCategory[]> => {
    const supabase = await getClient();
    const { data: businesses } = await supabase.from('businesses').select('cuisine_type').eq('is_active', true);
    if (!businesses) return [];
    const typeMap = new Map<string, number>();
    (businesses as Array<{ cuisine_type: string | null }>).forEach((b: { cuisine_type: string | null }) => {
      if (b.cuisine_type) {
        typeMap.set(b.cuisine_type, (typeMap.get(b.cuisine_type) ?? 0) + 1);
      }
    });
    return Array.from(typeMap.entries())
      .map(([name, count]) => {
        const info = CUISINE_MAP[name] ?? { icon: '🍽️', id: `cat-${name.toLowerCase().replace(/\s+/g, '-')}` };
        return { id: info.id, name, icon: info.icon, business_count: count };
      })
      .sort((a, b) => b.business_count - a.business_count);
  },

  getCategoryById: async (id: string): Promise<MarketplaceCategory | null> => {
    const categories = await marketplaceService.getCategories();
    return categories.find((c) => c.id === id) ?? null;
  },

  getBusinesses: async (options?: { categoryId?: string; featured?: boolean; isOpen?: boolean }): Promise<MarketplaceBusiness[]> => {
    const supabase = await getClient();
    let query = supabase.from('businesses').select('*').eq('is_active', true);
    if (options?.featured) {
      query = query.eq('is_verified', true);
    }
    const { data } = await query.order('rating', { ascending: false });
    if (!data) return [];
    let result = (data as any[]).map(mapBusinessToUI);
    if (options?.categoryId) {
      const cuisineName = Object.entries(CUISINE_MAP).find(([, v]) => v.id === options.categoryId)?.[0];
      if (cuisineName) {
        result = result.filter((b: { category_name: string }) => b.category_name === cuisineName);
      }
    }
    if (options?.isOpen) {
      result = result.filter((b: { is_open: boolean }) => b.is_open);
    }
    return result;
  },

  getBusinessBySlug: async (slug: string): Promise<MarketplaceBusiness | null> => {
    const supabase = await getClient();
    const { data } = await supabase.from('businesses').select('*').eq('slug', slug).single();
    if (!data) return null;
    return mapBusinessToUI(data);
  },

  getBusinessById: async (id: string): Promise<MarketplaceBusiness | null> => {
    const supabase = await getClient();
    const { data } = await supabase.from('businesses').select('*').eq('id', id).single();
    if (!data) return null;
    return mapBusinessToUI(data);
  },

  getProducts: async (businessId: string): Promise<MarketplaceProduct[]> => {
    const supabase = await getClient();
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .order('name');
    if (!data) return [];
    return data.map(mapProductToUI);
  },

  getProductById: async (id: string): Promise<MarketplaceProduct | null> => {
    const supabase = await getClient();
    const { data } = await supabase.from('products').select('*').eq('id', id).single();
    if (!data) return null;
    return mapProductToUI(data);
  },

  search: async (query: string): Promise<{ businesses: MarketplaceBusiness[]; products: MarketplaceProduct[] }> => {
    const q = query.toLowerCase().trim();
    if (!q) return { businesses: [], products: [] };
    const supabase = await getClient();
    const [bizResult, prodResult] = await Promise.all([
      supabase.from('businesses').select('*').ilike('name', `%${q}%`).eq('is_active', true).limit(10),
      supabase.from('products').select('*').ilike('name', `%${q}%`).limit(20),
    ]);
    return {
      businesses: (bizResult.data ?? []).map(mapBusinessToUI),
      products: (prodResult.data ?? []).map(mapProductToUI),
    };
  },

  getBusinessesByCategory: async (categoryId: string): Promise<MarketplaceBusiness[]> => {
    return marketplaceService.getBusinesses({ categoryId });
  },

  getFeaturedBusinesses: async (): Promise<MarketplaceBusiness[]> => {
    return marketplaceService.getBusinesses({ featured: true });
  },

  getRecommendedBusinesses: async (): Promise<MarketplaceBusiness[]> => {
    const supabase = await getClient();
    const { data } = await supabase
      .from('businesses')
      .select('*')
      .eq('is_active', true)
      .order('rating', { ascending: false })
      .limit(4);
    if (!data) return [];
    return data.map(mapBusinessToUI);
  },

  getCategoriesWithBusinesses: async (): Promise<(MarketplaceCategory & { businesses: MarketplaceBusiness[] })[]> => {
    const [categories, businesses] = await Promise.all([
      marketplaceService.getCategories(),
      marketplaceService.getBusinesses(),
    ]);
    return categories.map((cat) => ({
      ...cat,
      businesses: businesses.filter((b) => b.category_id === cat.id),
    }));
  },
};
