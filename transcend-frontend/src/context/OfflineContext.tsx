// Offline Context
// Provides offline functionality to the entire app

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useOfflineStorage, StoredOperation } from '../hooks/useOfflineStorage';
import { getSyncService, initializeSyncService, getConnectionMonitor, initializeConnectionMonitor } from '../services/syncService';
import { getPWAManager, initializePWA } from '../services/pwaService';

export interface OfflineContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingOperations: StoredOperation[];
  cacheStats: { size: number; entries: number };

  // Cache operations
  setCacheData: <T>(key: string, data: T, ttl?: number) => Promise<void>;
  getCacheData: <T>(key: string) => Promise<T | null>;

  // Queue operations
  queueOperation: (operation: Omit<StoredOperation, 'id' | 'timestamp' | 'synced' | 'syncAttempts'>) => Promise<string>;
  cancelOperation: (operationId: string) => Promise<void>;

  // Sync operations
  syncNow: () => Promise<{ successful: number; failed: number; conflicts: number }>;
  resolveConflict: (operationId: string, resolution: 'client-wins' | 'server-wins' | 'manual', manualData?: any) => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

interface OfflineProviderProps {
  children: React.ReactNode;
  enablePWA?: boolean;
  enableAutoSync?: boolean;
}

export const OfflineProvider: React.FC<OfflineProviderProps> = ({
  children,
  enablePWA = true,
  enableAutoSync = true
}) => {
  const offlineStorage = useOfflineStorage({
    autoSync: enableAutoSync,
    syncInterval: 30000
  });

  // Initialize services on mount
  useEffect(() => {
    // Initialize sync service
    initializeSyncService(
      {
        maxRetries: 3,
        retryDelay: 1000,
        conflictResolutionStrategy: 'client-wins'
      },
      process.env.REACT_APP_API_URL || 'https://transcend-law.com/api'
    );

    // Initialize connection monitor
    initializeConnectionMonitor(5000);

    // Initialize PWA if enabled
    if (enablePWA) {
      initializePWA({
        enabled: true,
        swPath: '/sw.js'
      });

      // Cache critical app shell resources
      const pwaManager = getPWAManager();
      pwaManager.cacheAssets([
        '/',
        '/index.html',
        '/manifest.json'
      ]);
    }

    // Listen for conflicts
    const handleConflict = (event: CustomEvent) => {
      const { operationId, response } = event.detail;
      console.warn('Offline conflict detected:', operationId, response);
      // Components can subscribe to 'offline-conflict' events
    };

    window.addEventListener('offline-conflict', handleConflict as EventListener);

    return () => {
      window.removeEventListener('offline-conflict', handleConflict as EventListener);
    };
  }, [enablePWA, enableAutoSync]);

  const value: OfflineContextType = {
    isOnline: offlineStorage.isOnline,
    isSyncing: offlineStorage.isSyncing,
    pendingOperations: offlineStorage.pendingOperations,
    cacheStats: offlineStorage.cacheStats,
    setCacheData: offlineStorage.setCacheData,
    getCacheData: offlineStorage.getCacheData,
    queueOperation: offlineStorage.queueOperation,
    cancelOperation: offlineStorage.cancelOperation,
    syncNow: offlineStorage.syncPendingOperations,
    resolveConflict: offlineStorage.resolveConflict,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
};

/**
 * Hook to use offline context
 */
export const useOffline = (): OfflineContextType => {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error('useOffline must be used within OfflineProvider');
  }
  return context;
};

/**
 * HOC to wrap components with offline context
 */
export const withOffline = <P extends object>(
  Component: React.ComponentType<P & { offline: OfflineContextType }>
): React.FC<P> => {
  return (props: P) => {
    const offline = useOffline();
    return <Component {...props} offline={offline} />;
  };
};

export default OfflineContext;
