// Notification dispatch.
//
// services/fraudDetection.ts imported './notificationService', which did not
// exist. Email is the only channel wired up today; push/SMS hooks belong here.
//
// Note: the email service is template-driven (`sendEmail(to, templateKey,
// context)`), so notifications must name a template rather than pass free-form
// subject/body. Anything without one is logged, not silently dropped.

import { sendEmail, emailTemplates } from '../src/services/emailService';
import { logger } from '../src/utils/logger';

const log = logger.child('notifications');

export type EmailTemplateKey = keyof typeof emailTemplates;

export interface Notification {
  userId?: string;
  email?: string;
  template?: EmailTemplateKey;
  context?: Record<string, any>;
  /** Used for the log line when no template applies. */
  reason?: string;
  severity?: 'info' | 'warning' | 'critical';
}

/** Send a notification. Never throws: a failed notice must not abort its caller. */
export const sendNotification = async (notification: Notification): Promise<void> => {
  try {
    if (notification.email && notification.template) {
      await sendEmail(notification.email, notification.template, notification.context);
      return;
    }

    log.warn('notification not deliverable - no email/template', {
      userId: notification.userId,
      reason: notification.reason,
      severity: notification.severity,
    });
  } catch (error) {
    log.error('failed to send notification', error);
  }
};

/**
 * Operational alert. Distinct from sendNotification so alerting can be routed
 * to on-call rather than a client mailbox later.
 */
export const sendAlert = async (
  subjectOrUserId: string,
  subjectOrDetail?: string | Record<string, any>,
  detail?: Record<string, any>
): Promise<void> => {
  // Two shapes in use: sendAlert(subject, detail) and
  // sendAlert(userId, subject, detail).
  const isUserScoped = typeof subjectOrDetail === 'string';
  const subject = isUserScoped ? (subjectOrDetail as string) : subjectOrUserId;
  const context = isUserScoped ? detail : (subjectOrDetail as Record<string, any> | undefined);

  log.warn(`ALERT: ${subject}`, {
    ...(isUserScoped ? { userId: subjectOrUserId } : {}),
    ...(context || {}),
  });
};

export const notificationService = { send: sendNotification, sendNotification, sendAlert };
export default notificationService;
