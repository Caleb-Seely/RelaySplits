
/**
 * Represents a runner in the relay race team.
 */
export type Runner = {
  /** Unique identifier for the runner (1-12) */
  id: number;
  /** Runner's name */
  name: string;
  /** Runner's pace in seconds per mile (e.g., 420 = 7:00 pace) */
  pace: number;
  /** Which van the runner belongs to (Van 1 or Van 2) */
  van: 1 | 2;
  /** Optional Supabase row id for this runner, used for stable identity when syncing */
  remoteId?: string;
};

/**
 * Represents a leg (segment) of the relay race.
 */
export type Leg = {
  /** Leg number (1-36 for a full relay race) */
  id: number;
  /** ID of the runner assigned to this leg */
  runnerId: number;
  /** Distance of this leg in miles */
  distance: number;
  /** Projected start time as Unix timestamp */
  projectedStart: number;
  /** Projected finish time as Unix timestamp */
  projectedFinish: number;
  /** Actual start time as Unix timestamp (when runner actually starts) */
  actualStart?: number;
  /** Actual finish time as Unix timestamp (when runner actually finishes) */
  actualFinish?: number;
  /** Optional per-leg pace override in seconds per mile (if set, used instead of runner pace for projections) */
  paceOverride?: number;
};

/**
 * Possible statuses for a race leg.
 */
export type RaceStatus = 
  /** Leg is ready to start but not yet active */
  | 'ready' 
  /** Runner is currently running this leg */
  | 'running' 
  /** Leg has been completed */
  | 'finished' 
  /** Next leg to start (within 30 minutes) */
  | 'next-up';

/**
 * Complete race data structure containing all race information.
 */
export type RaceData = {
  /** Race start time as Unix timestamp */
  startTime: number;
  /** Array of all runners in the race */
  runners: Runner[];
  /** Array of all legs in the race */
  legs: Leg[];
};
