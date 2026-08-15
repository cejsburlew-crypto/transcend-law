// Case Submission Flow Tests
// Covers: service selection, case creation, firm matching

describe('Case Submission Flow', () => {
  const testEmail = Cypress.env('TEST_EMAIL');
  const testPassword = Cypress.env('TEST_PASSWORD');

  beforeEach(() => {
    cy.login(testEmail, testPassword);
  });

  it('should complete full case submission flow', () => {
    // Navigate to services
    cy.get('[data-testid="nav-services"]').click();
    cy.url().should('include', '/services');

    // Select a service
    cy.get('[data-testid="service-card"]').first().click();
    cy.url().should('include', '/service-intake');

    // Step 1: Service type + case title
    cy.get('input[name="caseTitle"]').type('Trademark Dispute');
    cy.get('select[name="serviceType"]').select('Trademark');
    cy.get('button[data-testid="next-button"]').click();

    // Step 2: Description + budget + urgency
    cy.get('textarea[name="description"]').type('Need help with trademark infringement case');
    cy.get('input[name="budget"]').type('5000');
    cy.get('select[name="urgency"]').select('High');
    cy.get('button[data-testid="next-button"]').click();

    // Step 3: Location + documents + acceptance
    cy.get('input[name="location"]').type('California');
    cy.get('input[type="checkbox"][name="privacy"]').check();
    cy.get('input[type="checkbox"][name="terms"]').check();
    cy.get('button[data-testid="submit-button"]').click();

    // Verify case created
    cy.url().should('include', '/cases');
    cy.get('[data-testid="success-message"]').should('contain', 'Case submitted');
    cy.get('[data-testid="case-card"]').should('be.visible');
  });

  it('should validate required fields', () => {
    cy.get('[data-testid="nav-services"]').click();
    cy.get('[data-testid="service-card"]').first().click();
    
    // Try to submit without filling fields
    cy.get('button[data-testid="next-button"]').click();
    cy.get('[data-testid="error-message"]').should('contain', 'required');
  });

  it('should upload case documents', () => {
    cy.get('[data-testid="nav-services"]').click();
    cy.get('[data-testid="service-card"]').first().click();

    // Fill step 1 & 2
    cy.get('input[name="caseTitle"]').type('Patent Infringement');
    cy.get('select[name="serviceType"]').select('Patent');
    cy.get('button[data-testid="next-button"]').click();
    
    cy.get('textarea[name="description"]').type('Patent case');
    cy.get('input[name="budget"]').type('10000');
    cy.get('button[data-testid="next-button"]').click();

    // Upload document
    cy.get('input[type="file"]').selectFile('cypress/fixtures/sample-document.pdf');
    cy.get('[data-testid="document-preview"]').should('be.visible');
  });

  it('should show matching law firms', () => {
    cy.visit('/cases');
    cy.get('[data-testid="case-card"]').first().click();
    cy.url().should('include', '/case-detail');
    
    // Get matching firms
    cy.get('[data-testid="matching-firms"]').should('be.visible');
    cy.get('[data-testid="firm-card"]').should('have.length.greaterThan', 0);
  });

  it('should display privacy disclaimer', () => {
    cy.get('[data-testid="nav-services"]').click();
    cy.get('[data-testid="service-card"]').first().click();
    
    cy.get('[data-testid="privacy-disclaimer"]').should('be.visible');
    cy.get('[data-testid="privacy-disclaimer"]').should('contain', 'anonymous');
  });

  it('should track case status', () => {
    cy.visit('/cases');
    cy.get('[data-testid="case-card"]').first().then(($card) => {
      const status = $card.attr('data-status');
      cy.get('[data-testid="case-status"]').should('contain', status);
    });
  });

  it('should calculate service fee', () => {
    cy.get('[data-testid="nav-services"]').click();
    cy.get('[data-testid="service-card"]').first().click();

    cy.get('input[name="budget"]').type('5000');
    cy.get('[data-testid="fee-display"]').should('be.visible');
    cy.get('[data-testid="fee-amount"]').should('contain', '$');
  });
});
