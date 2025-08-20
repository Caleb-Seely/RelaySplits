import { 
  AnalyticsEvent, 
  PageViewEvent, 
  UserEvent, 
  PerformanceEvent, 
  ErrorEvent,
  EVENT_CATEGORIES,
  EVENT_ACTIONS,
  CustomEventParams
} from '@/types/analytics';

// Global gtag function type
declare global {
  interface Window {
    gtag: (
      command: 'config' | 'event' | 'set' | 'js',
      targetId: string,
      config?: Record<string, any>
    ) => void;
    dataLayer: any[];
  }
}

class AnalyticsService {
  private isInitialized = false;
  private isEnabled = true;
  private userId?: string;
  private sessionId: string;
  private environment: string;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.environment = import.meta.env.MODE || 'development';
    this.isEnabled = import.meta.env.PROD || import.meta.env.VITE_ENABLE_ANALYTICS === 'true';
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDeviceInfo() {
    const userAgent = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isTablet = /iPad|Android(?=.*\bMobile\b)(?=.*\bSafari\b)/i.test(userAgent);
    
    let deviceType: 'mobile' | 'desktop' | 'tablet' = 'desktop';
    if (isMobile) deviceType = 'mobile';
    else if (isTablet) deviceType = 'tablet';

    return {
      device_type: deviceType,
      browser: this.getBrowserInfo(),
      os: this.getOSInfo(),
      screen_resolution: `${screen.width}x${screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`
    };
  }

  private getBrowserInfo(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Unknown';
  }

  private getOSInfo(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    return 'Unknown';
  }

  private getAppInfo(): Record<string, string> {
    return {
      app_version: import.meta.env.VITE_APP_VERSION || '1.0.0',
      build_number: import.meta.env.VITE_BUILD_NUMBER || '1',
      environment: this.environment
    };
  }

  private mergeCustomParams(params?: CustomEventParams): Record<string, any> {
    const baseParams = {
      ...this.getDeviceInfo(),
      ...this.getAppInfo(),
      session_id: this.sessionId,
      timestamp: Date.now()
    };

    if (this.userId) {
      baseParams.user_id = this.userId;
    }

    return { ...baseParams, ...params };
  }

  // Initialize analytics
  init(userId?: string): void {
    if (!this.isEnabled || this.isInitialized) return;

    this.userId = userId;
    this.isInitialized = true;

    // Set user ID if provided
    if (userId && window.gtag) {
      window.gtag('config', 'G-E4PBDFCZQ5', {
        user_id: userId
      });
    }

    // Track session start
    this.trackEvent({
      event: EVENT_ACTIONS.SESSION_START,
      category: EVENT_CATEGORIES.USER_ENGAGEMENT,
      custom_parameters: {
        session_id: this.sessionId
      }
    });

    console.log('[Analytics] Initialized', { userId, sessionId: this.sessionId });
  }

  // Track custom events
  trackEvent(event: AnalyticsEvent): void {
    if (!this.isEnabled || !window.gtag) return;

    try {
      const eventParams = {
        event_category: event.category || 'general',
        event_label: event.label,
        value: event.value,
        ...this.mergeCustomParams(event.custom_parameters)
      };

      window.gtag('event', event.event, eventParams);

      if (import.meta.env.DEV) {
        console.log('[Analytics] Event tracked:', event.event, eventParams);
      }
    } catch (error) {
      console.error('[Analytics] Failed to track event:', error);
    }
  }

  // Track page views
  trackPageView(pageData: PageViewEvent): void {
    if (!this.isEnabled || !window.gtag) return;

    try {
      window.gtag('config', 'G-E4PBDFCZQ5', {
        page_title: pageData.page_title,
        page_location: pageData.page_location,
        page_path: pageData.page_path,
        ...this.mergeCustomParams()
      });

      if (import.meta.env.DEV) {
        console.log('[Analytics] Page view tracked:', pageData);
      }
    } catch (error) {
      console.error('[Analytics] Failed to track page view:', error);
    }
  }

  // Track performance metrics
  trackPerformance(metric: PerformanceEvent): void {
    this.trackEvent({
      event: EVENT_ACTIONS.LOAD_TIME,
      category: EVENT_CATEGORIES.PERFORMANCE,
      label: metric.metric_name,
      value: metric.value,
      custom_parameters: {
        metric_name: metric.metric_name,
        unit: metric.unit || 'ms'
      }
    });
  }

  // Track errors
  trackError(error: ErrorEvent): void {
    this.trackEvent({
      event: EVENT_ACTIONS.JAVASCRIPT_ERROR,
      category: EVENT_CATEGORIES.ERROR,
      label: error.error_type,
      value: error.fatal ? 1 : 0,
      custom_parameters: {
        error_message: error.error_message,
        error_stack: error.error_stack,
        error_type: error.error_type,
        fatal: error.fatal,
        ...error.context
      }
    });
  }

  // Track API calls
  trackAPICall(endpoint: string, method: string, duration: number, success: boolean): void {
    this.trackEvent({
      event: EVENT_ACTIONS.API_CALL,
      category: EVENT_CATEGORIES.PERFORMANCE,
      label: `${method} ${endpoint}`,
      value: duration,
      custom_parameters: {
        endpoint,
        method,
        success,
        api_response_time_ms: duration
      }
    });
  }

  // Track feature usage
  trackFeatureUsage(feature: string, action: string, params?: CustomEventParams): void {
    this.trackEvent({
      event: action,
      category: EVENT_CATEGORIES.FEATURE_USAGE,
      label: feature,
      custom_parameters: {
        feature_name: feature,
        ...params
      }
    });
  }

  // Track business events
  trackBusinessEvent(event: string, params?: CustomEventParams): void {
    this.trackEvent({
      event,
      category: EVENT_CATEGORIES.BUSINESS,
      custom_parameters: params
    });
  }

  // Set user properties
  setUserProperties(properties: Record<string, any>): void {
    if (!this.isEnabled || !window.gtag) return;

    try {
      window.gtag('set', 'user_properties', properties);
    } catch (error) {
      console.error('[Analytics] Failed to set user properties:', error);
    }
  }

  // Set user ID
  setUserId(userId: string): void {
    this.userId = userId;
    if (window.gtag) {
      window.gtag('config', 'G-E4PBDFCZQ5', {
        user_id: userId
      });
    }
  }

  // Track session end
  trackSessionEnd(): void {
    this.trackEvent({
      event: EVENT_ACTIONS.SESSION_END,
      category: EVENT_CATEGORIES.USER_ENGAGEMENT,
      custom_parameters: {
        session_id: this.sessionId
      }
    });
  }

  // Enable/disable analytics
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  // Get current state
  getState() {
    return {
      isInitialized: this.isInitialized,
      isEnabled: this.isEnabled,
      userId: this.userId,
      sessionId: this.sessionId,
      environment: this.environment
    };
  }
}

// Create singleton instance
export const analytics = new AnalyticsService();

// Export convenience functions
export const trackEvent = (event: AnalyticsEvent) => analytics.trackEvent(event);
export const trackPageView = (pageData: PageViewEvent) => analytics.trackPageView(pageData);
export const trackPerformance = (metric: PerformanceEvent) => analytics.trackPerformance(metric);
export const trackError = (error: ErrorEvent) => analytics.trackError(error);
export const trackAPICall = (endpoint: string, method: string, duration: number, success: boolean) => 
  analytics.trackAPICall(endpoint, method, duration, success);
export const trackFeatureUsage = (feature: string, action: string, params?: CustomEventParams) => 
  analytics.trackFeatureUsage(feature, action, params);
export const trackBusinessEvent = (event: string, params?: CustomEventParams) => 
  analytics.trackBusinessEvent(event, params);
