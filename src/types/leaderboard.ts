/**
 * Represents a team in the leaderboard (simplified schema)
 */
export interface LeaderboardTeam {
  id: string;
  team_name: string;
  team_start_time: number;
  current_leg: number;
  projected_finish_time: number;
  current_leg_projected_finish: number;
  last_updated_at: string;
  // Derived fields (calculated on-demand)
  progress_percentage?: number;
  status?: 'active' | 'dnf' | 'finished' | 'not_started';
  minutes_remaining_in_current_leg?: number;
}

/**
 * Leaderboard API request parameters
 */
export interface LeaderboardRequest {
  last_update?: string;
  force_refresh?: boolean;
}

/**
 * Leaderboard API response
 */
export interface LeaderboardResponse {
  teams: LeaderboardTeam[];
  last_updated: string;
  meta: {
    calculation_time_ms: number;
    teams_count: number;
    cache_hit_rate?: number;
  };
}

/**
 * Team leaderboard update payload (simplified)
 */
export interface LeaderboardUpdatePayload {
  team_id: string;
  current_leg: number;
  projected_finish_time: number;
  current_leg_projected_finish: number;
  team_start_time?: number; // Optional: actual race start time from dashboard
}

/**
 * Performance monitoring data
 */
export interface PerformanceReport {
  averageResponseTime: number;
  averageCacheHitRate: number;
  totalRequests: number;
  timestamp: string;
}

/**
 * Health check status
 */
export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  error?: string;
  timestamp: string;
}

/**
 * Data validation result
 */
export interface ValidationResult {
  isValid: boolean;
  issues: string[];
  warnings: string[];
}

/**
 * Data repair result
 */
export interface RepairResult {
  repaired: boolean;
  repairs?: string[];
  message: string;
}
