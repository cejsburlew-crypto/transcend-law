# Admin Dashboard & Role-Based Access Control (RBAC) System
**Transcend Law Platform - Administrative Console**

**Status:** Ready for Implementation (Phase 8 - September 2026)  
**Priority:** HIGH (Post-Launch)  
**Owner Account:** Protected Admin Account (Cannot be edited/deleted)

---

## OVERVIEW

Admin Dashboard providing:
- 📊 Real-time platform metrics
- 👥 User management (clients, attorneys, admins)
- 🔐 Role-based access control (RBAC)
- 🛡️ Owner account protection (immutable primary admin)
- 📈 Analytics and reporting
- ⚙️ System configuration
- 🚨 Error/incident tracking
- 💰 Revenue and financial overview

---

## ARCHITECTURE

### Admin User Roles (Hierarchy)

```
Owner (Jim Burlew)
├─ CANNOT be edited, deleted, or demoted
├─ Can create other Admins
├─ Can delete any other user
├─ Can access all systems
├─ Can view all financial data
└─ Can configure system settings

Admin (Team Leads)
├─ Can be promoted/demoted by Owner
├─ Can create Moderators
├─ Can access metrics, reports, users
├─ Can moderate content/users
├─ Can manage support tickets
└─ Cannot delete other Admins

Moderator (Support Staff)
├─ Can manage users (not admins)
├─ Can view reports
├─ Can respond to support issues
├─ Can moderate content
├─ Limited financial data access
└─ Cannot create other Moderators

Analyst (Data Team)
├─ Read-only access to analytics
├─ Can export reports
├─ Can view metrics dashboards
├─ Cannot access user data
├─ Cannot modify anything
└─ Limited financial data (aggregated only)

Support (Help Desk)
├─ Can view user profiles
├─ Can respond to support tickets
├─ Can see case details (customer-facing)
├─ Cannot see financial data
├─ Cannot modify user accounts
└─ Limited access to system config
```

### Database Schema

```sql
-- Admin users table
CREATE TABLE admin_users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('owner', 'admin', 'moderator', 'analyst', 'support') NOT NULL,
  
  -- Immutability protection (Owner only)
  is_protected BOOLEAN DEFAULT FALSE,
  
  full_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  
  -- Permissions override (if needed)
  custom_permissions JSON,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN DEFAULT FALSE,
  
  -- Audit trail
  created_by VARCHAR(36),
  deleted_by VARCHAR(36),
  deleted_at TIMESTAMP,
  
  INDEX (role),
  INDEX (is_active),
  INDEX (is_protected)
);

-- Audit log for admin actions
CREATE TABLE admin_audit_log (
  id VARCHAR(36) PRIMARY KEY,
  admin_id VARCHAR(36),
  action VARCHAR(100),
  resource_type VARCHAR(50),
  resource_id VARCHAR(36),
  before_state JSON,
  after_state JSON,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (admin_id),
  INDEX (timestamp),
  INDEX (resource_type)
);

-- Role permissions mapping
CREATE TABLE role_permissions (
  id VARCHAR(36) PRIMARY KEY,
  role VARCHAR(50),
  permission VARCHAR(100),
  UNIQUE KEY (role, permission),
  INDEX (role)
);
```

---

## OWNER ACCOUNT PROTECTION

### Owner Account (Jim Burlew)

**Protection Rules (Enforced at Code Level + DB Level):**

```typescript
// Owner account immutability rules
const OWNER_ID = "jim_burlew_owner_001";
const IS_PROTECTED = true;

// Cannot be deleted
if (adminId === OWNER_ID) {
  throw new Error("Owner account cannot be deleted");
}

// Cannot be demoted
if (currentRole === 'owner' && newRole !== 'owner') {
  throw new Error("Owner account cannot be demoted");
}

// Cannot have password reset via normal admin
if (targetAdminId === OWNER_ID && 
    requestingAdminId !== OWNER_ID) {
  throw new Error("Only Owner can reset Owner password");
}

// Cannot be locked/disabled
if (adminId === OWNER_ID && action === 'disable') {
  throw new Error("Owner account cannot be disabled");
}

// Cannot be edited by anyone but Owner
if (targetAdminId === OWNER_ID && 
    requestingAdminId !== OWNER_ID) {
  throw new Error("Owner account can only be edited by Owner");
}
```

**Database Constraints:**

```sql
-- Trigger to prevent Owner deletion
DELIMITER $$
CREATE TRIGGER prevent_owner_deletion
BEFORE DELETE ON admin_users
FOR EACH ROW
BEGIN
  IF OLD.is_protected = TRUE THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Protected admin account cannot be deleted';
  END IF;
END$$
DELIMITER ;

-- Trigger to prevent Owner role change
DELIMITER $$
CREATE TRIGGER prevent_owner_demotion
BEFORE UPDATE ON admin_users
FOR EACH ROW
BEGIN
  IF OLD.is_protected = TRUE AND NEW.role != OLD.role THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Protected admin account role cannot be changed';
  END IF;
END$$
DELIMITER ;
```

---

## ADMIN DASHBOARD COMPONENTS

### 1. Main Dashboard (Landing Page)

**Widgets:**
- Key metrics (users, cases, revenue)
- System health (error rate, latency, uptime)
- Recent activity feed
- Alerts/warnings
- Quick actions

```typescript
interface AdminDashboard {
  metrics: {
    totalUsers: number;
    activeUsers24h: number;
    totalCases: number;
    activeCases: number;
    monthlyRevenue: number;
    averageEngagement: number;
  };
  systemHealth: {
    uptime: string;
    errorRate: string;
    p95Latency: number;
    status: 'green' | 'yellow' | 'red';
  };
  alerts: Alert[];
  recentActivity: Activity[];
}
```

### 2. User Management Panel

**Capabilities:**
- View all users (clients, attorneys, admins)
- Search and filter
- View user details
- Enable/disable users
- View user history
- Promote to admin (Owner only)

```typescript
interface UserManagement {
  users: User[];
  searchFilters: {
    email: string;
    role: string;
    status: 'active' | 'inactive';
    createdAfter: Date;
    createdBefore: Date;
  };
  actions: {
    viewDetails: (userId: string) => void;
    toggleActive: (userId: string) => void;
    promoteToAdmin: (userId: string) => void; // Owner/Admin only
    resetPassword: (userId: string) => void; // Owner/Admin only
  };
}
```

### 3. Admin Users Panel

**Capabilities:**
- View all admins and their roles
- Invite new admins
- Change admin roles (Owner only for Owner account)
- View admin activity logs
- Remove admins (Owner only)

```typescript
interface AdminUsersPanel {
  admins: AdminUser[];
  actions: {
    inviteAdmin: (email: string, role: string) => void; // Admin+
    changeRole: (adminId: string, newRole: string) => void; // Owner only
    removeAdmin: (adminId: string) => void; // Owner only
    viewActivityLog: (adminId: string) => Activity[];
    resetPassword: (adminId: string) => void; // Owner only
  };
}
```

### 4. Analytics & Reporting

**Reports Available:**
- User growth trends
- Attorney network metrics
- Revenue trends
- Case completion rates
- Conversion funnel analysis
- Engagement metrics

```typescript
interface AnalyticsReports {
  userGrowth: {
    daily: number[];
    monthly: number[];
    churn: number;
  };
  attorneyMetrics: {
    totalAttorneys: number;
    activeAttorneys: number;
    avgCasesPerAttorney: number;
    avgEarningsPerAttorney: number;
  };
  caseMetrics: {
    totalCases: number;
    completedCases: number;
    completionRate: number;
    avgCaseValue: number;
    avgResolutionTime: number;
  };
}
```

### 5. Error & Incident Tracking

**Displays:**
- Real-time errors (from Phase 8)
- Error patterns
- Incident history
- Auto-repair status
- Manual escalations

### 6. Financial Dashboard

**Visibility (Owner/Admin only):**
- Daily revenue
- Monthly revenue
- Revenue by service type
- Attorney payouts
- Platform economics
- Growth tracking

### 7. System Settings

**Configuration (Owner only):**
- Commission rates
- Feature flags
- Payment processing config
- Email templates
- SMS templates
- Privacy settings

---

## API ENDPOINTS

### Authentication

```
POST /admin/login
  Body: { email, password }
  Response: { token, admin }

POST /admin/logout
  Headers: { Authorization: token }
  Response: { success: true }

POST /admin/refresh-token
  Headers: { Authorization: token }
  Response: { token }
```

### User Management

```
GET /admin/users
  Params: { role, status, search, page }
  Response: { users[], total, page }

GET /admin/users/:userId
  Response: { user }

PUT /admin/users/:userId
  Body: { status, ... }
  Response: { user }

DELETE /admin/users/:userId
  Requires: Admin+ role
  Protected against: Owner account deletion
  Response: { success }

POST /admin/users/:userId/promote-to-admin
  Requires: Owner role
  Body: { role }
  Response: { user }
```

### Admin Management

```
GET /admin/admins
  Response: { admins[] }

POST /admin/admins/invite
  Body: { email, role }
  Response: { invitation }

PUT /admin/admins/:adminId/role
  Requires: Owner role
  Protected against: Changing Owner role
  Body: { role }
  Response: { admin }

DELETE /admin/admins/:adminId
  Requires: Owner role
  Protected against: Deleting Owner account
  Response: { success }

GET /admin/admins/:adminId/activity
  Response: { activities[] }
```

### Analytics

```
GET /admin/analytics/dashboard
  Response: { metrics }

GET /admin/analytics/users
  Params: { period }
  Response: { trends }

GET /admin/analytics/revenue
  Params: { period }
  Response: { revenue_data }

GET /admin/analytics/cases
  Params: { period }
  Response: { case_data }
```

### Audit Log

```
GET /admin/audit-log
  Params: { admin, action, resource, page }
  Response: { logs[], total }

GET /admin/audit-log/:logId
  Response: { log }
```

---

## OWNER ACCOUNT SETUP

### Initial Setup (Post-Launch, Aug 26)

```typescript
// Step 1: Create protected Owner account
const ownerAccount = await AdminUsers.create({
  id: 'jim_burlew_owner_001',
  email: 'jim.burlew@jbca-inc.com',
  role: 'owner',
  is_protected: true,
  full_name: 'Jim Burlew',
  passwordHash: bcrypt.hash(SECURE_PASSWORD),
});

// Step 2: Grant all permissions
await RolePermissions.grantAll(ownerAccount.id);

// Step 3: Log creation
await AuditLog.create({
  admin_id: 'system',
  action: 'owner_account_created',
  resource_type: 'admin_user',
  resource_id: ownerAccount.id,
  after_state: ownerAccount,
});

// Step 4: Verify protection
console.log('✅ Owner account created and protected');
console.log('✅ Cannot be deleted:', ownerAccount.is_protected);
console.log('✅ Cannot be demoted:', ownerAccount.role === 'owner');
```

### Owner Login (First Time)

1. Navigate to admin.transcendlaw.com
2. Click "Owner Login"
3. Enter email + password
4. Accept 2FA (if enabled)
5. Set security preferences
6. Dashboard appears with all access

---

## CREATING NEW ADMINS

### Owner Creates Admin

```typescript
// Step 1: Generate invitation
const invitation = await AdminInvitation.create({
  email: 'admin@transcendlaw.com',
  role: 'admin',
  created_by: OWNER_ID,
});

// Step 2: Send email
await sendEmail({
  to: invitation.email,
  template: 'admin_invitation',
  data: { invitationLink: invitation.link },
});

// Step 3: Admin clicks link, sets password
// Step 4: Account activated
// Step 5: Logged in audit trail
```

### Admin Creates Moderator

```typescript
// Admin (but not Owner account) can create Moderator
const moderator = await AdminUsers.create({
  email: 'moderator@transcendlaw.com',
  role: 'moderator',
  created_by: ADMIN_ID,
});

// Same process as above
```

---

## REMOVING ADMINS (Owner Only)

### Owner Removes Other Admin

```typescript
// Only Owner can remove other admins
if (requestingAdminId !== OWNER_ID) {
  throw new Error('Only Owner can remove admins');
}

// Cannot remove Owner
if (targetAdminId === OWNER_ID) {
  throw new Error('Owner account cannot be removed');
}

// Remove admin
const removed = await AdminUsers.delete(targetAdminId);

// Log action
await AuditLog.create({
  admin_id: OWNER_ID,
  action: 'admin_removed',
  resource_id: targetAdminId,
  before_state: removed,
});
```

---

## PERMISSION MODEL

### Permission Hierarchy

```
Owner (owner)
├─ admin:create (can create admins)
├─ admin:read (can view admins)
├─ admin:update (can update any admin except self)
├─ admin:delete (can delete any admin except self)
├─ user:create
├─ user:read
├─ user:update
├─ user:delete
├─ analytics:view
├─ finance:view
├─ finance:edit
├─ system:configure
├─ audit:view
└─ [ALL PERMISSIONS]

Admin (admin)
├─ admin:read
├─ admin:create (Moderator only)
├─ user:read
├─ user:update
├─ user:delete
├─ analytics:view
├─ support:respond
├─ audit:view
└─ [LIMITED PERMISSIONS]

Moderator (moderator)
├─ user:read
├─ user:update
├─ support:respond
├─ audit:view
└─ [MINIMAL PERMISSIONS]

Analyst (analyst)
├─ analytics:view (read-only)
├─ reports:export
└─ [READ-ONLY PERMISSIONS]

Support (support)
├─ user:read (limited fields)
├─ support:respond
├─ cases:view
└─ [SUPPORT-ONLY PERMISSIONS]
```

---

## SECURITY FEATURES

### 1. Password Protection
- Minimum 12 characters
- Must include uppercase, lowercase, numbers, symbols
- Automatically reset required every 90 days (Owner only gets reminder)
- Failed login attempts: Account locked after 5 attempts (30 min)

### 2. Two-Factor Authentication (2FA)
- Required for all admin accounts
- Supported: TOTP (Google Authenticator), SMS backup
- Recovery codes: Generated at setup

### 3. Session Management
- Session timeout: 1 hour of inactivity
- Max concurrent sessions: 3 per admin
- Logout on suspicious activity detected
- Session revocation: Owner can revoke any admin session

### 4. Audit Logging
- Every action logged with timestamp, admin, before/after state
- Immutable audit log (cannot be edited)
- 7-year retention
- Access to audit log tracked

### 5. API Security
- JWT tokens with 1 hour expiry
- HTTPS only
- Rate limiting: 1000 requests per minute per admin
- IP whitelisting (optional for Owner)

---

## MONITORING & ALERTS

### Admin Activities Monitored

```
✅ Login/logout events
✅ Password changes
✅ User deletions
✅ Role promotions/demotions
✅ Permission changes
✅ Finance data access
✅ System configuration changes
✅ Admin account modifications
✅ Bulk operations
✅ Unusual activity patterns
```

### Alerts Sent

```
Owner Alerts:
├─ Any admin account created
├─ Any admin account deleted
├─ Any admin role changed
├─ Failed login attempts (any admin)
├─ Suspicious activity detected
└─ System configuration changes

Admin Alerts:
├─ Own password changed
├─ Own 2FA modified
├─ Own role changed
├─ Large data exports
└─ Unusual activity

Support Alerts:
├─ Own password changed
├─ Own 2FA modified
└─ Failed login attempts
```

---

## IMPLEMENTATION TIMELINE

### Phase 8A: Auth Infrastructure (Week 1-2)
- [ ] JWT token system
- [ ] Login/logout endpoints
- [ ] 2FA implementation
- [ ] Session management

### Phase 8B: RBAC Core (Week 2-3)
- [ ] Role definitions
- [ ] Permission model
- [ ] Database schema
- [ ] API endpoints

### Phase 8C: Admin Dashboard UI (Week 3-4)
- [ ] Dashboard layout
- [ ] User management interface
- [ ] Admin management interface
- [ ] Analytics views

### Phase 8D: Owner Protection (Week 4)
- [ ] Owner account creation
- [ ] Protection rules (code + DB)
- [ ] Testing owner immutability
- [ ] Audit logging

### Phase 8E: Testing & Launch (Week 5)
- [ ] Security testing
- [ ] Penetration testing
- [ ] User testing
- [ ] Production deployment

---

## TESTING CHECKLIST

### Owner Account Protection Tests

```
✅ Test: Cannot delete Owner account
✅ Test: Cannot demote Owner
✅ Test: Cannot edit Owner (by non-Owner)
✅ Test: Cannot disable Owner
✅ Test: Only Owner can edit Owner account
✅ Test: Owner can create Admins
✅ Test: Owner can delete other Admins (but not self)
✅ Test: Owner can change other Admin roles (but not own)
✅ Test: Audit log tracks all attempts
✅ Test: DB constraints prevent direct deletion
```

### RBAC Tests

```
✅ Test: Admin can view users
✅ Test: Admin cannot delete Owner
✅ Test: Moderator cannot create Admin
✅ Test: Analyst has read-only access
✅ Test: Support has limited access
✅ Test: Permission boundaries enforced
✅ Test: API returns 403 for unauthorized
✅ Test: Audit log tracks permission checks
```

### Security Tests

```
✅ Test: Weak passwords rejected
✅ Test: 2FA required for all admins
✅ Test: Failed logins lock account (5 attempts)
✅ Test: Session timeout enforces logout
✅ Test: JWT expiration enforces re-auth
✅ Test: API rate limiting works
✅ Test: All actions logged
```

---

## DOCUMENTATION FOR JIM (OWNER)

### Your Admin Account

**Email:** jim.burlew@jbca-inc.com  
**Role:** Owner (Protected)  
**Status:** Immutable - Cannot be edited or deleted by anyone

**What You Can Do:**
- View all dashboard metrics
- Create/manage admin users
- Change any admin's role (except yourself)
- Remove admins (except yourself)
- Access all system settings
- View financial data
- Configure platform features
- Reset any password (except via automatic reset)
- View complete audit trail

**What Cannot Happen:**
- Your account cannot be deleted
- Your account cannot be demoted
- Your role cannot be changed
- Your email cannot be changed (by anyone except you)
- Your account cannot be locked/disabled
- Anyone can edit your account

**First Time Setup:**
1. Go to admin.transcendlaw.com
2. Click "Owner Login"
3. Enter email + password (given at setup)
4. Set up 2FA (required)
5. Dashboard opens

**Managing Other Admins:**
1. Go to Admins panel
2. Click "Invite Admin"
3. Enter email + role (Admin, Moderator, Analyst, Support)
4. They receive email invitation
5. They set password and 2FA
6. Account active

**Removing an Admin:**
1. Go to Admins panel
2. Find admin
3. Click "Remove"
4. Confirm
5. Admin account deleted (logged)

---

## STATUS

**Admin Dashboard & RBAC System:** ✅ **READY FOR IMPLEMENTATION**

**Timeline:** Phase 8 (September 2026)  
**Owner Account:** Protected and immutable  
**Access:** Only Jim Burlew (Owner) + designated Admins

**Next Steps:**
1. Review this design document
2. Approve RBAC hierarchy
3. Confirm Owner account settings
4. Begin Phase 8 implementation
5. Deploy post-launch (late September)

---

*Created: August 15, 2026*  
*Ready for Jim's review and approval*  
*Implementation: Phase 8 (September 2026)*

