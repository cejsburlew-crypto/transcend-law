# Quick Start Guide - Transcend Legal Platform

## Installation

```bash
# Install backend dependencies
cd transcend-api
npm install

# Install frontend dependencies
cd ../transcend-frontend
npm install
npm install -D cypress k6 @cypress/code-coverage cypress-axe
```

## Running the Application

### Development Mode

```bash
# Terminal 1: Start backend
cd transcend-api
npm run dev

# Terminal 2: Start frontend
cd transcend-frontend
npm run dev

# Open browser
# http://localhost:5173
```

### Production Build

```bash
cd transcend-frontend
npm run build
npm run preview
```

---

## Testing

### Unit & Integration Tests (Jest)

```bash
# Run all tests
npm test

# Watch mode (auto-rerun on changes)
npm run test:watch

# Coverage report
npm run test:coverage

# Run integration tests only
npm run test:integration

# Debug mode
npm run test:debug
```

### E2E Tests (Cypress)

```bash
# Interactive mode (opens Cypress UI)
npm run test:e2e:open

# Headless mode (CI/CD)
npm run test:e2e

# Specific test file
npm run test:e2e -- --spec "cypress/e2e/hiring-workflow.cy.ts"

# With video recording
npm run test:e2e -- --video

# Generate coverage
npm run test:e2e -- --coverage
```

### Load Tests (k6)

```bash
# Hiring workflow load test
k6 run transcend-frontend/load-testing/hiring-workflow.js

# Messaging load test
k6 run transcend-frontend/load-testing/messaging.js

# With custom settings
k6 run -e ITERATIONS=100 -e DURATION=10m hiring-workflow.js
```

### Performance Testing (Lighthouse)

```bash
# Run Lighthouse
npm run lighthouse

# CI/CD mode
npm run lighthouse:ci

# Generate HTML report
open coverage/lighthouse-report.html
```

### Accessibility Testing

```bash
# Run accessibility audit
npm run test:a11y

# Generate report
npm run test:a11y -- --output html
```

### Security Scanning

```bash
# Dependency vulnerabilities
npm audit

# Fix automatically
npm audit fix

# Detailed report
npm audit --json > security-report.json
```

---

## Test Scripts Summary

Add these to `transcend-frontend/package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:integration": "jest src/__tests__/integration",
    "test:debug": "node --inspect-brk node_modules/.bin/jest --runInBand",
    "test:e2e": "cypress run",
    "test:e2e:open": "cypress open",
    "test:e2e:staging": "cypress run --config baseUrl=https://staging.transcend.legal",
    "test:e2e:production": "cypress run --config baseUrl=https://transcend.legal",
    "test:load": "k6 run load-testing/hiring-workflow.js",
    "test:load:messaging": "k6 run load-testing/messaging.js",
    "lighthouse": "lighthouse-ci autorun --config=lighthouserc.json",
    "lighthouse:ci": "lighthouse-ci autorun --config=lighthouserc.json --upload.target=temporary-public-storage",
    "test:a11y": "axe --help",
    "test:all": "npm run test && npm run test:e2e && npm run lighthouse",
    "build": "vite build",
    "preview": "vite preview",
    "deploy:staging": "npm run build && npm run deploy -- --environment staging",
    "deploy:production": "npm run build && npm run deploy -- --environment production"
  }
}
```

---

## Manual Testing Checklist

### User Journey: Client Hires a Lawyer

```
1. Dashboard
   [ ] Page loads
   [ ] Persona switcher visible
   [ ] Navigation menu shows

2. Service Discovery
   [ ] Services load
   [ ] Search works
   [ ] Filter by rating works
   [ ] Grid/list view toggle works

3. Intake Form
   [ ] Form loads
   [ ] Title validation works
   [ ] Description character counter works
   [ ] Budget input works
   [ ] Urgency level selection works

4. Offers
   [ ] Offers appear after intake submission
   [ ] Countdown timer updates
   [ ] Accept/reject buttons work
   [ ] Status changes correctly

5. Identity Verification
   [ ] Verification page loads
   [ ] File upload works
   [ ] File size validation works
   [ ] Status updates

6. Video Conferencing
   [ ] Video call button appears
   [ ] Call can be launched
   [ ] Duration timer works
   [ ] Call can be ended

7. Messaging
   [ ] Message input visible
   [ ] Messages can be sent
   [ ] New messages appear in real-time
   [ ] File attachments work

8. Subscription
   [ ] Subscription page loads
   [ ] Current tier displays
   [ ] Can upgrade tier
   [ ] Billing history shows
```

### Admin Testing

```
1. Verification Dashboard
   [ ] Dashboard loads
   [ ] Stats display
   [ ] Credentials list shows
   [ ] Can filter by status
   [ ] Can approve credential
   [ ] Can reject credential
```

### Responsive Testing

```
# Mobile (iPhone size: 375x812)
[ ] All elements visible
[ ] Navigation menu works
[ ] Forms are usable
[ ] Buttons are tappable

# Tablet (iPad size: 768x1024)
[ ] Layout adapts
[ ] Content is readable
[ ] No horizontal scroll

# Desktop (1280x800)
[ ] Sidebar visible
[ ] Layout optimal
[ ] All features accessible
```

### Accessibility Testing

```
[ ] Keyboard navigation works
[ ] Tab order is logical
[ ] All images have alt text
[ ] Color contrast is sufficient (4.5:1)
[ ] Form labels are associated
[ ] Error messages are clear
[ ] Screen reader announces content
```

---

## Deployment

### Staging Deployment

```bash
# 1. Build
npm run build

# 2. Run tests
npm run test:all

# 3. Deploy
npm run deploy:staging

# 4. Verify
curl https://staging.transcend.legal/health
npm run test:e2e:staging
```

### Production Deployment

```bash
# 1. Code review
git log --oneline origin/main..HEAD

# 2. Build
npm run build

# 3. Final tests
npm run test:all

# 4. Deploy
npm run deploy:production

# 5. Monitor
npm run monitor:production

# 6. Verify health
curl https://transcend.legal/health
```

### Rollback

```bash
# If critical issues
git revert HEAD
npm run build
npm run deploy:production

# Verify
npm run test:e2e:production
```

---

## Monitoring & Debugging

### View Logs

```bash
# Backend logs
npm run logs:backend

# Frontend console errors
npm run logs:frontend

# Full stack logs
npm run logs:all
```

### Performance Profiling

```bash
# CPU profiling
node --prof transcend-api/server.js

# Memory profiling
node --inspect transcend-api/server.js
# Open chrome://inspect
```

### Database

```bash
# Connect to database
psql postgresql://user:password@localhost:5432/transcend

# Run migrations
npm run migrate

# Seed test data
npm run seed
```

---

## Common Issues & Solutions

### Tests Failing

```bash
# Clear Jest cache
npm test -- --clearCache

# Clear Cypress cache
rm -rf ~/.cache/Cypress
npx cypress cache clear

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Port Already in Use

```bash
# Kill process on port 5173 (frontend)
lsof -ti:5173 | xargs kill -9

# Kill process on port 3000 (backend)
lsof -ti:3000 | xargs kill -9
```

### Database Issues

```bash
# Reset database
npm run migrate:reset

# Seed fresh data
npm run seed

# Check connections
psql -c "SELECT datname FROM pg_database"
```

### Memory Issues

```bash
# Increase Node memory limit
export NODE_OPTIONS=--max-old-space-size=4096
npm run build

# Or permanently in .env
NODE_OPTIONS=--max-old-space-size=4096
```

---

## Documentation

**Quick Reference:**
- [Phase 3: Integration Tests](PHASE_3_INTEGRATION_TESTS.md)
- [Phase 4: Testing & Launch](PHASE_4_TESTING_LAUNCH.md)
- [Project Status](PROJECT_COMPLETION_STATUS.md)

**Detailed Guides:**
- API Specification: `API_SPECIFICATION.md`
- Database Schema: `DATABASE_SCHEMA.md`
- Architecture: `ARCHITECTURE.md`
- Component Documentation: `COMPONENT_DOCS.md`

---

## Team Resources

**Slack Channel:** #transcend-platform
**Wiki:** https://wiki.transcend.legal
**Jira Board:** https://jira.transcend.legal/projects/TRANSCEND
**Monitoring:** https://sentry.transcend.legal
**APM:** https://newrelic.transcend.legal

---

## Getting Help

1. **Check Docs:** Search documentation first
2. **Search Logs:** Check error logs and monitoring
3. **Run Tests:** Verify with test suite
4. **Ask Team:** Post in Slack #transcend-platform
5. **File Issue:** Create GitHub issue if bug found

---

## Quick Commands Reference

```bash
# Start development
npm run dev

# Run tests
npm test
npm run test:e2e
npm run test:load

# Build for production
npm run build

# Deploy
npm run deploy:staging
npm run deploy:production

# Monitor
npm run monitor:production

# Debug
npm run test:debug
npm run logs:all
```

---

**Last Updated:** August 15, 2026
**Platform Version:** 1.0.0
**Node Version:** 18+
**Database:** PostgreSQL 13+
