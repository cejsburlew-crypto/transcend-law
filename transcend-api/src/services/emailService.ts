// Email Service
// SendGrid integration for notifications

import sgMail from '@sendgrid/mail';
import { query } from '../database/connection';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@transcend-law.com';

// ============================================
// EMAIL TEMPLATES
// ============================================

interface EmailContext {
  [key: string]: string | number | boolean;
}

const emailTemplates = {
  // Auth emails
  welcomeClient: {
    subject: 'Welcome to Transcend Law',
    template: 'welcome-client',
    type: 'transactional',
  },
  welcomeAttorney: {
    subject: 'Welcome to Transcend Law - Attorney Dashboard',
    template: 'welcome-attorney',
    type: 'transactional',
  },

  // Case emails
  caseSubmitted: {
    subject: 'Your case has been submitted to attorneys',
    template: 'case-submitted',
    type: 'transactional',
  },
  newCaseOpportunity: {
    subject: 'New case opportunity - {serviceType}',
    template: 'new-case-opportunity',
    type: 'transactional',
  },
  caseQuote: {
    subject: 'You received a quote from {attorneyName}',
    template: 'case-quote',
    type: 'transactional',
  },

  // Subscription emails
  subscriptionConfirmed: {
    subject: 'Your {planType} subscription is active',
    template: 'subscription-confirmed',
    type: 'transactional',
  },
  subscriptionUpgraded: {
    subject: 'Your plan has been upgraded to {newPlanType}',
    template: 'subscription-upgraded',
    type: 'transactional',
  },
  invoiceReady: {
    subject: 'Your invoice is ready - ${amount}',
    template: 'invoice-ready',
    type: 'transactional',
  },
  paymentFailed: {
    subject: 'Payment failed - Action required',
    template: 'payment-failed',
    type: 'transactional',
  },

  // Communication emails
  newMessage: {
    subject: 'New message from {senderName}',
    template: 'new-message',
    type: 'transactional',
  },

  // Notification emails
  caseAccepted: {
    subject: 'Your case has been accepted by {attorneyName}',
    template: 'case-accepted',
    type: 'transactional',
  },
};

// ============================================
// SEND EMAIL
// ============================================

export async function sendEmail(
  to: string,
  templateKey: keyof typeof emailTemplates,
  context?: EmailContext
): Promise<void> {
  try {
    const template = emailTemplates[templateKey];

    if (!template) {
      throw new Error(`Email template not found: ${templateKey}`);
    }

    // Replace variables in subject
    let subject = template.subject;
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        subject = subject.replace(`{${key}}`, String(value));
      });
    }

    // Build HTML body based on template
    const htmlBody = buildEmailBody(templateKey, context || {});

    const msg = {
      to,
      from: FROM_EMAIL,
      subject,
      html: htmlBody,
      text: htmlBody.replace(/<[^>]*>/g, ''), // Strip HTML tags for plain text
    };

    await sgMail.send(msg as any);
    console.log(`✅ Email sent to ${to}: ${templateKey}`);
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

export async function sendBatchEmails(
  recipients: Array<{ email: string; context: EmailContext }>,
  templateKey: keyof typeof emailTemplates
): Promise<void> {
  try {
    const template = emailTemplates[templateKey];

    if (!template) {
      throw new Error(`Email template not found: ${templateKey}`);
    }

    const messages = recipients.map((recipient) => {
      let subject = template.subject;
      if (recipient.context) {
        Object.entries(recipient.context).forEach(([key, value]) => {
          subject = subject.replace(`{${key}}`, String(value));
        });
      }

      const htmlBody = buildEmailBody(templateKey, recipient.context || {});

      return {
        to: recipient.email,
        from: FROM_EMAIL,
        subject,
        html: htmlBody,
        text: htmlBody.replace(/<[^>]*>/g, ''),
      };
    });

    await sgMail.sendMultiple(messages as any);
    console.log(`✅ Batch emails sent to ${recipients.length} recipients`);
  } catch (error) {
    console.error('Failed to send batch emails:', error);
    throw error;
  }
}

// ============================================
// EMAIL TEMPLATES - HTML BUILDERS
// ============================================

function buildEmailBody(
  templateKey: keyof typeof emailTemplates,
  context: EmailContext
): string {
  const baseStyle = `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
      .header h1 { margin: 0; font-size: 28px; }
      .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
      .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
      .footer { color: #999; font-size: 12px; text-align: center; margin-top: 20px; }
      .alert { background: #fef3cd; border: 1px solid #ffc107; color: #856404; padding: 15px; border-radius: 4px; margin: 20px 0; }
    </style>
  `;

  const templates: { [key: string]: string } = {
    // Welcome emails
    'welcome-client': `
      ${baseStyle}
      <div class="container">
        <div class="header">
          <h1>Welcome to Transcend Law</h1>
        </div>
        <div class="content">
          <p>Hello ${context.firstName},</p>
          <p>Welcome to the Transcend Law platform! We're excited to help you find the perfect legal representation.</p>
          <p>Here's what you can do:</p>
          <ul>
            <li>Submit cases and get quotes from qualified attorneys</li>
            <li>Communicate directly with attorneys</li>
            <li>Track your cases in real-time</li>
            <li>Access documents and invoices</li>
          </ul>
          <p><a href="${process.env.APP_URL || 'https://transcend-law.com'}/dashboard" class="button">Go to Dashboard</a></p>
          <div class="footer">
            <p>© 2026 Transcend Law. All rights reserved.</p>
          </div>
        </div>
      </div>
    `,

    'welcome-attorney': `
      ${baseStyle}
      <div class="container">
        <div class="header">
          <h1>Welcome to Transcend Law</h1>
          <p>Attorney Dashboard</p>
        </div>
        <div class="content">
          <p>Hello ${context.firstName},</p>
          <p>Your attorney profile is now active on Transcend Law!</p>
          <p>Start accepting cases from clients looking for your expertise.</p>
          <p><a href="${process.env.APP_URL || 'https://transcend-law.com'}/attorney/opportunities" class="button">View Opportunities</a></p>
          <div class="footer">
            <p>© 2026 Transcend Law. All rights reserved.</p>
          </div>
        </div>
      </div>
    `,

    // Case emails
    'case-submitted': `
      ${baseStyle}
      <div class="container">
        <div class="header">
          <h1>Case Submitted Successfully</h1>
        </div>
        <div class="content">
          <p>Hello ${context.clientName},</p>
          <p>Your case "<strong>${context.caseTitle}</strong>" has been submitted to attorneys in your area.</p>
          <p><strong>Case Details:</strong></p>
          <ul>
            <li>Service Type: ${context.serviceType}</li>
            <li>Budget: $${context.budgetMin} - $${context.budgetMax}</li>
            <li>Urgency: ${context.urgency}</li>
          </ul>
          <p>You'll hear from qualified attorneys within 24 hours.</p>
          <p><a href="${process.env.APP_URL || 'https://transcend-law.com'}/cases/${context.caseId}" class="button">View Case</a></p>
          <div class="footer">
            <p>© 2026 Transcend Law. All rights reserved.</p>
          </div>
        </div>
      </div>
    `,

    'case-quote': `
      ${baseStyle}
      <div class="container">
        <div class="header">
          <h1>New Quote Received</h1>
        </div>
        <div class="content">
          <p>Hello ${context.clientName},</p>
          <p><strong>${context.attorneyName}</strong> has sent you a quote for your case.</p>
          <p><strong>Quote Amount:</strong> $${context.quoteAmount}</p>
          <p><a href="${process.env.APP_URL || 'https://transcend-law.com'}/offers/${context.offerId}" class="button">View Quote</a></p>
          <div class="footer">
            <p>© 2026 Transcend Law. All rights reserved.</p>
          </div>
        </div>
      </div>
    `,

    // Subscription emails
    'subscription-confirmed': `
      ${baseStyle}
      <div class="container">
        <div class="header">
          <h1>Subscription Confirmed</h1>
        </div>
        <div class="content">
          <p>Hello ${context.firstName},</p>
          <p>Your <strong>${context.planType}</strong> subscription is now active!</p>
          <p><strong>Monthly Charge:</strong> $${context.amount}</p>
          <p><a href="${process.env.APP_URL || 'https://transcend-law.com'}/settings/subscription" class="button">Manage Subscription</a></p>
          <div class="footer">
            <p>© 2026 Transcend Law. All rights reserved.</p>
          </div>
        </div>
      </div>
    `,

    'payment-failed': `
      ${baseStyle}
      <div class="container">
        <div class="header" style="background: #dc3545;">
          <h1>Payment Failed</h1>
        </div>
        <div class="content">
          <p>Hello ${context.firstName},</p>
          <div class="alert">
            <strong>Your payment could not be processed.</strong>
          </div>
          <p>Your subscription may be interrupted if payment is not updated.</p>
          <p><a href="${process.env.APP_URL || 'https://transcend-law.com'}/settings/billing" class="button">Update Payment Method</a></p>
          <div class="footer">
            <p>© 2026 Transcend Law. All rights reserved.</p>
          </div>
        </div>
      </div>
    `,

    // Message notification
    'new-message': `
      ${baseStyle}
      <div class="container">
        <div class="header">
          <h1>New Message</h1>
        </div>
        <div class="content">
          <p>Hello ${context.recipientName},</p>
          <p>You have a new message from <strong>${context.senderName}</strong>.</p>
          <p><em>"${context.messagePreview}"</em></p>
          <p><a href="${process.env.APP_URL || 'https://transcend-law.com'}/messages" class="button">View Full Conversation</a></p>
          <div class="footer">
            <p>© 2026 Transcend Law. All rights reserved.</p>
          </div>
        </div>
      </div>
    `,
  };

  return templates[templateKey] || 'Email template not found';
}

// ============================================
// NOTIFICATION QUEUE
// ============================================

export async function queueEmailNotification(
  recipientId: string,
  templateKey: keyof typeof emailTemplates,
  context: EmailContext,
  delayMinutes: number = 0
): Promise<void> {
  try {
    // Get recipient email
    const result = await query(
      'SELECT email FROM users WHERE id = $1',
      [recipientId]
    );

    if (result.rows.length === 0) {
      throw new Error('Recipient not found');
    }

    const email = result.rows[0].email;

    if (delayMinutes > 0) {
      // Schedule for later (implement with job queue like Bull/BullMQ in production)
      console.log(`📋 Queued email to ${email} for ${delayMinutes} minutes later`);
    } else {
      // Send immediately
      await sendEmail(email, templateKey, context);
    }
  } catch (error) {
    console.error('Failed to queue email:', error);
    throw error;
  }
}

export default {
  sendEmail,
  sendBatchEmails,
  queueEmailNotification,
  emailTemplates,
};
