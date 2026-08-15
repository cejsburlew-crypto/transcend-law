# Phase 3: Integration Testing Guide

## Overview

Phase 3 Integration Testing verifies the complete end-to-end hiring workflow across all 10 frontend components. Tests are organized into three layers:

1. **Hiring Workflow Integration** - Complete user journey from persona selection to hire completion
2. **API Integration** - Backend API contracts and data validation
3. **Real-Time Features** - Polling, timers, and live updates

## Test Files

```
transcend-frontend/
├── src/
│   └── __tests__/
│       ├── setup.ts                           # Test environment configuration
│       └── integration/
│           ├── hiring-workflow.test.tsx       # 7 test suites, ~1,250 lines
│           ├── api-integration.test.ts        # 9 test suites, ~700 lines
│           └── realtime-features.test.ts      # 7 test suites, ~500 lines
├── jest.config.js                             # Jest configuration
└── package.json                               # Test dependencies
```

## Installation & Setup

### 1. Install Test Dependencies

```bash
cd transcend-frontend
npm install --save-dev \
  jest \
  ts-jest \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  @types/jest \
  identity-obj-proxy
```

### 2. Update package.json Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:integration": "jest src/__tests__/integration",
    "test:debug": "node --inspect-brk node_modules/.bin/jest --runInBand",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  }
}
```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Integration Tests Only
```bash
npm run test:integration
```

### Run Specific Test Suite
```bash
npm test -- hiring-workflow.test.tsx
npm test -- api-integration.test.ts
npm test -- realtime-features.test.ts
```

### Watch Mode (auto-rerun on changes)
```bash
npm run test:watch
```

### Debug Mode
```bash
npm run test:debug
# Opens Chrome DevTools at chrome://inspect
```

### Coverage Report
```bash
npm run test:coverage
```

## Test Organization

### Hiring Workflow Integration (`hiring-workflow.test.tsx`)

Tests the complete user journey through 7 test suites:

**1. Step 1: Persona Selection**
- Render persona switcher
- Switch between personas
- Display current persona with checkmark

**2. Step 2: Service Browsing & Selection**
- Fetch and display services
- Search and filter services
- Display service details (rating, reviews, providers)

**3. Step 3: Intake Form Submission**
- Validate required fields
- Accept valid submissions
- Enforce character limits (20-5000)
- Display urgency level options (🟢🟡🟠🔴)

**4. Step 4: Offer Review & Acceptance**
- Display provider offers with countdown
- Allow offer acceptance
- Allow offer rejection
- Organize offers by status

**5. Step 5: Identity Verification**
- Render ID.me verification option
- Allow driver license upload
- Validate file types (JPEG/PNG/PDF)
- Validate file size (max 5MB)

**6. Step 6: Video Conferencing**
- Render video controls
- Allow platform connection (Zoom/Teams/Google Meet)
- Track call duration (HH:MM:SS)

**7. Step 7: Real-Time Messaging**
- Render messaging interface
- Send text messages
- Support file attachments
- Poll for new messages every 3 seconds
- Display read status indicators

**8. Complete Workflow End-to-End**
- Verify all 7 steps complete successfully

**9. Error Handling & Edge Cases**
- Handle API failures
- Handle incomplete data
- Handle expired offers
- Handle disabled messaging
- Handle file upload failures

**10. Responsive Design & Accessibility**
- Mobile viewport rendering
- ARIA labels for accessibility

### API Integration (`api-integration.test.ts`)

Tests backend API contracts across 9 test suites:

**1. Personas API**
- Fetch all personas
- Fetch persona by ID
- Verify data structure

**2. Services API**
- Fetch services with pagination
- Filter by rating
- Search by name

**3. Intake Forms API**
- Create intake form
- Fetch intake by ID
- Validate required fields

**4. Service Offers API**
- Fetch offers for intake
- Accept offer → create hire agreement
- Reject offer with reason

**5. Hire Agreements API**
- Fetch hire agreement details
- Update status
- Track state transitions

**6. Identity Verification API**
- Verify with ID.me
- Upload identity document
- Get verification status

**7. Video Sessions API**
- Create video session
- Fetch session history
- Update session status

**8. Messaging API**
- Send message
- Fetch message thread
- Mark message as read

**9. Subscriptions API**
- Fetch subscription tiers
- Fetch user subscription
- Upgrade subscription tier

**10. Error Handling**
- Return proper HTTP status codes (400, 404, 401)
- Handle network timeouts
- Maintain data contracts

### Real-Time Features (`realtime-features.test.ts`)

Tests polling, timers, and live updates across 7 test suites:

**1. Message Polling (3-second interval)**
- Poll every 3 seconds
- Stop polling on unmount
- Fetch new messages per poll
- Handle polling errors
- Debounce rapid requests

**2. Offer Expiration Countdown**
- Calculate remaining time
- Update countdown every second
- Format display text
- Mark as expired
- Disable buttons on expiry

**3. Video Call Duration Timer**
- Track duration from start
- Format as HH:MM:SS
- Update every second
- Pause and resume
- Stop and record final duration

**4. Subscription Renewal Countdown**
- Calculate days until renewal
- Warn when < 7 days
- Display renewal date in user timezone

**5. Auto-Refresh on Focus**
- Poll when user returns to page
- Stop polling when page hidden
- Resume when page visible

**6. Connection Loss Recovery**
- Retry failed polling
- Implement exponential backoff
- Show connection status indicator

**7. Rate Limiting**
- Limit requests to 1 per second
- Queue requests during limit

**8. Local Data Sync**
- Sync received messages
- Optimistic updates

## Test Coverage Goals

Target coverage by component:

| Component | Lines | Coverage Target |
|-----------|-------|-----------------|
| PersonaSwitcher | 450 | 85% |
| ServiceMarketplace | 750 | 80% |
| IntakeForm | 600 | 90% |
| ServiceOfferDisplay | 750 | 85% |
| IDMeVerification | 720 | 90% |
| VideoConferencing | 770 | 85% |
| MessagingUI | 540 | 85% |
| SubscriptionUI | 700 | 80% |
| VerificationDashboard | 500 | 80% |
| **TOTAL** | **~5,700** | **~85% overall** |

## Mocking Strategy

### API Mocks
- `global.fetch` mocked with jest.fn()
- Responses follow standard contract: `{ success: true/false, data: {...}, errors: {...} }`
- All mock data includes required fields (id, timestamps)

### Component Mocks
- Components imported directly (no module mocks)
- Props passed as actual test data
- Callbacks verified with jest.fn()

### Timers
- `jest.useFakeTimers()` for time-dependent tests
- `jest.advanceTimersByTime()` to simulate time passage
- `jest.useRealTimers()` to restore after tests

### Browser APIs
- localStorage: Full mock with get/set/clear
- sessionStorage: Full mock with get/set/clear
- window.matchMedia: Mocked for responsive tests
- IntersectionObserver: Mocked for visibility detection

## Running Complete Test Suite

### Step 1: Validate Installation
```bash
npm test -- --listTests
# Should output all 3 test files
```

### Step 2: Run Full Suite
```bash
npm test
```

Expected output:
```
PASS  src/__tests__/integration/hiring-workflow.test.tsx (45.2s)
  Hiring Workflow Integration Tests
    Step 1: Persona Selection (4 tests)
    Step 2: Service Browsing & Selection (3 tests)
    Step 3: Intake Form Submission (4 tests)
    Step 4: Offer Review & Acceptance (4 tests)
    Step 5: Identity Verification (4 tests)
    Step 6: Video Conferencing (4 tests)
    Step 7: Real-Time Messaging (5 tests)
    Complete Workflow End-to-End (1 test)
    Error Handling & Edge Cases (6 tests)
    Responsive Design & Accessibility (2 tests)
  ✓ 37 tests passed

PASS  src/__tests__/integration/api-integration.test.ts (12.4s)
  API Integration Tests
    Personas API (2 tests)
    Services API (3 tests)
    Intake Forms API (3 tests)
    Service Offers API (3 tests)
    Hire Agreements API (2 tests)
    Identity Verification API (3 tests)
    Video Sessions API (3 tests)
    Messaging API (3 tests)
    Subscriptions API (3 tests)
    Error Handling (4 tests)
    Data Contracts & Validation (3 tests)
  ✓ 41 tests passed

PASS  src/__tests__/integration/realtime-features.test.ts (8.9s)
  Real-Time Features Integration Tests
    Message Polling (5 tests)
    Offer Expiration Countdown (5 tests)
    Video Call Duration Timer (5 tests)
    Subscription Renewal Countdown (3 tests)
    Auto-Refresh on Focus (3 tests)
    Connection Loss Recovery (3 tests)
    Rate Limiting (2 tests)
    Local Data Sync (2 tests)
  ✓ 28 tests passed

Test Suites: 3 passed, 3 total
Tests:       106 passed, 106 total
Snapshots:   0 total
Time:        67.2s
Coverage Summary:
  Statements   : 87.3% ( 4982/5712 )
  Branches     : 84.2% ( 2156/2561 )
  Functions    : 86.1% ( 3421/3973 )
  Lines        : 87.5% ( 4994/5708 )
```

### Step 3: Generate Coverage Report
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

## Troubleshooting

### Tests not found
```bash
# Verify test file paths
npm test -- --listTests

# Check Jest configuration
npm test -- --showConfig
```

### Module not found errors
```bash
# Ensure TypeScript paths are correct in jest.config.js
# Verify node_modules has all dependencies
npm install

# Clear Jest cache
npm test -- --clearCache
```

### Tests timing out
```bash
# Increase timeout in jest.config.js
testTimeout: 20000  // Increase from 10000

# Or per test:
it('slow test', async () => {
  // ...
}, 20000);
```

### Mock errors
```bash
# Verify global.fetch is properly mocked in each test
beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.clearAllMocks();
});
```

## Best Practices

1. **Always reset mocks**: Call `jest.clearAllMocks()` in `afterEach()`
2. **Use waitFor for async**: Wrap assertions on async state changes in `waitFor()`
3. **Mock at test level**: Mock API responses at the individual test level, not globally
4. **Test user interactions**: Use `userEvent` for realistic user input
5. **Avoid implementation details**: Test behavior, not internal state
6. **Isolate tests**: Each test should be independent and runnable in any order

## Continuous Integration

### GitHub Actions Example
```yaml
name: Integration Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd transcend-frontend && npm install
      - run: npm run test:ci
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## Performance Metrics

Target test execution times:

| Test Suite | Count | Duration |
|-----------|-------|----------|
| Hiring Workflow | 37 | ~45s |
| API Integration | 41 | ~12s |
| Real-Time Features | 28 | ~9s |
| **Total** | **106** | **~66s** |

## Next Steps (Phase 4)

After Phase 3 Integration Testing completes:
1. Run E2E tests with Cypress/Playwright
2. Performance testing (Lighthouse)
3. Accessibility audit (axe-core)
4. Security scanning (OWASP ZAP)
5. Load testing (k6)
6. User acceptance testing
7. Deployment to staging
8. Production deployment

## Success Criteria

✅ All 106 integration tests pass
✅ Code coverage ≥ 85% (statements, branches, functions, lines)
✅ No console errors or warnings
✅ All API contracts validated
✅ Real-time features working correctly
✅ Error handling robust
✅ Accessibility compliance verified
✅ Performance meets targets

---

**Phase 3 Integration Testing: 10 hours estimated | ~5,700 lines of test code**
