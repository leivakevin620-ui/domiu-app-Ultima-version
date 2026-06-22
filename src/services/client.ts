import { getBrowserClient } from '@/lib/db/supabase';

export type PointTransactionType = 'earned' | 'spent' | 'expired';

export interface ClientProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  status: string;
}

export interface ClientStats {
  totalOrders: number;
  totalSpent: number;
  totalSavings: number;
  loyaltyPoints: number;
  activeCoupons: number;
  memberSince: string;
  tier: string;
  nextTier: string;
  tierProgress: number;
}

export interface FavoriteItem {
  id: string;
  user_id: string;
  business_id: string | null;
  product_id: string | null;
  created_at: string;
  business?: {
    id: string;
    name: string;
    slug: string;
    rating: number;
    cuisine_type: string;
    image_url: string | null;
    is_active: boolean;
  } | null;
  product?: {
    id: string;
    name: string;
    price: number;
    discount_price: number | null;
    image_url: string | null;
    status: string;
    business_id: string;
    business_name?: string;
    business_slug?: string;
  } | null;
}

export interface ClientAddress {
  id: string;
  type: string;
  street_address: string;
  city: string;
  state_province: string | null;
  postal_code: string | null;
  country: string;
  lat?: number | null;
  lng?: number | null;
  is_primary: boolean;
  label?: string;
}

export interface PaymentMethod {
  id: string;
  type: string;
  brand: string | null;
  last_four: string | null;
  holder_name: string | null;
  expires_at: string | null;
  is_default: boolean;
  is_active: boolean;
}

export interface LoyaltySummary {
  totalPoints: number;
  lifetimePoints: number;
  tier: string;
  nextTier: string;
  tierProgress: number;
  pointsToNextTier: number;
  recentTransactions: LoyaltyTransaction[];
}

export interface LoyaltyTransaction {
  id: string;
  points: number;
  reason: string;
  reference_type: string | null;
  created_at: string;
}

export interface Reward {
  id: string;
  title: string;
  description: string | null;
  points_required: number;
  type: string;
  value: number | null;
  stock: number | null;
  image_url: string | null;
  is_active: boolean;
}

export interface RewardRedemption {
  id: string;
  reward_id: string;
  reward_title: string;
  points_spent: number;
  status: string;
  created_at: string;
  completed_at: string | null;
}

export interface ReferralInfo {
  id: string;
  code: string;
  status: string;
  reward_given: boolean;
  created_at: string;
  converted_at: string | null;
  referred?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

export interface WalletInfo {
  id: string;
  balance: number;
  currency: string;
  total_credited: number;
  total_debited: number;
}

export interface WalletTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  status: string;
  reference_type: string | null;
  description?: string;
  created_at: string;
}

export interface CouponAvailable {
  id: string;
  code: string;
  type: string;
  value: number;
  max_discount: number | null;
  min_amount: number;
  description: string | null;
  expires_at: string | null;
  usage_count?: number;
}

export interface CouponUsageRecord {
  id: string;
  coupon_id: string;
  discount_amount: number;
  created_at: string;
  coupon?: { code: string; type: string };
}

export interface NotificationItem {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  description: string | null;
  image_url: string | null;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AppSettings {
  language: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  orderUpdates: boolean;
  promotions: boolean;
  paymentAlerts: boolean;
}

export interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const FAQ_DATA: FAQItem[] = [
  { category: 'pedidos', question: '¿Cómo hago un pedido?', answer: 'Explora restaurantes cercanos, selecciona tus productos, agrégalos al carrito y procede al checkout. Elige tu método de pago y confirma tu pedido.' },
  { category: 'pedidos', question: '¿Puedo cancelar un pedido?', answer: 'Puedes cancelar un pedido mientras esté en estado "Pendiente". Una vez que el negocio lo confirme, ya no será posible cancelarlo.' },
  { category: 'pedidos', question: '¿Cómo rastreo mi pedido?', answer: 'Ve a la sección "Mis Pedidos" y selecciona el pedido activo. Verás un mapa en tiempo real con la ubicación del repartidor.' },
  { category: 'pagos', question: '¿Qué métodos de pago aceptan?', answer: 'Aceptamos tarjetas de crédito/débito, Nequi, Daviplata, PSE y pago en efectivo contra entrega.' },
  { category: 'pagos', question: '¿Es seguro pagar en la app?', answer: 'Sí, todos los pagos están protegidos con encriptación SSL y cumplen con los estándares de seguridad PCI.' },
  { category: 'entregas', question: '¿Cuánto tarda la entrega?', answer: 'El tiempo estimado de entrega varía según el restaurante y tu ubicación. Generalmente entre 30-60 minutos.' },
  { category: 'entregas', question: '¿El envío es gratis?', answer: 'Algunos restaurantes ofrecen envío gratis en pedidos que superen cierto monto. Revisa los cupones disponibles para obtener envío gratis.' },
  { category: 'cuenta', question: '¿Cómo cambio mi contraseña?', answer: 'Ve a Configuración > Seguridad y selecciona "Cambiar contraseña". Te enviaremos un enlace a tu correo.' },
  { category: 'cuenta', question: '¿Cómo elimino mi cuenta?', answer: 'En Configuración > Cuenta encontrarás la opción "Eliminar cuenta". Esta acción es irreversible.' },
  { category: 'fidelidad', question: '¿Cómo funcionan los puntos?', answer: 'Ganas 1 punto por cada $1 gastado. Canjea tus puntos por descuentos y beneficios en la sección de Fidelización.' },
  { category: 'fidelidad', question: '¿Los puntos expiran?', answer: 'Los puntos tienen una validez de 12 meses desde que se generan. Revisa tu saldo en la sección de Fidelización.' },
  { category: 'repartidor', question: '¿Puedo contactar al repartidor?', answer: 'Sí, una vez que un repartidor es asignado a tu pedido, puedes usar el chat en vivo desde la pantalla de seguimiento.' },
];

function getBrowserClientCached() {
  return getBrowserClient();
}

import { getCached, setCache, clearCache } from '@/lib/supabase-cache';

export const clientService = {
  // ============================================================
  // PROFILE
  // ============================================================
  async getProfile(userId: string): Promise<ClientProfile | null> {
    const cacheKey = `profile:${userId}`;
    const cached = getCached<ClientProfile | null>(cacheKey);
    if (cached !== null) return cached;
    const supabase = getBrowserClientCached();
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, phone, avatar_url, status')
      .eq('id', userId)
      .single();
    const result = data as ClientProfile | null;
    if (result) setCache(cacheKey, result, 300_000);
    return result;
  },

  async updateProfile(userId: string, updates: Partial<ClientProfile>): Promise<void> {
    const supabase = getBrowserClientCached();
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);
    if (error) throw new Error(error.message);
    clearCache(`profile:${userId}`);
  },

  async getStats(userId: string): Promise<ClientStats> {
    const supabase = getBrowserClientCached();
    const [ordersRes, pointsRes, couponsRes, profileRes] = await Promise.all([
      supabase.from('orders').select('id, total_amount, created_at, status').eq('customer_id', userId),
      supabase.rpc('get_loyalty_balance', { p_user_id: userId }),
      supabase.from('coupon_usage').select('id').eq('user_id', userId),
      supabase.from('profiles').select('created_at').eq('id', userId).single(),
    ]);

    const orders = (ordersRes.data ?? []) as Record<string, unknown>[];
    const totalOrders = orders.length;
    const totalSpent = orders.reduce((s, o) => s + Number((o as { total_amount: number }).total_amount), 0);
    const totalSavings = orders.filter((o) => o.status === 'delivered').length * 2;
    const totalPoints = (pointsRes.data as number) ?? 0;
    const activeCoupons = (couponsRes.data ?? []).length;

    let tier = 'Bronce';
    let nextTier = 'Plata';
    let tierProgress = 0;
    if (totalPoints >= 1000) { tier = 'Élite'; nextTier = 'Máximo'; tierProgress = 100; }
    else if (totalPoints >= 500) { tier = 'Oro'; nextTier = 'Élite'; tierProgress = ((totalPoints - 500) / 500) * 100; }
    else if (totalPoints >= 200) { tier = 'Plata'; nextTier = 'Oro'; tierProgress = ((totalPoints - 200) / 300) * 100; }
    else { tierProgress = (totalPoints / 200) * 100; }

    return {
      totalOrders,
      totalSpent,
      totalSavings,
      loyaltyPoints: totalPoints,
      activeCoupons,
      memberSince: ((profileRes.data as unknown as Record<string, unknown>)?.created_at as string) ?? new Date().toISOString(),
      tier,
      nextTier,
      tierProgress: Math.min(tierProgress, 100),
    };
  },

  // ============================================================
  // FAVORITES
  // ============================================================
  async getFavorites(userId: string): Promise<FavoriteItem[]> {
    const supabase = getBrowserClientCached();
    const { data } = await supabase
      .from('customer_favorites')
      .select(`
        id, user_id, business_id, product_id, created_at,
        business:businesses(id, name, slug, rating, cuisine_type, image_url, is_active),
        product:products(id, name, price, discount_price, image_url, status, business_id)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return (data ?? []) as unknown as FavoriteItem[];
  },

  async addFavorite(userId: string, target: { businessId?: string; productId?: string }): Promise<void> {
    const supabase = getBrowserClientCached();
    const { error } = await supabase.from('customer_favorites').insert({
      user_id: userId,
      business_id: target.businessId ?? null,
      product_id: target.productId ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async removeFavorite(favoriteId: string): Promise<void> {
    const supabase = getBrowserClientCached();
    const { error } = await supabase.from('customer_favorites').delete().eq('id', favoriteId);
    if (error) throw new Error(error.message);
  },

  async checkFavorite(userId: string, target: { businessId?: string; productId?: string }): Promise<boolean> {
    const supabase = getBrowserClientCached();
    let query = supabase
      .from('customer_favorites')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (target.businessId) query = query.eq('business_id', target.businessId).is('product_id', null);
    else if (target.productId) query = query.eq('product_id', target.productId).is('business_id', null);
    const { count } = await query;
    return (count ?? 0) > 0;
  },

  async toggleFavorite(userId: string, target: { businessId?: string; productId?: string }): Promise<boolean> {
    const isFav = await clientService.checkFavorite(userId, target);
    if (isFav) {
      const supabase = getBrowserClientCached();
      let query = supabase.from('customer_favorites').delete().eq('user_id', userId);
      if (target.businessId) query = query.eq('business_id', target.businessId).is('product_id', null);
      else if (target.productId) query = query.eq('product_id', target.productId).is('business_id', null);
      await query;
      return false;
    }
    await clientService.addFavorite(userId, target);
    return true;
  },

  // ============================================================
  // ADDRESSES
  // ============================================================
  async getAddresses(userId: string): Promise<ClientAddress[]> {
    const supabase = getBrowserClientCached();
    const { data } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false });
    return (data ?? []) as ClientAddress[];
  },

  async createAddress(userId: string, address: Omit<ClientAddress, 'id'>): Promise<string> {
    const supabase = getBrowserClientCached();
    if (address.is_primary) {
      await supabase.from('addresses').update({ is_primary: false }).eq('user_id', userId).eq('is_primary', true);
    }
    const { data, error } = await supabase
      .from('addresses')
      .insert({ user_id: userId, ...address })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return data.id;
  },

  async updateAddress(addressId: string, userId: string, updates: Partial<ClientAddress>): Promise<void> {
    const supabase = getBrowserClientCached();
    if (updates.is_primary) {
      await supabase.from('addresses').update({ is_primary: false }).eq('user_id', userId).eq('is_primary', true);
    }
    const { error } = await supabase.from('addresses').update(updates).eq('id', addressId);
    if (error) throw new Error(error.message);
  },

  async deleteAddress(addressId: string): Promise<void> {
    const supabase = getBrowserClientCached();
    const { error } = await supabase.from('addresses').delete().eq('id', addressId);
    if (error) throw new Error(error.message);
  },

  async setDefaultAddress(addressId: string, userId: string): Promise<void> {
    const supabase = getBrowserClientCached();
    await supabase.from('addresses').update({ is_primary: false }).eq('user_id', userId).eq('is_primary', true);
    const { error } = await supabase.from('addresses').update({ is_primary: true }).eq('id', addressId);
    if (error) throw new Error(error.message);
  },

  // ============================================================
  // PAYMENT METHODS
  // ============================================================
  async getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    const supabase = getBrowserClientCached();
    const { data } = await supabase
      .from('customer_payment_methods')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    return (data ?? []) as PaymentMethod[];
  },

  async createPaymentMethod(userId: string, method: Omit<PaymentMethod, 'id' | 'is_active'>): Promise<string> {
    const supabase = getBrowserClientCached();
    if (method.is_default) {
      await supabase.from('customer_payment_methods').update({ is_default: false }).eq('user_id', userId);
    }
    const { data, error } = await supabase
      .from('customer_payment_methods')
      .insert({ user_id: userId, ...method })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return data.id;
  },

  async updatePaymentMethod(methodId: string, userId: string, updates: Partial<PaymentMethod>): Promise<void> {
    const supabase = getBrowserClientCached();
    if (updates.is_default) {
      await supabase.from('customer_payment_methods').update({ is_default: false }).eq('user_id', userId);
    }
    const { error } = await supabase.from('customer_payment_methods').update(updates).eq('id', methodId);
    if (error) throw new Error(error.message);
  },

  async deletePaymentMethod(methodId: string): Promise<void> {
    const supabase = getBrowserClientCached();
    const { error } = await supabase.from('customer_payment_methods').update({ is_active: false }).eq('id', methodId);
    if (error) throw new Error(error.message);
  },

  // ============================================================
  // COUPONS
  // ============================================================
  async getAvailableCoupons(): Promise<CouponAvailable[]> {
    const supabase = getBrowserClientCached();
    const now = new Date().toISOString();
    const { data } = await supabase
      .from('coupons')
      .select('*')
      .eq('is_active', true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`expires_at.is.null,expires_at.gte.${now}`)
      .order('created_at', { ascending: false });
    return (data ?? []) as CouponAvailable[];
  },

  async getCouponUsage(userId: string): Promise<CouponUsageRecord[]> {
    const supabase = getBrowserClientCached();
    const { data } = await supabase
      .from('coupon_usage')
      .select('id, coupon_id, discount_amount, created_at, coupon:coupons(code, type)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return (data ?? []) as unknown as CouponUsageRecord[];
  },

  // ============================================================
  // LOYALTY
  // ============================================================
  async getLoyaltySummary(userId: string): Promise<LoyaltySummary> {
    const supabase = getBrowserClientCached();
    const [pointsRes, recentRes] = await Promise.all([
      supabase.rpc('get_loyalty_balance', { p_user_id: userId }),
      supabase
        .from('loyalty_points')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const totalPoints = (pointsRes.data as number) ?? 0;
    const recent = (recentRes.data ?? []) as Record<string, unknown>[];
    const lifetimePoints = recent.reduce((s, r) => (r.points as number) > 0 ? s + (r.points as number) : s, 0);

    let tier = 'Bronce';
    let nextTier = 'Plata';
    let tierProgress = 0;
    let pointsToNextTier = 200;
    if (totalPoints >= 1000) { tier = 'Élite'; nextTier = 'Máximo'; pointsToNextTier = 0; tierProgress = 100; }
    else if (totalPoints >= 500) { tier = 'Oro'; nextTier = 'Élite'; pointsToNextTier = 1000 - totalPoints; tierProgress = ((totalPoints - 500) / 500) * 100; }
    else if (totalPoints >= 200) { tier = 'Plata'; nextTier = 'Oro'; pointsToNextTier = 500 - totalPoints; tierProgress = ((totalPoints - 200) / 300) * 100; }
    else { pointsToNextTier = 200 - totalPoints; tierProgress = (totalPoints / 200) * 100; }

    return {
      totalPoints,
      lifetimePoints,
      tier,
      nextTier,
      tierProgress: Math.min(tierProgress, 100),
      pointsToNextTier: Math.max(pointsToNextTier, 0),
      recentTransactions: recent.map(r => ({
        id: r.id as string,
        points: r.points as number,
        reason: r.reason as string,
        reference_type: r.reference_type as string | null,
        created_at: r.created_at as string,
      })),
    };
  },

  async getRewards(): Promise<Reward[]> {
    const supabase = getBrowserClientCached();
    const { data } = await supabase
      .from('rewards')
      .select('*')
      .eq('is_active', true)
      .order('points_required', { ascending: true });
    return (data ?? []) as Reward[];
  },

  async redeemReward(userId: string, rewardId: string): Promise<void> {
    const supabase = getBrowserClientCached();
    const [rewardRes, balanceRes] = await Promise.all([
      supabase.from('rewards').select('*').eq('id', rewardId).single(),
      supabase.rpc('get_loyalty_balance', { p_user_id: userId }),
    ]);
    const reward = rewardRes.data as Reward | null;
    if (!reward) throw new Error('Recompensa no encontrada');
    const balance = (balanceRes.data as number) ?? 0;
    if (balance < reward.points_required) throw new Error('Puntos insuficientes');

    const { error: insertErr } = await supabase.from('reward_redemptions').insert({
      reward_id: rewardId,
      user_id: userId,
      points_spent: reward.points_required,
      status: 'pending',
    });
    if (insertErr) throw new Error(insertErr.message);

    await supabase.from('loyalty_points').insert({
      user_id: userId,
      points: -reward.points_required,
      reason: `Canje: ${reward.title}`,
      reference_id: rewardId,
      reference_type: 'reward',
    });
  },

  async getRedemptions(userId: string): Promise<RewardRedemption[]> {
    const supabase = getBrowserClientCached();
    const { data } = await supabase
      .from('reward_redemptions')
      .select('id, reward_id, points_spent, status, created_at, completed_at, rewards!reward_id(title)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    type RedemptionRow = Record<string, unknown> & { rewards?: { title: string } };
    return ((data ?? []) as unknown as RedemptionRow[]).map(r => ({
      id: r.id as string,
      reward_id: r.reward_id as string,
      reward_title: r.rewards?.title ?? 'Recompensa',
      points_spent: r.points_spent as number,
      status: r.status as string,
      created_at: r.created_at as string,
      completed_at: r.completed_at as string | null,
    }));
  },

  // ============================================================
  // REFERRALS
  // ============================================================
  async getReferralInfo(userId: string): Promise<{ code: string; totalReferrals: number; convertedReferrals: number; earnings: number }> {
    const supabase = getBrowserClientCached();
    const [referralRes] = await Promise.all([
      supabase.from('referrals').select('*, referred:profiles!referred_id(first_name, last_name)').eq('referrer_id', userId).order('created_at', { ascending: false }),
    ]);

    const referrals = (referralRes.data ?? []) as Record<string, unknown>[];
    const active = referrals.find((r) => r.code && !r.referred_id) ?? referrals[0];
    return {
      code: (active?.code as string) ?? '',
      totalReferrals: referrals.length,
      convertedReferrals: referrals.filter((r) => r.status === 'converted').length,
      earnings: referrals.filter((r) => r.reward_given).length * 5,
    };
  },

  // ============================================================
  // WALLET
  // ============================================================
  async getWallet(userId: string): Promise<WalletInfo | null> {
    const supabase = getBrowserClientCached();
    const { data } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single();
    return data as WalletInfo | null;
  },

  async getWalletTransactions(walletId: string): Promise<WalletTransaction[]> {
    const supabase = getBrowserClientCached();
    const { data } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_id', walletId)
      .order('created_at', { ascending: false });
    return ((data ?? []) as Record<string, unknown>[]).map(t => ({
      id: t.id as string,
      transaction_type: t.transaction_type as string,
      amount: Number(t.amount),
      balance_before: Number(t.balance_before),
      balance_after: Number(t.balance_after),
      status: t.status as string,
      reference_type: t.reference_type as string | null,
      description: (t.description as string | undefined) ?? undefined,
      created_at: t.created_at as string,
    }));
  },

  // ============================================================
  // NOTIFICATIONS
  // ============================================================
  async getNotifications(userId: string, limit = 50): Promise<NotificationItem[]> {
    const supabase = getBrowserClientCached();
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data ?? []) as NotificationItem[];
  },

  async markNotificationRead(notificationId: string): Promise<void> {
    const supabase = getBrowserClientCached();
    await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
  },

  async markAllNotificationsRead(userId: string): Promise<void> {
    const supabase = getBrowserClientCached();
    await supabase.from('notifications').update({ is_read: true }).eq('recipient_id', userId).eq('is_read', false);
  },

  async getUnreadCount(userId: string): Promise<number> {
    const supabase = getBrowserClientCached();
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('is_read', false)
      .is('deleted_at', null);
    return count ?? 0;
  },

  // ============================================================
  // FAQ
  // ============================================================
  getFAQ(): FAQItem[] {
    return FAQ_DATA;
  },

  getFAQByCategory(category: string): FAQItem[] {
    return FAQ_DATA.filter(f => f.category === category);
  },

  getFAQCategories(): string[] {
    return [...new Set(FAQ_DATA.map(f => f.category))];
  },

  // ============================================================
  // APP SETTINGS
  // ============================================================
  async getSettings(userId: string): Promise<AppSettings> {
    const supabase = getBrowserClientCached();
    const { data } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();
    const prefs = data as Record<string, unknown> | null;
    return {
      language: 'es',
      emailNotifications: (prefs?.email_enabled as boolean) ?? true,
      pushNotifications: (prefs?.push_enabled as boolean) ?? true,
      smsNotifications: (prefs?.sms_enabled as boolean) ?? true,
      orderUpdates: (prefs?.order_notifications as boolean) ?? true,
      promotions: (prefs?.promotion_notifications as boolean) ?? true,
      paymentAlerts: (prefs?.payment_notifications as boolean) ?? true,
    };
  },

  async updateSettings(userId: string, settings: Partial<AppSettings>): Promise<void> {
    const supabase = getBrowserClientCached();
    const mapping: Record<string, string> = {
      emailNotifications: 'email_enabled',
      pushNotifications: 'push_enabled',
      smsNotifications: 'sms_enabled',
      orderUpdates: 'order_notifications',
      promotions: 'promotion_notifications',
      paymentAlerts: 'payment_notifications',
    };
    const dbUpdates: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(settings)) {
      const dbKey = mapping[key];
      if (dbKey && typeof value === 'boolean') dbUpdates[dbKey] = value;
    }
    if (Object.keys(dbUpdates).length === 0) return;
    const existing = await supabase.from('notification_preferences').select('id').eq('user_id', userId).single();
    if (existing.data) {
      await supabase.from('notification_preferences').update(dbUpdates).eq('user_id', userId);
    } else {
      await supabase.from('notification_preferences').insert({ user_id: userId, ...dbUpdates });
    }
  },
};
