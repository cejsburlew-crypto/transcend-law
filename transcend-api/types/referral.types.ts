/**
 * Referral Program Type Definitions
 * Shared types for referral system across frontend and backend
 */

// ============================================
// ENUMS
// ============================================

export enum ReferralStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export enum RewardStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  PAID = 'paid',
  REJECTED = 'rejected',
}

export enum RewardType {
  CREDIT = 'credit',
  DISCOUNT = 'discount',
}

export enum PayoutMethod {
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
  BANK_TRANSFER = 'bank_transfer',
}

export enum ReferralEventType {
  CODE_GENERATED = 'code_generated',
  REFERRAL_CREATED = 'referral_created',
  REFERRAL_VERIFIED = 'referral_verified',
  REFERRAL_EXPIRED = 'referral_expired',
  REWARD_CREATED = 'reward_created',
  REWARD_APPROVED = 'reward_approved',
  REWARD_PAID = 'reward_paid',
  REWARD_REJECTED = 'reward_rejected',
  PAYOUT_PROCESSED = 'payout_processed',
  CODE_DEACTIVATED = 'code_deactivated',
}

// ============================================
// CORE MODELS
// ============================================

export interface ReferralCode {
  id?: string;
  code: string;
  referrerId: string;
  createdAt: Date;
  expiresAt: Date;
  maxUses: number;
  currentUses: number;
  isActive: boolean;
  updatedAt?: Date;
}

export interface Referral {
  id: string;
  referrerCode: string;
  referrerId: string;
  referredUserId: string;
  referredEmail: string;
  status: ReferralStatus;
  verifiedAt?: Date;
  createdAt: Date;
  expiresAt: Date;
  updatedAt?: Date;
}

export interface ReferralReward {
  id: string;
  referralId: string;
  referrerId: string;
  rewardType: RewardType;
  amount: number;
  currency: string;
  status: RewardStatus;
  paidAt?: Date;
  payoutMethod?: PayoutMethod;
  transactionId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface ReferralStats {
  totalReferrals: number;
  verifiedReferrals: number;
  totalRewardsEarned: number;
  totalRewardsPaid: number;
  pendingRewards: number;
  lastReferralDate?: Date;
}

export interface ReferralEvent {
  id: string;
  eventType: ReferralEventType;
  referralId?: string;
  referrerId?: string;
  rewardId?: string;
  eventData: Record<string, any>;
  createdAt: Date;
}

export interface ReferralPayoutHistory {
  id: string;
  batchId: string;
  rewardId: string;
  referrerId: string;
  amount: number;
  payoutMethod: PayoutMethod;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  stripePayoutId?: string;
  paypalTransactionId?: string;
  processedAt?: Date;
  createdAt: Date;
}

// ============================================
// ADMIN MODELS
// ============================================

export interface AdminDashboardData {
  totalReferrals: number;
  verifiedReferrals: number;
  conversionRate: number;
  totalRewards: number;
  paidRewards: number;
  totalRewardAmount: number;
  totalPaidAmount: number;
  pendingPayouts?: number;
}

export interface LeaderboardEntry {
  referrerId: string;
  referrerName: string;
  referrerEmail: string;
  referralCount: number;
  totalRewardsEarned: number;
}

export interface BulkExportData {
  referralId: string;
  referrerName: string;
  referrerEmail: string;
  referredName: string;
  referredEmail: string;
  status: string;
  referralCode: string;
  createdAt: string;
  verifiedAt?: string;
  rewardAmount: number;
  rewardStatus: string;
}

export interface PayoutResult {
  successful: number;
  failed: number;
  errors: string[];
}

// ============================================
// REQUEST/RESPONSE DTOs
// ============================================

export namespace ReferralDTO {
  export interface GenerateCodeRequest {
    userId: string;
    expirationDays?: number;
    maxUses?: number;
  }

  export interface GenerateCodeResponse {
    code: ReferralCode;
  }

  export interface ValidateCodeRequest {
    code: string;
  }

  export interface ValidateCodeResponse {
    valid: boolean;
    code?: ReferralCode;
  }

  export interface CreateReferralRequest {
    referrerId: string;
    referralCode: string;
    referredUserId: string;
    referredEmail: string;
  }

  export interface CreateReferralResponse {
    referral: Referral;
  }

  export interface VerifyReferralRequest {
    referralId: string;
  }

  export interface VerifyReferralResponse {
    referral: Referral;
    rewards: ReferralReward[];
  }

  export interface GetStatsResponse {
    stats: ReferralStats;
  }

  export interface GetRewardsResponse {
    rewards: ReferralReward[];
    total: number;
  }

  export interface GetCodesResponse {
    codes: ReferralCode[];
    total: number;
  }

  export interface ProcessPayoutsRequest {
    limit?: number;
    payoutMethod?: PayoutMethod;
  }

  export interface ProcessPayoutsResponse {
    results: PayoutResult;
  }

  export interface ExportDataRequest {
    startDate?: Date;
    endDate?: Date;
    status?: ReferralStatus;
    referrerId?: string;
  }

  export interface ExportDataResponse {
    data: BulkExportData[];
    csv?: string;
  }

  export interface ApproveRewardRequest {
    rewardId: string;
  }

  export interface ApproveRewardResponse {
    reward: ReferralReward;
  }

  export interface RejectRewardRequest {
    rewardId: string;
  }

  export interface RejectRewardResponse {
    reward: ReferralReward;
  }

  export interface AdminDashboardResponse {
    data: AdminDashboardData;
  }

  export interface LeaderboardResponse {
    entries: LeaderboardEntry[];
    total: number;
  }
}

// ============================================
// FILTER OBJECTS
// ============================================

export interface ReferralFilters {
  startDate?: Date;
  endDate?: Date;
  status?: ReferralStatus;
  referrerId?: string;
  page?: number;
  limit?: number;
}

export interface RewardFilters {
  referrerId: string;
  status?: RewardStatus;
  rewardType?: RewardType;
  page?: number;
  limit?: number;
}

// ============================================
// CONFIGURATION
// ============================================

export interface ReferralConfig {
  referralExpirationDays: number;
  maxCodesPerUser: number;
  referrerReward: number;
  referredDiscount: number;
  codeLength: number;
  maxPayoutsPerBatch: number;
  payoutDelay?: number; // days
}

// ============================================
// ERROR TYPES
// ============================================

export class ReferralError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ReferralError';
  }
}

export const ReferralErrorCodes = {
  INVALID_CODE: 'INVALID_CODE',
  CODE_EXPIRED: 'CODE_EXPIRED',
  CODE_LIMIT_REACHED: 'CODE_LIMIT_REACHED',
  INVALID_REFERRAL: 'INVALID_REFERRAL',
  DUPLICATE_REFERRAL: 'DUPLICATE_REFERRAL',
  REFERRAL_EXPIRED: 'REFERRAL_EXPIRED',
  REWARD_NOT_FOUND: 'REWARD_NOT_FOUND',
  PAYOUT_FAILED: 'PAYOUT_FAILED',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
} as const;

// ============================================
// QUERY RESULTS
// ============================================

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ReferralMetrics {
  totalReferrals: number;
  verifiedReferrals: number;
  conversionRate: number;
  totalRewardsCost: number;
  averageRewardValue: number;
  topReferrers: LeaderboardEntry[];
  pendingPayouts: number;
}

// ============================================
// NOTIFICATIONS
// ============================================

export interface ReferralNotification {
  type: 'referral_created' | 'referral_verified' | 'reward_paid';
  userId: string;
  title: string;
  message: string;
  data?: Record<string, any>;
}

// ============================================
// CACHE KEYS
// ============================================

export const ReferralCacheKeys = {
  CODE_PREFIX: 'ref:code:',
  STATS_PREFIX: 'ref:stats:',
  LEADERBOARD: 'ref:leaderboard',
  PENDING_PAYOUTS: 'ref:pending:payouts',
} as const;

// ============================================
// VALIDATION SCHEMAS
// ============================================

export interface ValidationRule {
  field: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean;
}

export const ReferralValidationRules = {
  CODE: {
    field: 'code',
    minLength: 8,
    maxLength: 8,
    pattern: /^[A-Z0-9]{8}$/,
  } as ValidationRule,
  EMAIL: {
    field: 'email',
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  } as ValidationRule,
  AMOUNT: {
    field: 'amount',
    required: true,
    custom: (value: number) => value > 0,
  } as ValidationRule,
} as const;
