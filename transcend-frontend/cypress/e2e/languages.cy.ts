// Multi-Language & Localization Tests
// Covers: language switching, translation, RTL support

describe('Multi-Language & Localization', () => {
  const testEmail = Cypress.env('TEST_EMAIL');
  const testPassword = Cypress.env('TEST_PASSWORD');

  beforeEach(() => {
    cy.login(testEmail, testPassword);
  });

  it('should display language selector', () => {
    cy.get('[data-testid="language-selector"]').should('be.visible');
    cy.get('[data-testid="language-selector"]').click();
    cy.get('[data-testid="language-option"]').should('have.length.greaterThan', 10);
  });

  it('should switch to Spanish', () => {
    cy.get('[data-testid="language-selector"]').click();
    cy.get('[data-testid="language-es"]').click();
    
    cy.get('[data-testid="dashboard-title"]').should('contain', 'Panel de Control');
    cy.get('[data-testid="nav-services"]').should('contain', 'Servicios');
  });

  it('should switch to French', () => {
    cy.get('[data-testid="language-selector"]').click();
    cy.get('[data-testid="language-fr"]').click();
    
    cy.get('[data-testid="dashboard-title"]').should('contain', 'Tableau de Bord');
    cy.get('[data-testid="nav-services"]').should('contain', 'Services');
  });

  it('should switch to German', () => {
    cy.get('[data-testid="language-selector"]').click();
    cy.get('[data-testid="language-de"]').click();
    
    cy.get('[data-testid="dashboard-title"]').should('contain', 'Dashboard');
    cy.get('[data-testid="nav-services"]').should('contain', 'Dienstleistungen');
  });

  it('should switch to Chinese', () => {
    cy.get('[data-testid="language-selector"]').click();
    cy.get('[data-testid="language-zh"]').click();
    
    cy.get('[data-testid="dashboard-title"]').should('contain', '仪表板');
  });

  it('should switch to Arabic (RTL)', () => {
    cy.get('[data-testid="language-selector"]').click();
    cy.get('[data-testid="language-ar"]').click();
    
    cy.get('html').should('have.attr', 'dir', 'rtl');
    cy.get('[data-testid="dashboard-title"]').should('contain', 'لوحة التحكم');
  });

  it('should switch to Japanese', () => {
    cy.get('[data-testid="language-selector"]').click();
    cy.get('[data-testid="language-ja"]').click();
    
    cy.get('[data-testid="dashboard-title"]').should('contain', 'ダッシュボード');
  });

  it('should persist language preference', () => {
    cy.get('[data-testid="language-selector"]').click();
    cy.get('[data-testid="language-es"]').click();
    cy.reload();
    
    cy.get('[data-testid="dashboard-title"]').should('contain', 'Panel de Control');
  });

  it('should translate form labels', () => {
    cy.get('[data-testid="language-selector"]').click();
    cy.get('[data-testid="language-fr"]').click();
    
    cy.get('[data-testid="nav-services"]').click();
    cy.get('input[name="caseTitle"]').should('have.attr', 'placeholder').and('contain', 'Titre');
  });

  it('should translate error messages', () => {
    cy.get('[data-testid="language-selector"]').click();
    cy.get('[data-testid="language-es"]').click();
    
    cy.get('[data-testid="nav-messages"]').click();
    cy.get('[data-testid="message-input"]').type('Test');
    cy.get('[data-testid="send-button"]').click();
    
    cy.get('[data-testid="error-message"]').should('contain', 'Error');
  });

  it('should translate payment page', () => {
    cy.get('[data-testid="language-selector"]').click();
    cy.get('[data-testid="language-de"]').click();
    
    cy.get('[data-testid="nav-billing"]').click();
    cy.get('[data-testid="plan-basic"]').should('contain', 'Basis');
    cy.get('[data-testid="plan-professional"]').should('contain', 'Professionell');
  });

  it('should translate case submission', () => {
    cy.get('[data-testid="language-selector"]').click();
    cy.get('[data-testid="language-pt"]').click();
    
    cy.get('[data-testid="nav-services"]').click();
    cy.get('input[name="caseTitle"]').should('have.attr', 'placeholder').and('contain', 'Título');
  });

  it('should support Hindi', () => {
    cy.get('[data-testid="language-selector"]').click();
    cy.get('[data-testid="language-hi"]').click();
    
    cy.get('[data-testid="dashboard-title"]').should('contain', 'डैशबोर्ड');
  });

  it('should support Vietnamese', () => {
    cy.get('[data-testid="language-selector"]').click();
    cy.get('[data-testid="language-vi"]').click();
    
    cy.get('[data-testid="dashboard-title"]').should('contain', 'Bảng Điều Khiển');
  });

  it('should support Thai', () => {
    cy.get('[data-testid="language-selector"]').click();
    cy.get('[data-testid="language-th"]').click();
    
    cy.get('[data-testid="dashboard-title"]').should('contain', 'แดชบอร์ด');
  });
});
