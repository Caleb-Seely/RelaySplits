// Analytics configuration
export const ANALYTICS_CONFIG = {
  // Google Analytics
  GA_MEASUREMENT_ID: 'G-E4PBDFCZQ5',
  
  // Sentry (set in environment variables)
  SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
  
  // Feature flags
  ENABLE_ANALYTICS: import.meta.env.PROD || import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  ENABLE_SENTRY: import.meta.env.PROD || import.meta.env.VITE_SENTRY_DEV_ENABLED === 'true',
  ENABLE_PERFORMANCE_MONITORING: import.meta.env.PROD || import.meta.env.VITE_ENABLE_PERFORMANCE === 'true',
  
  // Sampling rates
  SENTRY_TRACES_SAMPLE_RATE: import.meta.env.PROD ? 0.1 : 1.0,
  SENTRY_REPLAYS_SAMPLE_RATE: import.meta.env.PROD ? 0.1 : 1.0,
  
  // Performance thresholds
  PERFORMANCE_THRESHOLDS: {
    CLS: { good: 0.1, poor: 0.25 },
    FID: { good: 100, poor: 300 },
    FCP: { good: 1800, poor: 3000 },
    LCP: { good: 2500, poor: 4000 },
    TTFB: { good: 800, poor: 1800 }
  },
  
  // Event categories to track
  TRACKED_CATEGORIES: [
    'user_engagement',
    'feature_usage', 
    'performance',
    'error',
    'business',
    'onboarding',
    'sync',
    'pwa'
  ],
  
  // Sensitive data that should not be tracked
  SENSITIVE_FIELDS: [
    'password',
    'token',
    'secret',
    'key',
    'auth',
    'private'
  ],
  
  // Custom dimensions and metrics
  CUSTOM_DIMENSIONS: {
    USER_ID: 'user_id',
    TEAM_ID: 'team_id',
    RACE_ID: 'race_id',
    RUNNER_ID: 'runner_id',
    DEVICE_TYPE: 'device_type',
    BROWSER: 'browser',
    OS: 'os',
    APP_VERSION: 'app_version',
    ENVIRONMENT: 'environment'
  },
  
  CUSTOM_METRICS: {
    SESSION_DURATION: 'session_duration',
    RACE_DURATION: 'race_duration',
    TEAM_SIZE: 'team_size',
    API_RESPONSE_TIME: 'api_response_time',
    LOAD_TIME: 'load_time'
  }
};

// Environment-specific settings
export const getAnalyticsConfig = () => {
  const isProduction = import.meta.env.PROD;
  const isDevelopment = import.meta.env.DEV;
  
  return {
    ...ANALYTICS_CONFIG,
    // Override settings based on environment
    ENABLE_ANALYTICS: isProduction || ANALYTICS_CONFIG.ENABLE_ANALYTICS,
    ENABLE_SENTRY: isProduction || ANALYTICS_CONFIG.ENABLE_SENTRY,
    ENABLE_PERFORMANCE_MONITORING: isProduction || ANALYTICS_CONFIG.ENABLE_PERFORMANCE_MONITORING,
    
    // Debug mode for development
    DEBUG: isDevelopment,
    
    // Sampling rates for development
    SENTRY_TRACES_SAMPLE_RATE: isProduction ? 0.1 : 1.0,
    SENTRY_REPLAYS_SAMPLE_RATE: isProduction ? 0.1 : 1.0
  };
};
