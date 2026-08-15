// PWA Service
// Progressive Web App configuration and service worker management

export interface PWAConfig {
  enabled: boolean;
  swPath: string;
  onInstall?: () => void;
  onUpdate?: () => void;
  onError?: (error: Error) => void;
}

export interface ServiceWorkerStatus {
  installed: boolean;
  active: boolean;
  updateAvailable: boolean;
  updateWaiting?: ServiceWorkerContainer;
}

class PWAManager {
  private config: PWAConfig;
  private swRegistration: ServiceWorkerRegistration | null = null;
  private updateCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<PWAConfig> = {}) {
    this.config = {
      enabled: true,
      swPath: '/sw.js',
      ...config
    };
  }

  /**
   * Initialize PWA
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.warn('PWA or service workers not supported');
      return;
    }

    try {
      this.swRegistration = await navigator.serviceWorker.register(this.config.swPath);
      console.log('✅ Service Worker registered:', this.swRegistration);

      // Check for updates periodically
      this.startUpdateChecks();

      // Listen for controller change (new service worker activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('🔄 Service Worker updated');
        if (this.config.onUpdate) {
          this.config.onUpdate();
        }
      });

    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
      if (this.config.onError && error instanceof Error) {
        this.config.onError(error);
      }
    }
  }

  /**
   * Unregister service worker
   */
  async unregister(): Promise<void> {
    if (this.swRegistration) {
      await this.swRegistration.unregister();
      this.swRegistration = null;
    }

    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
    }
  }

  /**
   * Check for service worker updates
   */
  async checkForUpdate(): Promise<boolean> {
    if (!this.swRegistration) {
      return false;
    }

    try {
      await this.swRegistration.update();
      return !!this.swRegistration.waiting;
    } catch (error) {
      console.error('Failed to check for updates:', error);
      return false;
    }
  }

  /**
   * Start checking for updates
   */
  private startUpdateChecks(intervalMs: number = 3600000): void { // 1 hour default
    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdate();
    }, intervalMs);
  }

  /**
   * Skip waiting (activate waiting service worker)
   */
  skipWaiting(): void {
    if (this.swRegistration?.waiting) {
      this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  /**
   * Get service worker status
   */
  getStatus(): ServiceWorkerStatus {
    return {
      installed: !!this.swRegistration,
      active: !!this.swRegistration?.active,
      updateAvailable: !!this.swRegistration?.waiting,
      updateWaiting: this.swRegistration?.waiting
    };
  }

  /**
   * Send message to service worker
   */
  postMessage(message: any): void {
    if (this.swRegistration?.active) {
      this.swRegistration.active.postMessage(message);
    }
  }

  /**
   * Cache assets for offline access
   */
  async cacheAssets(urls: string[], cacheName: string = 'transcend-cache'): Promise<void> {
    try {
      const cache = await caches.open(cacheName);
      await cache.addAll(urls);
      console.log(`📦 Cached ${urls.length} assets`);
    } catch (error) {
      console.error('Failed to cache assets:', error);
    }
  }

  /**
   * Prefetch critical resources
   */
  async prefetchResources(urls: string[]): Promise<void> {
    const cacheName = 'transcend-prefetch';
    try {
      const cache = await caches.open(cacheName);
      const requests = urls.map(url => new Request(url, { credentials: 'include' }));

      for (const request of requests) {
        try {
          const response = await fetch(request);
          if (response.ok) {
            await cache.put(request, response);
          }
        } catch (error) {
          console.warn(`Failed to prefetch ${request.url}:`, error);
        }
      }
    } catch (error) {
      console.error('Prefetch failed:', error);
    }
  }

  /**
   * Clear old caches
   */
  async clearOldCaches(excludeCaches: string[] = []): Promise<void> {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => {
        if (!excludeCaches.includes(cacheName)) {
          return caches.delete(cacheName);
        }
      })
    );
  }
}

let pwaManager: PWAManager | null = null;

export function initializePWA(config?: Partial<PWAConfig>): PWAManager {
  pwaManager = new PWAManager(config);
  pwaManager.initialize();
  return pwaManager;
}

export function getPWAManager(): PWAManager {
  if (!pwaManager) {
    pwaManager = new PWAManager();
  }
  return pwaManager;
}

/**
 * Install PWA prompt handler
 */
export class InstallPromptHandler {
  private deferredPrompt: any = null;
  private installButton: HTMLElement | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.deferredPrompt = e;
        this.showInstallPrompt();
      });

      window.addEventListener('appinstalled', () => {
        console.log('✅ PWA installed');
        this.hideInstallPrompt();
      });
    }
  }

  /**
   * Show install prompt
   */
  private showInstallPrompt(): void {
    // This would typically show a custom UI button
    // For now, just log it
    console.log('Install prompt ready');
  }

  /**
   * Hide install prompt
   */
  private hideInstallPrompt(): void {
    if (this.installButton) {
      this.installButton.style.display = 'none';
    }
  }

  /**
   * Trigger install
   */
  async install(): Promise<void> {
    if (!this.deferredPrompt) {
      return;
    }

    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    console.log(`User response: ${outcome}`);
    this.deferredPrompt = null;
  }

  /**
   * Check if install prompt is available
   */
  isAvailable(): boolean {
    return !!this.deferredPrompt;
  }

  /**
   * Set install button reference
   */
  setInstallButton(button: HTMLElement): void {
    this.installButton = button;
  }
}
