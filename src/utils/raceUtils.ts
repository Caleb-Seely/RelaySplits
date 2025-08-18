
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

export function getCurrentRunner(legs: Leg[], now: Date): Leg | null {
  const currentTime = now.getTime();
  
  for (const leg of legs) {
    // Only consider a leg as current if it has actually started but not finished
    // Don't auto-transition based on projected finish times
    if (leg.actualStart && leg.actualStart <= currentTime && !leg.actualFinish) {
      return leg;
    }
  }
  
  return null;
}

export function getNextRunner(legs: Leg[], now: Date): Leg | null {
  const currentTime = now.getTime();
  
  for (const leg of legs) {
    // If this leg hasn't started yet, it's the next runner
    if (!leg.actualStart) {
      return leg;
    }
  }
  
  return null;
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
  const legs: Leg[] = [];
  let currentStartTime = startTime;
  
  DEFAULT_LEG_DISTANCES.forEach((distance, index) => {
    const legNumber = index + 1;
    const runnerIndex = index % runners.length; // Use runners.length instead of hardcoded 12
    const runner = runners[runnerIndex];
    
    if (!runner) {
      throw new Error(`No runner found for leg ${legNumber}`);
    }
    
    const projectedFinish = calculateProjectedFinish(currentStartTime, runner.pace, distance);
    
    const leg = {
      id: legNumber,
      runnerId: runner.id,
      distance,
      projectedStart: currentStartTime,
      projectedFinish
    };
    
    legs.push(leg);
    
    currentStartTime = projectedFinish;
  });
  
  return legs;
}
