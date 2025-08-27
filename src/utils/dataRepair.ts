import { validateRaceDataStructure, validateRunnerStructure, validateLegStructure } from './validation';
import { sanitizeRunnerName, sanitizePace, sanitizeDistance, sanitizeTimestamp } from './sanitization';

import type { RaceData, Runner, Leg } from '@/types/race';

/**
 * Repairs race data by fixing common issues and validating structure
 */
export const repairRaceData = (data: unknown): RaceData | null => {
  if (validateRaceDataStructure(data)) {
    return data as RaceData;
  }
  
  // Attempt to repair common issues
  const partialData = data as Partial<RaceData>;
  
  const repaired: RaceData = {
    runners: Array.isArray(partialData.runners) 
      ? partialData.runners.filter(validateRunnerStructure).map(repairRunner)
      : [],
    legs: Array.isArray(partialData.legs) 
      ? partialData.legs.filter(validateLegStructure).map(repairLeg)
      : [],
    startTime: typeof partialData.startTime === 'number' && partialData.startTime > 0
      ? partialData.startTime 
      : Date.now()
  };
  
  return validateRaceDataStructure(repaired) ? repaired : null;
};

/**
 * Repairs a single runner object
 */
export const repairRunner = (runner: Partial<Runner>): Runner => {
  const now = Date.now();
  
  return {
    id: typeof runner.id === 'number' && runner.id > 0 ? runner.id : 1,
    name: typeof runner.name === 'string' ? sanitizeRunnerName(runner.name) : 'Unknown Runner',
    pace: typeof runner.pace === 'number' && runner.pace > 0 ? sanitizePace(runner.pace) || 420 : 420, // Default 7:00 pace
    van: runner.van === 1 || runner.van === 2 ? runner.van : 1,
    remoteId: typeof runner.remoteId === 'string' ? runner.remoteId : undefined,
    updated_at: typeof runner.updated_at === 'string' ? runner.updated_at : null
  };
};

/**
 * Repairs a single leg object
 */
export const repairLeg = (leg: Partial<Leg>): Leg => {
  const now = Date.now();
  
  return {
    id: typeof leg.id === 'number' && leg.id > 0 ? leg.id : 1,
    runnerId: typeof leg.runnerId === 'number' && leg.runnerId > 0 ? leg.runnerId : 1,
    distance: typeof leg.distance === 'number' && leg.distance > 0 ? sanitizeDistance(leg.distance) || 3.0 : 3.0,
    projectedStart: typeof leg.projectedStart === 'number' && leg.projectedStart > 0 
      ? sanitizeTimestamp(leg.projectedStart) || now 
      : now,
    projectedFinish: typeof leg.projectedFinish === 'number' && leg.projectedFinish > 0 
      ? sanitizeTimestamp(leg.projectedFinish) || (now + 1800000) // 30 minutes later
      : now + 1800000,
    actualStart: leg.actualStart !== undefined && leg.actualStart !== null
      ? sanitizeTimestamp(leg.actualStart) || undefined
      : undefined,
    actualFinish: leg.actualFinish !== undefined && leg.actualFinish !== null
      ? sanitizeTimestamp(leg.actualFinish) || undefined
      : undefined,
    paceOverride: leg.paceOverride !== undefined && leg.paceOverride !== null
      ? sanitizePace(leg.paceOverride) || undefined
      : undefined,
    remoteId: typeof leg.remoteId === 'string' ? leg.remoteId : undefined,
    updated_at: typeof leg.updated_at === 'string' ? leg.updated_at : null
  };
};

/**
 * Repairs runner ID conflicts by reassigning duplicate IDs
 */
export const repairRunnerIdConflicts = (runners: Runner[]): Runner[] => {
  const usedIds = new Set<number>();
  const repaired: Runner[] = [];
  
  for (const runner of runners) {
    let newId = runner.id;
    
    // If ID is already used, find the next available ID
    while (usedIds.has(newId)) {
      newId++;
    }
    
    usedIds.add(newId);
    repaired.push({ ...runner, id: newId });
  }
  
  return repaired;
};

/**
 * Repairs leg ID conflicts by reassigning duplicate IDs
 */
export const repairLegIdConflicts = (legs: Leg[]): Leg[] => {
  const usedIds = new Set<number>();
  const repaired: Leg[] = [];
  
  for (const leg of legs) {
    let newId = leg.id;
    
    // If ID is already used, find the next available ID
    while (usedIds.has(newId)) {
      newId++;
    }
    
    usedIds.add(newId);
    repaired.push({ ...leg, id: newId });
  }
  
  return repaired;
};

/**
 * Repairs leg sequence issues by adjusting projected times
 */
export const repairLegSequence = (legs: Leg[]): Leg[] => {
  if (legs.length === 0) return legs;
  
  const repaired = [...legs];
  let currentTime = repaired[0].projectedStart;
  
  for (let i = 0; i < repaired.length; i++) {
    const leg = repaired[i];
    
    // Ensure projected start time is after previous leg's finish
    if (i > 0) {
      const prevLeg = repaired[i - 1];
      const minStartTime = prevLeg.projectedFinish + 60000; // 1 minute buffer
      currentTime = Math.max(currentTime, minStartTime);
    }
    
    // Update projected times
    const duration = leg.projectedFinish - leg.projectedStart;
    repaired[i] = {
      ...leg,
      projectedStart: currentTime,
      projectedFinish: currentTime + duration
    };
    
    currentTime = repaired[i].projectedFinish;
  }
  
  return repaired;
};

/**
 * Repairs missing runner assignments by assigning unassigned runners to legs
 */
export const repairRunnerAssignments = (runners: Runner[], legs: Leg[]): Leg[] => {
  if (runners.length === 0 || legs.length === 0) return legs;
  
  const assignedRunnerIds = new Set(legs.map(l => l.runnerId));
  const unassignedRunners = runners.filter(r => !assignedRunnerIds.has(r.id));
  
  if (unassignedRunners.length === 0) return legs;
  
  const repaired = [...legs];
  let runnerIndex = 0;
  
  // Find legs without valid runner assignments and assign unassigned runners
  for (let i = 0; i < repaired.length && runnerIndex < unassignedRunners.length; i++) {
    const leg = repaired[i];
    const assignedRunner = runners.find(r => r.id === leg.runnerId);
    
    if (!assignedRunner) {
      repaired[i] = {
        ...leg,
        runnerId: unassignedRunners[runnerIndex].id
      };
      runnerIndex++;
    }
  }
  
  return repaired;
};

/**
 * Comprehensive data repair function that fixes multiple issues
 */
export const repairRaceDataComprehensive = (data: unknown): RaceData | null => {
  // First attempt basic repair
  const basicRepair = repairRaceData(data);
  if (!basicRepair) return null;
  
  // Apply comprehensive repairs
  const repairedRunners = repairRunnerIdConflicts(basicRepair.runners);
  const repairedLegs = repairLegIdConflicts(basicRepair.legs);
  const sequencedLegs = repairLegSequence(repairedLegs);
  const assignedLegs = repairRunnerAssignments(repairedRunners, sequencedLegs);
  
  const comprehensiveRepair: RaceData = {
    ...basicRepair,
    runners: repairedRunners,
    legs: assignedLegs
  };
  
  return validateRaceDataStructure(comprehensiveRepair) ? comprehensiveRepair : null;
};

/**
 * Creates a repair report showing what was fixed
 */
export const createRepairReport = (originalData: unknown, repairedData: RaceData | null): string => {
  if (!repairedData) {
    return '❌ Data repair failed - unable to fix data structure issues';
  }
  
  let report = '🔧 Data Repair Report\n\n';
  
  // Compare original vs repaired
  const original = originalData as Partial<RaceData>;
  
  if (!Array.isArray(original.runners) || original.runners.length !== repairedData.runners.length) {
    report += `• Fixed runners array: ${original.runners?.length || 0} → ${repairedData.runners.length}\n`;
  }
  
  if (!Array.isArray(original.legs) || original.legs.length !== repairedData.legs.length) {
    report += `• Fixed legs array: ${original.legs?.length || 0} → ${repairedData.legs.length}\n`;
  }
  
  if (typeof original.startTime !== 'number' || original.startTime !== repairedData.startTime) {
    report += `• Fixed start time: ${original.startTime || 'invalid'} → ${repairedData.startTime}\n`;
  }
  
  // Check for specific repairs
  const originalRunnerIds = original.runners?.map(r => r.id) || [];
  const repairedRunnerIds = repairedData.runners.map(r => r.id);
  const originalLegIds = original.legs?.map(l => l.id) || [];
  const repairedLegIds = repairedData.legs.map(l => l.id);
  
  if (new Set(originalRunnerIds).size !== originalRunnerIds.length) {
    report += '• Fixed duplicate runner IDs\n';
  }
  
  if (new Set(originalLegIds).size !== originalLegIds.length) {
    report += '• Fixed duplicate leg IDs\n';
  }
  
  report += `\n✅ Repair completed successfully!\n`;
  report += `• Runners: ${repairedData.runners.length}\n`;
  report += `• Legs: ${repairedData.legs.length}\n`;
  report += `• Start time: ${new Date(repairedData.startTime).toLocaleString()}\n`;
  
  return report;
};
