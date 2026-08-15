// Document Management Flow Tests
// Covers: file upload, download, deletion, storage limits

describe('Document Management Flow', () => {
  const testEmail = Cypress.env('TEST_EMAIL');
  const testPassword = Cypress.env('TEST_PASSWORD');

  beforeEach(() => {
    cy.login(testEmail, testPassword);
  });

  it('should upload a document', () => {
    cy.get('[data-testid="nav-cases"]').click();
    cy.get('[data-testid="case-card"]').first().click();
    cy.url().should('include', '/case-detail');
    
    cy.get('[data-testid="upload-document-button"]').click();
    cy.get('input[type="file"]').selectFile('cypress/fixtures/sample-document.pdf');
    
    cy.get('[data-testid="document-item"]').should('contain', 'sample-document.pdf');
  });

  it('should validate file type', () => {
    cy.get('[data-testid="nav-cases"]').click();
    cy.get('[data-testid="case-card"]').first().click();
    
    cy.get('[data-testid="upload-document-button"]').click();
    cy.get('input[type="file"]').selectFile('cypress/fixtures/invalid-file.exe');
    
    cy.get('[data-testid="error-message"]').should('contain', 'File type not allowed');
  });

  it('should validate file size', () => {
    cy.get('[data-testid="nav-cases"]').click();
    cy.get('[data-testid="case-card"]').first().click();
    
    cy.get('[data-testid="upload-document-button"]').click();
    cy.get('input[type="file"]').selectFile('cypress/fixtures/large-file.pdf');
    
    cy.get('[data-testid="error-message"]').should('contain', 'File too large');
  });

  it('should download a document', () => {
    cy.get('[data-testid="nav-cases"]').click();
    cy.get('[data-testid="case-card"]').first().click();
    
    cy.get('[data-testid="document-item"]').first().then(($doc) => {
      const fileName = $doc.text();
      cy.get('[data-testid="download-button"]').first().click();
      cy.readFile(`cypress/downloads/${fileName}`).should('exist');
    });
  });

  it('should delete a document', () => {
    cy.get('[data-testid="nav-cases"]').click();
    cy.get('[data-testid="case-card"]').first().click();
    
    cy.get('[data-testid="document-item"]').first().then(($doc) => {
      const initialCount = cy.get('[data-testid="document-item"]').length;
      
      cy.get('[data-testid="delete-button"]').first().click();
      cy.get('[data-testid="confirm-delete"]').click();
      
      cy.get('[data-testid="document-item"]').should('have.length', initialCount - 1);
    });
  });

  it('should display document metadata', () => {
    cy.get('[data-testid="nav-cases"]').click();
    cy.get('[data-testid="case-card"]').first().click();
    
    cy.get('[data-testid="document-item"]').first().click();
    cy.get('[data-testid="document-name"]').should('be.visible');
    cy.get('[data-testid="document-size"]').should('be.visible');
    cy.get('[data-testid="document-date"]').should('be.visible');
  });

  it('should show storage usage', () => {
    cy.get('[data-testid="nav-cases"]').click();
    cy.get('[data-testid="case-card"]').first().click();
    
    cy.get('[data-testid="storage-usage"]').should('be.visible');
    cy.get('[data-testid="storage-bar"]').should('be.visible');
  });

  it('should support multiple file uploads', () => {
    cy.get('[data-testid="nav-cases"]').click();
    cy.get('[data-testid="case-card"]').first().click();
    
    cy.get('[data-testid="upload-document-button"]').click();
    cy.get('input[type="file"]').selectFile([
      'cypress/fixtures/document1.pdf',
      'cypress/fixtures/document2.pdf',
      'cypress/fixtures/document3.pdf'
    ]);
    
    cy.get('[data-testid="document-item"]').should('have.length.greaterThan', 3);
  });

  it('should display upload progress', () => {
    cy.get('[data-testid="nav-cases"]').click();
    cy.get('[data-testid="case-card"]').first().click();
    
    cy.get('[data-testid="upload-document-button"]').click();
    cy.get('input[type="file"]').selectFile('cypress/fixtures/large-document.pdf');
    
    cy.get('[data-testid="upload-progress"]').should('be.visible');
    cy.get('[data-testid="progress-bar"]').should('be.visible');
  });

  it('should preview document before upload', () => {
    cy.get('[data-testid="nav-cases"]').click();
    cy.get('[data-testid="case-card"]').first().click();
    
    cy.get('[data-testid="upload-document-button"]').click();
    cy.get('input[type="file"]').selectFile('cypress/fixtures/sample-document.pdf');
    
    cy.get('[data-testid="document-preview"]').should('be.visible');
  });
});
