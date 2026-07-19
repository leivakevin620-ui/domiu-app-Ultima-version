import type { DomiServerContext } from '@/lib/domi/server-context';
import type { DomiNavigationLink } from '@/lib/domi/tools/types';
import type { DomiUserSettings } from '@/lib/domi/user-settings';

export type DomiAdvancedIntent =
  | 'budget_recommendation'
  | 'product_recommendation'
  | 'promotions'
  | 'addresses'
  | 'payment_methods'
  | 'prepare_order_draft'
  | 'resume_goal'
  | 'admin_evaluation'
  | 'memory_forget_specific'
  | 'memory_correct'
  | 'proactive_settings'
  | 'voice_settings';

export interface DomiAgentPlan {
  intent: DomiAdvancedIntent;
  query: string;
  budget: number | null;
  reference: string | null;
  requestedQuantity: number;
  rawMessage: string;
}

export interface DomiRecentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DomiMemoryView {
  id: string;
  key: string;
  text: string;
  type: string;
  confidence: number;
  expiresAt: string | null;
}

export interface DomiAgentState {
  context: DomiServerContext;
  settings: DomiUserSettings;
  conversationId: string;
  messages: DomiRecentMessage[];
  memories: DomiMemoryView[];
}

export interface DomiRecommendation {
  productId: string;
  productName: string;
  productDescription: string;
  imageUrl: string | null;
  businessId: string;
  businessName: string;
  businessSlug: string;
  businessRating: number;
  productRating: number;
  quantityAvailable: number;
  preparationMinutes: number;
  originalPrice: number;
  currentPrice: number;
  discountAmount: number;
  deliveryFee: number;
  serviceFee: number;
  estimatedTotal: number;
  estimatedDeliveryMinutes: number;
  withinBudget: boolean;
  score: number;
  reasons: string[];
  dataStatus: 'confirmed' | 'estimated' | 'pending' | 'unavailable';
}

export interface DomiClientCommand {
  type: 'cart.add' | 'cart.replace' | 'cart.clear' | 'navigate' | 'speech.stop';
  payload: Record<string, unknown>;
}

export interface DomiAdvancedResult {
  intent: DomiAdvancedIntent;
  tool: string;
  message: string;
  data: Record<string, unknown>;
  recordCount: number;
  suggestedActions: string[];
  navigation: DomiNavigationLink[];
  clientCommands?: DomiClientCommand[];
  requiresConfirmation?: boolean;
  riskLevel?: 'low' | 'medium' | 'high';
  escalateToHuman?: boolean;
}
