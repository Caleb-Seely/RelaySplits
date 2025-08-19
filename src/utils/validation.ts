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
 * Validates a single leg object
 */
export function validateLeg(leg: any, index?: number, allRunners?: Runner[]): ValidationResult {
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

  // Check time consistency
  if (leg.projectedStart && leg.projectedFinish && leg.projectedFinish <= leg.projectedStart) {
    issues.push(`Leg ${leg.id || index} has invalid time range: finish (${leg.projectedFinish}) <= start (${leg.projectedStart})`);
  }

  // Check actual times if present
  if (leg.actualStart !== undefined && leg.actualStart !== null) {
    if (typeof leg.actualStart !== 'number' || leg.actualStart <= 0) {
      issues.push(`Leg ${leg.id || index} has invalid actualStart: ${leg.actualStart}`);
    }
  }

  if (leg.actualFinish !== undefined && leg.actualFinish !== null) {
    if (typeof leg.actualFinish !== 'number' || leg.actualFinish <= 0) {
      issues.push(`Leg ${leg.id || index} has invalid actualFinish: ${leg.actualFinish}`);
    }
    
    if (leg.actualStart && leg.actualFinish <= leg.actualStart) {
      issues.push(`Leg ${leg.id || index} has invalid actual time range: finish (${leg.actualFinish}) <= start (${leg.actualStart})`);
    }
  }

  // Check runner assignment if runners are provided
  if (allRunners && leg.runnerId) {
    const assignedRunner = allRunners.find(r => r.id === leg.runnerId);
    if (!assignedRunner) {
      issues.push(`Leg ${leg.id || index} assigned to non-existent runner ${leg.runnerId}`);
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
export function validateRaceData(runners: Runner[], legs: Leg[], startTime?: number): ValidationResult {
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
    issues.push('No runners provided');
    return { isValid: false, issues, warnings, suggestions };
  }

  // Validate individual runners
  const runnerValidationResults = runners.map((runner, index) => validateRunner(runner, index));
  runnerValidationResults.forEach(result => {
    issues.push(...result.issues);
    warnings.push(...result.warnings);
    suggestions.push(...result.suggestions);
  });

  // Check for duplicate runner IDs
  const runnerIds = runners.map(r => r.id).filter(id => id > 0);
  const uniqueRunnerIds = new Set(runnerIds);
  if (runnerIds.length !== uniqueRunnerIds.size) {
    issues.push('Duplicate runner IDs found');
  }

  // Validate legs array
  if (!Array.isArray(legs)) {
    issues.push('Legs must be an array');
    return { isValid: false, issues, warnings, suggestions };
  }

  // Validate individual legs
  const legValidationResults = legs.map((leg, index) => validateLeg(leg, index, runners));
  legValidationResults.forEach(result => {
    issues.push(...result.issues);
    warnings.push(...result.warnings);
    suggestions.push(...result.suggestions);
  });

  // Check for duplicate leg IDs
  const legIds = legs.map(l => l.id).filter(id => id > 0);
  const uniqueLegIds = new Set(legIds);
  if (legIds.length !== uniqueLegIds.size) {
    issues.push('Duplicate leg IDs found');
  }

  // Check leg sequence
  const sortedLegs = [...legs].sort((a, b) => a.id - b.id);
  for (let i = 0; i < sortedLegs.length - 1; i++) {
    const currentLeg = sortedLegs[i];
    const nextLeg = sortedLegs[i + 1];
    
    if (nextLeg.id !== currentLeg.id + 1) {
      issues.push(`Gap in leg sequence: ${currentLeg.id} -> ${nextLeg.id}`);
    }
  }

  // Check for multiple running legs
  const runningLegs = legs.filter(leg => 
    leg.actualStart && !leg.actualFinish
  );
  
  if (runningLegs.length > 1) {
    issues.push(`Multiple runners currently running: ${runningLegs.map(l => l.id).join(', ')}`);
  }

  // Check race completion consistency
  const lastLeg = sortedLegs[sortedLegs.length - 1];
  if (lastLeg && lastLeg.actualFinish) {
    const unfinishedLegs = sortedLegs.slice(0, -1).filter(leg => !leg.actualFinish);
    if (unfinishedLegs.length > 0) {
      issues.push(`Race marked as complete but legs ${unfinishedLegs.map(l => l.id).join(', ')} are not finished`);
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
 * Creates a comprehensive validation report
 */
export function createValidationReport(runners: Runner[], legs: Leg[], startTime?: number): string {
  const result = validateRaceData(runners, legs, startTime);
  
  let report = '=== RACE DATA VALIDATION REPORT ===\n\n';
  
  if (result.isValid) {
    report += '✅ All data is valid!\n\n';
  } else {
    report += '❌ Data validation failed!\n\n';
  }
  
  if (result.issues.length > 0) {
    report += '🚨 CRITICAL ISSUES:\n';
    result.issues.forEach(issue => {
      report += `  • ${issue}\n`;
    });
    report += '\n';
  }
  
  if (result.warnings.length > 0) {
    report += '⚠️  WARNINGS:\n';
    result.warnings.forEach(warning => {
      report += `  • ${warning}\n`;
    });
    report += '\n';
  }
  
  if (result.suggestions.length > 0) {
    report += '💡 SUGGESTIONS:\n';
    result.suggestions.forEach(suggestion => {
      report += `  • ${suggestion}\n`;
    });
    report += '\n';
  }
  
  report += `📊 SUMMARY:\n`;
  report += `  • Runners: ${runners.length}\n`;
  report += `  • Legs: ${legs.length}\n`;
  report += `  • Issues: ${result.issues.length}\n`;
  report += `  • Warnings: ${result.warnings.length}\n`;
  report += `  • Suggestions: ${result.suggestions.length}\n`;
  
  return report;
}
