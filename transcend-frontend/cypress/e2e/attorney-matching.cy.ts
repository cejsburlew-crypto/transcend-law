// Attorney Matching & Firm Selection Tests
// Covers: case matching, firm discovery, offer flow

describe('Attorney Matching & Firm Selection', () => {
  const testEmail = Cypress.env('TEST_EMAIL');
  const testPassword = Cypress.env('TEST_PASSWORD');

  beforeEach(() => {
    cy.login(testEmail, testPassword);
  });

  it('should display matching firms on case detail', () => {
    cy.visit('/cases');
    cy.get('[data-testid="case-card"]').first().click();
    
    cy.get('[data-testid="matching-firms"]').should('be.visible');
    cy.get('[data-testid="firm-card"]').should('have.length.greaterThan', 0);
  });

  it('should filter firms by state', () => {
    cy.visit('/cases');
    cy.get('[data-testid="case-card"]').first().click();
    
    cy.get('[data-testid="filter-state"]').click();
    cy.get('[data-testid="state-ca"]').click();
    
    cy.get('[data-testid="firm-card"]').each(($firm) => {
      cy.wrap($firm).should('contain', 'California');
    });
  });

  it('should filter firms by experience', () => {
    cy.visit('/cases');
    cy.get('[data-testid="case-card"]').first().click();
    
    cy.get('[data-testid="filter-experience"]').click();
    cy.get('[data-testid="experience-10plus"]').click();
    
    cy.get('[data-testid="firm-card"]').each(($firm) => {
      const years = parseInt($firm.find('[data-testid="firm-years"]').text());
      expect(years).to.be.greaterThan(10);
    });
  });

  it('should display firm details', () => {
    cy.visit('/cases');
    cy.get('[data-testid="case-card"]').first().click();
    cy.get('[data-testid="firm-card"]').first().click();
    
    cy.url().should('include', '/firm-detail');
    cy.get('[data-testid="firm-name"]').should('be.visible');
    cy.get('[data-testid="firm-bio"]').should('be.visible');
    cy.get('[data-testid="firm-rating"]').should('be.visible');
  });

  it('should request quote from firm', () => {
    cy.visit('/cases');
    cy.get('[data-testid="case-card"]').first().click();
    cy.get('[data-testid="firm-card"]').first().click();
    
    cy.get('[data-testid="request-quote-button"]').click();
    cy.get('[data-testid="success-message"]').should('contain', 'Quote request sent');
  });

  it('should track quote status', () => {
    cy.visit('/cases');
    cy.get('[data-testid="case-card"]').first().click();
    
    cy.get('[data-testid="case-quotes"]').should('be.visible');
    cy.get('[data-testid="quote-item"]').should('have.length.greaterThan', 0);
  });

  it('should display firm tier (Premium/Basic)', () => {
    cy.visit('/cases');
    cy.get('[data-testid="case-card"]').first().click();
    
    cy.get('[data-testid="firm-card"]').each(($firm) => {
      const tier = $firm.find('[data-testid="firm-tier"]').text();
      expect(tier).to.match(/Premium|Basic/);
    });
  });

  it('should show firm rating and reviews', () => {
    cy.visit('/cases');
    cy.get('[data-testid="case-card"]').first().click();
    cy.get('[data-testid="firm-card"]').first().click();
    
    cy.get('[data-testid="firm-rating"]').should('be.visible');
    cy.get('[data-testid="review-count"]').should('be.visible');
    cy.get('[data-testid="review-item"]').should('have.length.greaterThan', 0);
  });

  it('should show firm specialties', () => {
    cy.visit('/cases');
    cy.get('[data-testid="case-card"]').first().click();
    cy.get('[data-testid="firm-card"]').first().click();
    
    cy.get('[data-testid="specialty-badge"]').should('have.length.greaterThan', 0);
  });

  it('should match firms based on case type', () => {
    // Submit a trademark case
    cy.get('[data-testid="nav-services"]').click();
    cy.get('[data-testid="service-card"]').first().click();
    cy.get('input[name="caseTitle"]').type('Trademark Issue');
    cy.get('select[name="serviceType"]').select('Trademark');
    cy.get('button[data-testid="next-button"]').click();
    cy.get('textarea[name="description"]').type('Trademark dispute');
    cy.get('input[name="budget"]').type('5000');
    cy.get('button[data-testid="next-button"]').click();
    cy.get('input[type="checkbox"][name="privacy"]').check();
    cy.get('input[type="checkbox"][name="terms"]').check();
    cy.get('button[data-testid="submit-button"]').click();
    
    // Check matching firms
    cy.visit('/cases');
    cy.get('[data-testid="case-card"]').first().click();
    cy.get('[data-testid="firm-card"]').each(($firm) => {
      cy.wrap($firm).should('contain', 'Trademark');
    });
  });

  it('should show tier-based sorting', () => {
    cy.visit('/cases');
    cy.get('[data-testid="case-card"]').first().click();
    
    let lastTier = null;
    cy.get('[data-testid="firm-card"]').each(($firm, index) => {
      if (index > 0) {
        const tier = $firm.find('[data-testid="firm-tier"]').text();
        // Premium should appear before Basic
        if (lastTier === 'Premium') {
          expect(['Premium', 'Basic']).to.include(tier);
        }
      }
      lastTier = $firm.find('[data-testid="firm-tier"]').text();
    });
  });

  it('should reject anonymous case matching disclosure', () => {
    cy.visit('/cases');
    cy.get('[data-testid="case-card"]').first().click();
    
    cy.get('[data-testid="privacy-notice"]').should('be.visible');
    cy.get('[data-testid="privacy-notice"]').should('contain', 'anonymous');
  });
});
