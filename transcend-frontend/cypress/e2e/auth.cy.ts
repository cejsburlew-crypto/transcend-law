// Authentication Flow Tests
// Covers: signup, login, logout, session persistence

describe('Authentication Flow', () => {
  const testEmail = Cypress.env('TEST_EMAIL');
  const testPassword = Cypress.env('TEST_PASSWORD');

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  it('should signup as a client user', () => {
    cy.visit('/signup');
    cy.get('input[name="email"]').type(testEmail);
    cy.get('input[name="password"]').type(testPassword);
    cy.get('input[name="confirmPassword"]').type(testPassword);
    cy.get('input[value="client"]').check();
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/dashboard');
    cy.get('[data-testid="dashboard-title"]').should('be.visible');
  });

  it('should login with valid credentials', () => {
    cy.visit('/login');
    cy.get('input[type="email"]').type(testEmail);
    cy.get('input[type="password"]').type(testPassword);
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/dashboard');
    cy.get('[data-testid="user-profile"]').should('be.visible');
  });

  it('should reject invalid credentials', () => {
    cy.visit('/login');
    cy.get('input[type="email"]').type(testEmail);
    cy.get('input[type="password"]').type('wrongpassword');
    cy.get('button[type="submit"]').click();
    cy.get('[data-testid="error-message"]').should('contain', 'Invalid credentials');
  });

  it('should logout successfully', () => {
    cy.login(testEmail, testPassword);
    cy.get('[data-testid="user-menu"]').click();
    cy.get('[data-testid="logout-button"]').click();
    cy.url().should('include', '/login');
  });

  it('should redirect to login when accessing protected routes', () => {
    cy.visit('/dashboard');
    cy.url().should('include', '/login');
  });

  it('should persist session on page reload', () => {
    cy.login(testEmail, testPassword);
    cy.reload();
    cy.url().should('include', '/dashboard');
    cy.get('[data-testid="user-profile"]').should('be.visible');
  });

  it('should have valid JWT token structure', () => {
    cy.login(testEmail, testPassword);
    cy.window().then((win) => {
      const token = win.localStorage.getItem('auth_token');
      expect(token).to.exist;
      expect(token).to.match(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    });
  });

  it('should handle password reset flow', () => {
    cy.visit('/login');
    cy.get('[data-testid="forgot-password-link"]').click();
    cy.url().should('include', '/reset-password');
    cy.get('input[type="email"]').type(testEmail);
    cy.get('button[type="submit"]').click();
    cy.get('[data-testid="success-message"]').should('contain', 'Check your email');
  });
});
