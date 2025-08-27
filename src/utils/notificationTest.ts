// Comprehensive notification testing utility
export interface NotificationTestResult {
  test: string;
  passed: boolean;
  details: string;
  error?: string;
}

export class NotificationTester {
  private results: NotificationTestResult[] = [];

  async runAllTests(): Promise<NotificationTestResult[]> {
    this.results = [];
    
    await this.testBasicSupport();
    await this.testServiceWorker();
    await this.testPermissionFlow();
    await this.testNotificationDisplay();
    await this.testBackgroundNotifications();
    await this.testBrowserSpecificIssues();
    
    return this.results;
  }

  private addResult(test: string, passed: boolean, details: string, error?: string) {
    this.results.push({ test, passed, details, error });
  }

  private async testBasicSupport() {
    try {
      const notificationSupported = 'Notification' in window;
      const serviceWorkerSupported = 'serviceWorker' in navigator;
      
      this.addResult(
        'Basic Support',
        notificationSupported && serviceWorkerSupported,
        `Notification API: ${notificationSupported}, Service Worker: ${serviceWorkerSupported}`,
        notificationSupported && serviceWorkerSupported ? undefined : 'Basic APIs not supported'
      );
    } catch (error) {
      this.addResult('Basic Support', false, 'Error testing basic support', error as string);
    }
  }

  private async testServiceWorker() {
    try {
      if (!('serviceWorker' in navigator)) {
        this.addResult('Service Worker', false, 'Service Worker not supported');
        return;
      }

      const registration = await navigator.serviceWorker.getRegistration();
      const isRegistered = !!registration;
      const isActive = registration?.active ? true : false;
      
      this.addResult(
        'Service Worker',
        isRegistered && isActive,
        `Registered: ${isRegistered}, Active: ${isActive}`,
        isRegistered && isActive ? undefined : 'Service Worker not properly registered or active'
      );
    } catch (error) {
      this.addResult('Service Worker', false, 'Error testing service worker', error as string);
    }
  }

  private async testPermissionFlow() {
    try {
      const currentPermission = Notification.permission;
      
      if (currentPermission === 'default') {
        // Try to request permission
        try {
          const newPermission = await Notification.requestPermission();
          this.addResult(
            'Permission Flow',
            newPermission === 'granted',
            `Permission requested: ${newPermission}`,
            newPermission === 'granted' ? undefined : 'Permission denied by user'
          );
        } catch (error) {
          this.addResult('Permission Flow', false, 'Error requesting permission', error as string);
        }
      } else {
        this.addResult(
          'Permission Flow',
          currentPermission === 'granted',
          `Current permission: ${currentPermission}`,
          currentPermission === 'granted' ? undefined : 'Permission not granted'
        );
      }
    } catch (error) {
      this.addResult('Permission Flow', false, 'Error testing permission flow', error as string);
    }
  }

  private async testNotificationDisplay() {
    try {
      if (Notification.permission !== 'granted') {
        this.addResult('Notification Display', false, 'Permission not granted');
        return;
      }

      // Test basic notification
      const testNotification = new Notification('Test Notification', {
        body: 'This is a test notification',
        icon: '/icon-192.png',
        requireInteraction: false
      });

      // Close it immediately
      setTimeout(() => {
        testNotification.close();
      }, 1000);

      this.addResult(
        'Notification Display',
        true,
        'Test notification created successfully'
      );
    } catch (error) {
      this.addResult('Notification Display', false, 'Error creating test notification', error as string);
    }
  }

  private async testBackgroundNotifications() {
    try {
      if (Notification.permission !== 'granted') {
        this.addResult('Background Notifications', false, 'Permission not granted');
        return;
      }

      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration?.active) {
        this.addResult('Background Notifications', false, 'Service Worker not active');
        return;
      }

      // Test service worker notification
      await registration.showNotification('Background Test', {
        body: 'This is a background test notification',
        icon: '/icon-192.png',
        requireInteraction: false
      });

      this.addResult(
        'Background Notifications',
        true,
        'Background notification created successfully'
      );
    } catch (error) {
      this.addResult('Background Notifications', false, 'Error creating background notification', error as string);
    }
  }

  private async testBrowserSpecificIssues() {
    try {
      const userAgent = navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(userAgent);
      const isAndroid = /Android/.test(userAgent);
      const isChrome = /Chrome/.test(userAgent);
      const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
      const isFirefox = /Firefox/.test(userAgent);
      
      let issues: string[] = [];
      
      // iOS Safari specific issues
      if (isIOS && isSafari) {
        issues.push('iOS Safari has limited notification support');
      }
      
      // Android Chrome specific issues
      if (isAndroid && isChrome) {
        // Check for potential issues
        if (!window.matchMedia('(display-mode: standalone)').matches) {
          issues.push('Android Chrome may require app installation for reliable notifications');
        }
      }
      
      // Firefox specific issues
      if (isFirefox) {
        issues.push('Firefox may have different notification behavior');
      }
      
      // Check for HTTPS requirement
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        issues.push('Notifications require HTTPS (except localhost)');
      }
      
      this.addResult(
        'Browser Compatibility',
        issues.length === 0,
        `Platform: ${isIOS ? 'iOS' : isAndroid ? 'Android' : 'Desktop'}, Browser: ${isChrome ? 'Chrome' : isSafari ? 'Safari' : isFirefox ? 'Firefox' : 'Other'}`,
        issues.length > 0 ? issues.join(', ') : undefined
      );
    } catch (error) {
      this.addResult('Browser Compatibility', false, 'Error testing browser compatibility', error as string);
    }
  }

  // Get a summary of all test results
  getSummary(): { passed: number; total: number; issues: string[] } {
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const issues = this.results
      .filter(r => !r.passed)
      .map(r => `${r.test}: ${r.error || r.details}`);
    
    return { passed, total, issues };
  }

  // Get specific recommendations based on test results
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    
    const basicSupport = this.results.find(r => r.test === 'Basic Support');
    if (basicSupport && !basicSupport.passed) {
      recommendations.push('Your browser does not support notifications. Try updating your browser or using a different one.');
    }
    
    const serviceWorker = this.results.find(r => r.test === 'Service Worker');
    if (serviceWorker && !serviceWorker.passed) {
      recommendations.push('Service Worker is not working. This is required for background notifications.');
    }
    
    const permission = this.results.find(r => r.test === 'Permission Flow');
    if (permission && !permission.passed) {
      recommendations.push('Notification permission is not granted. Please allow notifications in your browser settings.');
    }
    
    const display = this.results.find(r => r.test === 'Notification Display');
    if (display && !display.passed) {
      recommendations.push('Cannot display notifications. Check if notifications are blocked by your browser or system.');
    }
    
    const background = this.results.find(r => r.test === 'Background Notifications');
    if (background && !background.passed) {
      recommendations.push('Background notifications are not working. This may be due to browser restrictions or service worker issues.');
    }
    
    const browser = this.results.find(r => r.test === 'Browser Compatibility');
    if (browser && !browser.passed) {
      recommendations.push('Browser compatibility issues detected. Consider using Chrome or Firefox on desktop, or Chrome on Android.');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('All tests passed! Notifications should be working properly.');
    }
    
    return recommendations;
  }
}

// Export singleton instance
export const notificationTester = new NotificationTester();
