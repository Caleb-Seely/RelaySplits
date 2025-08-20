// Analytics event types and interfaces
export interface AnalyticsEvent {
  event: string;
  category?: string;
  action?: string;
  label?: string;
  value?: number;
  custom_parameters?: Record<string, any>;
}

export interface PageViewEvent {
  page_title: string;
  page_location: string;
  page_path: string;
}

export interface UserEvent {
  user_id?: string;
  team_id?: string;
  race_id?: string;
  runner_id?: string;
}

export interface PerformanceEvent {
  metric_name: string;
  value: number;
  unit?: string;
}

export interface ErrorEvent {
  error_message: string;
  error_stack?: string;
  error_type: string;
  fatal: boolean;
  context?: Record<string, any>;
}

// Predefined event categories
export const EVENT_CATEGORIES = {
  USER_ENGAGEMENT: 'user_engagement',
  FEATURE_USAGE: 'feature_usage',
  PERFORMANCE: 'performance',
  ERROR: 'error',
  BUSINESS: 'business',
  ONBOARDING: 'onboarding',
  SYNC: 'sync',
  PWA: 'pwa'
} as const;

// Predefined event actions - FOCUSED ON YOUR SPECIFIC NEEDS
export const EVENT_ACTIONS = {
  // Page views (handled automatically)
  PAGE_VIEW: 'page_view',
  
  // Session tracking
  SESSION_START: 'session_start',
  SESSION_END: 'session_end',
  
  // Critical business events
  SETUP_COMPLETED: 'setup_completed',
  RACE_STARTED: 'race_started',
  RACE_COMPLETED: 'race_completed',
  TEAM_CREATED: 'team_created',
  
  // Feature usage
  SPREADSHEET_IMPORT_USED: 'spreadsheet_import_used',
  PACE_OVERRIDE_USED: 'pace_override_used',
  CONFETTI_TEST: 'confetti_test',
  CELEBRATION_BUTTON_CLICKED: 'celebration_button_clicked',
  
  // Sync and technical
  SYNC_ERROR: 'sync_error',
  IMPORT_CRASH: 'import_crash',
  CONFLICT_RESOLVED: 'conflict_resolved',
  
  // PWA features
  INSTALL_PROMPT_SHOWN: 'install_prompt_shown',
  INSTALL_SUCCESS: 'install_success',
  
  // Additional valuable events
  RUNNER_ADDED: 'runner_added',
  LEG_COMPLETED: 'leg_completed',
  VAN_SWITCHED: 'van_switched',
  OFFLINE_MODE_USED: 'offline_mode_used',
  NOTIFICATION_SENT: 'notification_sent',
  
  // Performance
  SESSION_DURATION: 'session_duration',
  
  // Additional valuable events for insights
  TEAM_SIZE_FINALIZED: 'team_size_finalized',
  RACE_DURATION_RECORDED: 'race_duration_recorded',
  QUICK_HELP_USED: 'quick_help_used',
  SETTINGS_ACCESSED: 'settings_accessed',
  EXPORT_USED: 'export_used'
} as const;

// Custom event parameters
export interface CustomEventParams {
  // User context
  user_id?: string;
  team_id?: string;
  race_id?: string;
  runner_id?: string;
  
  // Feature context
  feature_name?: string;
  feature_version?: string;
  
  // Performance context
  load_time_ms?: number;
  api_response_time_ms?: number;
  session_duration_ms?: number;
  
  // Error context
  error_code?: string;
  error_details?: string;
  error_source?: string;
  
  // Business context
  race_type?: string;
  team_size?: number;
  race_duration?: number;
  leg_number?: number;
  van_number?: number;
  
  // Device context
  device_type?: 'mobile' | 'desktop' | 'tablet';
  browser?: string;
  os?: string;
  
  // App context
  app_version?: string;
  build_number?: string;
  environment?: 'development' | 'staging' | 'production';
  
  // Sync context
  sync_method?: string;
  conflict_type?: string;
  offline_queue_size?: number;
  
  // Import context
  import_file_type?: string;
  import_row_count?: number;
  import_error_count?: number;
}
