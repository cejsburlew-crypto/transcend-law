// Escrow Payment Service
// Manages third-party payment holding via Stripe Connect
// Handles release conditions, disputes, fees, and reconciliation

import Stripe from 'stripe';
import { query } from '../database/connection';
import { sendEmailNotification } from './emailService';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// ============================================
// TYPES & INTERFACES
// ============================================

export interface EscrowAccount {
  id: string;
  escrowHoldingAccountId: string;
  balance: number;
  status: 'active' | 'suspended' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}

export interface EscrowHold {
  id: string;
  caseId: string;
  clientId: string;
  providerId: string;
  amount: number;
  currency: string;
  status: 'held' | 'released' | 'refunded' | 'disputed';
  releaseConditions: {
    requiresClientApproval: boolean;
    requiresProviderApproval: boolean;
    holdPeriodDays: number;
    holdUntilDate: Date;
  };
  fees: {
    escrowFeeAmount: number;
    escrowFeePercentage: number;
    whoPaysFee: 'client' | 'provider' | 'platform';
  };
  paymentIntentId: string;
  transferId?: string;
  createdAt: Date;
  releasedAt?: Date;
  refundedAt?: Date;
}

export interface Dispute {
  id: string;
  escrowHoldId: string;
  initiatedBy: string;
  reason: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  resolution?: string;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface AccountReconciliation {
  id: string;
  date: Date;
  totalHeld: number;
  totalReleased: number;
  totalRefunded: number;
  totalDisputed: number;
  platformFeeCollected: number;
  status: 'pending' | 'completed' | 'verified';
  verifiedAt?: Date;
}

// ============================================
// ESCROW ACCOUNT MANAGEMENT
// ============================================

export async function initializeEscrowAccount(): Promise<EscrowAccount> {
  try {
    // Create Stripe connected account for escrow holding
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      email: process.env.ESCROW_ADMIN_EMAIL || 'escrow@transcend-law.com',
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      business_profile: {
        name: 'Transcend Law Escrow Account',
        support_email: process.env.ESCROW_ADMIN_EMAIL || 'support@transcend-law.com',
      },
    });

    // Save to database
    const result = await query(
      `INSERT INTO escrow_accounts (stripe_account_id, balance, status)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [account.id, 0, 'active']
    );

    return {
      id: result.rows[0].id,
      escrowHoldingAccountId: account.id,
      balance: 0,
      status: 'active',
      createdAt: new Date(result.rows[0].created_at),
      updatedAt: new Date(result.rows[0].updated_at),
    };
  } catch (error) {
    console.error('Failed to initialize escrow account:', error);
    throw error;
  }
}

export async function getEscrowAccountBalance(): Promise<number> {
  try {
    const result = await query(
      `SELECT balance FROM escrow_accounts WHERE status = $1 ORDER BY created_at DESC LIMIT 1`,
      ['active']
    );

    if (result.rows.length === 0) {
      throw new Error('No active escrow account found');
    }

    return result.rows[0].balance;
  } catch (error) {
    console.error('Failed to get escrow balance:', error);
    throw error;
  }
}

// ============================================
// ESCROW HOLD CREATION
// ============================================

export async function createEscrowHold(
  caseId: string,
  clientId: string,
  providerId: string,
  amount: number,
  holdPeriodDays: number = 30,
  feePercentage: number = 2.5,
  whoPaysFee: 'client' | 'provider' | 'platform' = 'platform'
): Promise<EscrowHold> {
  try {
    // Validate amount
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    // Calculate escrow fee
    const escrowFeeAmount = Math.round((amount * feePercentage) / 100);
    const totalAmount = whoPaysFee === 'client' ? amount + escrowFeeAmount : amount;
    const holdUntilDate = new Date();
    holdUntilDate.setDate(holdUntilDate.getDate() + holdPeriodDays);

    // Get client payment method
    const clientResult = await query(
      `SELECT stripe_customer_id FROM users WHERE id = $1`,
      [clientId]
    );

    if (clientResult.rows.length === 0) {
      throw new Error('Client not found');
    }

    // Create payment intent for escrow
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount * 100, // Convert to cents
      currency: 'usd',
      customer: clientResult.rows[0].stripe_customer_id,
      description: `Escrow hold for case ${caseId}`,
      metadata: {
        caseId,
        clientId,
        providerId,
        escrowType: 'service_payment',
      },
      automatic_payment_methods: {
        enabled: true,
      },
      setup_future_usage: 'on_session',
    });

    // Save escrow hold to database
    const result = await query(
      `INSERT INTO escrow_holds
       (case_id, client_id, provider_id, amount, currency, status,
        requires_client_approval, requires_provider_approval,
        hold_period_days, hold_until_date,
        escrow_fee_amount, escrow_fee_percentage, who_pays_fee,
        payment_intent_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        caseId,
        clientId,
        providerId,
        amount,
        'usd',
        'held',
        true,
        false,
        holdPeriodDays,
        holdUntilDate,
        escrowFeeAmount,
        feePercentage,
        whoPaysFee,
        paymentIntent.id,
      ]
    );

    // Log audit trail
    await logEscrowActivity(
      'escrow_created',
      result.rows[0].id,
      clientId,
      `Escrow hold created: $${amount} for case ${caseId}`
    );

    return {
      id: result.rows[0].id,
      caseId,
      clientId,
      providerId,
      amount,
      currency: 'usd',
      status: 'held',
      releaseConditions: {
        requiresClientApproval: true,
        requiresProviderApproval: false,
        holdPeriodDays,
        holdUntilDate,
      },
      fees: {
        escrowFeeAmount,
        escrowFeePercentage: feePercentage,
        whoPaysFee,
      },
      paymentIntentId: paymentIntent.id,
      createdAt: new Date(result.rows[0].created_at),
    };
  } catch (error) {
    console.error('Failed to create escrow hold:', error);
    throw error;
  }
}

// ============================================
// ESCROW RELEASE LOGIC
// ============================================

export async function releaseEscrowFunds(
  escrowHoldId: string,
  reason: string,
  releasedBy: string
): Promise<EscrowHold> {
  try {
    // Get escrow hold details
    const holdResult = await query(
      `SELECT * FROM escrow_holds WHERE id = $1`,
      [escrowHoldId]
    );

    if (holdResult.rows.length === 0) {
      throw new Error('Escrow hold not found');
    }

    const hold = holdResult.rows[0];

    if (hold.status !== 'held') {
      throw new Error(`Cannot release escrow hold with status: ${hold.status}`);
    }

    // Check if release conditions are met
    if (hold.requires_client_approval && !hold.client_approved_at) {
      throw new Error('Client approval required before release');
    }

    // Get provider's Stripe account
    const providerResult = await query(
      `SELECT stripe_account_id FROM providers WHERE user_id = $1`,
      [hold.provider_id]
    );

    if (providerResult.rows.length === 0) {
      throw new Error('Provider account not found');
    }

    const providerStripeAccountId = providerResult.rows[0].stripe_account_id;

    // Get escrow account
    const escrowAccountResult = await query(
      `SELECT stripe_account_id FROM escrow_accounts WHERE status = $1 LIMIT 1`,
      ['active']
    );

    if (escrowAccountResult.rows.length === 0) {
      throw new Error('Escrow account not found');
    }

    // Transfer funds from escrow to provider
    let transferAmount = hold.amount;
    if (hold.who_pays_fee === 'platform') {
      // Platform pays the fee, provider gets full amount
      transferAmount = hold.amount;
    } else if (hold.who_pays_fee === 'provider') {
      // Provider pays fee, so we deduct it
      transferAmount = hold.amount - hold.escrow_fee_amount;
    }

    const transfer = await stripe.transfers.create({
      amount: transferAmount * 100, // cents
      currency: 'usd',
      destination: providerStripeAccountId,
      source_transaction: hold.payment_intent_id,
      description: `Escrow release for case ${hold.case_id}`,
      metadata: {
        escrowHoldId,
        caseId: hold.case_id,
        reason,
      },
    });

    // Update escrow hold
    const updatedHold = await query(
      `UPDATE escrow_holds
       SET status = $1, transfer_id = $2, released_at = NOW(), released_by = $3
       WHERE id = $4
       RETURNING *`,
      ['released', transfer.id, releasedBy, escrowHoldId]
    );

    // Update escrow account balance
    await query(
      `UPDATE escrow_accounts
       SET balance = balance - $1
       WHERE status = $2`,
      [transferAmount, 'active']
    );

    // Log audit trail
    await logEscrowActivity(
      'escrow_released',
      escrowHoldId,
      releasedBy,
      `Escrow released: $${transferAmount} to provider. Reason: ${reason}`
    );

    // Send notifications
    await sendEscrowReleaseNotifications(hold, transferAmount);

    return {
      id: updatedHold.rows[0].id,
      caseId: hold.case_id,
      clientId: hold.client_id,
      providerId: hold.provider_id,
      amount: hold.amount,
      currency: hold.currency,
      status: 'released',
      releaseConditions: {
        requiresClientApproval: hold.requires_client_approval,
        requiresProviderApproval: hold.requires_provider_approval,
        holdPeriodDays: hold.hold_period_days,
        holdUntilDate: new Date(hold.hold_until_date),
      },
      fees: {
        escrowFeeAmount: hold.escrow_fee_amount,
        escrowFeePercentage: hold.escrow_fee_percentage,
        whoPaysFee: hold.who_pays_fee,
      },
      paymentIntentId: hold.payment_intent_id,
      transferId: transfer.id,
      createdAt: new Date(hold.created_at),
      releasedAt: new Date(),
    };
  } catch (error) {
    console.error('Failed to release escrow funds:', error);
    throw error;
  }
}

export async function approveEscrowRelease(
  escrowHoldId: string,
  userId: string
): Promise<void> {
  try {
    // Get escrow hold
    const holdResult = await query(
      `SELECT * FROM escrow_holds WHERE id = $1`,
      [escrowHoldId]
    );

    if (holdResult.rows.length === 0) {
      throw new Error('Escrow hold not found');
    }

    const hold = holdResult.rows[0];

    // Verify user is authorized (client or provider)
    if (hold.client_id !== userId && hold.provider_id !== userId) {
      throw new Error('Unauthorized to approve this escrow hold');
    }

    // Update approval
    if (hold.client_id === userId) {
      await query(
        `UPDATE escrow_holds
         SET client_approved_at = NOW()
         WHERE id = $1`,
        [escrowHoldId]
      );
    } else if (hold.provider_id === userId) {
      await query(
        `UPDATE escrow_holds
         SET provider_approved_at = NOW()
         WHERE id = $1`,
        [escrowHoldId]
      );
    }

    // Log activity
    await logEscrowActivity(
      'escrow_approved',
      escrowHoldId,
      userId,
      'Escrow release approved'
    );
  } catch (error) {
    console.error('Failed to approve escrow release:', error);
    throw error;
  }
}

// ============================================
// AUTOMATIC RELEASE LOGIC
// ============================================

export async function processAutomaticEscrowReleases(): Promise<number> {
  try {
    // Find escrow holds that meet automatic release conditions
    const holds = await query(
      `SELECT * FROM escrow_holds
       WHERE status = $1
       AND hold_until_date <= NOW()
       AND client_approved_at IS NOT NULL`,
      ['held']
    );

    let releasedCount = 0;

    for (const hold of holds.rows) {
      try {
        await releaseEscrowFunds(
          hold.id,
          'Automatic release - hold period expired',
          'system'
        );
        releasedCount++;
      } catch (error) {
        console.error(`Failed to auto-release escrow hold ${hold.id}:`, error);
      }
    }

    console.log(`✅ Automatically released ${releasedCount} escrow holds`);
    return releasedCount;
  } catch (error) {
    console.error('Failed to process automatic escrow releases:', error);
    throw error;
  }
}

// ============================================
// REFUND LOGIC
// ============================================

export async function refundEscrowHold(
  escrowHoldId: string,
  reason: string,
  refundedBy: string
): Promise<EscrowHold> {
  try {
    // Get escrow hold
    const holdResult = await query(
      `SELECT * FROM escrow_holds WHERE id = $1`,
      [escrowHoldId]
    );

    if (holdResult.rows.length === 0) {
      throw new Error('Escrow hold not found');
    }

    const hold = holdResult.rows[0];

    if (hold.status !== 'held') {
      throw new Error(`Cannot refund escrow hold with status: ${hold.status}`);
    }

    // Refund payment intent
    const refund = await stripe.refunds.create({
      payment_intent: hold.payment_intent_id,
      reason: 'requested_by_customer',
      metadata: {
        escrowHoldId,
        reason,
        refundedBy,
      },
    });

    // Update escrow hold status
    const updatedHold = await query(
      `UPDATE escrow_holds
       SET status = $1, refunded_at = NOW(), refund_id = $2
       WHERE id = $3
       RETURNING *`,
      ['refunded', refund.id, escrowHoldId]
    );

    // Update escrow account balance (add back to account)
    const refundAmount =
      hold.who_pays_fee === 'client' ? hold.amount + hold.escrow_fee_amount : hold.amount;

    await query(
      `UPDATE escrow_accounts
       SET balance = balance + $1
       WHERE status = $2`,
      [refundAmount, 'active']
    );

    // Log activity
    await logEscrowActivity(
      'escrow_refunded',
      escrowHoldId,
      refundedBy,
      `Escrow refunded: $${refundAmount}. Reason: ${reason}`
    );

    // Send notifications
    await sendEscrowRefundNotifications(hold, refundAmount, reason);

    return {
      id: updatedHold.rows[0].id,
      caseId: hold.case_id,
      clientId: hold.client_id,
      providerId: hold.provider_id,
      amount: hold.amount,
      currency: hold.currency,
      status: 'refunded',
      releaseConditions: {
        requiresClientApproval: hold.requires_client_approval,
        requiresProviderApproval: hold.requires_provider_approval,
        holdPeriodDays: hold.hold_period_days,
        holdUntilDate: new Date(hold.hold_until_date),
      },
      fees: {
        escrowFeeAmount: hold.escrow_fee_amount,
        escrowFeePercentage: hold.escrow_fee_percentage,
        whoPaysFee: hold.who_pays_fee,
      },
      paymentIntentId: hold.payment_intent_id,
      createdAt: new Date(hold.created_at),
      refundedAt: new Date(),
    };
  } catch (error) {
    console.error('Failed to refund escrow hold:', error);
    throw error;
  }
}

// ============================================
// DISPUTE MANAGEMENT
// ============================================

export async function openDispute(
  escrowHoldId: string,
  initiatedBy: string,
  reason: string
): Promise<Dispute> {
  try {
    // Get escrow hold
    const holdResult = await query(
      `SELECT * FROM escrow_holds WHERE id = $1`,
      [escrowHoldId]
    );

    if (holdResult.rows.length === 0) {
      throw new Error('Escrow hold not found');
    }

    const hold = holdResult.rows[0];

    // Verify initiator is involved in the case
    if (hold.client_id !== initiatedBy && hold.provider_id !== initiatedBy) {
      throw new Error('Only involved parties can initiate a dispute');
    }

    // Create dispute
    const result = await query(
      `INSERT INTO escrow_disputes (escrow_hold_id, initiated_by, reason, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [escrowHoldId, initiatedBy, reason, 'open']
    );

    // Update escrow hold status
    await query(
      `UPDATE escrow_holds SET status = $1 WHERE id = $2`,
      ['disputed', escrowHoldId]
    );

    // Log activity
    await logEscrowActivity(
      'dispute_opened',
      escrowHoldId,
      initiatedBy,
      `Dispute opened: ${reason}`
    );

    // Notify admin and other party
    await sendDisputeNotifications(escrowHoldId, hold, reason);

    return {
      id: result.rows[0].id,
      escrowHoldId,
      initiatedBy,
      reason,
      status: 'open',
      createdAt: new Date(result.rows[0].created_at),
    };
  } catch (error) {
    console.error('Failed to open dispute:', error);
    throw error;
  }
}

export async function resolveDispute(
  disputeId: string,
  resolution: string,
  resolution_action: 'release' | 'refund',
  resolvedBy: string
): Promise<Dispute> {
  try {
    // Get dispute
    const disputeResult = await query(
      `SELECT * FROM escrow_disputes WHERE id = $1`,
      [disputeId]
    );

    if (disputeResult.rows.length === 0) {
      throw new Error('Dispute not found');
    }

    const dispute = disputeResult.rows[0];

    if (dispute.status !== 'open' && dispute.status !== 'investigating') {
      throw new Error(`Cannot resolve dispute with status: ${dispute.status}`);
    }

    // Get escrow hold
    const holdResult = await query(
      `SELECT * FROM escrow_holds WHERE id = $1`,
      [dispute.escrow_hold_id]
    );

    const hold = holdResult.rows[0];

    // Execute resolution action
    if (resolution_action === 'release') {
      await releaseEscrowFunds(
        dispute.escrow_hold_id,
        `Dispute resolved: ${resolution}`,
        resolvedBy
      );
    } else if (resolution_action === 'refund') {
      await refundEscrowHold(
        dispute.escrow_hold_id,
        `Dispute resolved: ${resolution}`,
        resolvedBy
      );
    }

    // Update dispute
    const updatedDispute = await query(
      `UPDATE escrow_disputes
       SET status = $1, resolution = $2, resolved_at = NOW(), resolved_by = $3
       WHERE id = $4
       RETURNING *`,
      ['resolved', resolution, resolvedBy, disputeId]
    );

    // Log activity
    await logEscrowActivity(
      'dispute_resolved',
      dispute.escrow_hold_id,
      resolvedBy,
      `Dispute resolved: ${resolution}`
    );

    return {
      id: updatedDispute.rows[0].id,
      escrowHoldId: dispute.escrow_hold_id,
      initiatedBy: dispute.initiated_by,
      reason: dispute.reason,
      status: 'resolved',
      resolution,
      createdAt: new Date(dispute.created_at),
      resolvedAt: new Date(),
    };
  } catch (error) {
    console.error('Failed to resolve dispute:', error);
    throw error;
  }
}

export async function getDispute(disputeId: string): Promise<Dispute | null> {
  try {
    const result = await query(
      `SELECT * FROM escrow_disputes WHERE id = $1`,
      [disputeId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const dispute = result.rows[0];
    return {
      id: dispute.id,
      escrowHoldId: dispute.escrow_hold_id,
      initiatedBy: dispute.initiated_by,
      reason: dispute.reason,
      status: dispute.status,
      resolution: dispute.resolution,
      createdAt: new Date(dispute.created_at),
      resolvedAt: dispute.resolved_at ? new Date(dispute.resolved_at) : undefined,
    };
  } catch (error) {
    console.error('Failed to get dispute:', error);
    throw error;
  }
}

// ============================================
// ACCOUNT RECONCILIATION
// ============================================

export async function reconcileEscrowAccounts(): Promise<AccountReconciliation> {
  try {
    // Get all escrow statistics for today
    const stats = await query(
      `SELECT
        COUNT(CASE WHEN status = 'held' THEN 1 END) as held_count,
        COUNT(CASE WHEN status = 'released' THEN 1 END) as released_count,
        COUNT(CASE WHEN status = 'refunded' THEN 1 END) as refunded_count,
        COUNT(CASE WHEN status = 'disputed' THEN 1 END) as disputed_count,
        COALESCE(SUM(CASE WHEN status = 'held' THEN amount ELSE 0 END), 0) as total_held,
        COALESCE(SUM(CASE WHEN status = 'released' THEN amount ELSE 0 END), 0) as total_released,
        COALESCE(SUM(CASE WHEN status = 'refunded' THEN amount ELSE 0 END), 0) as total_refunded,
        COALESCE(SUM(CASE WHEN status = 'disputed' THEN amount ELSE 0 END), 0) as total_disputed,
        COALESCE(SUM(CASE WHEN who_pays_fee = 'platform' THEN escrow_fee_amount ELSE 0 END), 0) as platform_fees
       FROM escrow_holds
       WHERE DATE(created_at) = CURRENT_DATE`
    );

    const stats_row = stats.rows[0];

    // Create reconciliation record
    const result = await query(
      `INSERT INTO escrow_reconciliations
       (date, total_held, total_released, total_refunded, total_disputed, platform_fee_collected, status)
       VALUES (NOW(), $1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        parseFloat(stats_row.total_held),
        parseFloat(stats_row.total_released),
        parseFloat(stats_row.total_refunded),
        parseFloat(stats_row.total_disputed),
        parseFloat(stats_row.platform_fees),
        'completed',
      ]
    );

    // Verify account balance
    const accountResult = await query(
      `SELECT balance FROM escrow_accounts WHERE status = $1 LIMIT 1`,
      ['active']
    );

    if (accountResult.rows.length > 0) {
      const expectedBalance = parseFloat(stats_row.total_held);
      const actualBalance = accountResult.rows[0].balance;

      if (Math.abs(expectedBalance - actualBalance) > 0.01) {
        console.warn(
          `⚠️  Escrow account reconciliation mismatch: expected $${expectedBalance}, got $${actualBalance}`
        );
      }
    }

    return {
      id: result.rows[0].id,
      date: new Date(result.rows[0].date),
      totalHeld: parseFloat(stats_row.total_held),
      totalReleased: parseFloat(stats_row.total_released),
      totalRefunded: parseFloat(stats_row.total_refunded),
      totalDisputed: parseFloat(stats_row.total_disputed),
      platformFeeCollected: parseFloat(stats_row.platform_fees),
      status: 'completed',
      verifiedAt: new Date(),
    };
  } catch (error) {
    console.error('Failed to reconcile escrow accounts:', error);
    throw error;
  }
}

export async function getReconciliationHistory(
  days: number = 30
): Promise<AccountReconciliation[]> {
  try {
    const result = await query(
      `SELECT * FROM escrow_reconciliations
       WHERE date >= NOW() - INTERVAL '${days} days'
       ORDER BY date DESC`,
      []
    );

    return result.rows.map((row) => ({
      id: row.id,
      date: new Date(row.date),
      totalHeld: parseFloat(row.total_held),
      totalReleased: parseFloat(row.total_released),
      totalRefunded: parseFloat(row.total_refunded),
      totalDisputed: parseFloat(row.total_disputed),
      platformFeeCollected: parseFloat(row.platform_fee_collected),
      status: row.status,
      verifiedAt: row.verified_at ? new Date(row.verified_at) : undefined,
    }));
  } catch (error) {
    console.error('Failed to get reconciliation history:', error);
    throw error;
  }
}

// ============================================
// ESCROW HOLD QUERIES
// ============================================

export async function getEscrowHold(escrowHoldId: string): Promise<EscrowHold | null> {
  try {
    const result = await query(
      `SELECT * FROM escrow_holds WHERE id = $1`,
      [escrowHoldId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const hold = result.rows[0];
    return {
      id: hold.id,
      caseId: hold.case_id,
      clientId: hold.client_id,
      providerId: hold.provider_id,
      amount: parseFloat(hold.amount),
      currency: hold.currency,
      status: hold.status,
      releaseConditions: {
        requiresClientApproval: hold.requires_client_approval,
        requiresProviderApproval: hold.requires_provider_approval,
        holdPeriodDays: hold.hold_period_days,
        holdUntilDate: new Date(hold.hold_until_date),
      },
      fees: {
        escrowFeeAmount: parseFloat(hold.escrow_fee_amount),
        escrowFeePercentage: parseFloat(hold.escrow_fee_percentage),
        whoPaysFee: hold.who_pays_fee,
      },
      paymentIntentId: hold.payment_intent_id,
      transferId: hold.transfer_id,
      createdAt: new Date(hold.created_at),
      releasedAt: hold.released_at ? new Date(hold.released_at) : undefined,
      refundedAt: hold.refunded_at ? new Date(hold.refunded_at) : undefined,
    };
  } catch (error) {
    console.error('Failed to get escrow hold:', error);
    throw error;
  }
}

export async function getEscrowHoldsByCase(caseId: string): Promise<EscrowHold[]> {
  try {
    const result = await query(
      `SELECT * FROM escrow_holds WHERE case_id = $1 ORDER BY created_at DESC`,
      [caseId]
    );

    return result.rows.map((hold) => ({
      id: hold.id,
      caseId: hold.case_id,
      clientId: hold.client_id,
      providerId: hold.provider_id,
      amount: parseFloat(hold.amount),
      currency: hold.currency,
      status: hold.status,
      releaseConditions: {
        requiresClientApproval: hold.requires_client_approval,
        requiresProviderApproval: hold.requires_provider_approval,
        holdPeriodDays: hold.hold_period_days,
        holdUntilDate: new Date(hold.hold_until_date),
      },
      fees: {
        escrowFeeAmount: parseFloat(hold.escrow_fee_amount),
        escrowFeePercentage: parseFloat(hold.escrow_fee_percentage),
        whoPaysFee: hold.who_pays_fee,
      },
      paymentIntentId: hold.payment_intent_id,
      transferId: hold.transfer_id,
      createdAt: new Date(hold.created_at),
      releasedAt: hold.released_at ? new Date(hold.released_at) : undefined,
      refundedAt: hold.refunded_at ? new Date(hold.refunded_at) : undefined,
    }));
  } catch (error) {
    console.error('Failed to get escrow holds by case:', error);
    throw error;
  }
}

export async function getEscrowHoldsByUser(
  userId: string,
  userType: 'client' | 'provider'
): Promise<EscrowHold[]> {
  try {
    const column = userType === 'client' ? 'client_id' : 'provider_id';
    const result = await query(
      `SELECT * FROM escrow_holds WHERE ${column} = $1 ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows.map((hold) => ({
      id: hold.id,
      caseId: hold.case_id,
      clientId: hold.client_id,
      providerId: hold.provider_id,
      amount: parseFloat(hold.amount),
      currency: hold.currency,
      status: hold.status,
      releaseConditions: {
        requiresClientApproval: hold.requires_client_approval,
        requiresProviderApproval: hold.requires_provider_approval,
        holdPeriodDays: hold.hold_period_days,
        holdUntilDate: new Date(hold.hold_until_date),
      },
      fees: {
        escrowFeeAmount: parseFloat(hold.escrow_fee_amount),
        escrowFeePercentage: parseFloat(hold.escrow_fee_percentage),
        whoPaysFee: hold.who_pays_fee,
      },
      paymentIntentId: hold.payment_intent_id,
      transferId: hold.transfer_id,
      createdAt: new Date(hold.created_at),
      releasedAt: hold.released_at ? new Date(hold.released_at) : undefined,
      refundedAt: hold.refunded_at ? new Date(hold.refunded_at) : undefined,
    }));
  } catch (error) {
    console.error('Failed to get escrow holds by user:', error);
    throw error;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function logEscrowActivity(
  action: string,
  escrowHoldId: string,
  userId: string,
  description: string
): Promise<void> {
  try {
    await query(
      `INSERT INTO escrow_audit_log (escrow_hold_id, action, user_id, description)
       VALUES ($1, $2, $3, $4)`,
      [escrowHoldId, action, userId, description]
    );
  } catch (error) {
    console.error('Failed to log escrow activity:', error);
  }
}

async function sendEscrowReleaseNotifications(
  hold: any,
  amount: number
): Promise<void> {
  try {
    // Get user emails
    const clientResult = await query(`SELECT email FROM users WHERE id = $1`, [
      hold.client_id,
    ]);
    const providerResult = await query(`SELECT email FROM users WHERE id = $1`, [
      hold.provider_id,
    ]);

    if (clientResult.rows.length > 0) {
      await sendEmailNotification(
        clientResult.rows[0].email,
        'Escrow Funds Released',
        `Your escrow hold of $${amount} has been released to the service provider.`
      );
    }

    if (providerResult.rows.length > 0) {
      await sendEmailNotification(
        providerResult.rows[0].email,
        'Escrow Payment Received',
        `You have received an escrow payment of $${amount}.`
      );
    }
  } catch (error) {
    console.error('Failed to send escrow release notifications:', error);
  }
}

async function sendEscrowRefundNotifications(
  hold: any,
  amount: number,
  reason: string
): Promise<void> {
  try {
    const clientResult = await query(`SELECT email FROM users WHERE id = $1`, [
      hold.client_id,
    ]);

    if (clientResult.rows.length > 0) {
      await sendEmailNotification(
        clientResult.rows[0].email,
        'Escrow Refund Processed',
        `Your escrow hold of $${amount} has been refunded. Reason: ${reason}`
      );
    }
  } catch (error) {
    console.error('Failed to send escrow refund notifications:', error);
  }
}

async function sendDisputeNotifications(
  escrowHoldId: string,
  hold: any,
  reason: string
): Promise<void> {
  try {
    // Notify admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@transcend-law.com';
    await sendEmailNotification(
      adminEmail,
      'Escrow Dispute Opened',
      `A dispute has been opened for escrow hold ${escrowHoldId}. Reason: ${reason}`
    );

    // Notify both parties
    const clientResult = await query(`SELECT email FROM users WHERE id = $1`, [
      hold.client_id,
    ]);
    const providerResult = await query(`SELECT email FROM users WHERE id = $1`, [
      hold.provider_id,
    ]);

    if (clientResult.rows.length > 0) {
      await sendEmailNotification(
        clientResult.rows[0].email,
        'Escrow Dispute Opened',
        `A dispute has been opened on your escrow payment. Our team will investigate and resolve this matter.`
      );
    }

    if (providerResult.rows.length > 0) {
      await sendEmailNotification(
        providerResult.rows[0].email,
        'Escrow Dispute Opened',
        `A dispute has been opened on your escrow payment. Our team will investigate and resolve this matter.`
      );
    }
  } catch (error) {
    console.error('Failed to send dispute notifications:', error);
  }
}

export default {
  initializeEscrowAccount,
  getEscrowAccountBalance,
  createEscrowHold,
  releaseEscrowFunds,
  approveEscrowRelease,
  processAutomaticEscrowReleases,
  refundEscrowHold,
  openDispute,
  resolveDispute,
  getDispute,
  reconcileEscrowAccounts,
  getReconciliationHistory,
  getEscrowHold,
  getEscrowHoldsByCase,
  getEscrowHoldsByUser,
};
