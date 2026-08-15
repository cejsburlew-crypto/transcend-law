// Win-Back Campaign Email Template

export const churnWinBackTemplate = {
  id: 'churn-win-back',
  subject: 'We miss you - Here\'s a special offer just for you',
  category: 'retention',

  buildHtml: (context: Record<string, string | number | boolean>) => {
    const {
      firstName = 'Valued Client',
      discountPercentage = '10',
      discountExpiryDays = '7',
      prioritySupportText = '',
      ctaLink = '#',
      trackingPixel = '',
    } = context;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 0;
              background-color: #f9fafb;
            }
            .container {
              background-color: white;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
              margin: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 40px 20px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 700;
            }
            .content {
              padding: 40px;
            }
            .greeting {
              font-size: 16px;
              margin-bottom: 20px;
              color: #111827;
            }
            .body-text {
              font-size: 15px;
              line-height: 1.6;
              color: #4b5563;
              margin-bottom: 20px;
            }
            .offer-section {
              background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
              border: 2px solid #7dd3fc;
              border-radius: 8px;
              padding: 24px;
              margin: 30px 0;
              text-align: center;
            }
            .offer-badge {
              font-size: 48px;
              font-weight: 700;
              color: #3b82f6;
              margin-bottom: 12px;
              line-height: 1;
            }
            .offer-description {
              font-size: 14px;
              color: #0c4a6e;
              margin-bottom: 12px;
            }
            .offer-expiry {
              font-size: 12px;
              color: #0369a1;
              font-weight: 500;
            }
            .benefits {
              background-color: #f3f4f6;
              border-left: 4px solid #3b82f6;
              padding: 16px;
              margin: 24px 0;
              border-radius: 4px;
            }
            .benefits-list {
              list-style: none;
              padding: 0;
              margin: 0;
            }
            .benefits-list li {
              padding: 8px 0;
              font-size: 14px;
              color: #374151;
            }
            .benefits-list li:before {
              content: "✓ ";
              color: #10b981;
              font-weight: 700;
              margin-right: 8px;
            }
            .cta-button {
              display: inline-block;
              background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
              color: white;
              text-decoration: none;
              padding: 14px 32px;
              border-radius: 8px;
              font-weight: 600;
              font-size: 15px;
              margin: 24px 0;
              transition: all 0.3s ease;
            }
            .cta-button:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
            }
            .support-section {
              background-color: #fffbeb;
              border-left: 4px solid #f59e0b;
              padding: 16px;
              margin: 24px 0;
              border-radius: 4px;
              font-size: 13px;
              color: #78350f;
            }
            .footer {
              background-color: #f9fafb;
              padding: 24px;
              text-align: center;
              font-size: 12px;
              color: #6b7280;
              border-top: 1px solid #e5e7eb;
            }
            .footer-links {
              margin-top: 12px;
            }
            .footer-links a {
              color: #3b82f6;
              text-decoration: none;
              margin: 0 12px;
            }
            .signature {
              margin-top: 24px;
              padding-top: 24px;
              border-top: 1px solid #e5e7eb;
              font-size: 13px;
              color: #6b7280;
            }
            @media (max-width: 600px) {
              .header h1 {
                font-size: 20px;
              }
              .content {
                padding: 20px;
              }
              .offer-badge {
                font-size: 36px;
              }
              .cta-button {
                display: block;
                text-align: center;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>We Miss You!</h1>
            </div>

            <div class="content">
              <div class="greeting">
                Hi ${firstName},
              </div>

              <p class="body-text">
                We've noticed you haven't been as active on Transcend Law lately, and we want to help you get back on track. Your satisfaction is our priority, and we're here to support your legal needs.
              </p>

              <div class="offer-section">
                <div class="offer-badge">${discountPercentage}% OFF</div>
                <div class="offer-description">
                  Exclusive discount on your next legal service request
                </div>
                <div class="offer-expiry">
                  Valid for ${discountExpiryDays} days only
                </div>
              </div>

              <div class="benefits">
                <ul class="benefits-list">
                  <li>Get ${discountPercentage}% off your next service</li>
                  ${prioritySupportText ? `<li>${prioritySupportText}</li>` : ''}
                  <li>Expert legal professionals at your fingertips</li>
                  <li>Secure and confidential case handling</li>
                </ul>
              </div>

              <p class="body-text">
                Whether you need legal consultation, case review, or other services, our network of qualified attorneys is ready to help. Take advantage of this special offer and get back to resolving your legal matters.
              </p>

              <center>
                <a href="${ctaLink}" class="cta-button">Redeem Your Offer</a>
              </center>

              <div class="support-section">
                <strong>Having issues?</strong> Our support team is available 24/7 to help. Reply to this email or contact us through your Transcend Law account.
              </div>

              <div class="signature">
                <p>
                  Best regards,<br>
                  The Transcend Law Team
                </p>
              </div>
            </div>

            <div class="footer">
              <p>
                Questions about this offer? <a href="https://transcend-law.com/help">Visit our Help Center</a> or contact support.
              </p>
              <div class="footer-links">
                <a href="https://transcend-law.com/about">About</a>
                <a href="https://transcend-law.com/privacy">Privacy</a>
                <a href="https://transcend-law.com/terms">Terms</a>
              </div>
              <p style="margin: 16px 0 0 0;">
                © 2026 Transcend Law. All rights reserved.
              </p>
            </div>
          </div>

          <!-- Email tracking pixel -->
          ${trackingPixel ? `<img src="${trackingPixel}" width="1" height="1" alt="" style="display:none;" />` : ''}
        </body>
      </html>
    `;
  },

  buildText: (context: Record<string, string | number | boolean>) => {
    const { firstName = 'Valued Client', discountPercentage = '10', prioritySupportText = '' } = context;

    return `
Hi ${firstName},

We've noticed you haven't been as active on Transcend Law lately, and we want to help you get back on track.

SPECIAL OFFER: ${discountPercentage}% OFF

Get ${discountPercentage}% off your next legal service request!
${prioritySupportText ? `Plus: ${prioritySupportText}\n` : ''}

Whether you need legal consultation, case review, or other services, our network of qualified attorneys is ready to help.

Redeem your offer now: ${context.ctaLink}

Questions? Our support team is available 24/7 to help.

Best regards,
The Transcend Law Team

---
Transcend Law | https://transcend-law.com
Privacy: https://transcend-law.com/privacy
Terms: https://transcend-law.com/terms
    `;
  },
};

export default churnWinBackTemplate;
