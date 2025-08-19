// Notification utilities for relay race events
export interface NotificationMessage {
  title: string;
  body: string;
  data?: Record<string, any>;
}

export class NotificationManager {
  private static instance: NotificationManager;
  private registration: ServiceWorkerRegistration | null = null;
  private permission: NotificationPermission = 'default';
  private readonly STORAGE_KEY = 'relay_notifications_enabled';
  private readonly DEDUP_STORAGE_KEY = 'relay_notification_dedup';
  private isInitialized = false;
  private pendingNotifications: Map<string, { message: NotificationMessage; timestamp: number }> = new Map();
  private processingQueue = false;

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
      console.log('[Notifications] Service Worker or Notification API not supported');
      return false;
    }

    try {
      // Get service worker registration
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        console.log('[Notifications] No service worker registration found');
        return false;
      }
      this.registration = registration;

      // Check notification permission
      this.permission = Notification.permission;
      
      // Don't automatically request permission - let the dashboard prompts handle this
      // if (this.permission === 'default') {
      //   const permission = await Notification.requestPermission();
      //   this.permission = permission;
      // }

      // If permission is granted and no preference is set, enable notifications by default
      if (this.permission === 'granted' && !localStorage.getItem(this.STORAGE_KEY)) {
        console.log('[Notifications] Permission granted but no preference set, enabling by default');
        this.saveNotificationPreference(true);
      }

      // Start background sync for notifications when app is closed
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        try {
          navigator.serviceWorker.controller.postMessage({
            type: 'START_BACKGROUND_SYNC'
          });
          console.log('[Notifications] Started background sync for closed app notifications');
        } catch (error) {
          console.log('[Notifications] Failed to start background sync:', error);
        }
      }

      // Clean up old deduplication data
      this.cleanupOldDedupData();

      this.isInitialized = true;
      console.log('[Notifications] Initialized with permission:', this.permission);
      return true; // Return true if initialization succeeded, regardless of permission status
    } catch (error) {
      console.error('[Notifications] Initialization failed:', error);
      return false;
    }
  }

  // Enhanced deduplication system
  private isDuplicateNotification(message: NotificationMessage): boolean {
    try {
      const dedupKey = this.createNotificationTag(message);
      const now = Date.now();
      const dedupData = JSON.parse(localStorage.getItem(this.DEDUP_STORAGE_KEY) || '{}');
      
      // Clean up old entries (older than 10 minutes)
      const cutoff = now - (10 * 60 * 1000);
      Object.keys(dedupData).forEach(key => {
        if (dedupData[key] < cutoff) {
          delete dedupData[key];
        }
      });
      
      // Check if this notification was recently sent
      if (dedupData[dedupKey] && (now - dedupData[dedupKey]) < (5 * 60 * 1000)) { // 5 minute window
        console.log(`[Notifications] Duplicate notification detected: ${dedupKey}`);
        return true;
      }
      
      // Store this notification
      dedupData[dedupKey] = now;
      localStorage.setItem(this.DEDUP_STORAGE_KEY, JSON.stringify(dedupData));
      
      return false;
    } catch (error) {
      console.error('[Notifications] Error in deduplication check:', error);
      return false;
    }
  }

  private cleanupOldDedupData(): void {
    try {
      const dedupData = JSON.parse(localStorage.getItem(this.DEDUP_STORAGE_KEY) || '{}');
      const now = Date.now();
      const cutoff = now - (10 * 60 * 1000); // 10 minutes
      
      let cleaned = 0;
      Object.keys(dedupData).forEach(key => {
        if (dedupData[key] < cutoff) {
          delete dedupData[key];
          cleaned++;
        }
      });
      
      if (cleaned > 0) {
        localStorage.setItem(this.DEDUP_STORAGE_KEY, JSON.stringify(dedupData));
        console.log(`[Notifications] Cleaned up ${cleaned} old deduplication entries`);
      }
    } catch (error) {
      console.error('[Notifications] Error cleaning up deduplication data:', error);
    }
  }

  async showNotification(message: NotificationMessage): Promise<void> {
    if (this.permission !== 'granted' || !this.registration) {
      console.log('[Notifications] Cannot show notification - permission not granted or no registration');
      console.log('[Notifications] Permission:', this.permission, 'Registration:', !!this.registration);
      return;
    }

    // Check for duplicates
    if (this.isDuplicateNotification(message)) {
      console.log('[Notifications] Skipping duplicate notification');
      return;
    }

    // Add to pending queue to prevent race conditions
    const dedupKey = this.createNotificationTag(message);
    this.pendingNotifications.set(dedupKey, {
      message,
      timestamp: Date.now()
    });

    // Process queue if not already processing
    if (!this.processingQueue) {
      this.processNotificationQueue();
    }
  }

  private async processNotificationQueue(): Promise<void> {
    if (this.processingQueue || this.pendingNotifications.size === 0) {
      return;
    }

    this.processingQueue = true;

    try {
      for (const [dedupKey, { message }] of this.pendingNotifications) {
        await this.sendNotification(message);
        this.pendingNotifications.delete(dedupKey);
        
        // Small delay between notifications to prevent overwhelming the system
        if (this.pendingNotifications.size > 0) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    } catch (error) {
      console.error('[Notifications] Error processing notification queue:', error);
    } finally {
      this.processingQueue = false;
      
      // Process any new notifications that were added while processing
      if (this.pendingNotifications.size > 0) {
        setTimeout(() => this.processNotificationQueue(), 100);
      }
    }
  }

  private async sendNotification(message: NotificationMessage): Promise<void> {
    try {
      console.log('[Notifications] Attempting to show notification:', message.title, message.body);
      console.log('[Notifications] Page visibility:', !document.hidden ? 'visible' : 'hidden');
      console.log('[Notifications] Service worker state:', this.registration?.active ? 'active' : 'inactive');
      
      // Create a unique tag for this specific notification to prevent duplicates
      const notificationTag = this.createNotificationTag(message);
      
      // Choose the best icon based on device and platform
      const icon = this.getBestNotificationIcon();
      const badge = this.getBestNotificationBadge();
      
      const options: NotificationOptions = {
        body: message.body,
        icon: icon,
        badge: badge,
        data: message.data,
        requireInteraction: false, // Changed to false to allow background notifications
        silent: false,
        tag: notificationTag, // Use unique tag for deduplication
        // Add platform-specific options for better appearance
        ...this.getPlatformSpecificOptions()
      };

      console.log('[Notifications] Showing notification with options:', options);
      
      // Try service worker notification first
      if (this.registration) {
        try {
          const notification = await this.registration.showNotification(message.title, options);
          console.log('[Notifications] Service worker notification sent successfully:', notification);
        } catch (swError) {
          console.warn('[Notifications] Service worker notification failed, trying native:', swError);
          throw swError; // Fall through to native notification
        }
      }
      
      // Also try to show a fallback notification using the browser's native API
      if (Notification.permission === 'granted') {
        try {
          const fallbackNotification = new Notification(message.title, {
            body: message.body,
            icon: icon, // Use the same optimized icon
            badge: badge, // Use the same optimized badge
            requireInteraction: false, // Changed to false
            tag: notificationTag, // Use same tag for native notifications
            ...this.getPlatformSpecificOptions()
          });
          console.log('[Notifications] Fallback notification also sent');
        } catch (fallbackError) {
          console.log('[Notifications] Fallback notification failed:', fallbackError);
        }
      }
      
      // Also try sending through service worker message API as another fallback
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        try {
          navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_NOTIFICATION',
            title: message.title,
            body: message.body,
            data: message.data
          });
          console.log('[Notifications] Service worker message sent as fallback');
        } catch (messageError) {
          console.log('[Notifications] Service worker message failed:', messageError);
        }
      }
    } catch (error) {
      console.error('[Notifications] Failed to show notification:', error);
      
      // If all methods failed, try one more time with minimal options
      try {
        if (Notification.permission === 'granted') {
          const minimalNotification = new Notification(message.title, {
            body: message.body,
            tag: this.createNotificationTag(message)
          });
          console.log('[Notifications] Minimal fallback notification sent');
        }
      } catch (minimalError) {
        console.error('[Notifications] All notification methods failed:', minimalError);
      }
    }
  }

  // Get the best notification icon based on device and platform
  private getBestNotificationIcon(): string {
    // Check if we're on iOS (Safari)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    // Check if we're on Android
    const isAndroid = /Android/.test(navigator.userAgent);
    
    // Check if we're on Windows
    const isWindows = /Windows/.test(navigator.userAgent);
    
    // Check if we're on macOS
    const isMacOS = /Mac OS X/.test(navigator.userAgent) && !isIOS;
    
    // Choose icon based on platform
    if (isIOS) {
      // iOS prefers 180x180 or 152x152 icons
      return '/apple-touch-icon.png';
    } else if (isAndroid) {
      // Android prefers 192x192 or 144x144 icons
      return '/icon-192.png';
    } else if (isWindows) {
      // Windows prefers 192x192 icons
      return '/icon-192.png';
    } else if (isMacOS) {
      // macOS prefers 192x192 icons
      return '/icon-192.png';
    } else {
      // Default to 192x192 for other platforms
      return '/icon-192.png';
    }
  }

  // Get the best notification badge based on device and platform
  private getBestNotificationBadge(): string {
    // Badge should be smaller, use 96x96 or 72x72
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    if (isIOS) {
      // iOS prefers smaller badges
      return '/icon-72.png';
    } else {
      // Other platforms use 96x96
      return '/icon-96.png';
    }
  }

  // Get platform-specific notification options
  private getPlatformSpecificOptions(): Partial<NotificationOptions> {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    const isAndroid = /Android/.test(navigator.userAgent);
    
    if (isIOS) {
      // iOS-specific options
      return {
        silent: false // iOS notifications should have sound
      };
    } else if (isAndroid) {
      // Android-specific options
      return {
        silent: false
      };
    } else {
      // Desktop options
      return {
        silent: false
      };
    }
  }

  // Create a unique tag for notification deduplication
  private createNotificationTag(message: NotificationMessage): string {
    const data = message.data;
    if (data?.type && data?.legNumber && data?.runnerName) {
      // For race events, create a specific tag based on the event
      return `relay-${data.type}-${data.legNumber}-${data.runnerName}`;
    }
    
    // For other notifications, use a hash of the title and body
    const content = `${message.title}-${message.body}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `relay-${Math.abs(hash)}`;
  }

  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'Notification' in window;
  }

  getPermission(): NotificationPermission {
    return this.permission;
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    this.permission = permission;
    
    // Only save preference if permission was granted AND no preference was previously set
    if (permission === 'granted' && !localStorage.getItem(this.STORAGE_KEY)) {
      console.log('[Notifications] Permission granted and no preference set, enabling by default');
      this.saveNotificationPreference(true);
    }
    
    console.log('[Notifications] Permission requested, result:', permission);
    return permission;
  }

  // Save notification preference to localStorage
  private saveNotificationPreference(enabled: boolean): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, enabled.toString());
    } catch (error) {
      console.error('[Notifications] Failed to save preference:', error);
    }
  }

  // Public setter for preference
  setNotificationPreference(enabled: boolean): void {
    console.log(`[Notifications] Setting preference to: ${enabled}`);
    this.saveNotificationPreference(enabled);
  }

  // Check if notifications were previously enabled
  isNotificationPreferenceEnabled(): boolean {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      const isEnabled = saved === null ? true : saved === 'true';
      return isEnabled;
    } catch (error) {
      console.error('[Notifications] Failed to read preference:', error);
      return true; // Default to enabled on error
    }
  }

  // Clear saved preference (sets to false so OFF state persists)
  clearNotificationPreference(): void {
    try {
      console.log('[Notifications] Clearing notification preference (setting to false)');
      localStorage.setItem(this.STORAGE_KEY, 'false');
    } catch (error) {
      console.error('[Notifications] Failed to clear preference:', error);
    }
  }

  // Get the raw preference value for debugging
  getNotificationPreferenceValue(): string | null {
    try {
      return localStorage.getItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('[Notifications] Failed to get preference value:', error);
      return null;
    }
  }

  // Reset preference to default (enabled) - useful for testing
  resetNotificationPreference(): void {
    try {
      console.log('[Notifications] Resetting notification preference to default (enabled)');
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('[Notifications] Failed to reset preference:', error);
    }
  }

  // Test notification for development
  async showTestNotification(): Promise<void> {
    console.log('[Notifications] Showing test notification...');
    
    // Try both service worker and native notifications
    await this.showNotification({
      title: "Test Notification! 🏃‍♂️",
      body: "This is a test notification for runner updates.",
      data: { type: 'test', timestamp: Date.now() }
    });
    
    // Also try a native notification as backup
    if (Notification.permission === 'granted') {
      try {
        const icon = this.getBestNotificationIcon();
        const badge = this.getBestNotificationBadge();
        
        const nativeNotification = new Notification("Native Test! 🏃‍♂️", {
          body: "This is a native browser notification test",
          icon: icon,
          badge: badge,
          requireInteraction: false,
          ...this.getPlatformSpecificOptions()
        });
        console.log('[Notifications] Native test notification sent');
      } catch (error) {
        console.error('[Notifications] Native test notification failed:', error);
      }
    }
  }

  // Test background notification specifically
  async showBackgroundTestNotification(): Promise<void> {
    console.log('[Notifications] Showing background test notification...');
    console.log('[Notifications] Current page visibility:', !document.hidden ? 'visible' : 'hidden');
    console.log('[Notifications] Service worker registration:', !!this.registration);
    console.log('[Notifications] Service worker active:', this.registration?.active ? 'yes' : 'no');
    
    await this.showNotification({
      title: "Background Test! 🏃‍♂️",
      body: "This notification should appear even when the app is in the background.",
      data: { type: 'background_test', timestamp: Date.now() }
    });
  }

  // Get queue status for debugging
  getQueueStatus(): { pending: number; processing: boolean } {
    return {
      pending: this.pendingNotifications.size,
      processing: this.processingQueue
    };
  }

  // Clear all pending notifications
  clearPendingNotifications(): void {
    this.pendingNotifications.clear();
    console.log('[Notifications] Cleared all pending notifications');
  }
}



export function generateFirstLegStartNotification(runnerName: string): NotificationMessage {
  return {
    title: "And they're off! 🏃‍♂️",
    body: `${runnerName} is leaving Timberline!`,
    data: { type: 'first_leg_start', legNumber: 1, runnerName, timestamp: Date.now() }
  };
}

export function generateFinishNotification(
  finishedRunnerName: string, 
  finishedLegNumber: number, 
  nextRunnerName?: string, 
  nextLegNumber?: number,
  isFinalLeg: boolean = false
): NotificationMessage {
  if (isFinalLeg) {
    return {
      title: "Race Complete! 🎉",
      body: `${finishedRunnerName} finished Leg ${finishedLegNumber}. Amazing job, team!`,
      data: { type: 'runner_finish', legNumber: finishedLegNumber, runnerName: finishedRunnerName, isFinalLeg, timestamp: Date.now() }
    };
  }

  if (nextRunnerName && nextLegNumber) {
    // Special phrasing for the final handoff into Leg 36
    if (nextLegNumber === 36) {
      return {
        title: "Last leg! 🏃‍♂️",
        body: `${finishedRunnerName} hands off to ${nextRunnerName} and they are headed to the sand!`,
        data: { 
          type: 'runner_finish', 
          finishedLegNumber, 
          finishedRunnerName, 
          nextLegNumber, 
          nextRunnerName, 
          isFinalLeg,
          timestamp: Date.now()
        }
      };
    }
    return {
      title: "Handoff Complete! 🤝",
      body: `${finishedRunnerName} hands off to ${nextRunnerName} running Leg ${nextLegNumber}!`,
      data: { 
        type: 'runner_finish', 
        finishedLegNumber, 
        finishedRunnerName, 
        nextLegNumber, 
        nextRunnerName, 
        isFinalLeg,
        timestamp: Date.now()
      }
    };
  }

  return {
    title: "Runner Finished! ✅",
    body: `${finishedRunnerName} has finished Leg ${finishedLegNumber}`,
    data: { type: 'runner_finish', legNumber: finishedLegNumber, runnerName: finishedRunnerName, isFinalLeg, timestamp: Date.now() }
  };
}



// Export singleton instance
export const notificationManager = NotificationManager.getInstance();
