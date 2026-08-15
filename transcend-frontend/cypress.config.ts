import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    pageLoadTimeout: 30000,
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
  },
  env: {
    TEST_EMAIL: 'test-client@transcend-law.com',
    TEST_PASSWORD: 'TestPassword123!',
    ATTORNEY_EMAIL: 'test-attorney@transcend-law.com',
    ATTORNEY_PASSWORD: 'AttorneyPass123!',
    API_URL: 'http://localhost:3001',
  },
});
