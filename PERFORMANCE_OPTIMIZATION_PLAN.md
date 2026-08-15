# ⚡ Performance Optimization Plan

**Goal:** API response time < 200ms (p95), Frontend bundle < 500KB, Database queries < 50ms  
**Timeline:** Days 4-5 of Week 3  
**Status:** Starting  

---

## 📊 BASELINE METRICS

### Current Performance Targets
| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| API latency (p95) | < 200ms | TBD | 📊 |
| Database query | < 50ms | TBD | 📊 |
| Frontend bundle | < 500KB | TBD | 📊 |
| Message latency | < 100ms | TBD | 📊 |
| Page load | < 2s | TBD | 📊 |
| 1000 concurrent users | Success | TBD | 📊 |

---

## 🚀 DATABASE OPTIMIZATION

### 1. Query Analysis & Optimization

#### Current Indexes
```sql
-- Users table
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_user_type ON users(user_type);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- Cases table
CREATE INDEX idx_cases_user_id ON cases(user_id);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_created_at ON cases(created_at DESC);
CREATE INDEX idx_cases_service_type ON cases(service_type);

-- Messages table
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- Documents table
CREATE INDEX idx_documents_case_id ON documents(case_id);
CREATE INDEX idx_documents_user_id ON documents(user_id);
```

#### Missing Indexes (To Add)
```sql
-- Add composite indexes for common queries
CREATE INDEX idx_cases_user_status ON cases(user_id, status);
CREATE INDEX idx_messages_conversation_read ON messages(conversation_id, read_at);
CREATE INDEX idx_audit_logs_user_action ON audit_logs(user_id, action, created_at DESC);
CREATE INDEX idx_failed_logins_user_time ON failed_logins(user_id, created_at DESC);
CREATE INDEX idx_subscriptions_user_active ON subscriptions(user_id, active) WHERE active = true;
```

### 2. Query Optimization Examples

#### Before (Slow Query)
```typescript
// Gets all cases with all details - N+1 problem
const cases = await query(`
  SELECT * FROM cases WHERE user_id = $1
`);

// Then for each case, fetch firms
for (const caseItem of cases.rows) {
  const firms = await query(`
    SELECT * FROM law_firms WHERE id IN (SELECT firm_id FROM case_offers WHERE case_id = $1)
  `, [caseItem.id]);
  caseItem.firms = firms.rows;
}
```

#### After (Optimized Query)
```typescript
// Single query with JOIN - avoids N+1
const cases = await query(`
  SELECT 
    c.id, c.title, c.status, c.budget,
    json_agg(json_build_object(
      'id', f.id, 'name', f.name, 'rating', f.rating
    )) as firms
  FROM cases c
  LEFT JOIN case_offers co ON c.id = co.case_id
  LEFT JOIN law_firms f ON co.firm_id = f.id
  WHERE c.user_id = $1
  GROUP BY c.id
  LIMIT 20
`);
```

### 3. Connection Pooling

#### Current Config (Connection Pool)
```typescript
// Already optimized in transcend-api/src/database/connection.ts
const pool = new Pool({
  max: 20,           // Max concurrent connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

#### Monitoring Pool Health
```typescript
pool.on('error', (err, client) => {
  console.error('Pool error:', err);
});

pool.on('connect', () => {
  console.log('New connection established');
});

// Log pool stats
setInterval(() => {
  console.log(`Pool - Total: ${pool.totalCount}, Idle: ${pool.idleCount}, Waiting: ${pool.waitingCount}`);
}, 60000);
```

### 4. Query Caching Strategy

```typescript
// Query result caching with TTL
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 300 }); // 5 minute default

async function getCaseWithCache(caseId: string) {
  const cacheKey = `case:${caseId}`;
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Query database
  const result = await query('SELECT * FROM cases WHERE id = $1', [caseId]);
  
  // Cache result
  if (result.rows.length > 0) {
    cache.set(cacheKey, result.rows[0]);
  }

  return result.rows[0];
}

// Invalidate cache on update
async function updateCase(caseId: string, data: any) {
  // Update database
  const result = await query('UPDATE cases SET ... WHERE id = $1', [...]);
  
  // Invalidate cache
  cache.del(`case:${caseId}`);
  
  return result;
}
```

### 5. Batch Operations

```typescript
// Before: Individual inserts (slow)
for (const message of messages) {
  await query(
    'INSERT INTO messages (conversation_id, sender_id, content) VALUES ($1, $2, $3)',
    [message.conversationId, message.senderId, message.content]
  );
}

// After: Batch insert (fast)
const values = messages.flatMap((m, i) => [
  m.conversationId,
  m.senderId,
  m.content,
]);

const placeholders = messages
  .map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`)
  .join(',');

await query(
  `INSERT INTO messages (conversation_id, sender_id, content) VALUES ${placeholders}`,
  values
);
```

---

## 🌐 API OPTIMIZATION

### 1. Response Compression

```typescript
import compression from 'compression';

// Compress responses > 1KB
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6, // Balance between compression and CPU
}));
```

### 2. JSON Response Optimization

```typescript
// Only return needed fields
const optimizedResponse = {
  // Before: 500 bytes
  // {id, email, password_hash, created_at, updated_at, deleted_at, ...}
  
  // After: 150 bytes
  id: user.id,
  email: user.email,
  name: user.name,
  userType: user.user_type,
};
```

### 3. Pagination

```typescript
// Always paginate large result sets
router.get('/cases', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = (page - 1) * limit;

  const result = await query(
    'SELECT * FROM cases LIMIT $1 OFFSET $2',
    [limit, offset]
  );

  res.json({
    data: result.rows,
    page,
    limit,
    total: result.rowCount, // Get from separate count query
  });
});
```

### 4. Caching Headers

```typescript
// Set appropriate caching headers
router.get('/public-data', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600'); // 1 hour
  res.json(data);
});

router.get('/user-data', authenticate, (req, res) => {
  res.set('Cache-Control', 'private, max-age=300'); // 5 minutes
  res.json(data);
});

router.get('/frequently-changing', (req, res) => {
  res.set('Cache-Control', 'no-cache'); // Validate on each request
  res.json(data);
});
```

### 5. Request Timeouts

```typescript
// Set request timeouts to prevent hanging
app.use((req, res, next) => {
  req.setTimeout(30000); // 30 second timeout
  res.setTimeout(30000);
  next();
});
```

---

## 🎯 FRONTEND OPTIMIZATION

### 1. Code Splitting

```typescript
// Before: Single large bundle (~1.2MB)
import Dashboard from './pages/Dashboard';
import Services from './pages/Services';
import Messages from './pages/Messages';

// After: Code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Services = lazy(() => import('./pages/Services'));
const Messages = lazy(() => import('./pages/Messages'));

// Lazy load routes
<Suspense fallback={<Loading />}>
  <Routes>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/services" element={<Services />} />
    <Route path="/messages" element={<Messages />} />
  </Routes>
</Suspense>
```

### 2. Bundle Analysis

```bash
# Install analyzer
npm install --save-dev vite-plugin-visualizer

# Build and analyze
npm run build -- --profile

# Check bundle size
npm run analyze
```

### 3. Image Optimization

```typescript
// Use responsive images
<img 
  srcSet="
    /images/case-100w.jpg 100w,
    /images/case-300w.jpg 300w,
    /images/case-600w.jpg 600w
  "
  sizes="(max-width: 600px) 100px, 300px"
  src="/images/case-300w.jpg"
  alt="Case"
/>

// Use WebP with fallback
<picture>
  <source type="image/webp" srcSet="/images/case.webp" />
  <img src="/images/case.jpg" alt="Case" />
</picture>
```

### 4. Minification & Optimization

```typescript
// Vite config already handles:
// ✅ Code minification
// ✅ Tree shaking
// ✅ Module federation
// ✅ CSS optimization
// ✅ Image optimization

// Ensure in vite.config.ts:
export default defineConfig({
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
      },
    },
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
```

### 5. Lazy Loading Components

```typescript
// Defer non-critical components
const Analytics = lazy(() => import('./components/Analytics'));
const NotificationCenter = lazy(() => import('./components/NotificationCenter'));

export function Dashboard() {
  return (
    <div>
      <Header /> {/* Critical */}
      <MainContent /> {/* Critical */}
      
      <Suspense fallback={null}>
        <Analytics /> {/* Lazy loaded */}
        <NotificationCenter /> {/* Lazy loaded */}
      </Suspense>
    </div>
  );
}
```

---

## 🔄 CACHING STRATEGY

### 1. CDN Caching (CloudFront)

```typescript
// Static assets - long cache
Cache-Control: public, max-age=31536000, immutable

// HTML - no cache (always fresh)
Cache-Control: no-cache, no-store, must-revalidate

// API responses - short cache with validation
Cache-Control: private, max-age=300, must-revalidate
```

### 2. Browser Caching

```typescript
// Service Worker for offline support
// cache-first for assets
// network-first for API calls
// stale-while-revalidate for data
```

### 3. Redis Caching (Optional)

```typescript
import redis from 'redis';

const client = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
});

// Cache expensive queries
async function getCaseMetrics(userId: string) {
  const key = `metrics:${userId}`;
  
  // Try cache first
  const cached = await client.get(key);
  if (cached) return JSON.parse(cached);
  
  // Fetch if not cached
  const metrics = await calculateMetrics(userId);
  
  // Store in cache for 5 minutes
  await client.setex(key, 300, JSON.stringify(metrics));
  
  return metrics;
}
```

---

## 🧪 PERFORMANCE MONITORING

### 1. Application Performance Monitoring (Sentry)

```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1, // 10% of requests
  environment: process.env.NODE_ENV,
});

// Automatic performance monitoring
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

### 2. Custom Performance Metrics

```typescript
// Track API response times
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Log slow requests
    if (duration > 200) {
      console.warn(`Slow request: ${req.method} ${req.path} - ${duration}ms`);
    }
    
    // Send to monitoring service
    Sentry.captureMessage(`${req.method} ${req.path}`, 'info', {
      tags: { duration },
    });
  });
  
  next();
});
```

### 3. Database Query Monitoring

```typescript
// Log slow queries (from database/connection.ts)
const slowQueryThreshold = 100; // 100ms

query: async (text, values) => {
  const start = Date.now();
  const result = await pool.query(text, values);
  const duration = Date.now() - start;
  
  if (duration > slowQueryThreshold) {
    console.warn(`Slow query (${duration}ms): ${text.substring(0, 100)}...`);
    
    // Log to monitoring
    Sentry.captureMessage('Slow database query', 'warning', {
      tags: { duration },
    });
  }
  
  return result;
}
```

---

## ✅ OPTIMIZATION CHECKLIST

### Database
- [x] Indexes created
- [ ] Query optimization (N+1 fixes)
- [ ] Connection pool tuned
- [ ] Slow query logging enabled
- [ ] Query caching implemented
- [ ] Batch operations implemented
- [ ] Database statistics updated

### API
- [ ] Response compression enabled
- [ ] JSON responses optimized
- [ ] Pagination implemented
- [ ] Cache headers set
- [ ] Request timeouts configured
- [ ] Rate limiting verified
- [ ] Error responses compact

### Frontend
- [ ] Code splitting enabled
- [ ] Bundle analyzed
- [ ] Images optimized
- [ ] Minification verified
- [ ] Lazy loading components
- [ ] Critical CSS identified
- [ ] Font optimization done

### Infrastructure
- [ ] CDN configured
- [ ] Browser caching headers
- [ ] Gzip compression enabled
- [ ] Connection pooling tuned
- [ ] Monitoring set up
- [ ] Alerting configured
- [ ] Performance baselines recorded

---

## 🎯 SUCCESS METRICS

| Metric | Target | Verification |
|--------|--------|--------------|
| API latency (p95) | < 200ms | Load test report |
| Database query | < 50ms | Query logs |
| Frontend bundle | < 500KB | `npm run analyze` |
| Page load time | < 2s | Lighthouse |
| 1000 concurrent users | Success | k6 load test |
| Error rate | < 0.1% | Monitoring |
| Cache hit rate | > 70% | CDN stats |
| Message latency | < 100ms | Socket monitoring |

---

## 🚀 DEPLOYMENT

### Pre-Production Checklist
- [ ] All optimizations tested
- [ ] Monitoring enabled
- [ ] Baselines recorded
- [ ] Team trained
- [ ] Rollback plan ready

### Production Deployment
- [ ] Blue-green deployment
- [ ] Monitoring dashboard open
- [ ] On-call team ready
- [ ] Communication channels open

---

**Status:** Ready to implement  
**Timeline:** Days 4-5 of Week 3  
**Success Criteria:** 90%+ of metrics meet targets
