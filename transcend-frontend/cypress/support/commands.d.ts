// Cypress command type definitions

declare namespace Cypress {
  interface Chainable {
    login(email: string, password: string): Chainable<void>;
    signup(email: string, password: string, userType: string): Chainable<void>;
    logout(): Chainable<void>;
  }
}
