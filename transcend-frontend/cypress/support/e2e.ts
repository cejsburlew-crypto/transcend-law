// Cypress support file
// Custom commands and utilities for E2E tests

Cypress.Commands.add('login', (email: string, password: string) => {
  cy.visit('/login');
  cy.get('input[type="email"]').type(email);
  cy.get('input[type="password"]').type(password);
  cy.get('button[type="submit"]').click();
  cy.url().should('include', '/dashboard');
});

Cypress.Commands.add('signup', (email: string, password: string, userType: string) => {
  cy.visit('/signup');
  cy.get('input[name="email"]').type(email);
  cy.get('input[name="password"]').type(password);
  cy.get('input[name="confirmPassword"]').type(password);
  cy.get(`input[value="${userType}"]`).check();
  cy.get('button[type="submit"]').click();
  cy.url().should('include', '/dashboard');
});

Cypress.Commands.add('logout', () => {
  cy.get('[data-testid="user-menu"]').click();
  cy.get('[data-testid="logout-button"]').click();
  cy.url().should('include', '/login');
});

// Override the visit command to handle CORS
Cypress.Commands.overwrite('visit', (originalFn, url, options) => {
  return originalFn(url, {
    ...options,
    onBeforeLoad(win) {
      win.sessionStorage.clear();
    },
  });
});

export {};
