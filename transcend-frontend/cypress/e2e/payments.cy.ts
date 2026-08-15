// Payment & Subscription Flow Tests
// Covers: subscription selection, payment processing, invoice management

describe('Payment & Subscription Flow', () => {
  const testEmail = Cypress.env('TEST_EMAIL');
  const testPassword = Cypress.env('TEST_PASSWORD');

  beforeEach(() => {
    cy.login(testEmail, testPassword);
  });

  it('should display subscription plans', () => {
    cy.get('[data-testid="nav-billing"]').click();
    cy.url().should('include', '/billing');
    
    cy.get('[data-testid="plan-card"]').should('have.length', 3);
    cy.get('[data-testid="plan-basic"]').should('contain', '$29');
    cy.get('[data-testid="plan-professional"]').should('contain', '$99');
    cy.get('[data-testid="plan-enterprise"]').should('contain', '$299');
  });

  it('should upgrade to professional plan', () => {
    cy.get('[data-testid="nav-billing"]').click();
    cy.get('[data-testid="plan-professional"] button').click();
    
    cy.url().should('include', '/checkout');
    cy.get('[data-testid="plan-summary"]').should('contain', 'Professional');
    cy.get('[data-testid="price-summary"]').should('contain', '$99');
  });

  it('should process payment successfully', () => {
    cy.get('[data-testid="nav-billing"]').click();
    cy.get('[data-testid="plan-basic"] button').click();
    
    // Fill payment form
    cy.get('input[name="cardNumber"]').type('4242424242424242');
    cy.get('input[name="expirationDate"]').type('12/25');
    cy.get('input[name="cvc"]').type('123');
    cy.get('input[name="billingName"]').type('John Doe');
    
    cy.get('button[data-testid="pay-button"]').click();
    cy.get('[data-testid="success-message"]').should('contain', 'Payment successful');
    cy.url().should('include', '/billing');
  });

  it('should handle payment decline', () => {
    cy.get('[data-testid="nav-billing"]').click();
    cy.get('[data-testid="plan-basic"] button').click();
    
    // Use test card that will decline
    cy.get('input[name="cardNumber"]').type('4000000000000002');
    cy.get('input[name="expirationDate"]').type('12/25');
    cy.get('input[name="cvc"]').type('123');
    
    cy.get('button[data-testid="pay-button"]').click();
    cy.get('[data-testid="error-message"]').should('contain', 'Card declined');
  });

  it('should display invoices', () => {
    cy.get('[data-testid="nav-billing"]').click();
    cy.get('[data-testid="invoices-tab"]').click();
    
    cy.get('[data-testid="invoice-item"]').should('have.length.greaterThan', 0);
    cy.get('[data-testid="invoice-date"]').should('be.visible');
    cy.get('[data-testid="invoice-amount"]').should('contain', '$');
  });

  it('should download invoice PDF', () => {
    cy.get('[data-testid="nav-billing"]').click();
    cy.get('[data-testid="invoices-tab"]').click();
    
    cy.get('[data-testid="download-invoice"]').first().click();
    cy.readFile('cypress/downloads/invoice-*.pdf').should('exist');
  });

  it('should upgrade subscription plan', () => {
    cy.get('[data-testid="nav-billing"]').click();
    cy.get('[data-testid="current-plan"]').should('contain', 'Basic');
    
    cy.get('[data-testid="upgrade-to-professional"]').click();
    cy.url().should('include', '/checkout');
    
    cy.get('input[name="cardNumber"]').type('4242424242424242');
    cy.get('input[name="expirationDate"]').type('12/25');
    cy.get('input[name="cvc"]').type('123');
    cy.get('button[data-testid="pay-button"]').click();
    
    cy.get('[data-testid="success-message"]').should('be.visible');
    cy.get('[data-testid="current-plan"]').should('contain', 'Professional');
  });

  it('should display subscription status', () => {
    cy.get('[data-testid="nav-billing"]').click();
    cy.get('[data-testid="subscription-status"]').should('contain', 'Active');
    cy.get('[data-testid="renewal-date"]').should('contain', new Date().getFullYear());
  });

  it('should handle cancel subscription', () => {
    cy.get('[data-testid="nav-billing"]').click();
    cy.get('[data-testid="cancel-subscription-button"]').click();
    
    cy.get('[data-testid="confirm-cancel"]').click();
    cy.get('[data-testid="success-message"]').should('contain', 'Subscription canceled');
    cy.get('[data-testid="subscription-status"]').should('contain', 'Canceled');
  });
});
