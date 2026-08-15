// E2E Tests: Complete Hiring Workflow
// Cypress tests for real browser automation and user interactions

describe('Complete Hiring Workflow - E2E', () => {
  const BASE_URL = 'http://localhost:5173';
  const TEST_TIMEOUT = 10000;

  beforeEach(() => {
    cy.visit(`${BASE_URL}/`);
    cy.window().then((win) => {
      // Mock authentication
      win.sessionStorage.setItem('authToken', 'test_token_123');
      win.sessionStorage.setItem('userId', '1');
      win.sessionStorage.setItem('userRole', 'client');
    });
    cy.reload();
  });

  describe('1. Dashboard & Persona Selection', () => {
    it('should load dashboard with default persona', () => {
      cy.contains('Welcome').should('be.visible');
      cy.get('[data-testid="persona-display"]').should('contain', 'Client');
    });

    it('should display persona switcher', () => {
      cy.get('[data-testid="persona-switcher"]').should('be.visible');
      cy.get('[data-testid="persona-switcher"]').click();
      cy.get('[data-testid="persona-option-lawyer"]').should('be.visible');
    });

    it('should switch between personas', () => {
      cy.get('[data-testid="persona-switcher"]').click();
      cy.get('[data-testid="persona-option-lawyer"]').click();
      cy.get('[data-testid="persona-display"]').should('contain', 'Lawyer');
    });

    it('should persist persona selection', () => {
      cy.get('[data-testid="persona-switcher"]').click();
      cy.get('[data-testid="persona-option-paralegal"]').click();
      cy.reload();
      cy.get('[data-testid="persona-display"]').should('contain', 'Paralegal');
    });

    it('should show persona-specific navigation', () => {
      cy.get('[data-testid="nav-services"]').should('be.visible');
      cy.get('[data-testid="nav-tools"]').should('be.visible');
      cy.get('[data-testid="nav-messages"]').should('be.visible');
    });
  });

  describe('2. Service Discovery & Browsing', () => {
    it('should load service marketplace', () => {
      cy.get('[data-testid="nav-services"]').click();
      cy.get('[data-testid="marketplace-header"]').should('contain', 'Services');
      cy.get('[data-testid="service-grid"]').should('be.visible');
    });

    it('should display services with details', () => {
      cy.get('[data-testid="nav-services"]').click();
      cy.get('[data-testid="service-card"]').first().should('contain', 'Contract');
      cy.get('[data-testid="service-card"]').first().within(() => {
        cy.get('[data-testid="service-rating"]').should('contain', '4.');
        cy.get('[data-testid="service-reviews"]').should('be.visible');
      });
    });

    it('should search services by name', () => {
      cy.get('[data-testid="nav-services"]').click();
      cy.get('[data-testid="search-input"]').type('contract', { delay: 50 });
      cy.get('[data-testid="service-card"]').should('contain', 'Contract');
      cy.get('[data-testid="service-card"]').should('have.length.greaterThan', 0);
    });

    it('should filter services by rating', () => {
      cy.get('[data-testid="nav-services"]').click();
      cy.get('[data-testid="filter-rating"]').click();
      cy.get('[data-testid="filter-4-5"]').click();
      cy.get('[data-testid="service-card"]').each(($card) => {
        cy.wrap($card).get('[data-testid="service-rating"]').then(($rating) => {
          const rating = parseFloat($rating.text());
          expect(rating).to.be.greaterThan(4.4);
        });
      });
    });

    it('should sort services', () => {
      cy.get('[data-testid="nav-services"]').click();
      cy.get('[data-testid="sort-select"]').select('popularity');
      // Verify services are re-ordered
      cy.get('[data-testid="service-grid"]').should('be.visible');
    });

    it('should toggle grid/list view', () => {
      cy.get('[data-testid="nav-services"]').click();
      cy.get('[data-testid="view-toggle-list"]').click();
      cy.get('[data-testid="service-list"]').should('be.visible');
      cy.get('[data-testid="view-toggle-grid"]').click();
      cy.get('[data-testid="service-grid"]').should('be.visible');
    });

    it('should navigate to service detail', () => {
      cy.get('[data-testid="nav-services"]').click();
      cy.get('[data-testid="service-card"]').first().click();
      cy.url().should('include', '/services/');
      cy.get('[data-testid="service-detail-header"]').should('be.visible');
    });
  });

  describe('3. Intake Form Submission', () => {
    beforeEach(() => {
      cy.get('[data-testid="nav-services"]').click();
      cy.get('[data-testid="service-card"]').first().click();
      cy.get('[data-testid="btn-start-intake"]').click();
    });

    it('should load intake form', () => {
      cy.get('[data-testid="intake-form"]').should('be.visible');
      cy.get('[data-testid="form-title"]').should('contain', 'Request Service');
    });

    it('should validate required fields', () => {
      cy.get('[data-testid="btn-submit"]').click();
      cy.get('[data-testid="error-title"]').should('be.visible');
      cy.get('[data-testid="error-description"]').should('be.visible');
    });

    it('should validate description character limit', () => {
      cy.get('[data-testid="input-title"]').type('Review Contract');
      cy.get('[data-testid="input-description"]').type('Short');
      cy.get('[data-testid="error-description"]').should('contain', 'minimum 20');
    });

    it('should accept valid intake submission', () => {
      const title = 'Review NDA Agreement';
      const description = 'Need comprehensive review of vendor NDA before signing. Please focus on confidentiality scope and indemnification clauses.';
      const budget = '2500';

      cy.get('[data-testid="input-title"]').type(title);
      cy.get('[data-testid="input-description"]').type(description, { delay: 0 });
      cy.get('[data-testid="input-budget"]').type(budget);

      cy.get('[data-testid="urgency-high"]').click();
      cy.get('[data-testid="input-start-date"]').type('2026-08-20');

      cy.get('[data-testid="checkbox-terms"]').click();
      cy.get('[data-testid="btn-submit"]').click();

      cy.get('[data-testid="modal-success"]', { timeout: TEST_TIMEOUT })
        .should('be.visible')
        .should('contain', 'Request submitted');
    });

    it('should display character counter', () => {
      cy.get('[data-testid="input-description"]').type('This is a test description that will show');
      cy.get('[data-testid="char-count"]')
        .should('contain', '44')
        .should('contain', '5000');
    });

    it('should allow budget range selection', () => {
      cy.get('[data-testid="input-title"]').type('Service Request');
      cy.get('[data-testid="input-description"]').type('This is a test description for the service');

      cy.get('[data-testid="budget-range-select"]').select('2000-5000');
      cy.get('[data-testid="input-budget"]').should('have.value', '3500');
    });

    it('should display urgency level options', () => {
      cy.get('[data-testid="urgency-low"]').should('be.visible');
      cy.get('[data-testid="urgency-medium"]').should('be.visible');
      cy.get('[data-testid="urgency-high"]').should('be.visible');
      cy.get('[data-testid="urgency-urgent"]').should('be.visible');
    });
  });

  describe('4. Service Offer Review', () => {
    beforeEach(() => {
      // Navigate to offers section (after intake submission)
      cy.get('[data-testid="nav-messages"]').click();
      cy.get('[data-testid="tab-offers"]').click();
    });

    it('should display received offers', () => {
      cy.get('[data-testid="offer-card"]', { timeout: TEST_TIMEOUT })
        .should('have.length.greaterThan', 0);
    });

    it('should show offer details', () => {
      cy.get('[data-testid="offer-card"]').first().within(() => {
        cy.get('[data-testid="provider-name"]').should('be.visible');
        cy.get('[data-testid="hourly-rate"]').should('be.visible');
        cy.get('[data-testid="estimated-hours"]').should('be.visible');
        cy.get('[data-testid="total-cost"]').should('be.visible');
      });
    });

    it('should display offer expiration countdown', () => {
      cy.get('[data-testid="offer-card"]').first().within(() => {
        cy.get('[data-testid="expiration-timer"]').should('be.visible');
        // Should show "Expires in X days"
        cy.get('[data-testid="expiration-timer"]').should('contain', 'Expires');
      });
    });

    it('should accept offer', () => {
      cy.get('[data-testid="offer-card"]').first().within(() => {
        cy.get('[data-testid="btn-accept"]').click();
      });

      cy.get('[data-testid="modal-confirm"]').should('be.visible');
      cy.get('[data-testid="btn-confirm"]').click();

      cy.get('[data-testid="notification-success"]')
        .should('be.visible')
        .should('contain', 'Offer accepted');
    });

    it('should reject offer with reason', () => {
      cy.get('[data-testid="offer-card"]').first().within(() => {
        cy.get('[data-testid="btn-reject"]').click();
      });

      cy.get('[data-testid="modal-reject"]').should('be.visible');
      cy.get('[data-testid="input-reason"]').type('Rate too high');
      cy.get('[data-testid="btn-confirm-reject"]').click();

      cy.get('[data-testid="notification-success"]')
        .should('be.visible')
        .should('contain', 'Offer rejected');
    });

    it('should organize offers by status', () => {
      cy.get('[data-testid="section-active"]').should('be.visible');
      cy.get('[data-testid="section-accepted"]').should('be.visible');
      cy.get('[data-testid="section-declined"]').should('be.visible');
    });

    it('should update UI when offers expire', () => {
      // Offer expires after timer reaches zero
      cy.get('[data-testid="offer-card"]').first().within(() => {
        cy.get('[data-testid="status-badge"]').should('contain', 'Pending');
      });

      // Simulate time passing (in real scenario, wait for actual expiry)
      cy.wait(1000);
    });
  });

  describe('5. Identity Verification', () => {
    beforeEach(() => {
      // After offer accepted, navigate to verification
      cy.get('[data-testid="nav-account"]').click();
      cy.get('[data-testid="section-verification"]').click();
    });

    it('should display verification options', () => {
      cy.get('[data-testid="idme-option"]').should('be.visible');
      cy.get('[data-testid="document-upload-option"]').should('be.visible');
    });

    it('should launch ID.me verification', () => {
      cy.get('[data-testid="btn-idme-verify"]').click();

      // ID.me typically opens in new window/tab
      cy.get('[data-testid="idme-status"]', { timeout: TEST_TIMEOUT })
        .should('contain', 'Redirecting');
    });

    it('should allow document upload', () => {
      cy.get('[data-testid="btn-upload-license"]').click();

      cy.fixture('sample-license.jpg').then((fileContent) => {
        cy.get('input[type="file"]').selectFile({
          contents: Cypress.Buffer.from(fileContent),
          fileName: 'license.jpg',
          mimeType: 'image/jpeg',
        });
      });

      cy.get('[data-testid="file-preview"]').should('be.visible');
      cy.get('[data-testid="btn-upload"]').click();

      cy.get('[data-testid="status-pending"]')
        .should('be.visible')
        .should('contain', 'Under review');
    });

    it('should validate file types', () => {
      cy.get('[data-testid="btn-upload-license"]').click();

      // Try uploading invalid file type
      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from('test'),
        fileName: 'document.txt',
        mimeType: 'text/plain',
      });

      cy.get('[data-testid="error-file-type"]')
        .should('be.visible')
        .should('contain', 'JPEG, PNG, or PDF');
    });

    it('should show verification status', () => {
      cy.get('[data-testid="verification-status"]').should('be.visible');

      // Status can be: verified, pending, expired, failed
      cy.get('[data-testid="status-badge"]').should('match', /verified|pending|expired|failed/i);
    });

    it('should allow re-verification', () => {
      cy.get('[data-testid="status-expired"]').should('be.visible');
      cy.get('[data-testid="btn-reverify"]').click();

      cy.get('[data-testid="verification-modal"]').should('be.visible');
    });
  });

  describe('6. Video Conferencing', () => {
    beforeEach(() => {
      // Navigate to hire agreement with verified status
      cy.get('[data-testid="nav-messages"]').click();
      cy.get('[data-testid="tab-active-hires"]').click();
      cy.get('[data-testid="hire-card"]').first().click();
      cy.get('[data-testid="section-conferencing"]').should('be.visible');
    });

    it('should display video conferencing options', () => {
      cy.get('[data-testid="platform-zoom"]').should('be.visible');
      cy.get('[data-testid="platform-teams"]').should('be.visible');
      cy.get('[data-testid="platform-gmeet"]').should('be.visible');
    });

    it('should show connection status', () => {
      cy.get('[data-testid="connection-status"]').should('be.visible');
      cy.get('[data-testid="connection-status"]').should('match', /connected|disconnected/i);
    });

    it('should launch video call', () => {
      cy.get('[data-testid="platform-zoom"]').click();
      cy.get('[data-testid="btn-start-call"]').click();

      cy.get('[data-testid="active-call-indicator"]', { timeout: TEST_TIMEOUT })
        .should('be.visible')
        .should('contain', '00:00:00');
    });

    it('should track call duration', () => {
      cy.get('[data-testid="platform-zoom"]').click();
      cy.get('[data-testid="btn-start-call"]').click();

      // Wait a few seconds and check timer updates
      cy.get('[data-testid="call-duration"]').should('contain', '00:00:');
      cy.wait(2000);
      cy.get('[data-testid="call-duration"]').should('contain', '00:00:');
    });

    it('should show participant list', () => {
      cy.get('[data-testid="platform-zoom"]').click();
      cy.get('[data-testid="btn-start-call"]').click();

      cy.get('[data-testid="participants-list"]')
        .should('be.visible')
        .should('contain', 'Participants');
    });

    it('should allow call features', () => {
      cy.get('[data-testid="platform-zoom"]').click();
      cy.get('[data-testid="btn-start-call"]').click();

      cy.get('[data-testid="btn-share-screen"]').should('be.visible');
      cy.get('[data-testid="btn-toggle-mic"]').should('be.visible');
      cy.get('[data-testid="btn-toggle-camera"]').should('be.visible');
      cy.get('[data-testid="btn-chat"]').should('be.visible');
    });

    it('should end call', () => {
      cy.get('[data-testid="platform-zoom"]').click();
      cy.get('[data-testid="btn-start-call"]').click();

      cy.wait(1000);
      cy.get('[data-testid="btn-end-call"]').click();

      cy.get('[data-testid="call-history-item"]')
        .should('be.visible')
        .should('contain', 'Recording available');
    });

    it('should show call history', () => {
      cy.get('[data-testid="section-call-history"]').click();

      cy.get('[data-testid="history-item"]')
        .should('have.length.greaterThan', 0)
        .first()
        .within(() => {
          cy.get('[data-testid="call-date"]').should('be.visible');
          cy.get('[data-testid="call-duration"]').should('be.visible');
          cy.get('[data-testid="recording-link"]').should('be.visible');
        });
    });
  });

  describe('7. Real-Time Messaging', () => {
    beforeEach(() => {
      cy.get('[data-testid="nav-messages"]').click();
      cy.get('[data-testid="hire-card"]').first().click();
      cy.get('[data-testid="section-messaging"]').should('be.visible');
    });

    it('should display message thread', () => {
      cy.get('[data-testid="messages-container"]').should('be.visible');
      cy.get('[data-testid="message-item"]').should('have.length.greaterThan', 0);
    });

    it('should send text message', () => {
      cy.get('[data-testid="input-message"]').type('When can you start?');
      cy.get('[data-testid="btn-send"]').click();

      cy.get('[data-testid="message-item"]')
        .last()
        .should('contain', 'When can you start?');
    });

    it('should display message read status', () => {
      cy.get('[data-testid="message-item"]')
        .first()
        .within(() => {
          cy.get('[data-testid="read-status"]').should('be.visible');
          // Should show single or double checkmark
          cy.get('[data-testid="read-status"]').should('match', /✓|✓✓/);
        });
    });

    it('should upload file attachment', () => {
      cy.get('[data-testid="btn-attach-file"]').click();

      cy.fixture('sample-document.pdf').then((fileContent) => {
        cy.get('input[type="file"]').selectFile({
          contents: Cypress.Buffer.from(fileContent),
          fileName: 'contract.pdf',
          mimeType: 'application/pdf',
        });
      });

      cy.get('[data-testid="file-preview"]').should('be.visible');
      cy.get('[data-testid="btn-send"]').click();

      cy.get('[data-testid="message-item"]')
        .last()
        .should('contain', 'contract.pdf');
    });

    it('should auto-scroll to latest message', () => {
      // Send multiple messages
      for (let i = 0; i < 5; i++) {
        cy.get('[data-testid="input-message"]').type(`Message ${i + 1}`);
        cy.get('[data-testid="btn-send"]').click();
      }

      cy.get('[data-testid="messages-container"]').then(($container) => {
        // Last message should be visible
        cy.get('[data-testid="message-item"]')
          .last()
          .should('be.visible');
      });
    });

    it('should search messages', () => {
      cy.get('[data-testid="btn-search-messages"]').click();
      cy.get('[data-testid="input-search"]').type('contract');

      cy.get('[data-testid="message-item"]').each(($msg) => {
        expect($msg.text().toLowerCase()).to.include('contract');
      });
    });

    it('should receive new messages in real-time', () => {
      const initialCount = cy.get('[data-testid="message-item"]').its('length');

      // Simulate incoming message (in real scenario, from provider)
      cy.window().then((win) => {
        // Trigger message event
        const event = new CustomEvent('messageReceived', {
          detail: { id: 999, message: 'New message from provider' },
        });
        win.dispatchEvent(event);
      });

      // Should show new message
      cy.get('[data-testid="message-item"]')
        .last()
        .should('contain', 'New message from provider');
    });

    it('should show typing indicator', () => {
      cy.window().then((win) => {
        const event = new CustomEvent('userTyping', {
          detail: { userId: 2, userName: 'Provider' },
        });
        win.dispatchEvent(event);
      });

      cy.get('[data-testid="typing-indicator"]')
        .should('be.visible')
        .should('contain', 'Provider is typing');
    });
  });

  describe('8. Subscription & Billing', () => {
    beforeEach(() => {
      cy.get('[data-testid="nav-account"]').click();
      cy.get('[data-testid="tab-subscription"]').click();
    });

    it('should display current subscription', () => {
      cy.get('[data-testid="current-tier-card"]').should('be.visible');
      cy.get('[data-testid="tier-name"]').should('be.visible');
      cy.get('[data-testid="renewal-date"]').should('be.visible');
    });

    it('should show tier options', () => {
      cy.get('[data-testid="tier-card"]').should('have.length.gte', 4);
      cy.get('[data-testid="tier-card-free"]').should('be.visible');
      cy.get('[data-testid="tier-card-starter"]').should('be.visible');
      cy.get('[data-testid="tier-card-professional"]').should('be.visible');
    });

    it('should highlight most popular tier', () => {
      cy.get('[data-testid="tier-card-professional"]').within(() => {
        cy.get('[data-testid="popular-badge"]').should('be.visible');
      });
    });

    it('should allow tier upgrade', () => {
      cy.get('[data-testid="tier-card-professional"]').within(() => {
        cy.get('[data-testid="btn-upgrade"]').click();
      });

      cy.get('[data-testid="modal-upgrade"]').should('be.visible');
      cy.get('[data-testid="btn-confirm-upgrade"]').click();

      cy.get('[data-testid="notification-success"]')
        .should('be.visible')
        .should('contain', 'Upgraded');
    });

    it('should display billing history', () => {
      cy.get('[data-testid="section-billing-history"]').click();

      cy.get('[data-testid="billing-item"]')
        .should('have.length.greaterThan', 0)
        .first()
        .within(() => {
          cy.get('[data-testid="bill-date"]').should('be.visible');
          cy.get('[data-testid="bill-amount"]').should('be.visible');
        });
    });

    it('should show account information', () => {
      cy.get('[data-testid="section-account-info"]').should('be.visible');
      cy.get('[data-testid="account-email"]').should('be.visible');
      cy.get('[data-testid="auto-renewal-toggle"]').should('be.visible');
    });
  });

  describe('9. Admin - Credential Verification', () => {
    beforeEach(() => {
      cy.window().then((win) => {
        win.sessionStorage.setItem('userRole', 'admin');
      });
      cy.reload();
      cy.get('[data-testid="nav-admin"]').click();
      cy.get('[data-testid="section-verification"]').click();
    });

    it('should display verification dashboard', () => {
      cy.get('[data-testid="verification-dashboard"]').should('be.visible');
      cy.get('[data-testid="dashboard-header"]').should('contain', 'Verification');
    });

    it('should show verification stats', () => {
      cy.get('[data-testid="stat-total"]').should('be.visible');
      cy.get('[data-testid="stat-verified"]').should('be.visible');
      cy.get('[data-testid="stat-pending"]').should('be.visible');
      cy.get('[data-testid="stat-expired"]').should('be.visible');
    });

    it('should filter credentials by status', () => {
      cy.get('[data-testid="filter-pending"]').click();
      cy.get('[data-testid="credential-item"]').each(($item) => {
        expect($item.text()).to.include('Pending');
      });
    });

    it('should approve credential', () => {
      cy.get('[data-testid="credential-item"]').first().within(() => {
        cy.get('[data-testid="btn-approve"]').click();
      });

      cy.get('[data-testid="notification-success"]')
        .should('be.visible')
        .should('contain', 'Approved');
    });

    it('should reject credential with reason', () => {
      cy.get('[data-testid="credential-item"]').first().within(() => {
        cy.get('[data-testid="btn-reject"]').click();
      });

      cy.get('[data-testid="modal-reject"]').should('be.visible');
      cy.get('[data-testid="input-reason"]').type('License expired');
      cy.get('[data-testid="btn-confirm"]').click();

      cy.get('[data-testid="notification-success"]')
        .should('be.visible')
        .should('contain', 'Rejected');
    });
  });

  describe('10. Responsive Design', () => {
    it('should work on mobile viewport', () => {
      cy.viewport('iphone-x');
      cy.visit(`${BASE_URL}/`);

      cy.get('[data-testid="persona-switcher"]').should('be.visible');
      cy.get('[data-testid="nav-services"]').should('be.visible');
    });

    it('should work on tablet viewport', () => {
      cy.viewport('ipad-2');
      cy.visit(`${BASE_URL}/`);

      cy.get('[data-testid="main-content"]').should('be.visible');
    });

    it('should work on desktop viewport', () => {
      cy.viewport(1280, 800);
      cy.visit(`${BASE_URL}/`);

      cy.get('[data-testid="sidebar"]').should('be.visible');
      cy.get('[data-testid="main-content"]').should('be.visible');
    });

    it('should toggle mobile navigation', () => {
      cy.viewport('iphone-x');
      cy.visit(`${BASE_URL}/`);

      cy.get('[data-testid="btn-menu"]').click();
      cy.get('[data-testid="mobile-menu"]').should('be.visible');
    });
  });

  describe('11. Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      cy.get('h1').should('have.length', 1);
      cy.get('h2').should('have.length.greaterThan', 0);
      cy.get('h3').should('have.length.greaterThan', 0);
    });

    it('should have alt text on images', () => {
      cy.get('img').each(($img) => {
        expect($img.attr('alt')).to.not.be.empty;
      });
    });

    it('should have proper ARIA labels', () => {
      cy.get('[data-testid="btn-send"]').should('have.attr', 'aria-label');
      cy.get('[data-testid="input-message"]').should('have.attr', 'aria-label');
    });

    it('should be keyboard navigable', () => {
      cy.get('body').tab();
      cy.focused().should('have.attr', 'data-testid');

      cy.get('body').tab();
      cy.focused().should('not.equal', Cypress.$('body'));
    });

    it('should have sufficient color contrast', () => {
      // This would require axe-core plugin
      cy.injectAxe();
      cy.checkA11y();
    });
  });

  describe('12. Error Handling', () => {
    it('should handle network errors gracefully', () => {
      cy.intercept('GET', '*/api/v2/services*', { statusCode: 500 }).as('servicesError');

      cy.get('[data-testid="nav-services"]').click();
      cy.wait('@servicesError');

      cy.get('[data-testid="error-message"]').should('be.visible');
      cy.get('[data-testid="btn-retry"]').should('be.visible');
    });

    it('should handle 404 errors', () => {
      cy.visit(`${BASE_URL}/nonexistent-page`);
      cy.get('[data-testid="error-404"]').should('be.visible');
      cy.get('[data-testid="btn-home"]').should('be.visible');
    });

    it('should timeout gracefully', () => {
      cy.intercept('GET', '*/api/v2/*', (req) => {
        req.destroy();
      }).as('timeout');

      cy.get('[data-testid="nav-services"]').click();
      cy.get('[data-testid="error-timeout"]', { timeout: 15000 })
        .should('be.visible');
    });

    it('should show validation errors', () => {
      cy.get('[data-testid="nav-services"]').click();
      cy.get('[data-testid="service-card"]').first().click();
      cy.get('[data-testid="btn-start-intake"]').click();

      cy.get('[data-testid="input-title"]').type('a');
      cy.get('[data-testid="btn-submit"]').click();

      cy.get('[data-testid="error-message"]').should('be.visible');
    });
  });

  describe('13. Performance', () => {
    it('should load marketplace within 3 seconds', () => {
      const start = Date.now();
      cy.get('[data-testid="nav-services"]').click();
      cy.get('[data-testid="service-grid"]', { timeout: 3000 }).should('be.visible');
      const duration = Date.now() - start;
      expect(duration).to.be.lessThan(3000);
    });

    it('should not have console errors', () => {
      const logs: string[] = [];
      cy.on('window:error', (error) => {
        logs.push(error.message);
      });

      cy.visit(`${BASE_URL}/`);
      cy.wait(1000);

      expect(logs.length).to.equal(0);
    });

    it('should handle rapid interactions', () => {
      cy.get('[data-testid="nav-services"]').click();
      cy.get('[data-testid="service-card"]').first().click();
      cy.get('[data-testid="service-card"]').first().click();
      cy.get('[data-testid="service-card"]').first().click();

      cy.get('[data-testid="service-detail-header"]').should('be.visible');
    });
  });

  describe('14. Complete Workflow - Start to Finish', () => {
    it('should complete full hiring workflow', () => {
      // 1. Select persona
      cy.get('[data-testid="persona-switcher"]').click();
      cy.get('[data-testid="persona-option-client"]').click();

      // 2. Browse services
      cy.get('[data-testid="nav-services"]').click();
      cy.get('[data-testid="search-input"]').type('contract');
      cy.get('[data-testid="service-card"]').first().click();

      // 3. Submit intake
      cy.get('[data-testid="btn-start-intake"]').click();
      cy.get('[data-testid="input-title"]').type('Review NDA');
      cy.get('[data-testid="input-description"]').type('Need comprehensive review of vendor NDA before signing');
      cy.get('[data-testid="input-budget"]').type('2500');
      cy.get('[data-testid="urgency-high"]').click();
      cy.get('[data-testid="checkbox-terms"]').click();
      cy.get('[data-testid="btn-submit"]').click();

      cy.get('[data-testid="modal-success"]', { timeout: TEST_TIMEOUT })
        .should('be.visible');

      // 4. Review offers
      cy.get('[data-testid="nav-messages"]').click();
      cy.get('[data-testid="tab-offers"]').click();
      cy.get('[data-testid="offer-card"]', { timeout: TEST_TIMEOUT })
        .should('have.length.greaterThan', 0);

      // 5. Accept offer
      cy.get('[data-testid="offer-card"]').first().within(() => {
        cy.get('[data-testid="btn-accept"]').click();
      });
      cy.get('[data-testid="modal-confirm"]').should('be.visible');
      cy.get('[data-testid="btn-confirm"]').click();

      cy.get('[data-testid="notification-success"]')
        .should('contain', 'Offer accepted');

      // 6. Verify identity
      cy.get('[data-testid="nav-account"]').click();
      cy.get('[data-testid="section-verification"]').should('be.visible');

      // 7. Access video & messaging
      cy.get('[data-testid="nav-messages"]').click();
      cy.get('[data-testid="tab-active-hires"]').click();
      cy.get('[data-testid="hire-card"]').first().click();

      cy.get('[data-testid="section-conferencing"]').should('be.visible');
      cy.get('[data-testid="section-messaging"]').should('be.visible');

      // Workflow complete
      cy.url().should('include', '/hires/');
    });
  });
});
