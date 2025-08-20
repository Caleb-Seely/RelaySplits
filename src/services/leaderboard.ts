import { LeaderboardRequest, LeaderboardResponse } from '@/types/leaderboard';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdge } from '@/integrations/supabase/edge';
import type { LeaderboardUpdatePayload } from '@/types/leaderboard';
import { useRaceStore } from '@/store/raceStore';

console.log('🔧 Leaderboard service loaded successfully');

// Configuration for production vs development
const LEADERBOARD_CONFIG = {
  // Set to true to use Edge Functions in production
  USE_EDGE_FUNCTIONS: import.meta.env.PROD && import.meta.env.VITE_USE_EDGE_FUNCTIONS === 'true',
  // Fallback to direct DB access if Edge Functions fail
  FALLBACK_TO_DB: true,
  // Rate limiting settings
  RATE_LIMIT_ENABLED: true,
  MAX_REQUESTS_PER_MINUTE: 30,
  // Cache settings
  CACHE_ENABLED: true,
  CACHE_DURATION_MS: 30000, // 30 seconds
};

// Simple client-side rate limiting
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(): boolean {
  if (!LEADERBOARD_CONFIG.RATE_LIMIT_ENABLED) return true;
  
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = LEADERBOARD_CONFIG.MAX_REQUESTS_PER_MINUTE;
  const clientId = 'leaderboard'; // Simple client identification
  
  // Clean up expired entries
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
  
  const entry = rateLimitStore.get(clientId);
  
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(clientId, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (entry.count >= maxRequests) {
    return false;
  }
  
  entry.count++;
  rateLimitStore.set(clientId, entry);
  return true;
}

// Simple caching
const cacheStore = new Map<string, { data: any; timestamp: number }>();

function getCachedData(key: string): any | null {
  if (!LEADERBOARD_CONFIG.CACHE_ENABLED) return null;
  
  const cached = cacheStore.get(key);
  if (!cached) return null;
  
  const now = Date.now();
  if (now - cached.timestamp > LEADERBOARD_CONFIG.CACHE_DURATION_MS) {
    cacheStore.delete(key);
    return null;
  }
  
  return cached.data;
}

function setCachedData(key: string, data: any): void {
  if (!LEADERBOARD_CONFIG.CACHE_ENABLED) return;
  
  cacheStore.set(key, {
    data,
    timestamp: Date.now()
  });
}

/**
 * Check if user is a team member (has valid team authentication)
 */
async function isTeamMember(): Promise<boolean> {
  try {
    // Check if user has team info in localStorage (this is how the app authenticates team members)
    const storedTeamId = localStorage.getItem('relay_team_id');
    const storedDeviceInfo = localStorage.getItem('relay_device_info');
    
    if (storedTeamId && storedDeviceInfo) {
      console.log('🔐 Team member found via localStorage:', { teamId: storedTeamId });
      return true;
    }
    
    console.log('🔐 No team member authentication found');
    return false;
  } catch (error) {
    console.warn('Team member check failed:', error);
    return false;
  }
}

/**
 * Fetch leaderboard data with team-member-first approach
 * - Team members get Edge Function access (better performance)
 * - Public users get direct DB access (fallback)
 * - Includes caching and rate limiting
 */
export async function fetchLeaderboardData(params?: LeaderboardRequest): Promise<LeaderboardResponse> {
  console.log('🚀 fetchLeaderboardData called');
  
  try {
    // Ensure we have basic authentication for leaderboard access
    const { ensureLeaderboardAccess } = await import('@/services/auth');
    await ensureLeaderboardAccess();
    
    // Rate limiting
    if (!checkRateLimit()) {
      throw new Error('Rate limit exceeded. Please wait before requesting again.');
    }

    // Check cache first
    const cacheKey = `leaderboard-${JSON.stringify(params || {})}`;
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      console.log('📦 Returning cached leaderboard data');
      return cachedData;
    }

    // Check if user is a team member
    const isTeam = await isTeamMember();
    
    if (isTeam) {
      console.log('🔐 Team member - trying Edge Function with team credentials');
      
      // Get team credentials from localStorage
      const storedTeamId = localStorage.getItem('relay_team_id');
      const storedDeviceInfo = localStorage.getItem('relay_device_info');
      const deviceInfo = storedDeviceInfo ? JSON.parse(storedDeviceInfo) : null;
      
      if (storedTeamId && deviceInfo?.deviceId) {
        try {
          console.log('🔐 Calling Edge Function with:', {
            teamId: storedTeamId,
            deviceId: deviceInfo.deviceId,
            params
          });
          
          const { data, error } = await supabase.functions.invoke('leaderboard-data', {
            body: {
              ...params,
              teamId: storedTeamId,
              deviceId: deviceInfo.deviceId
            },
          });

          console.log('🔐 Edge Function response:', { data, error });

          if (error) {
            console.warn('Edge Function failed, falling back to direct access:', error);
            // Don't throw error, just log it and continue to fallback
            console.log('Proceeding to direct database access fallback');
          } else {
            console.log('✅ Edge Function success, returning data');
            // Cache the result
            setCachedData(cacheKey, data);
            return data;
          }

          // Cache the result
          setCachedData(cacheKey, data);
          return data;
        } catch (edgeError) {
          console.warn('Edge Function error, using fallback:', edgeError);
          if (!LEADERBOARD_CONFIG.FALLBACK_TO_DB) {
            throw edgeError;
          }
          // Fall through to direct database access
        }
      } else {
        console.log('🔐 Team member - missing team credentials, using direct DB access');
      }
    } else {
      console.log('👥 Public user - using direct database access');
    }

    // Fallback: Use direct database access with simplified schema
    console.log('📊 Using direct database access');
    const { data: cachedTeams, error } = await supabase
      .from('leaderboard' as any)
      .select(`
        team_id,
        team_name,
        team_start_time,
        current_leg,
        projected_finish_time,
        current_leg_projected_finish,
        last_updated_at
      `)
      .order('projected_finish_time', { ascending: true });

    if (error) {
      console.error('Error fetching leaderboard data:', error);
      throw error;
    }

    console.log(`✅ Found ${cachedTeams?.length || 0} teams in database`);

    // Transform and validate the data to match simplified schema
    const teams = (cachedTeams || []).map((team: any) => {
      const now = Date.now();
      
      // Calculate derived fields
      const progressPercentage = Math.round(((team.current_leg - 1) / 36.0) * 100 * 100) / 100;
      
      let status: 'active' | 'dnf' | 'finished' | 'not_started';
      if (team.current_leg <= 1) {
        status = 'not_started';
      } else if (team.current_leg > 36) {
        status = 'finished';
      } else if (team.projected_finish_time < now - (2 * 60 * 60 * 1000)) {
        status = 'dnf';
      } else {
        status = 'active';
      }
      
      return {
        id: team.team_id,
        team_name: getTeamName(team.team_id),
        team_start_time: team.team_start_time || Date.now(),
        current_leg: team.current_leg || 1,
        projected_finish_time: team.projected_finish_time,
        current_leg_projected_finish: team.projected_finish_time || (Date.now() + 30 * 60 * 1000),
        last_updated_at: team.last_updated_at || team.last_calculated_at || new Date().toISOString(),
        progress_percentage: progressPercentage,
        status: status
      };
    });

    const result = {
      teams: teams,
      last_updated: new Date().toISOString(),
      meta: {
        calculation_time_ms: 50,
        teams_count: teams.length,
        cache_hit_rate: LEADERBOARD_CONFIG.CACHE_ENABLED ? 0 : 100,
        data_source: isTeam ? 'edge_function' : 'direct_db',
        user_type: isTeam ? 'team_member' : 'public'
      }
    };

    // Cache the result
    setCachedData(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error fetching leaderboard data:', error);
    throw error;
  }
}

/**
 * Updates the team's leaderboard entry when a leg is completed
 */
export async function updateTeamLeaderboard(payload: LeaderboardUpdatePayload): Promise<boolean> {
  try {
    console.log('[updateTeamLeaderboard] Sending payload:', JSON.stringify(payload, null, 2));
    console.log('[updateTeamLeaderboard] Payload validation:', {
      team_id: !!payload.team_id,
      current_leg: !!payload.current_leg,
      projected_finish_time: !!payload.projected_finish_time,
      current_leg_projected_finish: !!payload.current_leg_projected_finish,
      team_id_type: typeof payload.team_id,
      current_leg_type: typeof payload.current_leg,
      projected_finish_time_type: typeof payload.projected_finish_time,
      current_leg_projected_finish_type: typeof payload.current_leg_projected_finish
    });
    
    const { data, error } = await invokeEdge('leaderboard-update', payload);

    if (error) {
      console.error('Failed to update leaderboard:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating leaderboard:', error);
    return false;
  }
}

/**
 * Triggers leaderboard update when a leg is completed
 * This should be called whenever a leg's actualFinish time is set
 */
export async function triggerLeaderboardUpdateOnLegComplete(
  teamId: string,
  completedLegId: number,
  finishTime: number
): Promise<boolean> {
  try {
    const state = useRaceStore.getState();
    const { runners, legs, startTime } = state;
    
    // Find the completed leg
    const completedLeg = legs.find(leg => leg.id === completedLegId);
    if (!completedLeg) {
      console.error('Completed leg not found:', completedLegId);
      return false;
    }

    // Calculate current leg (next leg to run)
    const currentLeg = completedLegId + 1;
    
    // Calculate leaderboard data
    const leaderboardData = calculateLeaderboardData(
      teamId,
      '', // Team name will be fetched by the Edge Function
      startTime,
      currentLeg,
      finishTime,
      runners,
      legs
    );

    // Update leaderboard
    return await updateTeamLeaderboard(leaderboardData);
  } catch (error) {
    console.error('Error triggering leaderboard update:', error);
    return false;
  }
}

/**
 * Calculates leaderboard data for a team based on current race state
 */
export function calculateLeaderboardData(
  teamId: string,
  teamName: string,
  teamStartTime: number,
  currentLeg: number,
  lastLegCompletedAt: number,
  runners: any[],
  legs: any[]
): LeaderboardUpdatePayload {
  // Calculate progress percentage (assuming 36 total legs)
  const progressPercentage = Math.round((currentLeg - 1) / 36 * 100 * 100) / 100;
  
  // Calculate projected finish time based on completed legs and average pace
  const projectedFinishTime = calculateProjectedFinishTime(
    teamStartTime,
    currentLeg,
    lastLegCompletedAt,
    runners,
    legs
  );

  // Calculate average pace from completed legs
  const averagePace = calculateAveragePace(legs, currentLeg);

  // Determine status
  const status = determineTeamStatus(currentLeg, lastLegCompletedAt);

  // Get current runner name
  const currentRunner = getCurrentRunner(runners, legs, currentLeg);

  // Calculate current leg projected finish time
  const currentLegProjectedFinish = lastLegCompletedAt + (30 * 60 * 1000); // 30 min estimate for current leg
  
  return {
    team_id: teamId,
    current_leg: currentLeg,
    projected_finish_time: projectedFinishTime,
    current_leg_projected_finish: currentLegProjectedFinish
  };
}

/**
 * Calculates projected finish time based on race progress
 */
function calculateProjectedFinishTime(
  teamStartTime: number,
  currentLeg: number,
  lastLegCompletedAt: number,
  runners: any[],
  legs: any[]
): number {
  if (currentLeg <= 1) {
    // Race hasn't started, use average pace from runners
    const avgPace = runners.reduce((sum, runner) => sum + runner.pace, 0) / runners.length;
    const totalDistance = legs.reduce((sum, leg) => sum + leg.distance, 0);
    return teamStartTime + (totalDistance * avgPace * 1000); // Convert to milliseconds
  }

  // Calculate average pace from completed legs
  const completedLegs = legs.filter(leg => leg.number < currentLeg && leg.actualFinish);
  if (completedLegs.length === 0) {
    return lastLegCompletedAt + (36 - currentLeg + 1) * 30 * 60 * 1000; // 30 min per remaining leg
  }

  const totalCompletedTime = completedLegs.reduce((sum, leg) => {
    return sum + (leg.actualFinish! - leg.actualStart!);
  }, 0);

  const totalCompletedDistance = completedLegs.reduce((sum, leg) => sum + leg.distance, 0);
  const avgPaceSecondsPerMile = totalCompletedTime / totalCompletedDistance;

  // Calculate remaining distance
  const remainingLegs = legs.filter(leg => leg.number >= currentLeg);
  const remainingDistance = remainingLegs.reduce((sum, leg) => sum + leg.distance, 0);

  return lastLegCompletedAt + (remainingDistance * avgPaceSecondsPerMile * 1000);
}

/**
 * Calculates average pace from completed legs
 */
function calculateAveragePace(legs: any[], currentLeg: number): number | undefined {
  const completedLegs = legs.filter(leg => leg.number < currentLeg && leg.actualFinish && leg.actualStart);
  
  if (completedLegs.length === 0) {
    return undefined;
  }

  const totalTime = completedLegs.reduce((sum, leg) => {
    return sum + (leg.actualFinish! - leg.actualStart!);
  }, 0);

  const totalDistance = completedLegs.reduce((sum, leg) => sum + leg.distance, 0);
  
  return Math.round(totalTime / totalDistance);
}

/**
 * Determines team status based on current leg and last completion time
 */
function determineTeamStatus(currentLeg: number, lastLegCompletedAt: number): 'active' | 'dnf' | 'finished' | 'not_started' {
  if (currentLeg <= 1) {
    return 'not_started';
  }

  if (currentLeg > 36) {
    return 'finished';
  }

  // Check for DNF (did not finish) - if last leg was more than 2 hours ago
  const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
  if (lastLegCompletedAt < twoHoursAgo) {
    return 'dnf';
  }

  return 'active';
}

/**
 * Gets the current runner based on current leg
 */
function getCurrentRunner(runners: any[], legs: any[], currentLeg: number): any | null {
  if (currentLeg > 36) {
    return null;
  }

  const currentLegData = legs.find(leg => leg.number === currentLeg);
  if (!currentLegData) {
    return null;
  }

  return runners.find(runner => runner.id === currentLegData.runnerId) || null;
}

/**
 * Get team name from team ID with fallback
 */
function getTeamName(teamId: string): string {
  const teamNames: { [key: string]: string } = {
    '550e8400-e29b-41d4-a716-446655440001': 'Speed Demons',
    '550e8400-e29b-41d4-a716-446655440002': 'Marathon Masters',
    '550e8400-e29b-41d4-a716-446655440003': 'Trail Blazers',
    '550e8400-e29b-41d4-a716-446655440004': 'Endurance Elite',
    '550e8400-e29b-41d4-a716-446655440005': 'Sprint Squad'
  };
  
  return teamNames[teamId] || `Team ${teamId.slice(0, 8)}`;
}

/**
 * Validate and sanitize team status
 */
function validateStatus(status: string): 'active' | 'dnf' | 'finished' | 'not_started' {
  const validStatuses = ['active', 'dnf', 'finished', 'not_started'];
  return validStatuses.includes(status) ? status as any : 'not_started';
}

/**
 * Get progress insights for a team
 */
function getProgressInsights(team: any): string {
  if (team.status === 'finished') return 'Race completed!';
  if (team.status === 'dnf') return 'Did not finish';
  if (team.progress_percentage === 0) return 'Race not started';
  
  const progress = team.progress_percentage;
  if (progress < 25) return 'Early stages';
  if (progress < 50) return 'Quarter way through';
  if (progress < 75) return 'Halfway point';
  if (progress < 90) return 'Final stretch';
  return 'Almost finished!';
}

/**
 * Calculate estimated time to finish
 */
function calculateTimeToFinish(team: any): string {
  if (team.status === 'finished' || team.status === 'dnf') return 'N/A';
  
  const now = Date.now();
  const projectedFinish = team.projected_finish_time;
  
  if (!projectedFinish || projectedFinish <= now) return 'Unknown';
  
  const timeRemaining = projectedFinish - now;
  const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Format finish time for display
 */
export function formatFinishTime(timestamp: number): string {
  if (!timestamp || timestamp === 0) {
    return 'N/A';
  }

  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Sort teams by projected finish time (ascending)
 */
export function sortTeamsByFinishTime(teams: any[]): any[] {
  return [...teams].sort((a, b) => {
    // Handle teams with no projected finish time
    if (!a.projected_finish_time && !b.projected_finish_time) return 0;
    if (!a.projected_finish_time) return 1;
    if (!b.projected_finish_time) return -1;
    
    return a.projected_finish_time - b.projected_finish_time;
  });
}

/**
 * Get status color for team status
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'text-green-600';
    case 'finished':
      return 'text-blue-600';
    case 'dnf':
      return 'text-red-600';
    case 'not_started':
      return 'text-gray-600';
    default:
      return 'text-gray-600';
  }
}

/**
 * Get status badge for team status
 */
export function getStatusBadge(status: string): { text: string; color: string } {
  switch (status) {
    case 'active':
      return { text: 'Active', color: 'bg-green-100 text-green-800' };
    case 'finished':
      return { text: 'Finished', color: 'bg-blue-100 text-blue-800' };
    case 'dnf':
      return { text: 'DNF', color: 'bg-red-100 text-red-800' };
    case 'not_started':
      return { text: 'Not Started', color: 'bg-gray-100 text-gray-800' };
    default:
      return { text: 'Unknown', color: 'bg-gray-100 text-gray-800' };
  }
}

/**
 * Creates initial leaderboard entry for a team after setup is complete
 * Only creates if no entry already exists for the team
 */
export async function createInitialLeaderboardEntry(teamId: string, startTime: number): Promise<boolean> {
  try {
    console.log('[Leaderboard] Creating initial entry for team:', teamId, 'startTime:', startTime);
    
    // Validate inputs
    if (!teamId || typeof teamId !== 'string' || teamId.trim() === '') {
      console.error('[Leaderboard] Invalid teamId:', teamId);
      return false;
    }
    
    // Log startTime validation but don't fail - we have a fallback
    if (!startTime || typeof startTime !== 'number' || isNaN(startTime) || startTime <= 0) {
      console.warn('[Leaderboard] Invalid startTime, will use fallback:', startTime);
    }
    
    // Create new entry with simplified schema using Edge Function
    // Use a fallback startTime if the provided one is invalid
    const validStartTime = startTime && typeof startTime === 'number' && !isNaN(startTime) && startTime > 0 
      ? startTime 
      : Date.now() + (24 * 60 * 60 * 1000); // Fallback to tomorrow
    
    const payload = {
      team_id: teamId,
      current_leg: 1,
      projected_finish_time: validStartTime + (36 * 30 * 60 * 1000), // 30 min per leg estimate
      current_leg_projected_finish: validStartTime + (30 * 60 * 1000) // 30 min for first leg
    };

    // Validate payload before sending
    if (!payload.team_id || !payload.current_leg || !payload.projected_finish_time || !payload.current_leg_projected_finish) {
      console.error('[Leaderboard] Invalid payload created:', payload);
      return false;
    }

    console.log('[Leaderboard] Sending payload:', JSON.stringify(payload, null, 2));

    const success = await updateTeamLeaderboard(payload);
    
    if (success) {
      console.log('[Leaderboard] Initial entry created for team:', teamId);
    } else {
      console.error('[Leaderboard] Failed to create initial entry for team:', teamId);
    }
    
    return success;
  } catch (error) {
    console.error('[Leaderboard] Error creating initial entry:', error);
    return false;
  }
}


