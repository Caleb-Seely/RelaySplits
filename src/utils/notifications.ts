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

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  async initialize(): Promise<boolean> {
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

      // If permission is granted, automatically enable notifications by default
      if (this.permission === 'granted') {
        this.saveNotificationPreference(true);
      }

      console.log('[Notifications] Initialized with permission:', this.permission);
      return true; // Return true if initialization succeeded, regardless of permission status
    } catch (error) {
      console.error('[Notifications] Initialization failed:', error);
      return false;
    }
  }

  async showNotification(message: NotificationMessage): Promise<void> {
    if (this.permission !== 'granted' || !this.registration) {
      console.log('[Notifications] Cannot show notification - permission not granted or no registration');
      return;
    }

    try {
      console.log('[Notifications] Attempting to show notification:', message.title, message.body);
      
      const options: NotificationOptions = {
        body: message.body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        data: message.data,
        requireInteraction: true, // Make notifications require interaction to ensure they're visible
        silent: false,
        tag: 'relay-notification' // Group notifications
      };

      const notification = await this.registration.showNotification(message.title, options);
      console.log('[Notifications] Notification sent successfully:', notification);
      
      // Also try to show a fallback notification using the browser's native API
      if (Notification.permission === 'granted') {
        try {
          const fallbackNotification = new Notification(message.title, {
            body: message.body,
            icon: '/favicon.ico',
            requireInteraction: true
          });
          console.log('[Notifications] Fallback notification also sent');
        } catch (fallbackError) {
          console.log('[Notifications] Fallback notification failed:', fallbackError);
        }
      }
    } catch (error) {
      console.error('[Notifications] Failed to show notification:', error);
    }
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
    
    // Save the preference if permission was granted
    if (permission === 'granted') {
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
    this.saveNotificationPreference(enabled);
  }

  // Check if notifications were previously enabled
  isNotificationPreferenceEnabled(): boolean {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      // If no preference is saved, default to true (enabled)
      if (saved === null) return true;
      return saved === 'true';
    } catch (error) {
      console.error('[Notifications] Failed to read preference:', error);
      return true; // Default to enabled on error
    }
  }

  // Clear saved preference (sets to false so OFF state persists)
  clearNotificationPreference(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, 'false');
    } catch (error) {
      console.error('[Notifications] Failed to clear preference:', error);
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
        const nativeNotification = new Notification("Native Test! 🏃‍♂️", {
          body: "This is a native browser notification test",
          icon: '/favicon.ico',
          requireInteraction: true
        });
        console.log('[Notifications] Native test notification sent');
      } catch (error) {
        console.error('[Notifications] Native test notification failed:', error);
      }
    }
  }
}

// Notification message generators for different race events
export function generateStartNotification(runnerName: string, legNumber: number, isFirstLeg: boolean = false): NotificationMessage {
  if (isFirstLeg) {
    return {
      title: "And they're off! 🏃‍♂️",
      body: `${runnerName} is leaving Timberline!`,
      data: { type: 'runner_start', legNumber, runnerName, isFirstLeg, timestamp: Date.now() }
    };
  }

  return {
    title: "Runner Started! 🏃‍♂️",
    body: `${runnerName} is running Leg ${legNumber}`,
    data: { type: 'runner_start', legNumber, runnerName, isFirstLeg, timestamp: Date.now() }
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
      title: "Last leg! 🏃‍♂️",
      body: `${finishedRunnerName} hands off to ${nextRunnerName} and they are headed to the sand!`,
      data: { type: 'runner_finish', legNumber: finishedLegNumber, runnerName: finishedRunnerName, isFinalLeg, timestamp: Date.now() }
    };
  }

  if (nextRunnerName && nextLegNumber) {
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

// New function for handoff notifications (combines finish + start)
export function generateHandoffNotification(
  finishedRunnerName: string,
  finishedLegNumber: number,
  nextRunnerName: string,
  nextLegNumber: number
): NotificationMessage {
  return {
    title: "Handoff Complete! 🤝",
    body: `${finishedRunnerName} hands off to ${nextRunnerName} running Leg ${nextLegNumber}!`,
    data: { 
      type: 'handoff', 
      finishedLegNumber, 
      finishedRunnerName, 
      nextLegNumber, 
      nextRunnerName,
      timestamp: Date.now()
    }
  };
}

// Export singleton instance
export const notificationManager = NotificationManager.getInstance();
