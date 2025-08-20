import type { Runner, Leg } from '@/types/race';

/**
 * Validation result interface for comprehensive data validation
 */
export interface ValidationResult {
  isValid: boolean;
  issues: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Race timing validation configuration
 */
export interface TimingValidationConfig {
  maxLegDuration: number; // Maximum leg duration in milliseconds (default: 6 hours)
  minLegDuration: number; // Minimum leg duration in milliseconds (default: 1 minute)
  maxPaceVariance: number; // Maximum pace variance percentage (default: 50%)
  raceStartBuffer: number; // Buffer before race start for early timing (default: 1 hour)
}

const DEFAULT_TIMING_CONFIG: TimingValidationConfig = {
  maxLegDuration: 6 * 60 * 60 * 1000, // 6 hours
  minLegDuration: 60 * 1000, // 1 minute
  maxPaceVariance: 0.5, // 50%
  raceStartBuffer: 60 * 60 * 1000 // 1 hour
};

/**
 * Validates a single runner object
 */
export function validateRunner(runner: any, index?: number): ValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  if (!runner) {
    issues.push(`Runner ${index !== undefined ? `at index ${index}` : ''} is null or undefined`);
    return { isValid: false, issues, warnings, suggestions };
  }

  // Check required fields
  if (typeof runner.id !== 'number' || runner.id <= 0) {
    issues.push(`Runner ${index !== undefined ? `at index ${index}` : ''} has invalid ID: ${runner.id}`);
  }

  if (typeof runner.name !== 'string' || runner.name.trim().length === 0) {
    issues.push(`Runner ${runner.id || index} has invalid name: "${runner.name}"`);
  }

  if (typeof runner.pace !== 'number' || runner.pace <= 0) {
    issues.push(`Runner ${runner.id || index} has invalid pace: ${runner.pace}`);
  } else if (runner.pace < 180) { // Less than 3:00 pace
    warnings.push(`Runner ${runner.id || index} has very fast pace: ${runner.pace} seconds/mile`);
  } else if (runner.pace > 900) { // More than 15:00 pace
    warnings.push(`Runner ${runner.id || index} has very slow pace: ${runner.pace} seconds/mile`);
  }

  if (runner.van !== 1 && runner.van !== 2) {
    issues.push(`Runner ${runner.id || index} has invalid van assignment: ${runner.van}`);
  }

  // Check for duplicate IDs
  if (runner.id && runner.id > 0) {
    suggestions.push(`Consider validating runner ID ${runner.id} for uniqueness across all runners`);
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings,
    suggestions
  };
}

/**
 * Validates a single leg object with comprehensive timing checks
 */
export function validateLeg(
  leg: any, 
  index?: number, 
  allRunners?: Runner[], 
  raceStartTime?: number,
  config: TimingValidationConfig = DEFAULT_TIMING_CONFIG
): ValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  if (!leg) {
    issues.push(`Leg ${index !== undefined ? `at index ${index}` : ''} is null or undefined`);
    return { isValid: false, issues, warnings, suggestions };
  }

  // Check required fields
  if (typeof leg.id !== 'number' || leg.id <= 0) {
    issues.push(`Leg ${index !== undefined ? `at index ${index}` : ''} has invalid ID: ${leg.id}`);
  }

  if (typeof leg.runnerId !== 'number' || leg.runnerId <= 0) {
    issues.push(`Leg ${leg.id || index} has invalid runnerId: ${leg.runnerId}`);
  }

  if (typeof leg.distance !== 'number' || leg.distance <= 0) {
    issues.push(`Leg ${leg.id || index} has invalid distance: ${leg.distance}`);
  } else if (leg.distance > 10) {
    warnings.push(`Leg ${leg.id || index} has very long distance: ${leg.distance} miles`);
  }

  if (typeof leg.projectedStart !== 'number' || leg.projectedStart <= 0) {
    issues.push(`Leg ${leg.id || index} has invalid projectedStart: ${leg.projectedStart}`);
  }

  if (typeof leg.projectedFinish !== 'number' || leg.projectedFinish <= 0) {
    issues.push(`Leg ${leg.id || index} has invalid projectedFinish: ${leg.projectedFinish}`);
  }

  // Check projected time consistency
  if (leg.projectedStart && leg.projectedFinish && leg.projectedFinish <= leg.projectedStart) {
    issues.push(`Leg ${leg.id || index} has invalid projected time range: finish (${leg.projectedFinish}) <= start (${leg.projectedStart})`);
  }

  // Check actual times if present
  if (leg.actualStart !== undefined && leg.actualStart !== null) {
    if (typeof leg.actualStart !== 'number' || leg.actualStart <= 0) {
      issues.push(`Leg ${leg.id || index} has invalid actualStart: ${leg.actualStart}`);
    }
    
    // Check if leg started before race start (with buffer)
    if (raceStartTime && leg.actualStart < raceStartTime - config.raceStartBuffer) {
      issues.push(`Leg ${leg.id || index} started too early: ${new Date(leg.actualStart).toLocaleString()} (race starts: ${new Date(raceStartTime).toLocaleString()})`);
    }
  }

  if (leg.actualFinish !== undefined && leg.actualFinish !== null) {
    if (typeof leg.actualFinish !== 'number' || leg.actualFinish <= 0) {
      issues.push(`Leg ${leg.id || index} has invalid actualFinish: ${leg.actualFinish}`);
    }
    
    // Check actual time consistency
    if (leg.actualStart && leg.actualFinish <= leg.actualStart) {
      issues.push(`Leg ${leg.id || index} has invalid actual time range: finish (${leg.actualFinish}) <= start (${leg.actualStart})`);
    }
    
    // Check leg duration
    if (leg.actualStart && leg.actualFinish) {
      const duration = leg.actualFinish - leg.actualStart;
      
      if (duration < config.minLegDuration) {
        issues.push(`Leg ${leg.id || index} duration too short: ${Math.round(duration / 1000)}s (minimum: ${Math.round(config.minLegDuration / 1000)}s)`);
      }
      
      if (duration > config.maxLegDuration) {
        issues.push(`Leg ${leg.id || index} duration too long: ${Math.round(duration / 60000)}min (maximum: ${Math.round(config.maxLegDuration / 60000)}min)`);
      }
    }
  }

  // Check for incomplete legs (started but not finished)
  if (leg.actualStart && !leg.actualFinish) {
    const timeSinceStart = Date.now() - leg.actualStart;
    
    if (timeSinceStart > config.maxLegDuration) {
      issues.push(`Leg ${leg.id || index} has been running too long: ${Math.round(timeSinceStart / 60000)}min (maximum: ${Math.round(config.maxLegDuration / 60000)}min)`);
    } else if (timeSinceStart > config.maxLegDuration / 2) {
      warnings.push(`Leg ${leg.id || index} has been running for ${Math.round(timeSinceStart / 60000)}min - consider checking on runner`);
    }
  }

  // Check runner assignment if runners are provided
  if (allRunners && leg.runnerId) {
    const assignedRunner = allRunners.find(r => r.id === leg.runnerId);
    if (!assignedRunner) {
      issues.push(`Leg ${leg.id || index} assigned to non-existent runner ${leg.runnerId}`);
    } else {
      // Check pace vs actual time consistency
      if (leg.actualStart && leg.actualFinish && leg.distance) {
        const actualDuration = leg.actualFinish - leg.actualStart;
        const actualPace = (actualDuration / 1000) / leg.distance; // seconds per mile
        const expectedPace = assignedRunner.pace;
        const variance = Math.abs(actualPace - expectedPace) / expectedPace;
        
        if (variance > config.maxPaceVariance) {
          warnings.push(`Leg ${leg.id || index} actual pace (${Math.round(actualPace)}s/mile) differs significantly from runner's expected pace (${expectedPace}s/mile)`);
        }
      }
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings,
    suggestions
  };
}

/**
 * Validates the entire race data structure
 */
export function validateRaceData(
  runners: Runner[], 
  legs: Leg[], 
  startTime?: number,
  config: TimingValidationConfig = DEFAULT_TIMING_CONFIG
): ValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Validate start time
  if (startTime !== undefined && (typeof startTime !== 'number' || startTime <= 0)) {
    issues.push(`Invalid start time: ${startTime}`);
  }

  // Validate runners array
  if (!Array.isArray(runners)) {
    issues.push('Runners must be an array');
    return { isValid: false, issues, warnings, suggestions };
  }

  if (runners.length === 0) {
    issues.push('No runners defined');
  }

  // Validate individual runners
  runners.forEach((runner, index) => {
    const runnerValidation = validateRunner(runner, index);
    issues.push(...runnerValidation.issues);
    warnings.push(...runnerValidation.warnings);
    suggestions.push(...runnerValidation.suggestions);
  });

  // Check for duplicate runner IDs
  const runnerIds = runners.map(r => r.id);
  const duplicateIds = runnerIds.filter((id, index) => runnerIds.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    issues.push(`Duplicate runner IDs found: ${duplicateIds.join(', ')}`);
  }

  // Validate legs array
  if (!Array.isArray(legs)) {
    issues.push('Legs must be an array');
    return { isValid: false, issues, warnings, suggestions };
  }

  if (legs.length === 0) {
    issues.push('No legs defined');
  }

  // Validate individual legs
  legs.forEach((leg, index) => {
    const legValidation = validateLeg(leg, index, runners, startTime, config);
    issues.push(...legValidation.issues);
    warnings.push(...legValidation.warnings);
    suggestions.push(...legValidation.suggestions);
  });

  // Check for duplicate leg IDs
  const legIds = legs.map(l => l.id);
  const duplicateLegIds = legIds.filter((id, index) => legIds.indexOf(id) !== index);
  if (duplicateLegIds.length > 0) {
    issues.push(`Duplicate leg IDs found: ${duplicateLegIds.join(', ')}`);
  }

  // Check leg sequence consistency
  for (let i = 1; i < legs.length; i++) {
    const prevLeg = legs[i - 1];
    const currLeg = legs[i];
    
    if (prevLeg.actualFinish && currLeg.actualStart && 
        currLeg.actualStart < prevLeg.actualFinish) {
      issues.push(`Leg ${currLeg.id} started before leg ${prevLeg.id} finished`);
    }
  }

  // Check van assignments
  const van1Runners = runners.filter(r => r.van === 1);
  const van2Runners = runners.filter(r => r.van === 2);
  
  if (van1Runners.length === 0) {
    warnings.push('No runners assigned to Van 1');
  }
  
  if (van2Runners.length === 0) {
    warnings.push('No runners assigned to Van 2');
  }

  // Check for unassigned runners
  const assignedRunnerIds = new Set(legs.map(l => l.runnerId));
  const unassignedRunners = runners.filter(r => !assignedRunnerIds.has(r.id));
  if (unassignedRunners.length > 0) {
    warnings.push(`Unassigned runners: ${unassignedRunners.map(r => r.name).join(', ')}`);
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings,
    suggestions
  };
}

/**
 * Creates a comprehensive validation report
 */
export function createValidationReport(
  runners: Runner[], 
  legs: Leg[], 
  startTime?: number,
  config: TimingValidationConfig = DEFAULT_TIMING_CONFIG
): string {
  const validation = validateRaceData(runners, legs, startTime, config);
  
  let report = '=== Race Data Validation Report ===\n\n';
  
  if (validation.isValid) {
    report += '✅ Race data is valid!\n\n';
  } else {
    report += '❌ Race data has issues:\n';
    validation.issues.forEach(issue => {
      report += `  • ${issue}\n`;
    });
    report += '\n';
  }
  
  if (validation.warnings.length > 0) {
    report += '⚠️  Warnings:\n';
    validation.warnings.forEach(warning => {
      report += `  • ${warning}\n`;
    });
    report += '\n';
  }
  
  if (validation.suggestions.length > 0) {
    report += '💡 Suggestions:\n';
    validation.suggestions.forEach(suggestion => {
      report += `  • ${suggestion}\n`;
    });
    report += '\n';
  }
  
  // Add summary statistics
  report += '📊 Summary:\n';
  report += `  • Runners: ${runners.length}\n`;
  report += `  • Legs: ${legs.length}\n`;
  report += `  • Issues: ${validation.issues.length}\n`;
  report += `  • Warnings: ${validation.warnings.length}\n`;
  report += `  • Suggestions: ${validation.suggestions.length}\n`;
  
  return report;
}

/**
 * Quick validation for sync operations
 */
export function validateForSync(leg: any, operation: string): boolean {
  // For sync operations, we're more lenient with projected times
  // since we're primarily concerned with actual timing data
  const issues: string[] = [];
  
  // Basic required field checks
  if (!leg || typeof leg.id !== 'number' || leg.id <= 0) {
    console.warn(`[${operation}] Validation failed for leg ${leg?.id}: Invalid leg object`);
    return false;
  }
  
  if (typeof leg.runnerId !== 'number' || leg.runnerId <= 0) {
    issues.push(`Leg ${leg.id} has invalid runnerId: ${leg.runnerId}`);
  }
  
  if (typeof leg.distance !== 'number' || leg.distance <= 0) {
    issues.push(`Leg ${leg.id} has invalid distance: ${leg.distance}`);
  }
  
  // For sync operations, we're more lenient with projected times
  // Only validate projected times if they're being used
  if (leg.projectedStart !== undefined && leg.projectedStart !== null) {
    if (typeof leg.projectedStart !== 'number' || leg.projectedStart < 0) {
      issues.push(`Leg ${leg.id} has invalid projectedStart: ${leg.projectedStart}`);
    }
  }
  
  if (leg.projectedFinish !== undefined && leg.projectedFinish !== null) {
    if (typeof leg.projectedFinish !== 'number' || leg.projectedFinish < 0) {
      issues.push(`Leg ${leg.id} has invalid projectedFinish: ${leg.projectedFinish}`);
    }
  }
  
  // Validate actual times if present
  if (leg.actualStart !== undefined && leg.actualStart !== null) {
    if (typeof leg.actualStart !== 'number' || leg.actualStart <= 0) {
      issues.push(`Leg ${leg.id} has invalid actualStart: ${leg.actualStart}`);
    }
  }
  
  if (leg.actualFinish !== undefined && leg.actualFinish !== null) {
    if (typeof leg.actualFinish !== 'number' || leg.actualFinish <= 0) {
      issues.push(`Leg ${leg.id} has invalid actualFinish: ${leg.actualFinish}`);
    }
    
    // Check actual time consistency
    if (leg.actualStart && leg.actualFinish <= leg.actualStart) {
      issues.push(`Leg ${leg.id} has invalid actual time range: finish (${leg.actualFinish}) <= start (${leg.actualStart})`);
    }
  }
  
  if (issues.length > 0) {
    console.warn(`[${operation}] Validation failed for leg ${leg.id}:`, issues);
    return false;
  }
  
  return true;
}
