// src/types/database.ts
// Auto-generated from Supabase schema
// Types for all database tables and enums
/* eslint-disable @typescript-eslint/no-explicit-any */

// ============================================================================
// ENUMS
// ============================================================================

export type UserRole = 'super_admin' | 'admin_general' | 'admin_financiero' | 'admin_operativo' | 'admin_comercial' | 'admin_soporte' | 'business' | 'merchant' | 'customer' | 'courier' | 'guest';
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'banned';
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled' | 'refunded';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PaymentMethod = 'credit_card' | 'debit_card' | 'wallet' | 'cash' | 'transfer';
export type RatingType = 'order' | 'merchant' | 'courier';
export type ProductStatus = 'available' | 'unavailable' | 'discontinued';
export type AddressType = 'home' | 'work' | 'other';
export type DriverStatus = 'available' | 'busy' | 'offline' | 'on_break';
export type VehicleType = 'bike' | 'motorcycle' | 'car' | 'van';
export type TransactionType = 'credit' | 'debit' | 'refund' | 'bonus' | 'adjustment';
export type WalletTransactionStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type MessageType = 'text' | 'image' | 'file' | 'system';
export type NotificationType =
  | 'order_placed'
  | 'order_confirmed'
  | 'order_preparing'
  | 'order_ready'
  | 'order_in_transit'
  | 'order_delivered'
  | 'order_cancelled'
  | 'payment_received'
  | 'payment_failed'
  | 'new_message'
  | 'promotion'
  | 'rate_request'
  | 'driver_assigned'
  | 'courier_nearby'
  | 'system_alert'
  | 'review_reminder'
  | 'manual_order_created'
  | 'order_assigned';
export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'push';

// ============================================================================
// BASE TYPES
// ============================================================================

export interface Timestamp {
  created_at: string;
  updated_at: string;
}

export interface SoftDelete {
  deleted_at: string | null;
}

// ============================================================================
// PROFILES & ROLES
// ============================================================================

export interface Role extends Timestamp {
  id: string;
  name: UserRole;
  description: string | null;
  permissions: string[];
}

export interface Profile extends Timestamp, SoftDelete {
  id: string;
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  status: UserStatus;
  avatar_url: string | null;
  bio: string | null;
  verified_at: string | null;
  phone_verified_at: string | null;
  email_verified_at: string | null;
  last_login_at: string | null;
  metadata: Record<string, any>;
}

export interface ProfileWithRole extends Profile {
  role_data?: Role;
}

// ============================================================================
// BUSINESSES
// ============================================================================

export interface Business extends Timestamp, SoftDelete {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  cuisine_type: string | null;
  business_type: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  rating: number;
  total_ratings: number;
  is_verified: boolean;
  is_active: boolean;
  metadata: Record<string, any>;
}

export interface BusinessHours extends Timestamp {
  id: string;
  business_id: string;
  day_of_week: number; // 0=Sunday, 6=Saturday
  opens_at: string | null; // HH:MM:SS
  closes_at: string | null; // HH:MM:SS
  is_closed: boolean;
}

export interface BusinessWithDetails extends Business {
  owner?: Profile;
  hours?: BusinessHours[];
  address?: BusinessAddress;
  categories?: Category[];
}

// ============================================================================
// CATEGORIES & PRODUCTS
// ============================================================================

export interface Category extends Timestamp, SoftDelete {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_url: string | null;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
  metadata: Record<string, any>;
}

export interface Product extends Timestamp, SoftDelete {
  id: string;
  business_id: string;
  category_id: string;
  sku: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  cost_price: number | null;
  discount_price: number | null;
  discount_percentage: number;
  status: ProductStatus;
  quantity_available: number;
  preparation_time_minutes: number;
  rating: number;
  total_ratings: number;
  total_sales: number;
  is_featured: boolean;
  is_special: boolean;
  allergens: string[] | null;
  nutritional_info: Record<string, any> | null;
  metadata: Record<string, any>;
}

export interface ProductImage extends Timestamp {
  id: string;
  product_id: string;
  image_url: string;
  alt_text: string | null;
  display_order: number;
  is_primary: boolean;
  metadata: Record<string, any>;
}

export interface ProductVariant extends Timestamp {
  id: string;
  product_id: string;
  name: string;
  values: Record<string, any>; // {"size": "L", "color": "red"}
  price_modifier: number;
  sku_suffix: string | null;
  quantity_available: number;
  is_active: boolean;
}

export interface ProductWithDetails extends Product {
  category?: Category;
  images?: ProductImage[];
  variants?: ProductVariant[];
}

// ============================================================================
// ADDRESSES
// ============================================================================

export interface Address extends Timestamp, SoftDelete {
  id: string;
  user_id: string;
  type: AddressType;
  label: string | null;
  street_address: string;
  city: string;
  state_province: string | null;
  postal_code: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  location: GeometryPoint | null;
  is_primary: boolean;
  instructions: string | null;
  metadata: Record<string, any>;
}

export interface BusinessAddress extends Timestamp, SoftDelete {
  id: string;
  business_id: string;
  street_address: string;
  city: string;
  state_province: string | null;
  postal_code: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  location: GeometryPoint | null;
  phone: string | null;
  is_primary: boolean;
  delivery_available: boolean;
  metadata: Record<string, any>;
}

export interface GeometryPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

// ============================================================================
// ORDERS
// ============================================================================

export interface Order extends Timestamp, SoftDelete {
  id: string;
  order_number: string;
  order_code: string | null;
  customer_id: string;
  business_id: string;
  courier_id: string | null;
  delivery_address_id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  subtotal: number;
  delivery_fee: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  special_instructions: string | null;
  estimated_delivery_time: string | null;
  actual_delivery_time: string | null;
  rating_by_customer: number | null;
  courier_rating_by_customer: number | null;
  customer_feedback: string | null;
  metadata: Record<string, any>;
}

export interface OrderItem extends Timestamp {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  item_total: number;
  variant_selections: Record<string, any> | null;
  special_instructions: string | null;
}

export interface OrderTracking {
  id: string;
  order_id: string;
  status: OrderStatus;
  notes: string | null;
  created_at: string;
}

export interface OrderWithDetails extends Order {
  customer?: Profile;
  business?: Business;
  courier?: Driver;
  delivery_address?: Address;
  items?: OrderItem[];
  tracking?: OrderTracking[];
}

// ============================================================================
// DRIVERS
// ============================================================================

export interface Driver extends Timestamp, SoftDelete {
  id: string; // Same as profile id
  license_number: string;
  license_expiry: string | null;
  vehicle_type: VehicleType;
  vehicle_plate: string | null;
  vehicle_model: string | null;
  status: DriverStatus;
  is_verified: boolean;
  total_deliveries: number;
  completed_deliveries: number;
  rating: number;
  total_ratings: number;
  avg_rating: number;
  is_active: boolean;
  bank_account: Record<string, any> | null;
  metadata: Record<string, any>;
}

export interface DriverLocation extends Timestamp {
  id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  location: GeometryPoint;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  order_id: string | null;
}

export interface DriverAvailability extends Timestamp {
  id: string;
  driver_id: string;
  day_of_week: number; // 0=Sunday, 6=Saturday
  starts_at: string | null; // HH:MM:SS
  ends_at: string | null; // HH:MM:SS
  is_working: boolean;
}

export interface DriverEarnings extends Timestamp {
  id: string;
  driver_id: string;
  order_id: string;
  base_amount: number | null;
  bonus_amount: number;
  penalty_amount: number;
  total_earned: number;
  status: 'pending' | 'completed' | 'paid';
  paid_at: string | null;
  metadata: Record<string, any>;
}

export interface DriverWithDetails extends Driver {
  profile?: Profile;
  current_location?: DriverLocation;
  earnings?: DriverEarnings[];
}

// ============================================================================
// WALLETS
// ============================================================================

export interface Wallet extends Timestamp {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  is_active: boolean;
  total_credited: number;
  total_debited: number;
  metadata: Record<string, any>;
}

export interface WalletTransaction extends Timestamp, SoftDelete {
  id: string;
  wallet_id: string;
  transaction_type: TransactionType;
  amount: number;
  balance_before: number | null;
  balance_after: number | null;
  status: WalletTransactionStatus;
  reference_id: string | null;
  reference_type: string | null;
  description: string | null;
  metadata: Record<string, any>;
}

export interface WalletTopup extends Timestamp {
  id: string;
  wallet_id: string;
  amount: number;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  payment_reference: string | null;
  metadata: Record<string, any>;
}

export interface WalletWithDetails extends Wallet {
  transactions?: WalletTransaction[];
}

// ============================================================================
// CHATS & MESSAGES
// ============================================================================

export interface Chat extends Timestamp, SoftDelete {
  id: string;
  participant_1_id: string;
  participant_2_id: string;
  order_id: string | null;
  last_message_at: string | null;
  is_active: boolean;
  metadata: Record<string, any>;
}

export interface Message extends Timestamp {
  id: string;
  chat_id: string;
  sender_id: string;
  receiver_id: string;
  message_type: MessageType;
  content: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  is_read: boolean;
  read_at: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  metadata: Record<string, any>;
}

export interface GroupChat extends Timestamp {
  id: string;
  order_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_by: string;
  metadata: Record<string, any>;
}

export interface GroupChatMember extends Timestamp {
  id: string;
  group_chat_id: string;
  member_id: string;
  joined_at: string;
  left_at: string | null;
  role: 'admin' | 'moderator' | 'member';
}

export interface GroupMessage extends Timestamp {
  id: string;
  group_chat_id: string;
  sender_id: string;
  message_type: MessageType;
  content: string;
  file_url: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  metadata: Record<string, any>;
}

export interface ChatWithMessages extends Chat {
  messages?: Message[];
  participant_1?: Profile;
  participant_2?: Profile;
}

export interface UnreadMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  unread_count: number;
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export interface Notification extends Timestamp, SoftDelete {
  id: string;
  recipient_id: string;
  sender_id: string | null;
  notification_type: NotificationType;
  title: string;
  message: string;
  description: string | null;
  image_url: string | null;
  action_url: string | null;
  order_id: string | null;
  reference_id: string | null;
  reference_type: string | null;
  is_read: boolean;
  read_at: string | null;
  channels: NotificationChannel[];
  metadata: Record<string, any>;
}

export interface NotificationPreferences extends Timestamp {
  id: string;
  user_id: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  in_app_enabled: boolean;
  order_notifications: boolean;
  promotion_notifications: boolean;
  message_notifications: boolean;
  payment_notifications: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  metadata: Record<string, any>;
}

export interface NotificationTemplate extends Timestamp {
  id: string;
  type: NotificationType;
  title_template: string;
  message_template: string;
  description_template: string | null;
  icon: string | null;
  color: string | null;
  action_text: string | null;
  metadata: Record<string, any>;
}

export interface DeviceToken extends Timestamp {
  id: string;
  user_id: string;
  token: string;
  platform: 'ios' | 'android' | 'web' | null;
  is_active: boolean;
  last_used_at: string | null;
}

// ============================================================================
// RATINGS & REVIEWS
// ============================================================================

export interface Rating extends Timestamp, SoftDelete {
  id: string;
  order_id: string;
  rater_id: string;
  rated_entity_id: string; // business_id, driver_id, or product_id
  rating_type: RatingType;
  rating: number; // 1.0 to 5.0
  title: string | null;
  review: string | null;
  images: string[] | null;
  helpful_count: number;
  unhelpful_count: number;
  verified_purchase: boolean;
  is_public: boolean;
  is_featured: boolean;
  response: string | null;
  response_by: string | null;
  response_at: string | null;
  metadata: Record<string, any>;
}

export interface RatingComment extends Timestamp {
  id: string;
  rating_id: string;
  author_id: string;
  content: string;
}

export interface RatingReaction {
  id: string;
  rating_id: string;
  user_id: string;
  reaction_type: 'helpful' | 'unhelpful';
  created_at: string;
}

export interface RatingWithDetails extends Rating {
  rater?: Profile;
  comments?: RatingComment[];
  reactions?: RatingReaction[];
}

// ============================================================================
// COMPOSITE TYPES
// ============================================================================

export interface CreateOrderInput {
  customer_id: string;
  business_id: string;
  delivery_address_id: string;
  items: {
    product_id: string;
    quantity: number;
    variant_selections?: Record<string, any>;
    special_instructions?: string;
  }[];
  subtotal: number;
  delivery_fee: number;
  discount_amount?: number;
  tax_amount?: number;
  special_instructions?: string;
  payment_method: PaymentMethod;
}

export interface UpdateOrderStatusInput {
  order_id: string;
  status: OrderStatus;
  notes?: string;
}

export interface LocationUpdate {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
}

// ============================================================================
// DATABASE TYPE EXPORT
// ============================================================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;
      };
      roles: {
        Row: Role;
        Insert: Omit<Role, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Role, 'id' | 'created_at' | 'updated_at'>>;
      };
      businesses: {
        Row: Business;
        Insert: Omit<Business, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Business, 'id' | 'created_at' | 'updated_at'>>;
      };
      categories: {
        Row: Category;
        Insert: Omit<Category, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Category, 'id' | 'created_at' | 'updated_at'>>;
      };
      products: {
        Row: Product;
        Insert: Omit<Product, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>;
      };
      product_images: {
        Row: ProductImage;
        Insert: Omit<ProductImage, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ProductImage, 'id' | 'created_at' | 'updated_at'>>;
      };
      addresses: {
        Row: Address;
        Insert: Omit<Address, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Address, 'id' | 'created_at' | 'updated_at'>>;
      };
      business_addresses: {
        Row: BusinessAddress;
        Insert: Omit<BusinessAddress, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<BusinessAddress, 'id' | 'created_at' | 'updated_at'>>;
      };
      business_hours: {
        Row: BusinessHours;
        Insert: Omit<BusinessHours, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<BusinessHours, 'id' | 'created_at' | 'updated_at'>>;
      };
      orders: {
        Row: Order;
        Insert: Omit<Order, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Order, 'id' | 'created_at' | 'updated_at'>>;
      };
      order_items: {
        Row: OrderItem;
        Insert: Omit<OrderItem, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<OrderItem, 'id' | 'created_at' | 'updated_at'>>;
      };
      order_tracking: {
        Row: OrderTracking;
        Insert: Omit<OrderTracking, 'id' | 'created_at'>;
        Update: Partial<Omit<OrderTracking, 'id'>>;
      };
      drivers: {
        Row: Driver;
        Insert: Omit<Driver, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Driver, 'id' | 'created_at' | 'updated_at'>>;
      };
      driver_locations: {
        Row: DriverLocation;
        Insert: Omit<DriverLocation, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<DriverLocation, 'id' | 'created_at' | 'updated_at'>>;
      };
      driver_availability: {
        Row: DriverAvailability;
        Insert: Omit<DriverAvailability, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<DriverAvailability, 'id' | 'created_at' | 'updated_at'>>;
      };
      driver_earnings: {
        Row: DriverEarnings;
        Insert: Omit<DriverEarnings, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<DriverEarnings, 'id' | 'created_at' | 'updated_at'>>;
      };
      chats: {
        Row: Chat;
        Insert: Omit<Chat, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Chat, 'id' | 'created_at' | 'updated_at'>>;
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, 'id' | 'created_at'>;
        Update: Partial<Omit<Message, 'id'>>;
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Notification, 'id' | 'created_at' | 'updated_at'>>;
      };
      ratings: {
        Row: Rating;
        Insert: Omit<Rating, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Rating, 'id' | 'created_at' | 'updated_at'>>;
      };
      wallets: {
        Row: Wallet;
        Insert: Omit<Wallet, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Wallet, 'id' | 'created_at' | 'updated_at'>>;
      };
      wallet_transactions: {
        Row: WalletTransaction;
        Insert: Omit<WalletTransaction, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<WalletTransaction, 'id' | 'created_at' | 'updated_at'>>;
      };
    };
    Functions: {
      generate_order_number: {
        Args: Record<string, never>;
        Returns: string;
      };
      add_wallet_transaction: {
        Args: {
          p_wallet_id: string;
          p_transaction_type: TransactionType;
          p_amount: number;
        };
        Returns: WalletTransaction;
      };
      mark_messages_as_read: {
        Args: {
          p_chat_id: string;
          p_reader_id: string;
        };
        Returns: { updated_count: number };
      };
    };
  };
}
