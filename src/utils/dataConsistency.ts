import { isDatabaseRecord } from './typeGuards';

import { supabase } from '@/integrations/supabase/client';
import { ValidationResult, RepairResult } from '@/types/leaderboard';
import type { Leg, Runner } from '@/types/race';
import { getCurrentRunner } from '@/utils/raceUtils';

export interface MissingTimeConflict {
  legId: number;
  runnerName: string;
  field: 'actualStart' | 'actualFinish';
  suggestedTime?: number;
  previousLegFinishTime?: number;
  nextLegStartTime?: number;
}

// Helper function to check if data exists in database
const checkDatabaseForLegTime = async (teamId: string, legId: number, field: 'start_time' | 'finish_time'): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('legs')
      .select(field)
      .eq('team_id', teamId)
      .eq('number', legId)
      .single();
    
    if (error) {
      console.warn(`[checkDatabaseForLegTime] Error checking database for leg ${legId} ${field}:`, error);
      return false; // Assume missing if we can't check
    }
    
    if (!data) return false;
    
    // Type-safe field access using type guards
    if (!isDatabaseRecord(data)) {
      return false;
    }
    return data[field] !== null;
  } catch (error) {
    console.warn(`[checkDatabaseForLegTime] Exception checking database for leg ${legId} ${field}:`, error);
    return false; // Assume missing if we can't check
  }
};

export const detectMissingTimeConflicts = async (legs: Leg[], runners: Runner[], teamId?: string): Promise<MissingTimeConflict[]> => {
  const conflicts: MissingTimeConflict[] = [];

  console.log('[detectMissingTimeConflicts] Checking for missing times');

  // Find the current runner
  const currentRunner = getCurrentRunner(legs, new Date());
  console.log(`[detectMissingTimeConflicts] Current runner: ${currentRunner ? `Leg ${currentRunner.id} (${runners.find(r => r.id === currentRunner.runnerId)?.name || 'Unknown'})` : 'None'}`);

  // Determine which legs should be checked based on race progression
  const legsToCheck: Leg[] = [];

  if (currentRunner) {
    // Check ALL previous legs - they should all have finished
    for (let i = 1; i < currentRunner.id; i++) {
      const previousLeg = legs.find(l => l.id === i);
      if (previousLeg && !previousLeg.actualFinish) {
        legsToCheck.push(previousLeg);
      }
    }

    // Check the current leg - it should have started (unless it's leg 1)
    if (currentRunner.id > 1 && !currentRunner.actualStart) {
      legsToCheck.push(currentRunner);
    }
  } else {
    // No current runner - check if there's a leg that should have started but hasn't
    const lastCompletedLeg = legs
      .filter(leg => leg.actualFinish)
      .sort((a, b) => b.id - a.id)[0];

    if (lastCompletedLeg && lastCompletedLeg.id < legs.length) {
      const nextLeg = legs.find(l => l.id === lastCompletedLeg.id + 1);
      if (nextLeg && !nextLeg.actualStart) {
        legsToCheck.push(nextLeg);
      }
    }
  }

  console.log(`[detectMissingTimeConflicts] Checking ${legsToCheck.length} relevant legs`);

  // Check each relevant leg for missing times
  for (const leg of legsToCheck) {
    const runner = runners.find(r => r.id === leg.runnerId);
    const runnerName = runner?.name || `Runner ${leg.runnerId}`;

    // Check for missing start time
    if (!leg.actualStart && leg.id > 1) {
      // Check if the database has this data before flagging as missing
      let databaseHasData = false;
      if (teamId) {
        databaseHasData = await checkDatabaseForLegTime(teamId, leg.id, 'start_time');
        console.log(`[detectMissingTimeConflicts] Database check for leg ${leg.id} start_time: ${databaseHasData ? 'EXISTS' : 'MISSING'}`);
      }
      
      // Only flag as missing if database also doesn't have the data
      if (!databaseHasData) {
        const previousLeg = legs.find(l => l.id === leg.id - 1);
        const suggestedTime = previousLeg?.actualFinish;
        
        console.log(`[detectMissingTimeConflicts] Found missing start time for leg ${leg.id} (${runnerName}) - both local and database missing`);
        
        conflicts.push({
          legId: leg.id,
          runnerName,
          field: 'actualStart',
          suggestedTime,
          previousLegFinishTime: previousLeg?.actualFinish
        });
      } else {
        console.log(`[detectMissingTimeConflicts] Skipping missing start time check for leg ${leg.id} (${runnerName}) - database has the data, local sync issue`);
      }
    }

    // Check for missing finish time
    if (!leg.actualFinish && leg.id < legs.length) {
      // Check if the database has this data before flagging as missing
      let databaseHasData = false;
      if (teamId) {
        databaseHasData = await checkDatabaseForLegTime(teamId, leg.id, 'finish_time');
        console.log(`[detectMissingTimeConflicts] Database check for leg ${leg.id} finish_time: ${databaseHasData ? 'EXISTS' : 'MISSING'}`);
      }
      
      // Only flag as missing if database also doesn't have the data
      if (!databaseHasData) {
        const nextLeg = legs.find(l => l.id === leg.id + 1);
        const suggestedTime = nextLeg?.actualStart || Date.now();
        
        console.log(`[detectMissingTimeConflicts] Found missing finish time for leg ${leg.id} (${runnerName}) - both local and database missing`);
        
        conflicts.push({
          legId: leg.id,
          runnerName,
          field: 'actualFinish',
          suggestedTime,
          nextLegStartTime: nextLeg?.actualStart
        });
      } else {
        console.log(`[detectMissingTimeConflicts] Skipping missing finish time check for leg ${leg.id} (${runnerName}) - database has the data, local sync issue`);
      }
    }
  }

  console.log('[detectMissingTimeConflicts] Found', conflicts.length, 'conflicts');
  return conflicts;
};

// Smart detection that only triggers in specific scenarios
export const shouldCheckForMissingTimes = (legs: Leg[], lastCheckTime: number): boolean => {
  const now = Date.now();
  const timeSinceLastCheck = now - lastCheckTime;
  
  // Don't check more than once every 30 seconds
  if (timeSinceLastCheck < 30000) {
    return false;
  }

  // Find the current runner
  const currentRunner = getCurrentRunner(legs, new Date());

  // Check if there are any legs that should have times but don't
  const hasIncompleteLegs = legs.some(leg => {
    // Leg 1 might not have started yet
    if (leg.id === 1) return false;
    
    // Don't check the current runner
    if (currentRunner && currentRunner.id === leg.id) return false;
    
    // Check if previous leg finished but current leg hasn't started
    const previousLeg = legs.find(l => l.id === leg.id - 1);
    if (previousLeg?.actualFinish && !leg.actualStart) {
      return true;
    }
    
    // Check if current leg started but hasn't finished AND next leg has started
    // (this indicates the current leg should have finished)
    const nextLeg = legs.find(l => l.id === leg.id + 1);
    if (leg.actualStart && !leg.actualFinish && nextLeg?.actualStart) {
      return true;
    }
    
    // Check if this is a previous leg that should have finished
    if (currentRunner && leg.id < currentRunner.id && !leg.actualFinish) {
      return true;
    }
    
    return false;
  });

  return hasIncompleteLegs;
};

/**
 * User-friendly function to validate and repair impossible leg states
 * This can be called from the UI to fix data inconsistencies
 */
export const validateAndRepairLegStates = async (legs: Leg[], runners: Runner[], teamId?: string): Promise<{
  repaired: boolean;
  changes: string[];
  issues: string[];
  warnings: string[];
}> => {
  console.log('[validateAndRepairLegStates] Starting validation and repair...');
  
  // Import the repair function from raceUtils
  const { detectAndRepairImpossibleLegStates, validateLegStateIntegrity } = await import('@/utils/raceUtils');
  
  // First, validate the current state
  const integrityValidation = validateLegStateIntegrity(legs);
  
  // Then attempt to repair any impossible states
  const repairResult = detectAndRepairImpossibleLegStates(legs);
  
  if (repairResult.repaired) {
    console.log('[validateAndRepairLegStates] Auto-repaired impossible leg states:', repairResult.changes);
  }
  
  // Also check for missing time conflicts
  const missingTimeConflicts = await detectMissingTimeConflicts(legs, runners, teamId);
  
  return {
    repaired: repairResult.repaired,
    changes: repairResult.changes,
    issues: integrityValidation.issues,
    warnings: [...integrityValidation.warnings, ...missingTimeConflicts.map(c => `Missing ${c.field} for Leg ${c.legId} (${c.runnerName})`)]
  };
};

export class DataConsistencyManager {
  private processingTeams = new Set<string>();
  private locks = new Map<string, Promise<any>>();
  
  async withTeamLock<T>(teamId: string, operation: () => Promise<T>): Promise<T> {
    if (this.processingTeams.has(teamId)) {
      throw new Error(`Team ${teamId} is currently being updated`);
    }
    
    this.processingTeams.add(teamId);
    
    try {
      return await operation();
    } finally {
      this.processingTeams.delete(teamId);
    }
  }
  
  async validateDataIntegrity(teamId: string): Promise<ValidationResult> {
    const { data: team, error } = await supabase
      .from('teams')
      .select(`
        id,
        runners (id, name),
        legs (id, number, runner_id)
      `)
      .eq('id', teamId)
      .single();
    
    if (error || !team) {
      return {
        isValid: false,
        issues: [`Failed to fetch team data: ${error?.message || 'Unknown error'}`],
        warnings: []
      };
    }
    
    const issues: string[] = [];
    const warnings: string[] = [];
    
    // Check for orphaned legs
    const runnerIds = new Set(team.runners.map((r: any) => r.id));
    const orphanedLegs = team.legs.filter((l: any) => !runnerIds.has(l.runner_id));
    
    if (orphanedLegs.length > 0) {
      issues.push(`Found ${orphanedLegs.length} legs assigned to non-existent runners`);
    }
    
    // Check for duplicate leg numbers
    const legNumbers = team.legs.map((l: any) => l.number);
    const duplicateNumbers = legNumbers.filter((num, index) => legNumbers.indexOf(num) !== index);
    
    if (duplicateNumbers.length > 0) {
      issues.push(`Found duplicate leg numbers: ${duplicateNumbers.join(', ')}`);
    }
    
    // Check for missing leg numbers
    const expectedLegNumbers = Array.from({ length: team.legs.length }, (_, i) => i + 1);
    const missingNumbers = expectedLegNumbers.filter(num => !legNumbers.includes(num));
    
    if (missingNumbers.length > 0) {
      warnings.push(`Missing leg numbers: ${missingNumbers.join(', ')}`);
    }
    
    // Check for teams with no runners
    if (team.runners.length === 0) {
      warnings.push('Team has no runners assigned');
    }
    
    // Check for teams with no legs
    if (team.legs.length === 0) {
      warnings.push('Team has no legs defined');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      warnings
    };
  }
  
  async repairDataIntegrity(teamId: string): Promise<RepairResult> {
    const validation = await this.validateDataIntegrity(teamId);
    
    if (validation.isValid) {
      return { repaired: false, message: 'No repairs needed' };
    }
    
    // Attempt to repair common issues
    const repairs: string[] = [];
    
    // Remove orphaned legs
    if (validation.issues.some(issue => issue.includes('orphaned'))) {
      const { error } = await supabase
        .from('legs')
        .delete()
        .eq('team_id', teamId)
        .is('runner_id', null);
      
      if (!error) {
        repairs.push('Removed orphaned legs');
      }
    }
    
    // Fix duplicate leg numbers
    if (validation.issues.some(issue => issue.includes('duplicate'))) {
      // This would require more complex logic to fix duplicates
      // For now, just log the issue
      repairs.push('Noted duplicate leg numbers (manual fix required)');
    }
    
    return {
      repaired: repairs.length > 0,
      repairs,
      message: repairs.length > 0 ? `Repaired: ${repairs.join(', ')}` : 'Unable to repair automatically'
    };
  }
  
  async validateAllTeams(): Promise<Map<string, ValidationResult>> {
    const { data: teams } = await supabase
      .from('teams')
      .select('id');
    
    if (!teams) {
      return new Map();
    }
    
    const results = new Map<string, ValidationResult>();
    
    // Validate teams in parallel with concurrency limit
    const concurrencyLimit = 5;
    const chunks = [];
    
    for (let i = 0; i < teams.length; i += concurrencyLimit) {
      chunks.push(teams.slice(i, i + concurrencyLimit));
    }
    
    for (const chunk of chunks) {
      const promises = chunk.map(async (team) => {
        const validation = await this.validateDataIntegrity(team.id);
        return [team.id, validation] as [string, ValidationResult];
      });
      
      const chunkResults = await Promise.all(promises);
      chunkResults.forEach(([teamId, validation]) => {
        results.set(teamId, validation);
      });
    }
    
    return results;
  }
  
  async getDataIntegrityReport(): Promise<{
    totalTeams: number;
    validTeams: number;
    teamsWithIssues: number;
    teamsWithWarnings: number;
    commonIssues: string[];
  }> {
    const validationResults = await this.validateAllTeams();
    
    const totalTeams = validationResults.size;
    const validTeams = Array.from(validationResults.values()).filter(r => r.isValid).length;
    const teamsWithIssues = Array.from(validationResults.values()).filter(r => r.issues.length > 0).length;
    const teamsWithWarnings = Array.from(validationResults.values()).filter(r => r.warnings.length > 0).length;
    
    // Collect common issues
    const allIssues = Array.from(validationResults.values()).flatMap(r => r.issues);
    const issueCounts = new Map<string, number>();
    
    allIssues.forEach(issue => {
      issueCounts.set(issue, (issueCounts.get(issue) || 0) + 1);
    });
    
    const commonIssues = Array.from(issueCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue, count]) => `${issue} (${count} teams)`);
    
    return {
      totalTeams,
      validTeams,
      teamsWithIssues,
      teamsWithWarnings,
      commonIssues
    };
  }
}
