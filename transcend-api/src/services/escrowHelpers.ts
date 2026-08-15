// Escrow Helper Utilities
// Utility functions for escrow calculations, conversions, and common operations

/**
 * Calculate escrow fees based on service amount and fee percentage
 */
export function calculateEscrowFee(amount: number, feePercentage: number): number {
  return Math.round((amount * feePercentage) / 100 * 100) / 100;
}

/**
 * Calculate total amount to charge based on fee payment model
 */
export function calculateTotalCharge(
  serviceAmount: number,
  feePercentage: number,
  whoPaysFee: 'client' | 'provider' | 'platform'
): { totalCharge: number; platformFee: number; providerReceives: number } {
  const platformFee = calculateEscrowFee(serviceAmount, feePercentage);

  switch (whoPaysFee) {
    case 'client':
      return {
        totalCharge: serviceAmount + platformFee,
        platformFee,
        providerReceives: serviceAmount,
      };

    case 'provider':
      return {
        totalCharge: serviceAmount,
        platformFee,
        providerReceives: serviceAmount - platformFee,
      };

    case 'platform':
      return {
        totalCharge: serviceAmount,
        platformFee,
        providerReceives: serviceAmount,
      };
  }
}

/**
 * Convert dollars to cents for Stripe
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Convert cents to dollars
 */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  });
  return formatter.format(amount);
}

/**
 * Calculate days remaining in hold period
 */
export function calculateDaysRemaining(holdUntilDate: Date | string): number {
  const until = typeof holdUntilDate === 'string' ? new Date(holdUntilDate) : holdUntilDate;
  const now = new Date();
  const diff = until.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Check if hold is overdue for release
 */
export function isHoldOverdue(holdUntilDate: Date | string): boolean {
  const until = typeof holdUntilDate === 'string' ? new Date(holdUntilDate) : holdUntilDate;
  return until <= new Date();
}

/**
 * Check if hold is expiring soon (within 3 days)
 */
export function isHoldExpiringSoon(holdUntilDate: Date | string): boolean {
  const daysRemaining = calculateDaysRemaining(holdUntilDate);
  return daysRemaining > 0 && daysRemaining <= 3;
}

/**
 * Get human-readable hold status
 */
export function getHoldStatusDescription(status: string): string {
  const descriptions: Record<string, string> = {
    held: 'Funds are being held in escrow',
    released: 'Funds have been released to provider',
    refunded: 'Funds have been refunded to client',
    disputed: 'Funds are held pending dispute resolution',
  };
  return descriptions[status] || 'Unknown status';
}

/**
 * Validate Stripe account ID format
 */
export function isValidStripeAccountId(accountId: string): boolean {
  return /^acct_[A-Za-z0-9]{16,}$/.test(accountId);
}

/**
 * Validate Stripe payment intent ID format
 */
export function isValidPaymentIntentId(intentId: string): boolean {
  return /^pi_[A-Za-z0-9]{16,}$/.test(intentId);
}

/**
 * Validate Stripe transfer ID format
 */
export function isValidTransferId(transferId: string): boolean {
  return /^tr_[A-Za-z0-9]{16,}$/.test(transferId);
}

/**
 * Determine if release should be automatic based on conditions
 */
export function shouldAutoRelease(hold: {
  status: string;
  clientApprovedAt?: Date;
  holdUntilDate: Date;
  hasDispute: boolean;
}): boolean {
  // Conditions for automatic release:
  // 1. Status is 'held'
  // 2. Client has approved (if required)
  // 3. Hold period has passed
  // 4. No active dispute

  if (hold.status !== 'held') return false;
  if (!hold.clientApprovedAt) return false;
  if (!isHoldOverdue(hold.holdUntilDate)) return false;
  if (hold.hasDispute) return false;

  return true;
}

/**
 * Get recommended hold period based on service type
 */
export function getRecommendedHoldPeriod(serviceType: string): number {
  const holdPeriods: Record<string, number> = {
    'legal-consultation': 7,
    'document-review': 14,
    'contract-drafting': 21,
    'case-representation': 30,
    'notary-services': 3,
    'tax-preparation': 14,
    'estate-planning': 30,
    'real-estate': 21,
  };
  return holdPeriods[serviceType] || 30; // Default: 30 days
}

/**
 * Get recommended fee percentage based on service type
 */
export function getRecommendedFeePercentage(serviceType: string): number {
  const feePercentages: Record<string, number> = {
    'legal-consultation': 2.9,
    'document-review': 2.5,
    'contract-drafting': 2.5,
    'case-representation': 3.0,
    'notary-services': 1.5,
    'tax-preparation': 2.0,
    'estate-planning': 2.5,
    'real-estate': 2.5,
  };
  return feePercentages[serviceType] || 2.5; // Default: 2.5%
}

/**
 * Generate escrow reference number
 */
export function generateEscrowReference(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ESC-${timestamp}-${random}`;
}

/**
 * Parse Stripe error and return user-friendly message
 */
export function parseStripeError(error: any): string {
  if (error.type === 'StripeCardError') {
    return `Card error: ${error.message}`;
  } else if (error.type === 'StripeRateLimitError') {
    return 'Too many requests. Please try again later.';
  } else if (error.type === 'StripeInvalidRequestError') {
    return `Invalid request: ${error.message}`;
  } else if (error.type === 'StripeAPIError') {
    return 'Payment service error. Please try again.';
  } else if (error.type === 'StripeAuthenticationError') {
    return 'Payment authentication failed.';
  }
  return error.message || 'An error occurred processing your payment.';
}

/**
 * Create audit trail entry metadata
 */
export function createAuditMetadata(action: string, details: Record<string, any>): Record<string, any> {
  return {
    action,
    timestamp: new Date().toISOString(),
    ...details,
  };
}

/**
 * Check if dispute should be escalated
 */
export function shouldEscalateDispute(dispute: {
  createdAt: Date;
  status: string;
  amount: number;
}): boolean {
  const now = new Date();
  const daysOpen = (now.getTime() - dispute.createdAt.getTime()) / (1000 * 60 * 60 * 24);

  // Escalate if:
  // 1. Open for more than 7 days
  // 2. Amount is > $2500
  // 3. Status is 'investigating'

  return daysOpen > 7 || dispute.amount > 2500 || dispute.status === 'investigating';
}

/**
 * Validate escrow configuration
 */
export function validateEscrowConfig(config: {
  feePercentage: number;
  holdPeriodDays: number;
  whoPaysFee: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.feePercentage < 0 || config.feePercentage > 10) {
    errors.push('Fee percentage must be between 0 and 10');
  }

  if (config.holdPeriodDays < 1 || config.holdPeriodDays > 365) {
    errors.push('Hold period must be between 1 and 365 days');
  }

  if (!['client', 'provider', 'platform'].includes(config.whoPaysFee)) {
    errors.push('Fee must be paid by client, provider, or platform');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get dispute resolution options
 */
export function getDisputeResolutionOptions(
  amount: number,
  createdAt: Date
): {
  option: string;
  description: string;
  recommended: boolean;
}[] {
  const daysSinceCreated = (new Date().getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  const options = [
    {
      option: 'release',
      description: 'Release full amount to provider',
      recommended: daysSinceCreated > 14,
    },
    {
      option: 'refund',
      description: 'Refund full amount to client',
      recommended: daysSinceCreated < 3,
    },
    {
      option: 'split',
      description: 'Split amount between client and provider (manual)',
      recommended: daysSinceCreated >= 3 && daysSinceCreated <= 14,
    },
  ];

  return options;
}

/**
 * Generate escrow summary for reporting
 */
export function generateEscrowSummary(stats: {
  totalHeld: number;
  totalReleased: number;
  totalRefunded: number;
  totalDisputed: number;
  platformFeeCollected: number;
}): string {
  const total = stats.totalHeld + stats.totalReleased + stats.totalRefunded + stats.totalDisputed;

  return `
Escrow Summary:
- Total Held: ${formatCurrency(stats.totalHeld)}
- Total Released: ${formatCurrency(stats.totalReleased)} (${((stats.totalReleased / total) * 100).toFixed(1)}%)
- Total Refunded: ${formatCurrency(stats.totalRefunded)} (${((stats.totalRefunded / total) * 100).toFixed(1)}%)
- Total Disputed: ${formatCurrency(stats.totalDisputed)} (${((stats.totalDisputed / total) * 100).toFixed(1)}%)
- Platform Fees: ${formatCurrency(stats.platformFeeCollected)}
  `.trim();
}

/**
 * Calculate days until automatic release
 */
export function daysUntilAutoRelease(hold: {
  holdUntilDate: Date;
  clientApprovedAt?: Date;
}): number | null {
  if (!hold.clientApprovedAt) return null;

  const daysRemaining = calculateDaysRemaining(hold.holdUntilDate);
  return daysRemaining > 0 ? daysRemaining : 0;
}

/**
 * Get next reconciliation date
 */
export function getNextReconciliationDate(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(3, 0, 0, 0); // 3 AM
  return tomorrow;
}

/**
 * Check if reconciliation is overdue
 */
export function isReconciliationOverdue(lastReconciliation: Date): boolean {
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  return lastReconciliation < yesterday;
}

export default {
  calculateEscrowFee,
  calculateTotalCharge,
  dollarsToCents,
  centsToDollars,
  formatCurrency,
  calculateDaysRemaining,
  isHoldOverdue,
  isHoldExpiringSoon,
  getHoldStatusDescription,
  isValidStripeAccountId,
  isValidPaymentIntentId,
  isValidTransferId,
  shouldAutoRelease,
  getRecommendedHoldPeriod,
  getRecommendedFeePercentage,
  generateEscrowReference,
  parseStripeError,
  createAuditMetadata,
  shouldEscalateDispute,
  validateEscrowConfig,
  getDisputeResolutionOptions,
  generateEscrowSummary,
  daysUntilAutoRelease,
  getNextReconciliationDate,
  isReconciliationOverdue,
};
