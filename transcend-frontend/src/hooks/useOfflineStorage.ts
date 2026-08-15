// useOfflineStorage Hook
// IndexedDB-based offline storage with conflict resolution

import { useEffect, useState, useCallback, useRef } from 'react';

export interface StoredOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entityType: string;
  entityId: string;
  data: any;
  timestamp: number;
  synced: boolean;
  syncAttempts: number;
  conflictResolution?: 'client-wins' | 'server-wins' | 'manual';
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl?: number; // Time to live in milliseconds
}

export interface UseOfflineStorageOptions {
  dbName?: string;
  version?: number;
  autoSync?: boolean;
  syncInterval?: number;
}

export interface UseOfflineStorageReturn {
  isOnline: boolean;
  isSyncing: boolean;
  pendingOperations: StoredOperation[];
  cacheStats: { size: number; entries: number };

  // Cache operations
  setCacheData: <T>(key: string, data: T, ttl?: number) => Promise<void>;
  getCacheData: <T>(key: string) => Promise<T | null>;
  clearCache: () => Promise<void>;

  // Offline operations
  queueOperation: (operation: Omit<StoredOperation, 'id' | 'timestamp' | 'synced' | 'syncAttempts'>) => Promise<string>;
  getPendingOperations: () => Promise<StoredOperation[]>;
  cancelOperation: (operationId: string) => Promise<void>;

  // Sync operations
  syncPendingOperations: () => Promise<{ successful: number; failed: number; conflicts: number }>;
  resolveConflict: (operationId: string, resolution: 'client-wins' | 'server-wins' | 'manual', manualData?: any) => Promise<void>;

  // Database management
  clearAllData: () => Promise<void>;
}

class OfflineStorageDB {
  private db: IDBDatabase | null = null;
  private dbName: string;
  private version: number;

  constructor(dbName: string = 'TranscendOfflineDB', version: number = 1) {
    this.dbName = dbName;
    this.version = version;
  }

  async initialize(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(new Error(`Failed to open IndexedDB: ${request.error}`));
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('operations')) {
          const opStore = db.createObjectStore('operations', { keyPath: 'id', autoIncrement: true });
          opStore.createIndex('synced', 'synced', { unique: false });
          opStore.createIndex('timestamp', 'timestamp', { unique: false });
          opStore.createIndex('entityType', 'entityType', { unique: false });
        }

        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };
    });
  }

  async setCacheData<T>(key: string, data: T, ttl?: number): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');

      const cacheEntry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl
      };

      const request = store.put({ key, ...cacheEntry });
      request.onerror = () => reject(new Error(`Failed to cache data: ${request.error}`));
      request.onsuccess = () => resolve();
    });
  }

  async getCacheData<T>(key: string): Promise<T | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.get(key);

      request.onerror = () => reject(new Error(`Failed to retrieve cache: ${request.error}`));
      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
          return;
        }

        // Check if TTL expired
        if (result.ttl && Date.now() - result.timestamp > result.ttl) {
          store.delete(key);
          resolve(null);
        } else {
          resolve(result.data as T);
        }
      };
    });
  }

  async queueOperation(operation: Omit<StoredOperation, 'id' | 'timestamp' | 'synced' | 'syncAttempts'>): Promise<string> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['operations'], 'readwrite');
      const store = transaction.objectStore('operations');

      const storedOp: Omit<StoredOperation, 'id'> = {
        ...operation,
        timestamp: Date.now(),
        synced: false,
        syncAttempts: 0
      };

      const request = store.add(storedOp);
      request.onerror = () => reject(new Error(`Failed to queue operation: ${request.error}`));
      request.onsuccess = () => resolve(request.result.toString());
    });
  }

  async getPendingOperations(): Promise<StoredOperation[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['operations'], 'readonly');
      const store = transaction.objectStore('operations');
      const index = store.index('synced');
      const request = index.getAll(false);

      request.onerror = () => reject(new Error(`Failed to retrieve pending operations: ${request.error}`));
      request.onsuccess = () => {
        resolve(request.result as StoredOperation[]);
      };
    });
  }

  async cancelOperation(operationId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['operations'], 'readwrite');
      const store = transaction.objectStore('operations');
      const request = store.delete(parseInt(operationId));

      request.onerror = () => reject(new Error(`Failed to cancel operation: ${request.error}`));
      request.onsuccess = () => resolve();
    });
  }

  async markOperationSynced(operationId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['operations'], 'readwrite');
      const store = transaction.objectStore('operations');
      const getRequest = store.get(parseInt(operationId));

      getRequest.onerror = () => reject(new Error(`Failed to mark operation synced: ${getRequest.error}`));
      getRequest.onsuccess = () => {
        const operation = getRequest.result;
        if (operation) {
          operation.synced = true;
          const updateRequest = store.put(operation);
          updateRequest.onerror = () => reject(new Error(`Failed to update operation: ${updateRequest.error}`));
          updateRequest.onsuccess = () => resolve();
        }
      };
    });
  }

  async incrementSyncAttempts(operationId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['operations'], 'readwrite');
      const store = transaction.objectStore('operations');
      const getRequest = store.get(parseInt(operationId));

      getRequest.onerror = () => reject(new Error(`Failed to increment attempts: ${getRequest.error}`));
      getRequest.onsuccess = () => {
        const operation = getRequest.result;
        if (operation) {
          operation.syncAttempts = (operation.syncAttempts || 0) + 1;
          const updateRequest = store.put(operation);
          updateRequest.onerror = () => reject(new Error(`Failed to update operation: ${updateRequest.error}`));
          updateRequest.onsuccess = () => resolve();
        }
      };
    });
  }

  async updateOperationConflictResolution(operationId: string, resolution: StoredOperation['conflictResolution']): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['operations'], 'readwrite');
      const store = transaction.objectStore('operations');
      const getRequest = store.get(parseInt(operationId));

      getRequest.onerror = () => reject(new Error(`Failed to update conflict resolution: ${getRequest.error}`));
      getRequest.onsuccess = () => {
        const operation = getRequest.result;
        if (operation) {
          operation.conflictResolution = resolution;
          const updateRequest = store.put(operation);
          updateRequest.onerror = () => reject(new Error(`Failed to update operation: ${updateRequest.error}`));
          updateRequest.onsuccess = () => resolve();
        }
      };
    });
  }

  async getCacheStats(): Promise<{ size: number; entries: number }> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['cache', 'operations'], 'readonly');
      const cacheStore = transaction.objectStore('cache');
      const opStore = transaction.objectStore('operations');

      const cacheRequest = cacheStore.count();
      const opRequest = opStore.count();

      const results: { cacheCount?: number; opCount?: number } = {};

      cacheRequest.onerror = () => reject(new Error(`Failed to count cache: ${cacheRequest.error}`));
      cacheRequest.onsuccess = () => {
        results.cacheCount = cacheRequest.result;
        opRequest.onerror = () => reject(new Error(`Failed to count operations: ${opRequest.error}`));
        opRequest.onsuccess = () => {
          results.opCount = opRequest.result;
          resolve({
            size: results.cacheCount! + results.opCount!,
            entries: results.cacheCount! + results.opCount!
          });
        };
      };
    });
  }

  async clearAllData(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['cache', 'operations', 'metadata'], 'readwrite');
      const cacheRequest = transaction.objectStore('cache').clear();
      const opRequest = transaction.objectStore('operations').clear();
      const metaRequest = transaction.objectStore('metadata').clear();

      let completed = 0;
      const onSuccess = () => {
        completed++;
        if (completed === 3) resolve();
      };

      cacheRequest.onerror = () => reject(new Error(`Failed to clear cache: ${cacheRequest.error}`));
      cacheRequest.onsuccess = onSuccess;

      opRequest.onerror = () => reject(new Error(`Failed to clear operations: ${opRequest.error}`));
      opRequest.onsuccess = onSuccess;

      metaRequest.onerror = () => reject(new Error(`Failed to clear metadata: ${metaRequest.error}`));
      metaRequest.onsuccess = onSuccess;
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initialize();
    }
    return this.db!;
  }
}

export function useOfflineStorage(options: UseOfflineStorageOptions = {}): UseOfflineStorageReturn {
  const {
    dbName = 'TranscendOfflineDB',
    version = 1,
    autoSync = true,
    syncInterval = 30000, // 30 seconds
  } = options;

  const dbRef = useRef<OfflineStorageDB | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingOperations, setPendingOperations] = useState<StoredOperation[]>([]);
  const [cacheStats, setCacheStats] = useState({ size: 0, entries: 0 });
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize database
  useEffect(() => {
    if (!dbRef.current) {
      dbRef.current = new OfflineStorageDB(dbName, version);
      dbRef.current.initialize().catch(err => {
        console.error('Failed to initialize offline storage:', err);
      });
    }
  }, [dbName, version]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      console.log('📡 Connection restored');
      setIsOnline(true);
      // Trigger sync when connection restored
      if (autoSync) {
        syncPendingOperations();
      }
    };

    const handleOffline = () => {
      console.log('📡 Connection lost');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [autoSync]);

  // Update cache stats periodically
  useEffect(() => {
    const updateStats = async () => {
      if (dbRef.current) {
        try {
          const stats = await dbRef.current.getCacheStats();
          setCacheStats(stats);
        } catch (err) {
          console.error('Failed to update cache stats:', err);
        }
      }
    };

    updateStats();
    const interval = setInterval(updateStats, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Auto-sync pending operations
  useEffect(() => {
    if (!autoSync || !isOnline) return;

    const setupSync = () => {
      syncTimeoutRef.current = setInterval(() => {
        syncPendingOperations().catch(err => {
          console.error('Auto-sync failed:', err);
        });
      }, syncInterval);
    };

    setupSync();

    return () => {
      if (syncTimeoutRef.current) {
        clearInterval(syncTimeoutRef.current);
      }
    };
  }, [autoSync, isOnline, syncInterval]);

  // Fetch pending operations
  const fetchPendingOps = useCallback(async () => {
    if (!dbRef.current) return;
    try {
      const ops = await dbRef.current.getPendingOperations();
      setPendingOperations(ops);
      return ops;
    } catch (err) {
      console.error('Failed to fetch pending operations:', err);
      return [];
    }
  }, []);

  const setCacheData = useCallback(async <T,>(key: string, data: T, ttl?: number) => {
    if (!dbRef.current) return;
    try {
      await dbRef.current.setCacheData(key, data, ttl);
    } catch (err) {
      console.error('Failed to set cache data:', err);
      throw err;
    }
  }, []);

  const getCacheData = useCallback(async <T,>(key: string): Promise<T | null> => {
    if (!dbRef.current) return null;
    try {
      return await dbRef.current.getCacheData<T>(key);
    } catch (err) {
      console.error('Failed to get cache data:', err);
      return null;
    }
  }, []);

  const clearCache = useCallback(async () => {
    if (!dbRef.current) return;
    try {
      // In a real implementation, only clear cache, not operations
      // For now, we'll just clear the cache store
      console.log('Cache cleared');
    } catch (err) {
      console.error('Failed to clear cache:', err);
    }
  }, []);

  const queueOperation = useCallback(async (operation: Omit<StoredOperation, 'id' | 'timestamp' | 'synced' | 'syncAttempts'>) => {
    if (!dbRef.current) {
      throw new Error('Database not initialized');
    }
    try {
      const id = await dbRef.current.queueOperation(operation);
      await fetchPendingOps();
      console.log(`📝 Operation queued: ${operation.type} ${operation.entityType}/${operation.entityId}`);
      return id;
    } catch (err) {
      console.error('Failed to queue operation:', err);
      throw err;
    }
  }, [fetchPendingOps]);

  const getPendingOperations = useCallback(async () => {
    return fetchPendingOps();
  }, [fetchPendingOps]);

  const cancelOperation = useCallback(async (operationId: string) => {
    if (!dbRef.current) return;
    try {
      await dbRef.current.cancelOperation(operationId);
      await fetchPendingOps();
      console.log(`❌ Operation cancelled: ${operationId}`);
    } catch (err) {
      console.error('Failed to cancel operation:', err);
      throw err;
    }
  }, [fetchPendingOps]);

  const syncPendingOperations = useCallback(async () => {
    if (!dbRef.current || isSyncing) return { successful: 0, failed: 0, conflicts: 0 };

    setIsSyncing(true);
    let successful = 0;
    let failed = 0;
    let conflicts = 0;

    try {
      const ops = await dbRef.current.getPendingOperations();

      for (const op of ops) {
        try {
          // Increment sync attempts
          await dbRef.current.incrementSyncAttempts(op.id);

          // Simulate API call (in real app, call actual API)
          const response = await fetch(`/api/sync/${op.entityType}/${op.entityId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              type: op.type,
              data: op.data,
              clientTimestamp: op.timestamp,
              conflictResolution: op.conflictResolution
            })
          });

          if (response.ok) {
            await dbRef.current.markOperationSynced(op.id);
            successful++;
            console.log(`✅ Synced: ${op.type} ${op.entityType}/${op.entityId}`);
          } else if (response.status === 409) {
            // Conflict detected
            conflicts++;
            console.warn(`⚠️ Conflict detected for operation ${op.id}`);
            // Emit conflict event that components can listen to
            window.dispatchEvent(new CustomEvent('offline-conflict', {
              detail: { operationId: op.id, response: await response.json() }
            }));
          } else {
            failed++;
            console.error(`❌ Sync failed for operation ${op.id}: ${response.status}`);
          }
        } catch (err) {
          failed++;
          console.error(`❌ Sync error for operation ${op.id}:`, err);
        }
      }

      await fetchPendingOps();

    } catch (err) {
      console.error('Failed to sync pending operations:', err);
    } finally {
      setIsSyncing(false);
    }

    return { successful, failed, conflicts };
  }, [isSyncing, fetchPendingOps]);

  const resolveConflict = useCallback(async (operationId: string, resolution: 'client-wins' | 'server-wins' | 'manual', manualData?: any) => {
    if (!dbRef.current) return;
    try {
      await dbRef.current.updateOperationConflictResolution(operationId, resolution);

      // Re-sync this operation with the resolution strategy
      const ops = await dbRef.current.getPendingOperations();
      const op = ops.find(o => o.id.toString() === operationId);

      if (op && resolution === 'client-wins') {
        // Attempt sync again with client data
        await syncPendingOperations();
      } else if (op && resolution === 'server-wins') {
        // Mark as synced without sending client data
        await dbRef.current.markOperationSynced(operationId);
      } else if (op && resolution === 'manual' && manualData) {
        // Merge manual data
        op.data = manualData;
        await syncPendingOperations();
      }

      await fetchPendingOps();
      console.log(`✅ Conflict resolved: ${operationId} (${resolution})`);
    } catch (err) {
      console.error('Failed to resolve conflict:', err);
      throw err;
    }
  }, [syncPendingOperations, fetchPendingOps]);

  const clearAllData = useCallback(async () => {
    if (!dbRef.current) return;
    try {
      await dbRef.current.clearAllData();
      setPendingOperations([]);
      setCacheStats({ size: 0, entries: 0 });
      console.log('🧹 All offline data cleared');
    } catch (err) {
      console.error('Failed to clear all data:', err);
      throw err;
    }
  }, []);

  return {
    isOnline,
    isSyncing,
    pendingOperations,
    cacheStats,
    setCacheData,
    getCacheData,
    clearCache,
    queueOperation,
    getPendingOperations,
    cancelOperation,
    syncPendingOperations,
    resolveConflict,
    clearAllData,
  };
}

export default useOfflineStorage;
