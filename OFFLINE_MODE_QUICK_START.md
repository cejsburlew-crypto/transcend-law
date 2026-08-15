# Offline Mode - Quick Start Guide

Get offline mode running in 5 minutes.

## Step 1: Update index.html

Add PWA meta tags to `/transcend-frontend/public/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Professional services platform" />
    <meta name="theme-color" content="#667eea" />
    
    <!-- PWA Meta Tags -->
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Transcend" />
    
    <link rel="manifest" href="/manifest.json" />
    <link rel="icon" href="/favicon.ico" />
    <link rel="apple-touch-icon" href="/icon-192x192.png" />
    
    <title>Transcend Law</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

## Step 2: Wrap App with OfflineProvider

Update `/transcend-frontend/src/App.tsx`:

```typescript
import { OfflineProvider } from './context/OfflineContext';
import { OfflineIndicator } from './components/OfflineIndicator';

function App() {
  return (
    <OfflineProvider enablePWA={true} enableAutoSync={true}>
      <OfflineIndicator position="top" />
      {/* Your existing app content */}
    </OfflineProvider>
  );
}

export default App;
```

## Step 3: Use Offline Hook in Components

```typescript
import { useOffline } from '../context/OfflineContext';

function MyComponent() {
  const { isOnline, queueOperation, syncNow } = useOffline();

  // Use isOnline to conditionally handle offline scenarios
  if (!isOnline) {
    // Show offline UI
  }

  return <div>{/* Your component */}</div>;
}
```

## Step 4: Add Sync Endpoint to Backend

Create `/api/sync/{entityType}/{entityId}` endpoint:

```javascript
// Express example
app.post('/api/sync/:entityType/:entityId', authenticateToken, (req, res) => {
  const { type, data, clientTimestamp } = req.body;
  const { entityType, entityId } = req.params;

  // 1. Fetch current server version
  const serverData = getEntity(entityType, entityId);

  // 2. Check for conflicts
  if (serverData && serverData.updatedAt > clientTimestamp) {
    return res.status(409).json({
      serverData,
      version: serverData.version,
      lastModified: serverData.updatedAt
    });
  }

  // 3. Update entity
  const updated = updateEntity(entityType, entityId, data);

  res.json({ success: true, version: updated.version });
});
```

## Step 5: Test It!

### Test in Browser DevTools

1. Open Chrome DevTools → Network tab
2. Check "Offline" checkbox
3. Try using the app
4. Verify pending operations show in UI
5. Uncheck "Offline" 
6. Watch auto-sync happen

### Verify Service Worker

1. DevTools → Application → Service Workers
2. Should show "Registered and running"
3. Check Cache Storage for cached assets

### Check IndexedDB

1. DevTools → Application → IndexedDB
2. Should see "TranscendOfflineDB"
3. Inspect "cache" and "operations" stores

## Common Patterns

### Cache Data

```typescript
const { setCacheData, getCacheData } = useOffline();

// Cache provider data for 1 hour
await setCacheData('providers', data, 3600000);

// Retrieve later
const cached = await getCacheData('providers');
```

### Queue Operations

```typescript
const { queueOperation, isOnline } = useOffline();

const handleSubmit = async (formData) => {
  if (isOnline) {
    // Send immediately
    await api.submit(formData);
  } else {
    // Queue for later
    await queueOperation({
      type: 'create',
      entityType: 'intake',
      entityId: `intake-${Date.now()}`,
      data: formData
    });
  }
};
```

### Manual Sync

```typescript
const { syncNow, isSyncing } = useOffline();

const handleSync = async () => {
  const result = await syncNow();
  console.log(`Synced: ${result.successful} successful`);
};

return (
  <button onClick={handleSync} disabled={isSyncing}>
    {isSyncing ? 'Syncing...' : 'Manual Sync'}
  </button>
);
```

### Conflict Resolution

```typescript
window.addEventListener('offline-conflict', async (event) => {
  const { operationId, response } = event.detail;
  
  // Show conflict UI
  const choice = await showConflictDialog(response.serverData);
  
  // Resolve
  if (choice === 'keep-mine') {
    await resolveConflict(operationId, 'client-wins');
  } else {
    await resolveConflict(operationId, 'server-wins');
  }
});
```

## Environment Variables

Add to `.env`:

```
VITE_API_URL=https://transcend-law.com/api
VITE_ENABLE_PWA=true
VITE_ENABLE_AUTO_SYNC=true
VITE_SYNC_INTERVAL=30000
```

Use in code:

```typescript
const apiUrl = import.meta.env.VITE_API_URL || 'https://transcend-law.com/api';
```

## Debugging

### Enable Debug Logging

```javascript
// In console
localStorage.setItem('DEBUG', 'transcend:*');
// Refresh page
```

### Monitor Sync Service

```javascript
import { getSyncService } from '@/services/syncService';

const syncService = getSyncService();
console.log(syncService.getMetrics());
```

### Check Cache Stats

```javascript
import { useOfflineStorage } from '@/hooks/useOfflineStorage';

const { cacheStats } = useOfflineStorage();
console.log(cacheStats); // { size, entries }
```

### Clear All Offline Data

```javascript
// In DevTools console
indexedDB.deleteDatabase('TranscendOfflineDB');
// Or use context
await clearAllData();
```

## Troubleshooting

### Service Worker Not Installing

```bash
# Check manifest.json is valid
# Check HTTPS (or localhost)
# Clear browser cache
# Check /public/sw.js exists
```

### Sync Not Working

```javascript
// Check API endpoint
fetch('/api/sync/test', { 
  headers: { 'Authorization': `Bearer ${token}` } 
})

// Check token is valid
console.log(localStorage.getItem('token'))

// Check network
navigator.onLine
```

### IndexedDB Not Saving

```javascript
// Check available storage
navigator.storage.estimate()

// Check permissions
navigator.permissions.query({ name: 'storage' })

// Request persistent storage
navigator.storage.persist()
```

## Performance Tips

1. **Use appropriate cache TTLs**
   - Critical data: 1 hour (3600000 ms)
   - User profile: 24 hours (86400000 ms)
   - Lists: 30 minutes (1800000 ms)

2. **Batch operations**
   - Queue 5-10 operations before syncing
   - Reduces API calls

3. **Prioritize assets**
   - Cache app shell first
   - Lazy load less critical assets

4. **Monitor storage**
   - Clear old caches regularly
   - Set TTL on cached data

## Production Checklist

- [ ] Add PWA manifest.json
- [ ] Generate app icons (192x192, 512x512)
- [ ] Enable HTTPS
- [ ] Deploy service worker
- [ ] Set up sync endpoints
- [ ] Test offline flow
- [ ] Monitor sync metrics
- [ ] Set up error tracking
- [ ] Document for users
- [ ] Train support team

## Next Steps

1. Read full docs: `OFFLINE_MODE_IMPLEMENTATION.md`
2. Check examples: `OFFLINE_MODE_INTEGRATION_EXAMPLES.md`
3. Review architecture: `OFFLINE_MODE_SUMMARY.md`
4. Deploy and test
5. Monitor metrics
6. Iterate based on usage

## API Quick Reference

### useOfflineStorage Hook

```typescript
const {
  isOnline,                    // boolean
  isSyncing,                   // boolean
  pendingOperations,           // StoredOperation[]
  cacheStats,                  // { size, entries }
  setCacheData,                // <T>(key, data, ttl?) => Promise<void>
  getCacheData,                // <T>(key) => Promise<T | null>
  queueOperation,              // (op) => Promise<string>
  syncPendingOperations,       // () => Promise<{ successful, failed, conflicts }>
  resolveConflict              // (id, resolution, data?) => Promise<void>
} = useOfflineStorage();
```

### useOffline Context Hook

```typescript
const {
  isOnline,
  isSyncing,
  pendingOperations,
  cacheStats,
  setCacheData,
  getCacheData,
  queueOperation,
  cancelOperation,
  syncNow,
  resolveConflict
} = useOffline();
```

## Support

For issues:
1. Check browser console (F12)
2. Review DevTools Application tab
3. Check IndexedDB in Storage
4. Enable debug logging
5. Check backend logs
6. Review documentation

## Getting Help

- Full implementation guide: `OFFLINE_MODE_IMPLEMENTATION.md`
- Integration examples: `OFFLINE_MODE_INTEGRATION_EXAMPLES.md`
- Architecture overview: `OFFLINE_MODE_SUMMARY.md`
- Browser DevTools: Press F12
- MDN Docs: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
