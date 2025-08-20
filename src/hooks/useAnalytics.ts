import { useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  analytics, 
  trackEvent, 
  trackPageView, 
  trackPerformance, 
  trackError, 
  trackAPICall, 
  trackFeatureUsage, 
  trackBusinessEvent 
} from '@/services/analytics';
import { 
  EVENT_CATEGORIES, 
  EVENT_ACTIONS, 
  AnalyticsEvent, 
  PageViewEvent, 
  PerformanceEvent, 
  ErrorEvent, 
  CustomEventParams 
} from '@/types/analytics';

// Hook for automatic page view tracking
export function usePageViewTracking() {
  const location = useLocation();

  useEffect(() => {
    const pageData: PageViewEvent = {
      page_title: document.title,
      page_location: window.location.href,
      page_path: location.pathname
    };

    trackPageView(pageData);
  }, [location]);
}

// Hook for session tracking
export function useSessionTracking() {
  useEffect(() => {
    const handleBeforeUnload = () => {
      analytics.trackSessionEnd();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
}

// Hook for feature usage tracking
export function useFeatureTracking() {
  const trackFeature = useCallback((feature: string, action: string, params?: CustomEventParams) => {
    trackFeatureUsage(feature, action, params);
  }, []);

  const trackBusiness = useCallback((event: string, params?: CustomEventParams) => {
    trackBusinessEvent(event, params);
  }, []);

  const trackCustom = useCallback((event: AnalyticsEvent) => {
    trackEvent(event);
  }, []);

  return {
    trackFeature,
    trackBusiness,
    trackCustom
  };
}

// Hook for error tracking
export function useErrorTracking() {
  const trackErrorEvent = useCallback((error: Error | string, context?: Record<string, any>) => {
    const errorEvent: ErrorEvent = {
      error_message: typeof error === 'string' ? error : error.message,
      error_stack: typeof error === 'string' ? undefined : error.stack,
      error_type: typeof error === 'string' ? 'string_error' : error.constructor.name,
      fatal: false,
      context
    };

    trackError(errorEvent);
  }, []);

  return { trackErrorEvent };
}

// Hook for performance tracking
export function usePerformanceTracking() {
  const trackPerformanceMetric = useCallback((metric: PerformanceEvent) => {
    trackPerformance(metric);
  }, []);

  const trackAPICallMetric = useCallback((endpoint: string, method: string, duration: number, success: boolean) => {
    trackAPICall(endpoint, method, duration, success);
  }, []);

  return {
    trackPerformanceMetric,
    trackAPICallMetric
  };
}

// Hook for user context
export function useUserTracking() {
  const setUserId = useCallback((userId: string) => {
    analytics.setUserId(userId);
  }, []);

  const setUserProperties = useCallback((properties: Record<string, any>) => {
    analytics.setUserProperties(properties);
  }, []);

  return {
    setUserId,
    setUserProperties
  };
}

// Main analytics hook that combines all functionality
export function useAnalytics() {
  usePageViewTracking();
  useSessionTracking();

  const { trackFeature, trackBusiness, trackCustom } = useFeatureTracking();
  const { trackErrorEvent } = useErrorTracking();
  const { trackPerformanceMetric, trackAPICallMetric } = usePerformanceTracking();
  const { setUserId, setUserProperties } = useUserTracking();

  return {
    // Event tracking
    trackEvent: trackCustom,
    trackFeature,
    trackBusiness,
    
    // Error tracking
    trackError: trackErrorEvent,
    
    // Performance tracking
    trackPerformance: trackPerformanceMetric,
    trackAPICall: trackAPICallMetric,
    
    // User management
    setUserId,
    setUserProperties,
    
    // Utility functions
    getState: () => analytics.getState(),
    setEnabled: (enabled: boolean) => analytics.setEnabled(enabled)
  };
}

// SPECIFIC HOOKS FOR YOUR EVENTS

// Hook for setup and race events
export function useRaceTracking() {
  const { trackBusiness } = useFeatureTracking();
  
  return {
    trackSetupCompleted: (params?: CustomEventParams) => 
      trackBusiness(EVENT_ACTIONS.SETUP_COMPLETED, params),
    trackRaceStarted: (params?: CustomEventParams) => 
      trackBusiness(EVENT_ACTIONS.RACE_STARTED, params),
    trackRaceCompleted: (params?: CustomEventParams) => 
      trackBusiness(EVENT_ACTIONS.RACE_COMPLETED, params),
    trackTeamCreated: (params?: CustomEventParams) => 
      trackBusiness(EVENT_ACTIONS.TEAM_CREATED, params),
    trackRunnerAdded: (params?: CustomEventParams) => 
      trackBusiness(EVENT_ACTIONS.RUNNER_ADDED, params),
    trackLegCompleted: (params?: CustomEventParams) => 
      trackBusiness(EVENT_ACTIONS.LEG_COMPLETED, params),
    trackVanSwitched: (params?: CustomEventParams) => 
      trackBusiness(EVENT_ACTIONS.VAN_SWITCHED, params),
    trackTeamSizeFinalized: (params?: CustomEventParams) => 
      trackBusiness(EVENT_ACTIONS.TEAM_SIZE_FINALIZED, params),
    trackRaceDurationRecorded: (params?: CustomEventParams) => 
      trackBusiness(EVENT_ACTIONS.RACE_DURATION_RECORDED, params)
  };
}

// Hook for feature usage
export function useFeatureUsageTracking() {
  const { trackFeature } = useFeatureTracking();
  
  return {
    trackSpreadsheetImportUsed: (params?: CustomEventParams) => 
      trackFeature('spreadsheet_import', EVENT_ACTIONS.SPREADSHEET_IMPORT_USED, params),
    trackPaceOverrideUsed: (params?: CustomEventParams) => 
      trackFeature('pace_override', EVENT_ACTIONS.PACE_OVERRIDE_USED, params),
    trackConfettiTest: (params?: CustomEventParams) => 
      trackFeature('confetti', EVENT_ACTIONS.CONFETTI_TEST, params),
    trackCelebrationButtonClicked: (params?: CustomEventParams) => 
      trackFeature('celebration', EVENT_ACTIONS.CELEBRATION_BUTTON_CLICKED, params),
    trackOfflineModeUsed: (params?: CustomEventParams) => 
      trackFeature('offline_mode', EVENT_ACTIONS.OFFLINE_MODE_USED, params),
    trackNotificationSent: (params?: CustomEventParams) => 
      trackFeature('notification', EVENT_ACTIONS.NOTIFICATION_SENT, params),
    trackQuickHelpUsed: (params?: CustomEventParams) => 
      trackFeature('quick_help', EVENT_ACTIONS.QUICK_HELP_USED, params),
    trackSettingsAccessed: (params?: CustomEventParams) => 
      trackFeature('settings', EVENT_ACTIONS.SETTINGS_ACCESSED, params),
    trackExportUsed: (params?: CustomEventParams) => 
      trackFeature('export', EVENT_ACTIONS.EXPORT_USED, params)
  };
}

// Hook for technical events
export function useTechnicalTracking() {
  const { trackErrorEvent } = useErrorTracking();
  const { trackFeature } = useFeatureTracking();
  
  return {
    trackSyncError: (error: Error | string, params?: CustomEventParams) => {
      trackErrorEvent(error, { ...params, error_source: 'sync' });
      trackFeature('sync', EVENT_ACTIONS.SYNC_ERROR, params);
    },
    trackImportCrash: (error: Error | string, params?: CustomEventParams) => {
      trackErrorEvent(error, { ...params, error_source: 'import' });
      trackFeature('import', EVENT_ACTIONS.IMPORT_CRASH, params);
    },
    trackConflictResolved: (params?: CustomEventParams) => 
      trackFeature('conflict_resolution', EVENT_ACTIONS.CONFLICT_RESOLVED, params)
  };
}

// Hook for PWA events
export function usePWATracking() {
  const { trackFeature } = useFeatureTracking();
  
  return {
    trackInstallPromptShown: (params?: CustomEventParams) => 
      trackFeature('pwa', EVENT_ACTIONS.INSTALL_PROMPT_SHOWN, params),
    trackInstallSuccess: (params?: CustomEventParams) => 
      trackFeature('pwa', EVENT_ACTIONS.INSTALL_SUCCESS, params)
  };
}

// Hook for session duration tracking
export function useSessionDurationTracking() {
  const { trackPerformanceMetric } = usePerformanceTracking();
  
  const trackSessionDuration = useCallback((durationMs: number) => {
    trackPerformanceMetric({
      metric_name: EVENT_ACTIONS.SESSION_DURATION,
      value: durationMs,
      unit: 'ms'
    });
  }, [trackPerformanceMetric]);

  return { trackSessionDuration };
}
