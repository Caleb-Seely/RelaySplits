
import { format } from 'date-fns';
import type { Leg, Runner, RaceStatus } from '@/types/race';
import { LEG_DISTANCES, MAJOR_EXCHANGES, getLegDirectionsUrl } from '@/utils/legData';

/**
 * Standard Hood to Coast relay race distances for all 36 legs (in miles).
 * These are the official distances used in the Hood to Coast relay race.
 * Teams can customize these distances for other relay races.
 */
export const DEFAULT_LEG_DISTANCES = LEG_DISTANCES;



/**
 * Parses a pace string and converts it to seconds per mile.
 * @param pace - Pace string in format "MM:SS" or just minutes as a number
 * @returns Total seconds per mile
 * @throws Error if the pace format is invalid
 * @example
 * parsePace("7:30") // returns 450 (7 minutes 30 seconds = 450 seconds)
 * parsePace("7") // returns 420 (7 minutes = 420 seconds)
 */
export function parsePace(pace: string): number {
  const cleanPace = pace.trim();
  
  if (cleanPace.includes(':')) {
    const [minutes, seconds] = cleanPace.split(':').map(Number);
    if (isNaN(minutes) || isNaN(seconds) || minutes < 0 || seconds < 0 || seconds >= 60) {
      throw new Error('Invalid pace format');
    }
    return (minutes * 60) + (seconds || 0);
  } else {
    // If just a number, assume it's minutes
    const minutes = parseInt(cleanPace);
    if (isNaN(minutes) || minutes < 0) {
      throw new Error('Invalid pace format');
    }
    return minutes * 60;
  }
}

/**
 * Formats pace in MM:SS format, rounding seconds to whole numbers.
 * @param seconds - Total seconds per mile
 * @returns Formatted pace string (e.g., "7:30")
 * @example
 * formatPace(450) // returns "7:30"
 */
export function formatPace(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formats a timestamp into a time string with AM/PM.
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted time string (e.g., "2:30:45 PM")
 */
export function formatTime(timestamp: number): string {
  return format(new Date(timestamp), 'h:mm:ss a');
}

/**
 * Formats a timestamp into a time string with AM/PM (no seconds).
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted time string (e.g., "2:30 PM")
 */
export function formatRaceTime(timestamp: number): string {
  return format(new Date(timestamp), 'h:mm a');
}

/**
 * Formats a timestamp into a date and time string.
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted date/time string (e.g., "Jan 15, 2:30:45 PM")
 */
export function formatDateTime(timestamp: number): string {
  return format(new Date(timestamp), 'MMM d, h:mm:ss a');
}

/**
 * Formats a timestamp into a date-only string.
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted date string (e.g., "Tue, Aug 13, 2025")
 */
export function formatDate(timestamp: number): string {
  return format(new Date(timestamp), 'EEE, MMM d, yyyy');
}

/**
 * Formats a duration in milliseconds to a readable time string.
 * @param milliseconds - Duration in milliseconds
 * @returns Formatted duration string (e.g., "1:23:45" or "23:45")
 */
export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatCountdown(milliseconds: number): string {
  if (milliseconds <= 0) return 'now';
  
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}

export function calculateProjectedFinish(startTime: number, pace: number, distance: number): number {
  const runTimeMs = (pace * distance) * 1000; // Convert to milliseconds
  return startTime + runTimeMs;
}

export function calculateCurrentDistance(leg: Leg, runner: Runner, currentTime: number): number {
  if (!leg.actualStart || leg.actualFinish) return 0;
  
  const elapsedMs = currentTime - leg.actualStart;
  const elapsedMinutes = elapsedMs / (1000 * 60);
  const effectivePace = (leg.paceOverride ?? runner.pace);
  const paceMinutes = effectivePace / 60;
  const distanceCovered = elapsedMinutes / paceMinutes;
  
  return Math.max(0, leg.distance - distanceCovered);
}

export function calculateActualPace(leg: Leg): number | null {
  if (!leg.actualStart || !leg.actualFinish) return null;
  const runTimeMs = leg.actualFinish - leg.actualStart;
  const runTimeMinutes = runTimeMs / (1000 * 60);
  return runTimeMinutes / leg.distance; // Minutes per mile
}

export function recalculateProjections(legs: Leg[], updatedIndex: number, runners: Runner[], raceStartTime?: number): Leg[] {
  const updatedLegs = [...legs];
  
  // Recalculate from the updated leg onwards
  for (let i = Math.max(0, updatedIndex); i < updatedLegs.length; i++) {
    const currentLeg = updatedLegs[i];
    const runner = runners.find(r => r.id === currentLeg.runnerId);
    
    if (!runner) continue;
    
    // For the first leg, it should start exactly at race start time
    if (i === 0) {
      // First leg: use actual start if available, otherwise use the race start time
      const startTime = currentLeg.actualStart || raceStartTime || currentLeg.projectedStart;
      updatedLegs[i] = {
        ...currentLeg,
        projectedStart: startTime,
        projectedFinish: calculateProjectedFinish(
          startTime,
          currentLeg.paceOverride ?? runner.pace,
          currentLeg.distance
        )
      };
    } else {
      const prevLeg = updatedLegs[i - 1];
      
      // Only update projected start if this leg hasn't actually started yet
      // This preserves the original projection as a record once the leg begins
      if (!currentLeg.actualStart) {
        let newProjectedStart: number;
        
        if (prevLeg.actualFinish) {
          // Previous leg has finished - update projection based on actual finish
          newProjectedStart = prevLeg.actualFinish;
        } else {
          // Previous leg hasn't finished yet - use its projected finish
          newProjectedStart = prevLeg.projectedFinish;
        }
        
        updatedLegs[i] = {
          ...currentLeg,
          projectedStart: newProjectedStart,
          projectedFinish: calculateProjectedFinish(
            newProjectedStart,
            currentLeg.paceOverride ?? runner.pace,
            currentLeg.distance
          )
        };
      } else {
        // Leg has already started - preserve original projections but recalculate finish
        const effectiveStartTime = currentLeg.actualStart;
        updatedLegs[i] = {
          ...currentLeg,
          // Keep original projectedStart as historical record
          projectedFinish: calculateProjectedFinish(
            effectiveStartTime,
            currentLeg.paceOverride ?? runner.pace,
            currentLeg.distance
          )
        };
      }
    }
  }
  
  return updatedLegs;
}

// Cache for getCurrentRunner results
let currentRunnerCache: {
  legsHash: string | null;
  currentTime: number | null;
  result: Leg | null;
} = {
  legsHash: null,
  currentTime: null,
  result: null
};

// Function to clear cache when legs data changes
export function clearRunnerCache() {
  currentRunnerCache = {
    legsHash: null,
    currentTime: null,
    result: null
  };
  nextRunnerCache = {
    legsHash: null,
    currentTime: null,
    raceStartTime: null,
    result: null
  };
}

export function getCurrentRunner(legs: Leg[], now: Date): Leg | null {
  const currentTime = now.getTime();
  
  // Check if we can use cached result
  const legsHash = hashLegs(legs);
  const timeDiff = Math.abs(currentTime - (currentRunnerCache.currentTime || 0));
  
  // Use cache if:
  // 1. Legs haven't changed
  // 2. Time difference is less than 1 second (reduced from 5 seconds for faster UI updates)
  if (currentRunnerCache.legsHash === legsHash && timeDiff < 1000) {
    return currentRunnerCache.result;
  }
  
  // Sort legs by ID to ensure we check in order
  const sortedLegs = [...legs].sort((a, b) => a.id - b.id);
  
  for (const leg of sortedLegs) {
    // Only consider a leg as current if it has actually started but not finished
    // Don't auto-transition based on projected finish times
    if (leg.actualStart && leg.actualStart <= currentTime && !leg.actualFinish) {
      const result = leg;
      // Update cache
      currentRunnerCache = { legsHash, currentTime, result };
      return result;
    }
  }
  
  const result = null;
  // Update cache
  currentRunnerCache = { legsHash, currentTime, result };
  return result;
}

// Cache for getNextRunner results to avoid unnecessary recalculations
let nextRunnerCache: {
  legsHash: string | null;
  currentTime: number | null;
  raceStartTime: number | undefined | null;
  result: Leg | null;
} = {
  legsHash: null,
  currentTime: null,
  raceStartTime: null,
  result: null
};

// Simple hash function for legs array
function hashLegs(legs: Leg[]): string {
  if (!legs || legs.length === 0) return 'empty';
  
  // Create a hash based on leg IDs and their key timestamps
  const hashParts = legs.map(leg => 
    `${leg.id}:${leg.actualStart || 'null'}:${leg.actualFinish || 'null'}`
  );
  return hashParts.join('|');
}

export function getNextRunner(legs: Leg[], now: Date, raceStartTime?: number): Leg | null {
  const currentTime = now.getTime();
  
  // Check if we can use cached result
  const legsHash = hashLegs(legs);
  const timeDiff = Math.abs(currentTime - (nextRunnerCache.currentTime || 0));
  
  // Use cache if:
  // 1. Legs haven't changed
  // 2. Time difference is less than 1 second (reduced from 5 seconds for faster UI updates)
  // 3. Race start time hasn't changed
  if (nextRunnerCache.legsHash === legsHash && 
      timeDiff < 1000 && 
      nextRunnerCache.raceStartTime === raceStartTime) {
    return nextRunnerCache.result;
  }
  
  // Sort legs by ID to ensure we check in order
  const sortedLegs = [...legs].sort((a, b) => a.id - b.id);
  
  // Only log in development and only when there's a significant change or error
  const shouldLog = process.env.NODE_ENV === 'development' && 
    (sortedLegs.length === 0 || !raceStartTime || currentTime < raceStartTime - 60000); // Log if race hasn't started or is more than 1 minute away
  
  // Only log once per minute to reduce noise
  const logKey = `getNextRunner_${Math.floor(currentTime / 60000)}`;
  const hasLoggedThisMinute = sessionStorage.getItem(logKey);
  
  if (shouldLog && !hasLoggedThisMinute) {
    sessionStorage.setItem(logKey, 'true');
    console.log('[getNextRunner] Checking', sortedLegs.length, 'legs for next runner');
    console.log('[getNextRunner] Current time:', new Date(currentTime).toISOString());
    console.log('[getNextRunner] Race start time:', raceStartTime ? new Date(raceStartTime).toISOString() : 'undefined');
    if (sortedLegs.length > 0) {
      console.log('[getNextRunner] First leg:', {
        id: sortedLegs[0].id,
        runnerId: sortedLegs[0].runnerId,
        projectedStart: sortedLegs[0].projectedStart,
        actualStart: sortedLegs[0].actualStart,
        actualFinish: sortedLegs[0].actualFinish
      });
    }
  }
  
  for (const leg of sortedLegs) {
    // If this leg hasn't started yet, it's the next runner
    if (!leg.actualStart) {
      // Special case for leg 1: if race hasn't started yet, treat race start time as effective start
      if (leg.id === 1 && raceStartTime && currentTime < raceStartTime) {
        if (shouldLog && !hasLoggedThisMinute) {
          console.log('[getNextRunner] Found next runner: leg 1 (race not started yet)');
        }
        const result = leg;
        // Update cache
        nextRunnerCache = { legsHash, currentTime, raceStartTime, result };
        return result;
      }
      
      // For other legs or if race has started, check if this leg should be next
      const effectiveStartTime = leg.projectedStart || raceStartTime;
      if (effectiveStartTime && currentTime < effectiveStartTime) {
        if (shouldLog && !hasLoggedThisMinute) {
          console.log('[getNextRunner] Found next runner: leg', leg.id, 'runner', leg.runnerId);
        }
        const result = leg;
        // Update cache
        nextRunnerCache = { legsHash, currentTime, raceStartTime, result };
        return result;
      }
    }
  }
  
  if (shouldLog && !hasLoggedThisMinute) {
    console.log('[getNextRunner] No next runner found - all legs have started or are in progress');
  }
  
  const result = null;
  // Update cache
  nextRunnerCache = { legsHash, currentTime, raceStartTime, result };
  return result;
}

export function getLegStatus(leg: Leg, now: Date): RaceStatus {
  const currentTime = now.getTime();
  const startTime = leg.actualStart || leg.projectedStart;
  const finishTime = leg.actualFinish || leg.projectedFinish;
  
  if (leg.actualFinish) {
    return 'finished';
  }
  
  // If the leg has actually started but not finished, it's running
  // regardless of projected finish time
  if (leg.actualStart && !leg.actualFinish) {
    return 'running';
  }
  
  if (currentTime < startTime) {
    // Check if this is the next leg to run
    const timeDiff = startTime - currentTime;
    if (timeDiff <= 30 * 60 * 1000) { // Within 30 minutes
      return 'next-up';
    }
    return 'ready';
  }
  
  return 'ready';
}

export function getRunnersByVan(runners: Runner[], van: 1 | 2): Runner[] {
  return runners.filter(runner => runner.van === van);
}

export function getMajorExchangeTimes(legs: Leg[]): Array<{ legId: number; projectedFinish: number; actualFinish?: number }> {
  return legs
    .filter(leg => MAJOR_EXCHANGES.includes(leg.id))
    .map(leg => ({
      legId: leg.id,
      projectedFinish: leg.projectedFinish,
      actualFinish: leg.actualFinish
    }));
}

export function getRunTime(leg: Leg): number | null {
  if (!leg.actualStart || !leg.actualFinish) return null;
  return leg.actualFinish - leg.actualStart;
}

export function getEffectiveStartTime(leg: Leg, allLegs: Leg[], officialRaceStartTime?: number): number {
  // If the leg has an actual start time, use that
  if (leg.actualStart) {
    return leg.actualStart;
  }
  
  // Find the previous leg
  const legIndex = allLegs.findIndex(l => l.id === leg.id);
  if (legIndex <= 0) {
    // First leg or not found - use official race start time if provided, otherwise projected start
    if (officialRaceStartTime) {
      return officialRaceStartTime;
    }
    return leg.projectedStart;
  }
  
  const prevLeg = allLegs[legIndex - 1];
  
  // If previous leg has finished, this leg should start at that actual finish time
  if (prevLeg.actualFinish) {
    return prevLeg.actualFinish;
  }
  
  // Otherwise, use the previous leg's projected finish time
  return prevLeg.projectedFinish;
}

export function getCountdownTime(leg: Leg, now: Date, allLegs?: Leg[], officialRaceStartTime?: number): number {
  // Special case for leg 1 before race starts: use official race start time
  if (leg.id === 1 && !leg.actualStart && officialRaceStartTime) {
    return Math.max(0, officialRaceStartTime - now.getTime());
  }
  
  // Use effective start time for countdown if we have all legs data
  const startTime = allLegs 
    ? getEffectiveStartTime(leg, allLegs, officialRaceStartTime)
    : leg.actualStart || leg.projectedStart;
  return Math.max(0, startTime - now.getTime());
}

export function calculateTotalDistanceTraveled(legs: Leg[]): number {
  return legs
    .filter(leg => leg.actualFinish) // Only count legs that are actually finished
    .reduce((total, leg) => total + leg.distance, 0);
}

export function initializeRace(startTime: number, runners: Runner[]): Leg[] {
  // Validate input parameters
  if (!runners || runners.length === 0) {
    throw new Error('Cannot initialize race: no runners provided');
  }

  if (startTime <= 0) {
    throw new Error('Cannot initialize race: invalid start time');
  }

  // Validate runner data integrity
  const validRunners = runners.filter(runner => {
    if (!runner || typeof runner.id !== 'number' || runner.id <= 0) {
      console.warn(`[initializeRace] Skipping invalid runner:`, runner);
      return false;
    }
    if (typeof runner.pace !== 'number' || runner.pace <= 0) {
      console.warn(`[initializeRace] Runner ${runner.id} has invalid pace: ${runner.pace}`);
      return false;
    }
    if (runner.van !== 1 && runner.van !== 2) {
      console.warn(`[initializeRace] Runner ${runner.id} has invalid van: ${runner.van}`);
      return false;
    }
    return true;
  });

  if (validRunners.length === 0) {
    throw new Error('Cannot initialize race: no valid runners found');
  }

  if (validRunners.length !== runners.length) {
    console.warn(`[initializeRace] Filtered out ${runners.length - validRunners.length} invalid runners`);
  }

  const legs: Leg[] = [];
  let currentStartTime = startTime;
  
  DEFAULT_LEG_DISTANCES.forEach((distance, index) => {
    const legNumber = index + 1;
    const runnerIndex = index % validRunners.length;
    const runner = validRunners[runnerIndex];
    
    // Double-check runner validity (defensive programming)
    if (!runner || runner.id <= 0) {
      throw new Error(`Invalid runner data for leg ${legNumber}: runner ID must be positive`);
    }
    
    const projectedFinish = calculateProjectedFinish(currentStartTime, runner.pace, distance);
    
    const leg: Leg = {
      id: legNumber,
      runnerId: runner.id, // This is now guaranteed to be valid
      distance,
      projectedStart: currentStartTime,
      projectedFinish,
      updated_at: null
    };
    
    legs.push(leg);
    
    currentStartTime = projectedFinish;
  });
  
  // Final validation of created legs
  const invalidLegs = legs.filter(leg => !leg.runnerId || leg.runnerId <= 0);
  if (invalidLegs.length > 0) {
    throw new Error(`Race initialization failed: ${invalidLegs.length} legs have invalid runnerId`);
  }
  
  console.log(`[initializeRace] Successfully initialized ${legs.length} legs with ${validRunners.length} runners`);
  return legs;
}

export function validateRaceState(legs: Leg[]): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  const sortedLegs = [...legs].sort((a, b) => a.id - b.id);
  
  // Check for gaps in leg sequence
  for (let i = 0; i < sortedLegs.length - 1; i++) {
    const currentLeg = sortedLegs[i];
    const nextLeg = sortedLegs[i + 1];
    
    // Check for non-sequential leg IDs
    if (nextLeg.id !== currentLeg.id + 1) {
      issues.push(`Gap in leg sequence: ${currentLeg.id} -> ${nextLeg.id}`);
    }
    
    // Check for inconsistent finish/start times
    if (currentLeg.actualFinish && nextLeg.actualStart) {
      if (currentLeg.actualFinish > nextLeg.actualStart) {
        issues.push(`Leg ${currentLeg.id} finished after Leg ${nextLeg.id} started`);
      }
    }
    
    // Check for missing start times when finish exists
    if (currentLeg.actualFinish && !currentLeg.actualStart) {
      issues.push(`Leg ${currentLeg.id} has finish time but no start time`);
    }
  }
  
  // Check for multiple running legs
  const runningLegs = sortedLegs.filter(leg => 
    leg.actualStart && !leg.actualFinish
  );
  
  if (runningLegs.length > 1) {
    issues.push(`Multiple runners currently running: ${runningLegs.map(l => l.id).join(', ')}`);
  }
  
  // Check for race completion consistency
  const lastLeg = sortedLegs[sortedLegs.length - 1];
  if (lastLeg && lastLeg.actualFinish) {
    // If final leg is finished, all previous legs should be finished
    const unfinishedLegs = sortedLegs.slice(0, -1).filter(leg => !leg.actualFinish);
    if (unfinishedLegs.length > 0) {
      issues.push(`Race marked as complete but legs ${unfinishedLegs.map(l => l.id).join(', ')} are not finished`);
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}
