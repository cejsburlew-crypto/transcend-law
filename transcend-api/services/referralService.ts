import Redis from 'ioredis';
import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

/**
 * Referral Program Service
 * Handles unique referral code generation, tracking, rewards, and verification
 */

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

export interface ReferralCode {
  code: string;
  referrerId: string;
  createdAt: Date;
  expiresAt: Date;
  maxUses: number;
  currentUses: number;
  isActive: boolean;
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
}

export interface ReferralReward {
  id: string;
  referralId: string;
  referrerId: string;
  rewardType: 'credit' | 'discount';
  amount: number;
  currency: string;
  status: RewardStatus;
  paidAt?: Date;
  payoutMethod?: string;
  createdAt: Date;
}

export interface ReferralStats {
  totalReferrals: number;
  verifiedReferrals: number;
  totalRewardsEarned: number;
  totalRewardsPaid: number;
  pendingRewards: number;
  lastReferralDate?: Date;
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

/**
 * ReferralService manages the referral program
 */
export class ReferralService {
  private redisClient: Redis;
  private dbClient: any; // Database client (Prisma or similar)
  private apiClient: AxiosInstance;
  private readonly referralCodePrefix = 'ref:';
  private readonly codeLength = 8;
  private readonly referralExpirationDays = 90;
  private readonly maxCodesPerUser = 5;
  private readonly referrerReward = 50; // $50 credit
  private readonly referredDiscount = 0.2; // 20% off

  constructor(redisClient: Redis, dbClient: any) {
    this.redisClient = redisClient;
    this.dbClient = dbClient;
    this.apiClient = axios.create({
      timeout: 10000,
      headers: {
        'User-Agent': 'Transcend-Referral/1.0',
      },
    });
  }

  // ============================================
  // REFERRAL CODE GENERATION & MANAGEMENT
  // ============================================

  /**
   * Generate a unique referral code for a user
   */
  public async generateReferralCode(
    referrerId: string,
    expirationDays = this.referralExpirationDays,
    maxUses = 100
  ): Promise<ReferralCode> {
    try {
      // Check if user has reached max codes
      const existingCodes = await this.getUserReferralCodes(referrerId);
      if (existingCodes.length >= this.maxCodesPerUser) {
        throw new Error(`User has reached maximum referral codes (${this.maxCodesPerUser})`);
      }

      // Generate unique code
      let code: string;
      let isUnique = false;

      while (!isUnique) {
        code = this.generateUniqueCode();
        isUnique = !(await this.codeExists(code));
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + expirationDays * 24 * 60 * 60 * 1000);

      const referralCode: ReferralCode = {
        code: code!,
        referrerId,
        createdAt: now,
        expiresAt,
        maxUses,
        currentUses: 0,
        isActive: true,
      };

      // Store in Redis cache
      await this.redisClient.setex(
        `${this.referralCodePrefix}${code}`,
        expirationDays * 24 * 60 * 60,
        JSON.stringify(referralCode)
      );

      // Store in database
      await this.dbClient.referralCode.create({
        data: {
          code: code,
          referrerId,
          expiresAt,
          maxUses,
          currentUses: 0,
          isActive: true,
        },
      });

      logger.info(`Generated referral code ${code} for user ${referrerId}`);
      return referralCode;
    } catch (error) {
      logger.error(`Failed to generate referral code: ${error}`);
      throw new Error(`Failed to generate referral code: ${error}`);
    }
  }

  /**
   * Validate referral code format and existence
   */
  public async validateReferralCode(code: string): Promise<ReferralCode | null> {
    try {
      // Check Redis cache first
      const cached = await this.redisClient.get(`${this.referralCodePrefix}${code}`);
      if (cached) {
        return JSON.parse(cached);
      }

      // Check database
      const referralCode = await this.dbClient.referralCode.findUnique({
        where: { code },
      });

      if (!referralCode) {
        return null;
      }

      // Validate expiration
      if (new Date() > referralCode.expiresAt) {
        await this.deactivateReferralCode(code);
        return null;
      }

      // Validate usage limits
      if (referralCode.currentUses >= referralCode.maxUses) {
        await this.deactivateReferralCode(code);
        return null;
      }

      // Validate active status
      if (!referralCode.isActive) {
        return null;
      }

      return referralCode;
    } catch (error) {
      logger.error(`Failed to validate referral code: ${error}`);
      return null;
    }
  }

  /**
   * Deactivate a referral code
   */
  public async deactivateReferralCode(code: string): Promise<void> {
    try {
      // Update database
      await this.dbClient.referralCode.update({
        where: { code },
        data: { isActive: false },
      });

      // Remove from Redis cache
      await this.redisClient.del(`${this.referralCodePrefix}${code}`);

      logger.info(`Deactivated referral code ${code}`);
    } catch (error) {
      logger.error(`Failed to deactivate referral code: ${error}`);
      throw new Error(`Failed to deactivate referral code: ${error}`);
    }
  }

  /**
   * Get all referral codes for a user
   */
  public async getUserReferralCodes(referrerId: string): Promise<ReferralCode[]> {
    try {
      const codes = await this.dbClient.referralCode.findMany({
        where: { referrerId },
        orderBy: { createdAt: 'desc' },
      });
      return codes;
    } catch (error) {
      logger.error(`Failed to get user referral codes: ${error}`);
      return [];
    }
  }

  // ============================================
  // REFERRAL TRACKING
  // ============================================

  /**
   * Create a referral record when user signs up with referral code
   */
  public async createReferral(
    referrerId: string,
    referralCode: string,
    referredUserId: string,
    referredEmail: string
  ): Promise<Referral> {
    try {
      // Validate referral code
      const codeData = await this.validateReferralCode(referralCode);
      if (!codeData) {
        throw new Error('Invalid or expired referral code');
      }

      // Check for duplicate referral
      const existing = await this.dbClient.referral.findFirst({
        where: {
          referredUserId,
          referrerCode: referralCode,
        },
      });

      if (existing) {
        throw new Error('User already referred with this code');
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.referralExpirationDays * 24 * 60 * 60 * 1000);

      const referral: Referral = {
        id: uuidv4(),
        referrerCode: referralCode,
        referrerId,
        referredUserId,
        referredEmail,
        status: ReferralStatus.PENDING,
        createdAt: now,
        expiresAt,
      };

      // Store in database
      await this.dbClient.referral.create({
        data: {
          id: referral.id,
          referrerCode: referralCode,
          referrerId,
          referredUserId,
          referredEmail,
          status: ReferralStatus.PENDING,
          expiresAt,
        },
      });

      // Increment code usage
      await this.dbClient.referralCode.update({
        where: { code: referralCode },
        data: { currentUses: { increment: 1 } },
      });

      logger.info(`Created referral ${referral.id} for user ${referrerId}`);
      return referral;
    } catch (error) {
      logger.error(`Failed to create referral: ${error}`);
      throw new Error(`Failed to create referral: ${error}`);
    }
  }

  /**
   * Verify referral when referred user completes signup
   */
  public async verifyReferral(referralId: string): Promise<Referral> {
    try {
      const referral = await this.dbClient.referral.findUnique({
        where: { id: referralId },
      });

      if (!referral) {
        throw new Error('Referral not found');
      }

      if (referral.status !== ReferralStatus.PENDING) {
        throw new Error('Referral already verified or expired');
      }

      // Update referral status
      const updatedReferral = await this.dbClient.referral.update({
        where: { id: referralId },
        data: {
          status: ReferralStatus.VERIFIED,
          verifiedAt: new Date(),
        },
      });

      // Create rewards for both referrer and referred
      await this.createReferrerReward(
        referral.referrerId,
        referralId,
        this.referrerReward
      );

      await this.createReferredReward(
        referral.referredUserId,
        referralId,
        this.referredDiscount
      );

      logger.info(`Verified referral ${referralId}`);

      return updatedReferral;
    } catch (error) {
      logger.error(`Failed to verify referral: ${error}`);
      throw new Error(`Failed to verify referral: ${error}`);
    }
  }

  /**
   * Get referral by ID
   */
  public async getReferral(referralId: string): Promise<Referral | null> {
    try {
      return await this.dbClient.referral.findUnique({
        where: { id: referralId },
      });
    } catch (error) {
      logger.error(`Failed to get referral: ${error}`);
      return null;
    }
  }

  /**
   * Get all referrals for a referrer
   */
  public async getReferrerReferrals(referrerId: string, status?: ReferralStatus): Promise<Referral[]> {
    try {
      const where: any = { referrerId };
      if (status) {
        where.status = status;
      }

      return await this.dbClient.referral.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      logger.error(`Failed to get referrer referrals: ${error}`);
      return [];
    }
  }

  // ============================================
  // REWARD MANAGEMENT
  // ============================================

  /**
   * Create reward for referrer ($50 credit)
   */
  private async createReferrerReward(
    referrerId: string,
    referralId: string,
    amount: number
  ): Promise<ReferralReward> {
    try {
      const reward: ReferralReward = {
        id: uuidv4(),
        referralId,
        referrerId,
        rewardType: 'credit',
        amount,
        currency: 'USD',
        status: RewardStatus.PENDING,
        createdAt: new Date(),
      };

      await this.dbClient.referralReward.create({
        data: {
          id: reward.id,
          referralId,
          referrerId,
          rewardType: 'credit',
          amount,
          currency: 'USD',
          status: RewardStatus.PENDING,
        },
      });

      logger.info(`Created referrer reward ${reward.id} for user ${referrerId}`);
      return reward;
    } catch (error) {
      logger.error(`Failed to create referrer reward: ${error}`);
      throw new Error(`Failed to create referrer reward: ${error}`);
    }
  }

  /**
   * Create reward for referred user (20% discount)
   */
  private async createReferredReward(
    referredUserId: string,
    referralId: string,
    discountPercentage: number
  ): Promise<ReferralReward> {
    try {
      const reward: ReferralReward = {
        id: uuidv4(),
        referralId,
        referrerId: referredUserId,
        rewardType: 'discount',
        amount: discountPercentage * 100, // Store as basis points (20% = 2000)
        currency: 'USD',
        status: RewardStatus.APPROVED,
        createdAt: new Date(),
      };

      await this.dbClient.referralReward.create({
        data: {
          id: reward.id,
          referralId,
          referrerId: referredUserId,
          rewardType: 'discount',
          amount: discountPercentage * 100,
          currency: 'USD',
          status: RewardStatus.APPROVED,
        },
      });

      logger.info(`Created referred discount ${reward.id} for user ${referredUserId}`);
      return reward;
    } catch (error) {
      logger.error(`Failed to create referred reward: ${error}`);
      throw new Error(`Failed to create referred reward: ${error}`);
    }
  }

  /**
   * Get user's rewards
   */
  public async getUserRewards(
    referrerId: string,
    status?: RewardStatus
  ): Promise<ReferralReward[]> {
    try {
      const where: any = { referrerId };
      if (status) {
        where.status = status;
      }

      return await this.dbClient.referralReward.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      logger.error(`Failed to get user rewards: ${error}`);
      return [];
    }
  }

  /**
   * Approve reward
   */
  public async approveReward(rewardId: string): Promise<ReferralReward> {
    try {
      const reward = await this.dbClient.referralReward.update({
        where: { id: rewardId },
        data: { status: RewardStatus.APPROVED },
      });

      logger.info(`Approved reward ${rewardId}`);
      return reward;
    } catch (error) {
      logger.error(`Failed to approve reward: ${error}`);
      throw new Error(`Failed to approve reward: ${error}`);
    }
  }

  /**
   * Reject reward
   */
  public async rejectReward(rewardId: string): Promise<ReferralReward> {
    try {
      const reward = await this.dbClient.referralReward.update({
        where: { id: rewardId },
        data: { status: RewardStatus.REJECTED },
      });

      logger.info(`Rejected reward ${rewardId}`);
      return reward;
    } catch (error) {
      logger.error(`Failed to reject reward: ${error}`);
      throw new Error(`Failed to reject reward: ${error}`);
    }
  }

  // ============================================
  // PAYOUT LOGIC
  // ============================================

  /**
   * Process payouts for approved rewards
   */
  public async processPayouts(
    limit = 100,
    payoutMethod = 'stripe'
  ): Promise<{ successful: number; failed: number; errors: string[] }> {
    try {
      const approvedRewards = await this.dbClient.referralReward.findMany({
        where: {
          status: RewardStatus.APPROVED,
          rewardType: 'credit',
        },
        take: limit,
        orderBy: { createdAt: 'asc' },
      });

      const results = {
        successful: 0,
        failed: 0,
        errors: [] as string[],
      };

      for (const reward of approvedRewards) {
        try {
          await this.processRewardPayout(reward, payoutMethod);
          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Reward ${reward.id}: ${error}`);
          logger.error(`Failed to process payout for reward ${reward.id}: ${error}`);
        }
      }

      logger.info(`Processed payouts: ${results.successful} successful, ${results.failed} failed`);
      return results;
    } catch (error) {
      logger.error(`Failed to process payouts: ${error}`);
      throw new Error(`Failed to process payouts: ${error}`);
    }
  }

  /**
   * Process individual reward payout
   */
  private async processRewardPayout(reward: ReferralReward, payoutMethod: string): Promise<void> {
    try {
      // Call payment processor (Stripe, PayPal, etc.)
      const payoutResponse = await this.apiClient.post('/api/v2/payouts', {
        userId: reward.referrerId,
        amount: reward.amount,
        currency: reward.currency,
        method: payoutMethod,
        rewardId: reward.id,
      });

      if (!payoutResponse.data.success) {
        throw new Error(payoutResponse.data.error || 'Payout failed');
      }

      // Update reward status
      await this.dbClient.referralReward.update({
        where: { id: reward.id },
        data: {
          status: RewardStatus.PAID,
          paidAt: new Date(),
          payoutMethod,
        },
      });

      logger.info(`Processed payout for reward ${reward.id}`);
    } catch (error) {
      logger.error(`Failed to process payout: ${error}`);
      throw new Error(`Failed to process payout: ${error}`);
    }
  }

  /**
   * Get pending payouts
   */
  public async getPendingPayouts(): Promise<ReferralReward[]> {
    try {
      return await this.dbClient.referralReward.findMany({
        where: {
          status: RewardStatus.APPROVED,
          rewardType: 'credit',
        },
        orderBy: { createdAt: 'asc' },
      });
    } catch (error) {
      logger.error(`Failed to get pending payouts: ${error}`);
      return [];
    }
  }

  // ============================================
  // STATISTICS & ANALYTICS
  // ============================================

  /**
   * Get referral statistics for a user
   */
  public async getReferralStats(referrerId: string): Promise<ReferralStats> {
    try {
      const referrals = await this.dbClient.referral.findMany({
        where: { referrerId },
      });

      const verifiedReferrals = referrals.filter(
        (r) => r.status === ReferralStatus.VERIFIED
      );

      const rewards = await this.dbClient.referralReward.findMany({
        where: { referrerId },
      });

      const paidRewards = rewards.filter(
        (r) => r.status === RewardStatus.PAID
      );

      const totalRewardsEarned = rewards
        .filter((r) => r.rewardType === 'credit')
        .reduce((sum, r) => sum + r.amount, 0);

      const totalRewardsPaid = paidRewards
        .filter((r) => r.rewardType === 'credit')
        .reduce((sum, r) => sum + r.amount, 0);

      const pendingRewards = rewards
        .filter((r) => r.status === RewardStatus.PENDING && r.rewardType === 'credit')
        .reduce((sum, r) => sum + r.amount, 0);

      return {
        totalReferrals: referrals.length,
        verifiedReferrals: verifiedReferrals.length,
        totalRewardsEarned,
        totalRewardsPaid,
        pendingRewards,
        lastReferralDate: referrals.length > 0 ? referrals[0].createdAt : undefined,
      };
    } catch (error) {
      logger.error(`Failed to get referral stats: ${error}`);
      throw new Error(`Failed to get referral stats: ${error}`);
    }
  }

  // ============================================
  // ADMIN DASHBOARD
  // ============================================

  /**
   * Get admin dashboard data
   */
  public async getAdminDashboardData(): Promise<any> {
    try {
      const totalReferrals = await this.dbClient.referral.count();
      const verifiedReferrals = await this.dbClient.referral.count({
        where: { status: ReferralStatus.VERIFIED },
      });

      const totalRewards = await this.dbClient.referralReward.count();
      const paidRewards = await this.dbClient.referralReward.count({
        where: { status: RewardStatus.PAID },
      });

      const rewardAmounts = await this.dbClient.referralReward.aggregate({
        _sum: { amount: true },
        where: { rewardType: 'credit' },
      });

      const paidAmounts = await this.dbClient.referralReward.aggregate({
        _sum: { amount: true },
        where: { status: RewardStatus.PAID, rewardType: 'credit' },
      });

      return {
        totalReferrals,
        verifiedReferrals,
        conversionRate: totalReferrals > 0 ? (verifiedReferrals / totalReferrals) * 100 : 0,
        totalRewards,
        paidRewards,
        totalRewardAmount: rewardAmounts._sum.amount || 0,
        totalPaidAmount: paidAmounts._sum.amount || 0,
      };
    } catch (error) {
      logger.error(`Failed to get admin dashboard data: ${error}`);
      throw new Error(`Failed to get admin dashboard data: ${error}`);
    }
  }

  /**
   * Get referral leaderboard
   */
  public async getReferralLeaderboard(limit = 10): Promise<any[]> {
    try {
      const leaderboard = await this.dbClient.referral.groupBy({
        by: ['referrerId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: limit,
      });

      // Fetch user details for each referrer
      const enriched = await Promise.all(
        leaderboard.map(async (entry) => {
          const user = await this.dbClient.user.findUnique({
            where: { id: entry.referrerId },
            select: { name: true, email: true },
          });

          const rewards = await this.getUserRewards(entry.referrerId);
          const totalRewards = rewards
            .filter((r) => r.rewardType === 'credit')
            .reduce((sum, r) => sum + r.amount, 0);

          return {
            referrerId: entry.referrerId,
            referrerName: user?.name || 'Unknown',
            referrerEmail: user?.email || 'Unknown',
            referralCount: entry._count.id,
            totalRewardsEarned: totalRewards,
          };
        })
      );

      return enriched;
    } catch (error) {
      logger.error(`Failed to get referral leaderboard: ${error}`);
      throw new Error(`Failed to get referral leaderboard: ${error}`);
    }
  }

  // ============================================
  // DATA EXPORT
  // ============================================

  /**
   * Export referral data to CSV format
   */
  public async exportReferralData(filters?: {
    startDate?: Date;
    endDate?: Date;
    status?: ReferralStatus;
    referrerId?: string;
  }): Promise<BulkExportData[]> {
    try {
      const where: any = {};

      if (filters?.startDate) {
        where.createdAt = { gte: filters.startDate };
      }

      if (filters?.endDate) {
        where.createdAt = {
          ...where.createdAt,
          lte: filters.endDate,
        };
      }

      if (filters?.status) {
        where.status = filters.status;
      }

      if (filters?.referrerId) {
        where.referrerId = filters.referrerId;
      }

      const referrals = await this.dbClient.referral.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      const exportData: BulkExportData[] = await Promise.all(
        referrals.map(async (referral) => {
          const referrerUser = await this.dbClient.user.findUnique({
            where: { id: referral.referrerId },
            select: { name: true, email: true },
          });

          const referredUser = await this.dbClient.user.findUnique({
            where: { id: referral.referredUserId },
            select: { name: true, email: true },
          });

          const rewards = await this.dbClient.referralReward.findMany({
            where: { referralId: referral.id },
          });

          const rewardAmount = rewards
            .filter((r) => r.rewardType === 'credit')
            .reduce((sum, r) => sum + r.amount, 0);

          const rewardStatus = rewards[0]?.status || RewardStatus.PENDING;

          return {
            referralId: referral.id,
            referrerName: referrerUser?.name || 'Unknown',
            referrerEmail: referrerUser?.email || 'Unknown',
            referredName: referredUser?.name || 'Unknown',
            referredEmail: referredUser?.email || referral.referredEmail || 'Unknown',
            status: referral.status,
            referralCode: referral.referrerCode,
            createdAt: referral.createdAt.toISOString(),
            verifiedAt: referral.verifiedAt?.toISOString(),
            rewardAmount,
            rewardStatus,
          };
        })
      );

      logger.info(`Exported ${exportData.length} referral records`);
      return exportData;
    } catch (error) {
      logger.error(`Failed to export referral data: ${error}`);
      throw new Error(`Failed to export referral data: ${error}`);
    }
  }

  /**
   * Generate CSV content from export data
   */
  public generateCSVContent(data: BulkExportData[]): string {
    const headers = [
      'Referral ID',
      'Referrer Name',
      'Referrer Email',
      'Referred Name',
      'Referred Email',
      'Status',
      'Referral Code',
      'Created At',
      'Verified At',
      'Reward Amount',
      'Reward Status',
    ];

    const rows = data.map((item) => [
      item.referralId,
      item.referrerName,
      item.referrerEmail,
      item.referredName,
      item.referredEmail,
      item.status,
      item.referralCode,
      item.createdAt,
      item.verifiedAt || '',
      item.rewardAmount,
      item.rewardStatus,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${cell}"`).join(',')
      ),
    ].join('\n');

    return csvContent;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Generate unique referral code
   */
  private generateUniqueCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < this.codeLength; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Check if code exists
   */
  private async codeExists(code: string): Promise<boolean> {
    try {
      const exists = await this.dbClient.referralCode.findUnique({
        where: { code },
      });
      return !!exists;
    } catch {
      return false;
    }
  }

  /**
   * Clean up expired referrals
   */
  public async cleanupExpiredReferrals(): Promise<number> {
    try {
      const now = new Date();

      const result = await this.dbClient.referral.updateMany({
        where: {
          status: ReferralStatus.PENDING,
          expiresAt: { lt: now },
        },
        data: { status: ReferralStatus.EXPIRED },
      });

      logger.info(`Cleaned up ${result.count} expired referrals`);
      return result.count;
    } catch (error) {
      logger.error(`Failed to cleanup expired referrals: ${error}`);
      throw new Error(`Failed to cleanup expired referrals: ${error}`);
    }
  }

  /**
   * Get referral program stats summary
   */
  public async getReferralProgramStats(): Promise<any> {
    try {
      const totalReferrals = await this.dbClient.referral.count();
      const verifiedReferrals = await this.dbClient.referral.count({
        where: { status: ReferralStatus.VERIFIED },
      });

      const referralsThisMonth = await this.dbClient.referral.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      });

      const verifiedThisMonth = await this.dbClient.referral.count({
        where: {
          status: ReferralStatus.VERIFIED,
          verifiedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      });

      const totalRewardsPaid = await this.dbClient.referralReward.aggregate({
        _sum: { amount: true },
        where: { status: RewardStatus.PAID, rewardType: 'credit' },
      });

      return {
        totalReferrals,
        verifiedReferrals,
        conversionRate: totalReferrals > 0 ? (verifiedReferrals / totalReferrals) * 100 : 0,
        referralsThisMonth,
        verifiedThisMonth,
        totalRewardsPaid: totalRewardsPaid._sum.amount || 0,
      };
    } catch (error) {
      logger.error(`Failed to get referral program stats: ${error}`);
      throw new Error(`Failed to get referral program stats: ${error}`);
    }
  }
}

/**
 * Factory function to create referral service instance
 */
export function createReferralService(
  redisClient: Redis,
  dbClient: any
): ReferralService {
  return new ReferralService(redisClient, dbClient);
}
