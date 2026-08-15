// Sync Service
// Manages offline/online synchronization and conflict resolution

import { StoredOperation } from '../hooks/useOfflineStorage';

export interface SyncConfig {
  maxRetries: number;
  retryDelay: number;
  retryBackoffMultiplier: number;
  conflictResolutionStrategy: 'client-wins' | 'server-wins' | 'manual';
  batchSize: number;
}

export interface SyncResult {
  operationId: string;
  status: 'success' | 'failed' | 'conflict' | 'pending';
  error?: string;
  serverVersion?: number;
  clientVersion?: number;
}

export interface ConflictData {
  operationId: string;
  operation: StoredOperation;
  serverData: any;
  clientData: any;
  serverTimestamp: number;
  clientTimestamp: number;
}

export interface SyncMetrics {
  totalOperations: number;
  successfulSyncs: number;
  failedSyncs: number;
  conflicts: number;
  lastSyncTime: number;
  nextSyncTime: number;
  syncDuration: number;
}

const DEFAULT_CONFIG: SyncConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  retryBackoffMultiplier: 2,
  conflictResolutionStrategy: 'client-wins',
  batchSize: 10
};

class SyncManager {
  private config: SyncConfig;
  private metrics: SyncMetrics;
  private conflictHandlers: Map<string, (conflict: ConflictData) => Promise<'client' | 'server' | 'manual'>> = new Map();
  private syncInProgress: boolean = false;
  private apiBaseUrl: string;

  constructor(config: Partial<SyncConfig> = {}, apiBaseUrl: string = '') {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.apiBaseUrl = apiBaseUrl || process.env.REACT_APP_API_URL || 'https://transcend-law.com/api';
    this.metrics = {
      totalOperations: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      conflicts: 0,
      lastSyncTime: 0,
      nextSyncTime: 0,
      syncDuration: 0
    };
  }

  /**
   * Register a conflict handler for a specific entity type
   */
  registerConflictHandler(
    entityType: string,
    handler: (conflict: ConflictData) => Promise<'client' | 'server' | 'manual'>
  ): void {
    this.conflictHandlers.set(entityType, handler);
  }

  /**
   * Sync a single operation with retry logic
   */
  async syncOperation(
    operation: StoredOperation,
    token: string,
    attempt: number = 0
  ): Promise<SyncResult> {
    try {
      const url = `${this.apiBaseUrl}/sync/${operation.entityType}/${operation.entityId}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Client-Timestamp': operation.timestamp.toString(),
          'X-Conflict-Resolution': operation.conflictResolution || this.config.conflictResolutionStrategy
        },
        body: JSON.stringify({
          type: operation.type,
          data: operation.data,
          clientTimestamp: operation.timestamp
        })
      });

      // Success
      if (response.ok) {
        this.metrics.successfulSyncs++;
        return {
          operationId: operation.id,
          status: 'success'
        };
      }

      // Conflict detected (409)
      if (response.status === 409) {
        this.metrics.conflicts++;
        const conflictData = await response.json();
        return {
          operationId: operation.id,
          status: 'conflict',
          serverData: conflictData.serverData,
          serverVersion: conflictData.version,
          clientVersion: operation.timestamp
        };
      }

      // Retryable errors (5xx or network issues)
      if (response.status >= 500 || response.status === 0) {
        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelay * Math.pow(this.config.retryBackoffMultiplier, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.syncOperation(operation, token, attempt + 1);
        }
      }

      // Permanent error
      this.metrics.failedSyncs++;
      return {
        operationId: operation.id,
        status: 'failed',
        error: `HTTP ${response.status}: ${response.statusText}`
      };

    } catch (error) {
      if (attempt < this.config.maxRetries) {
        const delay = this.config.retryDelay * Math.pow(this.config.retryBackoffMultiplier, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.syncOperation(operation, token, attempt + 1);
      }

      this.metrics.failedSyncs++;
      return {
        operationId: operation.id,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Sync multiple operations with batching
   */
  async syncBatch(
    operations: StoredOperation[],
    token: string
  ): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    for (let i = 0; i < operations.length; i += this.config.batchSize) {
      const batch = operations.slice(i, i + this.config.batchSize);
      const batchResults = await Promise.all(
        batch.map(op => this.syncOperation(op, token))
      );
      results.push(...batchResults);

      // Small delay between batches to avoid overwhelming server
      if (i + this.config.batchSize < operations.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Handle a conflict with user-defined resolution strategy
   */
  async handleConflict(
    operationId: string,
    operation: StoredOperation,
    serverData: any,
    manualResolution?: 'client-wins' | 'server-wins' | 'manual'
  ): Promise<'client' | 'server' | 'manual'> {
    const resolution = manualResolution || this.config.conflictResolutionStrategy;

    // Check if there's a custom handler for this entity type
    const handler = this.conflictHandlers.get(operation.entityType);
    if (handler) {
      const conflict: ConflictData = {
        operationId,
        operation,
        serverData,
        clientData: operation.data,
        serverTimestamp: serverData.timestamp || Date.now(),
        clientTimestamp: operation.timestamp
      };
      return await handler(conflict);
    }

    // Default resolution strategies
    switch (resolution) {
      case 'client-wins':
        return 'client';
      case 'server-wins':
        return 'server';
      case 'manual':
        return 'manual';
      default:
        return 'client';
    }
  }

  /**
   * Perform full sync of all pending operations
   */
  async performFullSync(
    operations: StoredOperation[],
    token: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<{
    results: SyncResult[];
    summary: { successful: number; failed: number; conflicts: number };
  }> {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    this.syncInProgress = true;
    const startTime = Date.now();

    try {
      this.metrics.totalOperations = operations.length;
      const results: SyncResult[] = [];

      for (let i = 0; i < operations.length; i++) {
        const result = await this.syncOperation(operations[i], token);
        results.push(result);

        if (onProgress) {
          onProgress(i + 1, operations.length);
        }
      }

      this.metrics.syncDuration = Date.now() - startTime;
      this.metrics.lastSyncTime = Date.now();
      this.metrics.nextSyncTime = Date.now() + 30000; // Next sync in 30 seconds

      const summary = {
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'failed').length,
        conflicts: results.filter(r => r.status === 'conflict').length
      };

      return { results, summary };

    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Detect conflicts between client and server data
   */
  detectConflict(
    clientData: any,
    serverData: any,
    clientTimestamp: number,
    serverTimestamp: number
  ): boolean {
    // If both were modified after the base version, it's a conflict
    if (clientTimestamp > 0 && serverTimestamp > 0) {
      // Check if the content differs
      return JSON.stringify(clientData) !== JSON.stringify(serverData);
    }
    return false;
  }

  /**
   * Merge strategies for conflicts
   */
  mergeData(
    clientData: any,
    serverData: any,
    strategy: 'client-wins' | 'server-wins' | 'three-way'
  ): any {
    switch (strategy) {
      case 'client-wins':
        return clientData;

      case 'server-wins':
        return serverData;

      case 'three-way':
        // Perform three-way merge on objects
        if (typeof clientData === 'object' && typeof serverData === 'object' && clientData !== null && serverData !== null) {
          const merged = { ...serverData };
          for (const key in clientData) {
            if (clientData.hasOwnProperty(key)) {
              merged[key] = clientData[key];
            }
          }
          return merged;
        }
        return clientData;

      default:
        return clientData;
    }
  }

  /**
   * Get current sync metrics
   */
  getMetrics(): SyncMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset sync metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalOperations: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      conflicts: 0,
      lastSyncTime: 0,
      nextSyncTime: 0,
      syncDuration: 0
    };
  }

  /**
   * Check if sync is in progress
   */
  isSyncing(): boolean {
    return this.syncInProgress;
  }
}

// Singleton instance
let syncManager: SyncManager | null = null;

export function initializeSyncService(config?: Partial<SyncConfig>, apiBaseUrl?: string): SyncManager {
  syncManager = new SyncManager(config, apiBaseUrl);
  return syncManager;
}

export function getSyncService(): SyncManager {
  if (!syncManager) {
    syncManager = new SyncManager();
  }
  return syncManager;
}

export class OfflineQueue {
  private queue: StoredOperation[] = [];
  private maxQueueSize: number = 1000;

  /**
   * Add operation to queue
   */
  enqueue(operation: Omit<StoredOperation, 'id' | 'timestamp' | 'synced' | 'syncAttempts'>): void {
    if (this.queue.length >= this.maxQueueSize) {
      console.warn('Offline queue is full, removing oldest operation');
      this.queue.shift();
    }

    const storedOp: StoredOperation = {
      id: Date.now().toString(),
      ...operation,
      timestamp: Date.now(),
      synced: false,
      syncAttempts: 0
    };

    this.queue.push(storedOp);
  }

  /**
   * Get all queued operations
   */
  getAll(): StoredOperation[] {
    return [...this.queue];
  }

  /**
   * Get unsync operations
   */
  getPending(): StoredOperation[] {
    return this.queue.filter(op => !op.synced);
  }

  /**
   * Mark operation as synced
   */
  markSynced(operationId: string): void {
    const op = this.queue.find(o => o.id === operationId);
    if (op) {
      op.synced = true;
    }
  }

  /**
   * Remove operation from queue
   */
  remove(operationId: string): void {
    this.queue = this.queue.filter(op => op.id !== operationId);
  }

  /**
   * Clear queue
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Get priority-sorted queue (by timestamp, oldest first)
   */
  getSorted(): StoredOperation[] {
    return [...this.queue].sort((a, b) => a.timestamp - b.timestamp);
  }
}

// Connection status detector
export class ConnectionMonitor {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private listeners: Set<(isOnline: boolean) => void> = new Set();
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(private checkIntervalMs: number = 5000) {
    this.setupListeners();
    this.startPeriodicCheck();
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => this.setOnlineStatus(true));
    window.addEventListener('offline', () => this.setOnlineStatus(false));
  }

  private startPeriodicCheck(): void {
    if (typeof navigator === 'undefined') return;

    this.checkInterval = setInterval(() => {
      const wasOnline = this.isOnline;
      const isNowOnline = navigator.onLine;

      if (wasOnline !== isNowOnline) {
        this.setOnlineStatus(isNowOnline);
      }
    }, this.checkIntervalMs);
  }

  private setOnlineStatus(isOnline: boolean): void {
    if (this.isOnline !== isOnline) {
      this.isOnline = isOnline;
      this.notifyListeners();
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.isOnline);
      } catch (err) {
        console.error('Error in connection status listener:', err);
      }
    });
  }

  /**
   * Check current online status
   */
  getStatus(): boolean {
    return this.isOnline;
  }

  /**
   * Subscribe to connection status changes
   */
  subscribe(listener: (isOnline: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  /**
   * Perform connectivity test
   */
  async testConnectivity(testUrl: string = '/api/health'): Promise<boolean> {
    try {
      const response = await fetch(testUrl, {
        method: 'GET',
        cache: 'no-cache',
        headers: { 'Content-Type': 'application/json' }
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Export singleton
let connectionMonitor: ConnectionMonitor | null = null;

export function initializeConnectionMonitor(checkIntervalMs?: number): ConnectionMonitor {
  connectionMonitor = new ConnectionMonitor(checkIntervalMs);
  return connectionMonitor;
}

export function getConnectionMonitor(): ConnectionMonitor {
  if (!connectionMonitor) {
    connectionMonitor = new ConnectionMonitor();
  }
  return connectionMonitor;
}
