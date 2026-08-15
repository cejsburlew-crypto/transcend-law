# NPS Survey Deployment Checklist

## Pre-Deployment Steps

### Backend Setup
- [ ] Copy `npsService.ts` to `/transcend-api/services/`
- [ ] Copy `npsRoutes.ts` to `/transcend-api/routes/`
- [ ] Update Express app to register NPS routes:
  ```ts
  import { registerNPSRoutes } from './routes/npsRoutes';
  registerNPSRoutes(app);
  ```
- [ ] Verify database connection is properly configured
- [ ] Run database schema initialization (automatic on first service call)
- [ ] Test all API endpoints locally

### Frontend Setup
- [ ] Copy `NPSSurvey.tsx` to `/transcend-frontend/src/components/`
- [ ] Copy `NPSSurvey.css` to `/transcend-frontend/src/components/`
- [ ] Create `/transcend-frontend/src/components/Admin/` directory if it doesn't exist
- [ ] Copy `NPSDashboard.tsx` to `/transcend-frontend/src/components/Admin/`
- [ ] Import and add NPSSurvey component to main App component
- [ ] Import NPSDashboard in admin pages
- [ ] Verify styling loads correctly
- [ ] Test component responsiveness on mobile

### Documentation Setup
- [ ] Place `NPS_IMPLEMENTATION_GUIDE.md` in project root
- [ ] Place `NPS_INTEGRATION_EXAMPLE.ts` in project root
- [ ] Place `NPS_DEPLOYMENT_CHECKLIST.md` in project root (this file)
- [ ] Share documentation with team

## Environment Configuration

- [ ] Verify DATABASE_URL is set for production
- [ ] Confirm authentication tokens are properly validated
- [ ] Check CORS settings allow NPS API calls
- [ ] Verify HTTPS is enabled for all API endpoints
- [ ] Confirm logging/audit trail is configured

## Database Verification

- [ ] Run migration to create NPS tables:
  ```sql
  -- Tables are created automatically by npsService
  -- Verify in psql: \dt nps_*
  ```
- [ ] Check indexes are created:
  ```sql
  SELECT * FROM pg_indexes WHERE tablename LIKE 'nps_%';
  ```
- [ ] Verify foreign key relationships:
  ```sql
  SELECT * FROM information_schema.table_constraints 
  WHERE table_name LIKE 'nps_%' AND constraint_type = 'FOREIGN KEY';
  ```
- [ ] Test database connection pool
- [ ] Backup existing database before deployment

## Integration Testing

### API Testing
- [ ] POST /api/nps/submit - Submit survey response
  ```bash
  curl -X POST http://localhost:3000/api/nps/submit \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -d '{"userId":"test-user","userType":"client","score":8,"followUpComment":"Great service","tags":["Easy to use"]}'
  ```
- [ ] GET /api/nps/check-eligibility - Check survey eligibility
- [ ] GET /api/nps/survey/:id - Retrieve survey
- [ ] GET /api/nps/user/:userId/history - Get user history
- [ ] GET /api/nps/trends/monthly - Get monthly trends
- [ ] GET /api/nps/admin/dashboard - Admin dashboard (verify auth)
- [ ] POST /api/nps/admin/action-items/:id - Update action items
- [ ] GET /api/nps/admin/export - Export data

### Component Testing
- [ ] NPSSurvey displays without errors
- [ ] Score selection works (click each 0-10)
- [ ] Follow-up text input works
- [ ] Tag selection/deselection works
- [ ] Form submission succeeds
- [ ] Success message displays
- [ ] Survey auto-closes after submission
- [ ] Mobile layout is responsive

### Admin Dashboard Testing
- [ ] Dashboard loads for admin users
- [ ] Metrics display with correct values
- [ ] Trends chart renders correctly
- [ ] Feedback themes display
- [ ] Action items list shows
- [ ] Alerts display when present
- [ ] Tab navigation works
- [ ] Data updates on refresh

## Performance Testing

- [ ] Load test: Simulate 100 concurrent survey submissions
- [ ] Database query performance (check slow query log)
- [ ] Front-end bundle size impact (<200KB added)
- [ ] Memory usage on background scheduling
- [ ] Response time for dashboard (<1s)
- [ ] Trend calculation time (<5s for 12-month data)

## Security Verification

- [ ] Admin endpoints require authentication
- [ ] User can only view their own survey history
- [ ] Survey responses are encrypted in database
- [ ] No sensitive data in logs
- [ ] Rate limiting on API endpoints
- [ ] SQL injection prevention verified
- [ ] XSS protection in components
- [ ] CSRF tokens on state-changing requests

## Monitoring Setup

- [ ] Create alerts for NPS < 0 (critical)
- [ ] Monitor API error rates
- [ ] Track survey response rates
- [ ] Setup dashboard refresh schedule
- [ ] Configure log aggregation
- [ ] Setup uptime monitoring
- [ ] Create runbooks for alerts

## User Communication

- [ ] Prepare user-facing documentation
- [ ] Create admin guide for dashboard
- [ ] Prepare FAQ about survey frequency
- [ ] Set expectations for survey timing
- [ ] Communicate survey purpose/privacy
- [ ] Train support team on NPS system

## Staging Deployment

- [ ] Deploy to staging environment
- [ ] Run full integration test suite
- [ ] Perform user acceptance testing (UAT)
- [ ] Verify all routes work in staging
- [ ] Check database migrations in staging
- [ ] Monitor for errors (24 hours)
- [ ] Gather feedback from staging users
- [ ] Document any issues found

## Production Deployment

### Pre-Deployment
- [ ] Backup production database
- [ ] Notify stakeholders of deployment
- [ ] Prepare rollback plan
- [ ] Schedule deployment for low-traffic time
- [ ] Create deployment ticket with details

### Deployment
- [ ] Deploy backend service code
- [ ] Deploy frontend components
- [ ] Run database migrations
- [ ] Verify all services are running
- [ ] Check application logs for errors
- [ ] Test critical flows in production
- [ ] Monitor error rates

### Post-Deployment
- [ ] Verify dashboard is accessible to admins
- [ ] Check survey displays to users
- [ ] Monitor API response times
- [ ] Verify background jobs are running
- [ ] Check audit logs for activity
- [ ] Gather team feedback
- [ ] Update deployment status
- [ ] Schedule post-deployment review

## Monitoring & Alerts

### Critical Alerts (Immediate Action)
- [ ] API error rate > 5%
- [ ] Database connection failures
- [ ] NPS service startup failures
- [ ] Admin dashboard not loading

### Warning Alerts (Review within 1 hour)
- [ ] NPS score drops > 20 points
- [ ] Low survey response rate (<20%)
- [ ] API response time > 2 seconds
- [ ] Database query time > 5 seconds

### Info Notifications (Daily Review)
- [ ] Trend calculations completed
- [ ] Action items generated
- [ ] Survey scheduling completed

## Rollback Plan

If critical issues discovered:

1. **Immediate Actions**
   - [ ] Stop serving NPS survey to users
   - [ ] Disable NPS routes via feature flag
   - [ ] Notify team leads

2. **Rollback Process**
   - [ ] Revert code to last known good version
   - [ ] Restore database from backup if needed
   - [ ] Verify rollback success
   - [ ] Monitor error rates

3. **Post-Rollback**
   - [ ] Document issues found
   - [ ] Schedule post-mortem
   - [ ] Plan fixes for next deployment

## Success Metrics

After 1 week of deployment:
- [ ] NPS survey response rate ≥ 20%
- [ ] Dashboard accessible to all admins
- [ ] Zero critical errors in logs
- [ ] API response times stable
- [ ] Database performance acceptable
- [ ] Trend calculations running successfully
- [ ] At least 100 survey responses collected
- [ ] No user complaints about survey

## Knowledge Transfer

- [ ] Document any custom configurations
- [ ] Create runbook for common issues
- [ ] Record video walkthrough of dashboard
- [ ] Train support team on system
- [ ] Setup team Slack channel for updates
- [ ] Schedule weekly sync on NPS metrics

## Maintenance Schedule

- [ ] Daily: Monitor alerts and error logs
- [ ] Weekly: Review NPS trends and action items
- [ ] Monthly: Analyze dashboard data and generate reports
- [ ] Quarterly: Review and optimize performance
- [ ] Annually: Assess system improvements and plan enhancements

## Files Deployed

Production Checklist - Verify all files in place:

### Backend
- ✓ `/transcend-api/services/npsService.ts` (750+ lines)
- ✓ `/transcend-api/routes/npsRoutes.ts` (350+ lines)

### Frontend
- ✓ `/transcend-frontend/src/components/NPSSurvey.tsx` (350+ lines)
- ✓ `/transcend-frontend/src/components/NPSSurvey.css` (500+ lines)
- ✓ `/transcend-frontend/src/components/Admin/NPSDashboard.tsx` (400+ lines)

### Documentation
- ✓ `/NPS_IMPLEMENTATION_GUIDE.md` (Comprehensive guide)
- ✓ `/NPS_INTEGRATION_EXAMPLE.ts` (Integration examples)
- ✓ `/NPS_DEPLOYMENT_CHECKLIST.md` (This file)

## Deployment Sign-Off

- [ ] Code review completed and approved
- [ ] Testing completed by QA team
- [ ] Security review completed
- [ ] Performance testing passed
- [ ] Documentation reviewed
- [ ] Deployment plan approved by PM
- [ ] Launch approved by stakeholders

**Deployed By**: ___________________
**Deployment Date**: ___________________
**Deployment Time**: ___________________
**Reviewed By**: ___________________
**Review Date**: ___________________

---

## Notes & Issues Found During Deployment

(Document any issues or special configurations needed)

_________________________
_________________________
_________________________

---

**System Ready for Production**: YES / NO

For any questions or issues, refer to:
- Implementation Guide: `NPS_IMPLEMENTATION_GUIDE.md`
- Integration Examples: `NPS_INTEGRATION_EXAMPLE.ts`
- Contact: [Your Team Contact Info]
