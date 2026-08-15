// Real-Time Messaging Flow Tests
// Covers: message sending, typing indicators, online status, read receipts

describe('Real-Time Messaging Flow', () => {
  const testEmail = Cypress.env('TEST_EMAIL');
  const testPassword = Cypress.env('TEST_PASSWORD');

  beforeEach(() => {
    cy.login(testEmail, testPassword);
  });

  it('should open messaging interface', () => {
    cy.get('[data-testid="nav-messages"]').click();
    cy.url().should('include', '/messages');
    cy.get('[data-testid="messaging-component"]').should('be.visible');
  });

  it('should send a message', () => {
    cy.get('[data-testid="nav-messages"]').click();
    cy.get('[data-testid="conversation-item"]').first().click();
    
    cy.get('[data-testid="message-input"]').type('Hello, this is a test message');
    cy.get('[data-testid="send-button"]').click();
    
    cy.get('[data-testid="message-item"]').should('contain', 'Hello, this is a test message');
  });

  it('should display message timestamps', () => {
    cy.get('[data-testid="nav-messages"]').click();
    cy.get('[data-testid="conversation-item"]').first().click();
    
    cy.get('[data-testid="message-item"]').first().then(($msg) => {
      const time = $msg.find('[data-testid="message-time"]').text();
      expect(time).to.match(/\d{1,2}:\d{2}/);
    });
  });

  it('should show typing indicator', () => {
    cy.get('[data-testid="nav-messages"]').click();
    cy.get('[data-testid="conversation-item"]').first().click();
    
    cy.get('[data-testid="message-input"]').type('Test');
    cy.get('[data-testid="typing-indicator"]').should('be.visible');
  });

  it('should display online status', () => {
    cy.get('[data-testid="nav-messages"]').click();
    cy.get('[data-testid="conversation-item"]').first().then(($conv) => {
      const status = $conv.find('[data-testid="online-status"]').text();
      expect(status).to.match(/Online|Offline/);
    });
  });

  it('should show read receipts', () => {
    cy.get('[data-testid="nav-messages"]').click();
    cy.get('[data-testid="conversation-item"]').first().click();
    
    cy.get('[data-testid="message-input"]').type('Message for read receipt');
    cy.get('[data-testid="send-button"]').click();
    
    // Wait for read receipt
    cy.wait(1000);
    cy.get('[data-testid="read-receipt"]').should('be.visible');
  });

  it('should display connection status', () => {
    cy.get('[data-testid="nav-messages"]').click();
    cy.get('[data-testid="connection-status"]').should('be.visible');
    cy.get('[data-testid="connection-indicator"]').should('contain', 'Connected');
  });

  it('should handle message delivery', () => {
    cy.get('[data-testid="nav-messages"]').click();
    cy.get('[data-testid="conversation-item"]').first().click();
    
    cy.get('[data-testid="message-input"]').type('Delivery test message');
    cy.get('[data-testid="send-button"]').click();
    
    cy.get('[data-testid="message-item"]').last().should('contain', 'Delivery test message');
  });

  it('should scroll to latest message', () => {
    cy.get('[data-testid="nav-messages"]').click();
    cy.get('[data-testid="conversation-item"]').first().click();
    
    // Send multiple messages
    for (let i = 0; i < 5; i++) {
      cy.get('[data-testid="message-input"]').type(`Message ${i}`);
      cy.get('[data-testid="send-button"]').click();
    }
    
    cy.get('[data-testid="messages-container"]').then(($container) => {
      const scrollTop = $container[0].scrollTop;
      const scrollHeight = $container[0].scrollHeight;
      expect(scrollHeight - scrollTop).to.be.lessThan(100);
    });
  });

  it('should display conversation list', () => {
    cy.get('[data-testid="nav-messages"]').click();
    cy.get('[data-testid="conversation-item"]').should('have.length.greaterThan', 0);
  });
});
