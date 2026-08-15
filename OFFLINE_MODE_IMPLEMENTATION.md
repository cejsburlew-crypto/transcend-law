# Offline Mode Implementation Guide

## Overview

This guide documents the complete offline mode support system for the Transcend Law platform. The implementation provides:

- **IndexedDB-based caching** for local data storage
- **Connection detection** with automatic reconnection handling
- **Operation queuing** for offline actions
- **Auto-sync** when connection restored
- **Conflict resolution** strategies
- **PWA support** with service workers
- **Offline-first UI** indicators

## Architecture

### Core Components

```
transcend-frontend/src/
├── hooks/
│   └── useOfflineStorage.ts          # IndexedDB storage management
├── services/
│   ├── syncService.ts                # Sync operations & conflict resolution
│   └── pwaService.ts                 # PWA & service worker management
├── components/
│   └── OfflineIndicator.tsx          # UI indicator for offline status
├── context/
│   └── OfflineContext.tsx            # Context provider for offline features
├── styles/
│   └── OfflineIndicator.css          # Styling for offline UI
└── public/
    ├── sw.js                         # Service worker
    ├── manifest.json                 # PWA manifest
    └── index.html                    # Add PWA meta tags
```

## Implementation Details

### 1. useOfflineStorage Hook

The `useOfflineStorage` hook provides IndexedDB-based storage with automatic sync capabilities.

#### Features:
- Local data caching with TTL support
- Operation queue management
- Automatic sync on connection restore
- Cache statistics

#### Usage:

```typescript
import { useOfflineStorage } from '@/hooks/useOfflineStorage';

function MyComponent() {
  const {
    isOnline,
    isSyncing,
    pendingOperations,
    setCacheData,
    getCacheData,
    queueOperation,
    syncPendingOperations,
    resolveConflict
  } = useOfflineStorage();

  // Cache data with 1 hour TTL
  const handleCacheData = async () => {
    await setCacheData('user-profile', userData, 3600000);
  };

  // Queue offline operation
  const handleQueueOperation = async () => {
    const opId = await queueOperation({
      type: 'update',
      entityType: 'user',
      entityId: '123',
      data: { name: 'John' }
    });
  };

  // Manual sync
  const handleSync = async () => {
    const result = await syncPendingOperations();
    console.log(`Synced: ${result.successful} successful, ${result.failed} failed`);
  };

  return (
    <div>
      <p>Online: {isOnline ? 'Yes' : 'No'}</p>
      <p>Syncing: {isSyncing ? 'Yes' : 'No'}</p>
      <p>Pending: {pendingOperations.length}</p>
    </div>
  );
}
```

### 2. Sync Service

The `syncService` provides advanced sync capabilities with conflict resolution.

#### Features:
- Retry logic with exponential backoff
- Batch sync operations
- Conflict detection and resolution
- Sync metrics and reporting

#### Usage:

```typescript
import { initializeSyncService, getSyncService } from '@/services/syncService';

// Initialize at app startup
const syncManager = initializeSyncService({
  maxRetries: 3,
  retryDelay: 1000,
  conflictResolutionStrategy: 'client-wins',
  batchSize: 10
});

// Register custom conflict handler
syncManager.registerConflictHandler('document', async (conflict) => {
  // Custom conflict resolution logic
  if (conflict.clientTimestamp > conflict.serverTimestamp) {
    return 'client'; // Client version is newer
  }
  return 'server';
});

// Perform full sync
const syncService = getSyncService();
const { results, summary } = await syncService.performFullSync(
  pendingOperations,
  authToken,
  (current, total) => console.log(`Syncing ${current}/${total}`)
);
```

### 3. PWA Service

The `pwaService` handles PWA setup and service worker management.

#### Features:
- Service worker registration
- App installation prompts
- Asset caching and prefetching
- Update checking

#### Usage:

```typescript
import { initializePWA, getPWAManager } from '@/services/pwaService';

// Initialize PWA
const pwaManager = initializePWA({
  enabled: true,
  swPath: '/sw.js',
  onUpdate: () => console.log('App updated!'),
  onError: (error) => console.error('PWA error:', error)
});

// Cache critical resources
await pwaManager.cacheAssets([
  '/',
  '/dashboard',
  '/services'
]);

// Prefetch resources
await pwaManager.prefetchResources([
  '/api/professionals',
  '/api/services'
]);

// Check for updates
const hasUpdate = await pwaManager.checkForUpdate();
```

### 4. Offline Context Provider

Wrap your app with the `OfflineProvider` to enable offline features globally.

#### Setup in App.tsx:

```typescript
import { OfflineProvider } from '@/context/OfflineContext';

function App() {
  return (
    <OfflineProvider enablePWA={true} enableAutoSync={true}>
      {/* Your app components */}
    </OfflineProvider>
  );
}
```

#### Using in components:

```typescript
import { useOffline } from '@/context/OfflineContext';

function Dashboard() {
  const { isOnline, pendingOperations, queueOperation } = useOffline();

  return (
    <div>
      <OfflineIndicator />
      {!isOnline && <p>Working offline - {pendingOperations.length} changes pending</p>}
    </div>
  );
}
```

### 5. Offline Indicator Component

Visual indicator for offline status and sync progress.

#### Features:
- Shows offline/online status
- Displays pending operations count
- Sync progress indicator
- Auto-hide when online

#### Usage:

```typescript
import { OfflineIndicator } from '@/components/OfflineIndicator';

function App() {
  return (
    <>
      <OfflineIndicator 
        position="top" 
        autoHide={true} 
        autoHideDelay={5000} 
      />
      {/* Rest of app */}
    </>
  );
}
```

## Database Schema

### IndexedDB Structure

```
TranscendOfflineDB
├── cache
│   ├── key (String, Primary Key)
│   ├── data (Any)
│   ├── timestamp (Number)
│   └── ttl (Number, Optional)
│
├── operations
│   ├── id (Number, Primary Key, Auto-increment)
│   ├── type (String: 'create' | 'update' | 'delete')
│   ├── entityType (String, Index)
│   ├── entityId (String)
│   ├── data (Object)
│   ├── timestamp (Number, Index)
│   ├── synced (Boolean, Index)
│   ├── syncAttempts (Number)
│   └── conflictResolution (String, Optional)
│
└── metadata
    ├── key (String, Primary Key)
    ├── value (Any)
    └── timestamp (Number)
```

## Service Worker Strategies

The service worker implements multiple caching strategies:

### Strategy Selection:

1. **API Requests** - Network First
   - Try network first, fallback to cached data
   - Caches successful responses

2. **Images** - Cache First
   - Return cached images immediately
   - Update cache in background

3. **HTML** - Network First
   - Always try fresh HTML
   - Fallback to cached version

4. **CSS/JS** - Cache First
   - Serve from cache for performance
   - Assets should use versioning

### Cache Management:

```javascript
// Message from client to service worker
navigator.serviceWorker.controller.postMessage({
  type: 'CACHE_URLS',
  payload: {
    urls: ['/api/data', '/images/icon.png']
  }
});

// Clear caches
navigator.serviceWorker.controller.postMessage({
  type: 'CLEAR_CACHES'
});

// Get cache size
navigator.serviceWorker.controller.postMessage({
  type: 'GET_CACHE_SIZE'
});
```

## Conflict Resolution

### Resolution Strategies:

1. **Client Wins** (Default)
   - Client data takes precedence
   - Used for user-generated content

2. **Server Wins**
   - Server data takes precedence
   - Used for read-only data

3. **Manual**
   - Merge client and server data
   - Custom resolution logic

### Handling Conflicts:

```typescript
// Automatic conflict resolution
const conflict = await offlineStorage.resolveConflict(
  operationId,
  'client-wins'
);

// Manual conflict resolution
const conflict = await offlineStorage.resolveConflict(
  operationId,
  'manual',
  mergedData // Custom merged data
);

// Listen for conflicts
window.addEventListener('offline-conflict', (event) => {
  const { operationId, response } = event.detail;
  // Handle conflict UI
});
```

## API Integration

### Sync Endpoint

The backend should provide a sync endpoint:

```
POST /api/sync/{entityType}/{entityId}

Headers:
  Authorization: Bearer {token}
  X-Client-Timestamp: {timestamp}
  X-Conflict-Resolution: {strategy}

Body:
{
  type: 'create' | 'update' | 'delete',
  data: { ... },
  clientTimestamp: 123456789
}

Responses:
  200 OK - Operation synced successfully
  409 Conflict - Server version differs
    { serverData, version, lastModified }
  500+ - Retryable error
  4xx - Permanent error (except 409)
```

### Batch Sync Endpoint

```
POST /api/sync/batch

Headers:
  Authorization: Bearer {token}

Body:
{
  operations: [
    { type, entityType, entityId, data, clientTimestamp },
    ...
  ]
}

Response:
[
  { operationId, status, error? },
  ...
]
```

## HTML Setup

### Add PWA Meta Tags to index.html:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="Professional services platform" />
  <meta name="theme-color" content="#667eea" />
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
  
  <!-- Register Service Worker -->
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then(registration => console.log('SW registered:', registration))
          .catch(error => console.error('SW registration failed:', error));
      });
    }
  </script>
</body>
</html>
```

## Testing

### Testing Offline Functionality

```typescript
// Simulate offline
window.dispatchEvent(new Event('offline'));

// Simulate online
window.dispatchEvent(new Event('online'));

// Test with DevTools
// Chrome DevTools > Network > Throttling > Offline
// Or use Service Worker offline mode
```

### Testing Sync

```typescript
// Queue an operation
const opId = await offlineStorage.queueOperation({
  type: 'update',
  entityType: 'user',
  entityId: '123',
  data: { name: 'Test' }
});

// Go offline
window.dispatchEvent(new Event('offline'));

// Check pending operations
console.log(pendingOperations); // Should show 1

// Go online
window.dispatchEvent(new Event('online'));

// Auto-sync should trigger after 30 seconds
```

## Performance Considerations

1. **IndexedDB Size Limits**
   - Typical: 50MB per app
   - Can request more with persistent storage

2. **Cache Strategies**
   - Static assets: Cache first (use versioning)
   - API data: Network first (timeout 3-5 seconds)
   - Images: Cache first

3. **Batch Operations**
   - Limit batch size to 10-20 operations
   - Use exponential backoff for retries
   - Implement request deduplication

## Security Considerations

1. **Token Management**
   - Tokens stored in sessionStorage (not localStorage)
   - Automatically cleared on logout
   - Refreshed before sync operations

2. **Data Encryption**
   - Sensitive data encrypted before caching
   - Use TweetNaCl.js or similar for encryption
   - Implement key rotation

3. **CORS & CSP**
   - Service worker respects CORS
   - Content Security Policy allows service worker

## Monitoring & Logging

### Enable Debug Logging

```typescript
// In development
if (process.env.NODE_ENV === 'development') {
  localStorage.setItem('DEBUG', 'transcend:*');
}
```

### Monitor Sync Metrics

```typescript
const syncService = getSyncService();
const metrics = syncService.getMetrics();

console.log({
  totalOps: metrics.totalOperations,
  successful: metrics.successfulSyncs,
  failed: metrics.failedSyncs,
  conflicts: metrics.conflicts,
  duration: metrics.syncDuration
});
```

## Troubleshooting

### Service Worker Not Installing

1. Check manifest.json is valid
2. Ensure HTTPS (or localhost for dev)
3. Check browser console for errors
4. Verify sw.js path is correct

### Sync Operations Not Working

1. Check network connectivity
2. Verify API endpoint is correct
3. Check authorization token
4. Look for 409 conflicts

### IndexedDB Not Persisting

1. Check browser storage quota
2. Verify database operations complete
3. Check for transaction errors
4. Review browser console

## Browser Support

- **Modern Desktop**: Chrome, Firefox, Safari, Edge (Full support)
- **Mobile**: iOS Safari 11.3+, Chrome Android (Full support)
- **Legacy**: IE 11 (No support, graceful degradation)

## Performance Metrics

Typical performance targets:

- Offline cache miss: <50ms
- Sync operation: <500ms
- Full sync (10 ops): <2s
- Service worker install: <100ms
- Cache retrieval: <30ms

## Future Enhancements

1. **Advanced Conflict Resolution**
   - Three-way merge for complex documents
   - Custom merge strategies per entity type

2. **Selective Sync**
   - Sync only specific entity types
   - Priority-based sync ordering

3. **Encryption**
   - End-to-end encryption for sensitive data
   - Encrypted cache storage

4. **Analytics**
   - Track offline usage patterns
   - Monitor sync success rates
   - Performance metrics

5. **Background Sync**
   - Leverage Background Sync API
   - Periodic sync for background updates

## References

- [MDN: IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [MDN: Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [PWA Checklist](https://web.dev/pwa-checklist/)
- [Offline Cookbook](https://jakearchibald.com/2014/offline-cookbook/)

## Support

For issues or questions about offline mode implementation:
1. Check the troubleshooting section above
2. Review browser console and DevTools
3. Check service worker status in DevTools
4. Verify IndexedDB data in DevTools Storage tab
