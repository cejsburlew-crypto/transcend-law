// Shim: services/* imported './emailService', but the implementation lives in
// src/services/emailService.ts. Re-exported rather than duplicated so there is
// one email path.

export * from '../src/services/emailService';
export { default } from '../src/services/emailService';

import { sendRawEmail } from '../src/services/emailService';

/**
 * `sendEmailNotification(to, subject, body)`.
 *
 * Call sites pass an explicit subject and body, not a template key, so this
 * maps to sendRawEmail rather than the template-driven sendEmail.
 */
export const sendEmailNotification = sendRawEmail;
