// Service Worker registration and management
export class ServiceWorkerManager {
  private static instance: ServiceWorkerManager;
  private registration: ServiceWorkerRegistration | null = null;
  private updateAvailable = false;

  static getInstance(): ServiceWorkerManager {
    if (!ServiceWorkerManager.instance) {
      ServiceWorkerManager.instance = new ServiceWorkerManager();
    }
    return ServiceWorkerManager.instance;
  }

  async register(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) {
      console.log('[SW] Service Worker not supported');
      return false;
    }

    try {
      // Check if we're in a context where service workers can be registered
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        console.log('[SW] Service Worker requires HTTPS (except localhost)');
        return false;
      }

      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('[SW] Service Worker registered successfully');

      // Handle updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration!.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              this.updateAvailable = true;
              this.notifyUpdateAvailable();
            }
          });
        }
      });

      // Handle controller change
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[SW] New service worker activated');
        this.updateAvailable = false;
        window.location.reload();
      });

      return true;
    } catch (error) {
      console.error('[SW] Service Worker registration failed:', error);
      
      // Log specific error details for debugging
      if (error instanceof Error) {
        console.error('[SW] Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      
      return false;
    }
  }

  private notifyUpdateAvailable(): void {
    // Dispatch custom event for app to handle
    window.dispatchEvent(new CustomEvent('sw-update-available'));
  }

  async update(): Promise<void> {
    if (this.registration && this.updateAvailable) {
      await this.registration.update();
    }
  }

  async unregister(): Promise<boolean> {
    if (this.registration) {
      return await this.registration.unregister();
    }
    return false;
  }

  isUpdateAvailable(): boolean {
    return this.updateAvailable;
  }

  getRegistration(): ServiceWorkerRegistration | null {
    return this.registration;
  }
}

// PWA installation management
export class PWAManager {
  private static instance: PWAManager;
  private deferredPrompt: any = null;
  private installEventListeners: Array<(canInstall: boolean) => void> = [];

  static getInstance(): PWAManager {
    if (!PWAManager.instance) {
      PWAManager.instance = new PWAManager();
    }
    return PWAManager.instance;
  }

  init(): void {
    console.log('[PWA] Initializing PWA manager...');
    
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator as any).standalone === true) {
      console.log('[PWA] App is already installed');
      this.notifyInstallListeners(false);
      return;
    }
    
    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('[PWA] beforeinstallprompt event received');
      e.preventDefault();
      this.deferredPrompt = e;
      this.notifyInstallListeners(true);
    });

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed successfully');
      this.deferredPrompt = null;
      this.notifyInstallListeners(false);
    });
    
    // Check if we should show install prompt after user engagement
    this.checkInstallEligibility();
    
    console.log('[PWA] PWA manager initialized, waiting for beforeinstallprompt event...');
  }

  private checkInstallEligibility(): void {
    // On Android Chrome, the beforeinstallprompt event might not fire immediately
    // We need to wait for user engagement and check periodically
    let checkCount = 0;
    const maxChecks = 10; // Check for 10 seconds
    
    const checkInterval = setInterval(() => {
      checkCount++;
      
      // Check if we can install (this might become true after user interaction)
      if (this.deferredPrompt) {
        clearInterval(checkInterval);
        this.notifyInstallListeners(true);
        return;
      }
      
      // Stop checking after max attempts
      if (checkCount >= maxChecks) {
        clearInterval(checkInterval);
        console.log('[PWA] Install prompt not available after user engagement');
      }
    }, 1000);
  }

  async install(): Promise<boolean> {
    if (!this.deferredPrompt) {
      // If no deferred prompt but we're on Android Chrome, return false
      // The UI will handle showing installation instructions
      const userAgent = navigator.userAgent;
      const isAndroid = /Android/.test(userAgent);
      const isChrome = /Chrome/.test(userAgent);
      
      if (isAndroid && isChrome) {
        console.log('[PWA] No deferred prompt available on Android Chrome');
        return false;
      }
      
      return false;
    }

    try {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      this.deferredPrompt = null;
      
      if (outcome === 'accepted') {
        console.log('[PWA] User accepted installation');
        return true;
      } else {
        console.log('[PWA] User declined installation');
        return false;
      }
    } catch (error) {
      console.error('[PWA] Installation failed:', error);
      return false;
    }
  }

  canInstall(): boolean {
    // Check if we have a deferred prompt
    if (this.deferredPrompt !== null) {
      return true;
    }
    
    // Additional checks for Android Chrome
    const userAgent = navigator.userAgent;
    const isAndroid = /Android/.test(userAgent);
    const isChrome = /Chrome/.test(userAgent);
    
    // On Android Chrome, we might need to show manual installation instructions
    if (isAndroid && isChrome) {
      // Check if we're in a standalone mode (already installed)
      if (window.matchMedia('(display-mode: standalone)').matches) {
        return false;
      }
      
      // For Android Chrome, we can show installation instructions even without beforeinstallprompt
      return true;
    }
    
    return false;
  }

  onInstallStateChange(callback: (canInstall: boolean) => void): void {
    this.installEventListeners.push(callback);
  }

  private notifyInstallListeners(canInstall: boolean): void {
    this.installEventListeners.forEach(callback => callback(canInstall));
  }
}

// Initialize service worker and PWA
export async function initializePWA(): Promise<void> {
  const swManager = ServiceWorkerManager.getInstance();
  const pwaManager = PWAManager.getInstance();

  // Register service worker
  await swManager.register();
  
  // Initialize PWA
  pwaManager.init();

  console.log('[PWA] Initialization complete');
}

// Export singleton instances
export const serviceWorkerManager = ServiceWorkerManager.getInstance();
export const pwaManager = PWAManager.getInstance();
