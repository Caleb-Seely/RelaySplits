import { supabase } from './client';
import { rateLimitedFetch, isRateLimited, getRetryDelay } from '@/utils/rateLimiter';

// Minimal validation functions to replace the deleted inputValidation.ts
function validateRunner(body: any): { success: boolean; data?: any; error?: string } {
  try {
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return { success: false, error: 'Name is required' };
    }
    if (body.name.trim().length > 100) {
      return { success: false, error: 'Name too long (max 100 characters)' };
    }
    if (!body.pace || typeof body.pace !== 'string') {
      return { success: false, error: 'Pace is required' };
    }
    if (!body.van || !['1', '2'].includes(body.van)) {
      return { success: false, error: 'Van must be 1 or 2' };
    }
    return { success: true, data: body };
  } catch (error) {
    return { success: false, error: 'Validation failed' };
  }
}

function validateRunnersUpsert(body: any): { success: boolean; data?: any; error?: string } {
  try {
    if (!body.teamId || typeof body.teamId !== 'string') {
      return { success: false, error: 'Team ID is required' };
    }
    if (!body.deviceId || typeof body.deviceId !== 'string') {
      return { success: false, error: 'Device ID is required' };
    }
    if (!Array.isArray(body.runners)) {
      return { success: false, error: 'Runners must be an array' };
    }
    if (body.action && !['upsert', 'delete'].includes(body.action)) {
      return { success: false, error: 'Action must be upsert or delete' };
    }
    
    // Validate each runner in the array
    for (let i = 0; i < body.runners.length; i++) {
      const runner = body.runners[i];
      if (!runner.name || typeof runner.name !== 'string' || runner.name.trim().length === 0) {
        return { success: false, error: `Runner ${i + 1}: Name is required` };
      }
      if (runner.name.trim().length > 100) {
        return { success: false, error: `Runner ${i + 1}: Name too long (max 100 characters)` };
      }
      if (typeof runner.pace !== 'number' || runner.pace <= 0) {
        return { success: false, error: `Runner ${i + 1}: Pace must be a positive number` };
      }
      if (!runner.van || !['1', '2'].includes(runner.van.toString())) {
        return { success: false, error: `Runner ${i + 1}: Van must be 1 or 2` };
      }
    }
    
    return { success: true, data: body };
  } catch (error) {
    return { success: false, error: 'Validation failed' };
  }
}

function validateLeg(body: any): { success: boolean; data?: any; error?: string } {
  try {
    if (!body.distance || typeof body.distance !== 'number' || body.distance <= 0) {
      return { success: false, error: 'Distance must be a positive number' };
    }
    if (body.distance > 100) {
      return { success: false, error: 'Distance too long (max 100 miles)' };
    }
    return { success: true, data: body };
  } catch (error) {
    return { success: false, error: 'Validation failed' };
  }
}

function validateLegsUpsert(body: any): { success: boolean; data?: any; error?: string } {
  try {
    if (!body.teamId || typeof body.teamId !== 'string') {
      return { success: false, error: 'Team ID is required' };
    }
    if (!body.deviceId || typeof body.deviceId !== 'string') {
      return { success: false, error: 'Device ID is required' };
    }
    if (!Array.isArray(body.legs)) {
      return { success: false, error: 'Legs must be an array' };
    }
    if (body.action && !['upsert', 'delete'].includes(body.action)) {
      return { success: false, error: 'Action must be upsert or delete' };
    }
    
    // Validate each leg in the array
    for (let i = 0; i < body.legs.length; i++) {
      const leg = body.legs[i];
      if (typeof leg.number !== 'number' || leg.number <= 0) {
        return { success: false, error: `Leg ${i + 1}: Number must be a positive number` };
      }
      if (typeof leg.distance !== 'number' || leg.distance <= 0) {
        return { success: false, error: `Leg ${i + 1}: Distance must be a positive number` };
      }
      if (leg.distance > 100) {
        return { success: false, error: `Leg ${i + 1}: Distance too long (max 100 miles)` };
      }
      // runner_id is optional for legs
    }
    
    return { success: true, data: body };
  } catch (error) {
    return { success: false, error: 'Validation failed' };
  }
}

function validateTeam(body: any): { success: boolean; data?: any; error?: string } {
  try {
    // Only validate name if it's being provided (for updates, name might not be included)
    if (body.name !== undefined) {
      if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
        return { success: false, error: 'Team name is required' };
      }
      if (body.name.trim().length > 100) {
        return { success: false, error: 'Team name too long (max 100 characters)' };
      }
    }
    // Make start_time optional to avoid validation errors for teams-create
    if (body.start_time !== undefined) {
      // Handle both ISO date strings and timestamp numbers
      let startTime: number;
      if (typeof body.start_time === 'string') {
        // If it's a string, try to parse it as a date
        const date = new Date(body.start_time);
        if (isNaN(date.getTime())) {
          return { success: false, error: 'Invalid start_time format. Must be a valid ISO date string or timestamp' };
        }
        startTime = date.getTime();
      } else {
        // If it's already a number, use it directly
        startTime = Number(body.start_time);
      }
      
      if (isNaN(startTime) || startTime <= 0) {
        return { success: false, error: 'Start time must be a positive number' };
      }
    }
    return { success: true, data: body };
  } catch (error) {
    return { success: false, error: 'Validation failed' };
  }
}

export async function invokeEdge<T = any>(name: string, body: Record<string, any>) {
  // Only log API calls in development and not for routine operations
  if (process.env.NODE_ENV === 'development' && !name.includes('ping')) {
    console.log(`[invokeEdge] Calling ${name} with body:`, body);
  }
  
  try {
    // Validate input data based on the function being called
    const validationResult = validateEdgeFunctionInput(name, body);
    if (!validationResult.success) {
      console.error(`[invokeEdge] Validation failed for ${name}:`, validationResult.error);
      return { error: { message: `Validation failed: ${validationResult.error}` } };
    }

    // Use rate-limited fetch
    const response = await rateLimitedFetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(validationResult.data)
    });

    // Only log response status for non-routine operations
    if (process.env.NODE_ENV === 'development' && !name.includes('ping')) {
      console.log(`[invokeEdge] ${name} response status:`, response.status);
    }

    // Handle rate limiting
    if (isRateLimited(response)) {
      const retryDelay = getRetryDelay(response);
      console.warn(`[invokeEdge] Rate limited for ${name}, retry after ${retryDelay}ms`);
      return { error: { message: 'Rate limit exceeded. Please try again later.', retryAfter: retryDelay } };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error(`[invokeEdge] ${name} failed:`, errorData);
      return { error: errorData };
    }

    const data = await response.json();
    // Only log success for non-routine operations
    if (process.env.NODE_ENV === 'development' && !name.includes('ping')) {
      console.log(`[invokeEdge] ${name} success:`, data);
    }
    return { data: data as T };

  } catch (e) {
    console.error(`[invokeEdge] Exception calling ${name}:`, e);
    return { error: { message: 'Network error', details: e } };
  }
}

// Validate input data for edge functions
function validateEdgeFunctionInput(name: string, body: any): { success: boolean; data?: any; error?: string } {
  try {
    switch (name) {
      case 'runners-upsert':
        return validateRunnersUpsert(body);
      
      case 'legs-upsert':
        return validateLegsUpsert(body);
      
      case 'teams-create':
        // teams-create only sends name, admin_display_name, and device_profile
        // start_time is set by the server, so we don't validate it here
        if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
          return { success: false, error: 'Team name is required' };
        }
        if (body.name.trim().length > 100) {
          return { success: false, error: 'Team name too long (max 100 characters)' };
        }
        if (body.admin_display_name && typeof body.admin_display_name !== 'string') {
          return { success: false, error: 'Invalid admin display name' };
        }
        if (body.device_profile && typeof body.device_profile !== 'object') {
          return { success: false, error: 'Invalid device profile' };
        }
        return { success: true, data: body };
      
      case 'teams-update':
        return validateTeam(body);
      
      case 'teams-join':
        if (!body.invite_token || typeof body.invite_token !== 'string') {
          return { success: false, error: 'Invalid invite token' };
        }
        return { success: true, data: body };
      
      case 'teams-view':
        if (!body.viewer_code || typeof body.viewer_code !== 'string') {
          return { success: false, error: 'Invalid viewer code' };
        }
        return { success: true, data: body };
      
      case 'runners-list':
      case 'legs-list':
        if (!body.teamId || typeof body.teamId !== 'string') {
          return { success: false, error: 'Invalid team ID' };
        }
        return { success: true, data: body };
      
      case 'leaderboard-update':
        // Validate leaderboard update payload
        if (!body.team_id || typeof body.team_id !== 'string' || body.team_id.trim() === '') {
          return { success: false, error: 'Invalid team_id' };
        }
        if (!body.current_leg || typeof body.current_leg !== 'number' || body.current_leg <= 0) {
          return { success: false, error: 'Invalid current_leg' };
        }
        if (!body.projected_finish_time || typeof body.projected_finish_time !== 'number' || body.projected_finish_time <= 0) {
          return { success: false, error: 'Invalid projected_finish_time' };
        }
        if (!body.current_leg_projected_finish || typeof body.current_leg_projected_finish !== 'number' || body.current_leg_projected_finish <= 0) {
          return { success: false, error: 'Invalid current_leg_projected_finish' };
        }
        return { success: true, data: body };
      
      default:
        // For unknown functions, do basic validation
        if (typeof body !== 'object' || body === null) {
          return { success: false, error: 'Invalid request body' };
        }
        return { success: true, data: body };
    }
  } catch (error) {
    return { success: false, error: `Validation error: ${(error as Error).message}` };
  }
}

// Ensure we always have a stable deviceId for Edge Functions
export function getDeviceId(): string {
  // First check if we have device info with a registered device ID
  try {
    const deviceInfo = JSON.parse(localStorage.getItem('relay_device_info') || '{}');
    if (deviceInfo.deviceId) {
      return deviceInfo.deviceId;
    }
  } catch (error) {
    console.warn('[getDeviceId] Error parsing device info:', error);
  }
  
  // Fall back to the legacy relay_device_id
  const key = 'relay_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}
