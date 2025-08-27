import { create } from 'zustand';

import { eventBus, EVENT_TYPES } from '@/utils/eventBus';
import { recalculateProjections, clearRunnerCache, validateTimeUpdate, autoFixSingleRunnerViolations, initializeRace, validateRaceState, validateSingleRunnerRule, detectAndRepairImpossibleLegStates, validateLegStateIntegrity } from '@/utils/raceUtils';
import type { RaceData, Runner, Leg } from '@/types/race';
import { validateRaceData, createValidationReport } from '@/utils/validation';
import { repairRaceDataComprehensive, createRepairReport } from '@/utils/dataRepair';

// Subscribe to real-time updates from other devices
eventBus.subscribe(EVENT_TYPES.REALTIME_UPDATE, (event) => {
  console.log('[RaceStore] Received real-time update:', event.payload);
  
  // This will trigger a UI refresh when data is updated from other devices
  // The actual data fetching is handled by useEnhancedSyncManager
});

// Helper function to trigger leaderboard update after projections are recalculated
async function triggerLeaderboardUpdateAfterRecalculation(teamId: string | undefined, legs: Leg[], currentLeg: number) {
  if (!teamId) return;
  
  try {
    console.log('[RaceStore] Triggering leaderboard update after recalculation for team:', teamId, 'currentLeg:', currentLeg);
    
    // Find the current leg that's running or the next leg to start
    const currentLegData = legs.find(leg => leg.id === currentLeg);
    const lastCompletedLeg = legs.filter(leg => leg.actualFinish).sort((a, b) => b.id - a.id)[0];
    
    const lastLegCompletedAt = lastCompletedLeg?.actualFinish || Date.now();
    
    // Import and call the leaderboard update function
    const { triggerLeaderboardUpdateOnLegStart } = await import('@/services/leaderboard');
    const success = await triggerLeaderboardUpdateOnLegStart(teamId, currentLeg, lastLegCompletedAt);
    
    if (success) {
      console.log('[RaceStore] Leaderboard update triggered successfully');
    } else {
      console.warn('[RaceStore] Leaderboard update failed');
    }
  } catch (error) {
    console.error('[RaceStore] Failed to trigger leaderboard update after recalculation:', error);
  }
}

// Helper function to get the current leg number
function getCurrentLegNumber(legs: Leg[]): number {
  // Find the leg that's currently running (has start time but no finish time)
  const runningLeg = legs.find(leg => leg.actualStart && !leg.actualFinish);
  if (runningLeg) {
    return runningLeg.id;
  }
  
  // If no leg is running, find the next leg to start
  const lastCompletedLeg = legs.filter(leg => leg.actualFinish).sort((a, b) => b.id - a.id)[0];
  if (lastCompletedLeg) {
    return lastCompletedLeg.id + 1;
  }
  
  // If no legs have been completed, start with leg 1
  return 1;
}


interface RaceStore extends RaceData {
  runners: (Runner & { updated_at: string | null; remoteId?: string })[];
  legs: (Leg & { updated_at: string | null; remoteId?: string })[];
  currentVan: 1 | 2;
  setupStep: number;
  isSetupComplete: boolean;
  teamId?: string;
  didInitFromTeam: boolean;
  lastSyncedAt?: number;
  
  setStartTime: (time: number) => void;
  updateRunner: (id: number, updates: Partial<Runner>) => void;
  setRunners: (runners: Runner[]) => void;
  updateLegDistance: (id: number, distance: number) => void;
  updateLegActualTime: (id: number, field: 'actualStart' | 'actualFinish', time: number | null) => void;
  startNextRunner: (currentLegId: number | null, nextLegId: number) => void;
  setCurrentVan: (van: 1 | 2) => void;
  nextSetupStep: () => void;
  prevSetupStep: () => void;
  setSetupStep: (step: number) => void;
  completeSetup: () => void;
  initializeLegs: () => void;
  setTeamId: (teamId: string | undefined) => void;
  setRaceData: (data: Partial<{ runners: Runner[]; legs: Leg[]; startTime: number; isSetupComplete: boolean }>) => void;
  isDataConsistent: () => boolean;
  fixDataInconsistencies: () => boolean;
  forceReset: () => void;
  setLastSyncedAt: (ts: number) => void;
  hasOfflineData: () => boolean;
  restoreFromOffline: (runners: Runner[], legs: Leg[], isSetupComplete: boolean) => void;
  markSetupComplete: () => void;
  setDidInitFromTeam: (val: boolean) => void;
  assignRunnerToLegs: (runnerId: number, legIds: number[]) => void;
  setLegPaceOverride: (legIds: number[], paceSeconds?: number) => void;

  upsertRunner: (runner: Runner) => void;
  deleteRunner: (runnerId: number) => void;
  upsertLeg: (leg: Leg) => void;
  deleteLeg: (legId: number) => void;
  
  // Undo functionality
  undoLastStartRunner: () => void;
  canUndo: () => boolean;
  getUndoDescription: () => string | null;
  validateAndFixRaceState: () => { isValid: boolean; issues: string[]; fixed: boolean };
  validateRaceData: () => { isValid: boolean; issues: string[]; warnings: string[] };
  validateSingleRunnerRule: () => { isValid: boolean; issues: string[]; runningLegs: Leg[] };
  autoFixSingleRunnerViolations: () => { fixed: boolean; changes: string[] };
  validateAndRepairLegStates: () => { isValid: boolean; issues: string[]; repaired: boolean; changes: string[] };
  getValidationReport: () => string;
}

const defaultRunners: Runner[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  name: `Runner ${i + 1}`,
  pace: 420, // 7:00 pace default
  van: (i < 6 ? 1 : 2) as 1 | 2,
  remoteId: undefined,
  updated_at: null
}));

export const useRaceStore = create<RaceStore>((set, get) => ({
  startTime: new Date('2025-08-22T13:00').getTime(), // Default to 08/22/25 1:00 PM
  runners: defaultRunners,
  legs: [],
  currentVan: 1,
  setupStep: 1,
  isSetupComplete: false,
  teamId: undefined,
  didInitFromTeam: false,
  lastSyncedAt: undefined,

  setStartTime: (time) => set((state) => {
    if (state.legs.length > 0) {
      const updatedLegs = [...state.legs];
      const firstLeg = updatedLegs[0];
      updatedLegs[0] = {
        ...firstLeg,
        projectedStart: time,
      };

      // FIXED: Don't automatically set actualStart based on current time
      // actualStart should only be set when the race actually starts
      // The previous logic was causing the dashboard to show current time instead of saved start time

      const finalLegs = recalculateProjections(updatedLegs, 0, state.runners, time);
      
      return { startTime: time, legs: finalLegs };
    }
    return { startTime: time };
  }),
  
  updateRunner: (id, updates) => set((state) => {
    const currentRunner = state.runners.find(r => r.id === id);
    if (!currentRunner) return state;

    const updatedRunners = state.runners.map(runner => 
      runner.id === id ? { ...runner, ...updates } : runner
    );
    
    if (updates.pace && state.legs.length > 0) {
      const updatedLegs = recalculateProjections(state.legs, 0, updatedRunners, state.startTime);
      
      // Publish high-priority data event for sync
      eventBus.publish({
        type: EVENT_TYPES.RUNNER_UPDATE,
        payload: {
          runnerId: id,
          updates,
          previousValues: {
            name: currentRunner.name,
            pace: currentRunner.pace,
            van: currentRunner.van
          },
          timestamp: Date.now()
        },
        priority: 'high',
        source: 'raceStore'
      });
      
      // Trigger leaderboard update when pace changes affect projected finish time
      if (updates.pace !== currentRunner.pace && state.teamId) {
        const currentLeg = getCurrentLegNumber(updatedLegs);
        triggerLeaderboardUpdateAfterRecalculation(state.teamId, updatedLegs, currentLeg);
      }
      
      return { runners: updatedRunners, legs: updatedLegs };
    }
    
    // Publish high-priority data event for sync
    eventBus.publish({
      type: EVENT_TYPES.RUNNER_UPDATE,
      payload: {
        runnerId: id,
        updates,
        previousValues: {
          name: currentRunner.name,
          pace: currentRunner.pace,
          van: currentRunner.van
        },
        timestamp: Date.now()
      },
      priority: 'high',
      source: 'raceStore'
    });
    
    return { runners: updatedRunners };
  }),

  setRunners: (runners) => {
    set((state) => { 
      const updatedRunners = [...runners];
      
      // CRITICAL FIX: Save runner data to localStorage immediately to prevent data loss
      if (state.teamId) {
        try {
          localStorage.setItem(`relay_runners_${state.teamId}`, JSON.stringify(updatedRunners));
          localStorage.setItem(`relay_runners_timestamp_${state.teamId}`, Date.now().toString());
        } catch (error) {
          console.error('[RaceStore] Failed to save runners to localStorage:', error);
        }
      }
      
      return { 
        ...state,
        runners: updatedRunners
      };
    });
  },

  updateLegDistance: (id, distance) => set((state) => {
    const updatedLegs = state.legs.map(leg => 
      leg.id === id ? { ...leg, distance } : leg
    );
    
    const updatedIndex = updatedLegs.findIndex(leg => leg.id === id);
    const finalLegs = recalculateProjections(updatedLegs, updatedIndex, state.runners, state.startTime);
    
    return { legs: finalLegs };
  }),

  updateLegActualTime: (id, field, time) => set((state) => {
    const legIndex = state.legs.findIndex(leg => leg.id === id);
    if (legIndex === -1) return state;

    const currentLeg = state.legs[legIndex];
    const previousValue = currentLeg[field];

    // ENHANCED VALIDATION: Check for impossible states before making changes
    const validation = validateTimeUpdate(state.legs, id, field, time);
    if (!validation.isValid) {
      console.warn('[RaceStore] Time update validation failed:', validation.issues);
      // For now, we'll still allow the update but log the issues
      // In the future, we could show a confirmation dialog or prevent the update
    }

    // Check for warnings about potential issues
    if (validation.warnings.length > 0) {
      console.warn('[RaceStore] Time update warnings:', validation.warnings);
    }

    let updatedLegs = [...state.legs];
    updatedLegs[legIndex] = { ...updatedLegs[legIndex], [field]: time };

    // CRITICAL FIX: Auto-start next runner when current runner finishes
    if (field === 'actualFinish' && time !== null && legIndex < updatedLegs.length - 1) {
      const nextLeg = updatedLegs[legIndex + 1];
      if (!nextLeg.actualStart) {
        console.log(`[RaceStore] Auto-starting next runner for leg ${nextLeg.id} at ${new Date(time).toISOString()}`);
        updatedLegs[legIndex + 1] = { ...nextLeg, actualStart: time };
      }
    }

    // AUTO-REPAIR: Fix any impossible leg states that might exist
    const impossibleStateRepair = detectAndRepairImpossibleLegStates(updatedLegs);
    if (impossibleStateRepair.repaired) {
      console.log('[RaceStore] Auto-repaired impossible leg states:', impossibleStateRepair.changes);
      updatedLegs = impossibleStateRepair.updatedLegs;
    }

    // Auto-fix any single runner rule violations
    const autoFix = autoFixSingleRunnerViolations(updatedLegs);
    if (autoFix.fixed) {
      console.log('[RaceStore] Auto-fixed single runner violations:', autoFix.changes);
      updatedLegs.splice(0, updatedLegs.length, ...autoFix.updatedLegs);
    }

    const finalLegs = recalculateProjections(updatedLegs, legIndex, state.runners, state.startTime);

    // Clear runner cache to ensure immediate UI updates
    clearRunnerCache();
    
    // Publish high-priority data event for sync
    eventBus.publish({
      type: EVENT_TYPES.LEG_UPDATE,
      payload: {
        legId: id,
        field: field === 'actualStart' ? 'start' : 'finish',
        value: time,
        previousValue,
        runnerId: currentLeg.runnerId,
        timestamp: Date.now(),
        source: 'raceStore'
      },
      priority: 'high',
      source: 'raceStore'
    });

    // Update leaderboard when projections are recalculated (leg started, finished, or pace changed)
    if ((field === 'actualStart' || field === 'actualFinish') && time !== null && state.teamId) {
      // Trigger leaderboard update with the updated projections
      const currentLeg = getCurrentLegNumber(finalLegs);
      triggerLeaderboardUpdateAfterRecalculation(state.teamId, finalLegs, currentLeg);
    }

    // Special case: Update leaderboard when leg 36 finishes (race completion)
    if (field === 'actualFinish' && time !== null && state.teamId && id === 36) {
      console.log('[RaceStore] Race completion detected! Leg 36 finished at:', new Date(time).toISOString());
      // Trigger leaderboard update to mark race as finished
      import('@/services/leaderboard').then(async ({ triggerLeaderboardUpdateOnLegStart }) => {
        try {
          // Pass leg 37 to indicate race completion
          console.log('[RaceStore] Triggering leaderboard update for race completion with time:', new Date(time).toISOString());
          const success = await triggerLeaderboardUpdateOnLegStart(state.teamId!, 37, time);
          if (success) {
            console.log('[RaceStore] Race completion leaderboard update successful');
          } else {
            console.warn('[RaceStore] Race completion leaderboard update failed');
          }
        } catch (error) {
          console.error('[RaceStore] Failed to trigger leaderboard update on race completion:', error);
        }
      }).catch(error => {
        console.error('Failed to import leaderboard service for race completion:', error);
      });
    }

    // Update last synced timestamp to indicate local change
    return { legs: finalLegs, lastSyncedAt: Date.now() };
  }),

  // Simple timekeeping function - start the next leg
  startNextRunner: (currentLegId: number | null, nextLegId: number) => set((state) => {
    // Validate input parameters
    if ((currentLegId !== null && typeof currentLegId !== 'number') || typeof nextLegId !== 'number') {
      console.warn('[startNextRunner] Invalid parameters:', { currentLegId, nextLegId });
      return state;
    }

    const nextLegIndex = state.legs.findIndex(leg => leg.id === nextLegId);
    if (nextLegIndex === -1) {
      console.warn('[startNextRunner] Invalid next leg ID:', nextLegId);
      return state;
    }

    const now = Date.now();
    const updatedLegs = [...state.legs];

    // If there's a current leg, finish it first
    if (currentLegId !== null) {
      const currentLegIndex = state.legs.findIndex(leg => leg.id === currentLegId);
      if (currentLegIndex !== -1) {
        const currentLeg = state.legs[currentLegIndex];
        if (currentLeg.actualStart && !currentLeg.actualFinish) {
          console.log('[startNextRunner] Finishing leg:', currentLeg.id);
          updatedLegs[currentLegIndex] = { 
            ...currentLeg, 
            actualFinish: now 
          };
        }
      }
    }

    // Validate that starting the next leg won't violate the single runner rule
    const proposedLegs = updatedLegs.map((leg, index) => 
      index === nextLegIndex ? { ...leg, actualStart: now } : leg
    );
    
    const validation = validateSingleRunnerRule(proposedLegs);
    if (!validation.isValid) {
      console.warn('[startNextRunner] Starting next runner would violate single runner rule:', validation.issues);
      // For now, we'll still allow it but log the warning
      // In the future, we could show a confirmation dialog
    }

    // Start the next leg
    console.log('[startNextRunner] Starting leg:', nextLegId);
    updatedLegs[nextLegIndex] = { 
      ...updatedLegs[nextLegIndex], 
      actualStart: now 
    };

    // Auto-fix any single runner rule violations
    const autoFix = autoFixSingleRunnerViolations(updatedLegs);
    if (autoFix.fixed) {
      console.log('[startNextRunner] Auto-fixed single runner violations:', autoFix.changes);
      updatedLegs.splice(0, updatedLegs.length, ...autoFix.updatedLegs);
    }

    const finalLegs = recalculateProjections(updatedLegs, nextLegIndex, state.runners, state.startTime);

    // Clear runner cache to ensure immediate UI updates
    clearRunnerCache();

    // Publish event for sync
    eventBus.publish({
      type: EVENT_TYPES.START_RUNNER,
      payload: {
        currentLegId,
        nextLegId,
        finishTime: currentLegId ? updatedLegs.find(l => l.id === currentLegId)?.actualFinish : undefined,
        startTime: now,
        timestamp: Date.now()
      },
      priority: 'high',
      source: 'raceStore'
    });

    // Update leaderboard when a new leg starts
    if (state.teamId) {
      // Trigger leaderboard update asynchronously
      import('@/services/leaderboard').then(async ({ triggerLeaderboardUpdateOnLegStart }) => {
        try {
          const success = await triggerLeaderboardUpdateOnLegStart(state.teamId!, nextLegId, now);
          if (success) {
            console.log('[RaceStore] Leg start leaderboard update successful');
          } else {
            console.warn('[RaceStore] Leg start leaderboard update failed');
          }
        } catch (error) {
          console.error('[RaceStore] Failed to trigger leaderboard update on leg start:', error);
        }
      }).catch(error => {
        console.error('Failed to import leaderboard service for leg start:', error);
      });
    }

    return { legs: finalLegs, lastSyncedAt: Date.now() };
  }),

  setCurrentVan: (van) => set({ currentVan: van }),

  nextSetupStep: () => set((state) => ({ 
    setupStep: Math.min(state.setupStep + 1, 3) 
  })),

  prevSetupStep: () => set((state) => ({ 
    setupStep: Math.max(state.setupStep - 1, 1) 
  })),

  setSetupStep: (step) => set(() => ({
    setupStep: Math.max(1, Math.min(step, 3))
  })),

  completeSetup: () => {
    const state = get();
    set({ isSetupComplete: true });
    
    // Persist setup completion to localStorage
    if (state.teamId) {
      localStorage.setItem(`relay_setup_locked_${state.teamId}`, '1');
      console.log('[RaceStore] Setup completion persisted for team:', state.teamId);
      
      // Create leaderboard entry after setup is complete
      import('@/services/leaderboard').then(({ createInitialLeaderboardEntry }) => {
        createInitialLeaderboardEntry(state.teamId!, state.startTime);
      }).catch(error => {
        console.error('[RaceStore] Failed to create leaderboard entry:', error);
      });
    }
  },

  markSetupComplete: () => {
    const state = get();
    set({ isSetupComplete: true });
    
    // Persist setup completion to localStorage
    if (state.teamId) {
      localStorage.setItem(`relay_setup_locked_${state.teamId}`, '1');
      console.log('[RaceStore] Setup completion marked for team:', state.teamId);
    }
  },

  setDidInitFromTeam: (val) => set({ didInitFromTeam: val }),

  initializeLegs: () => set((state) => {
    try {
      // Ensure we have valid runners before initializing legs
      if (!state.runners || state.runners.length === 0) {
        console.warn('[initializeLegs] No runners available, creating default runners');
        const defaultRunners: Runner[] = Array.from({ length: 12 }, (_, i) => ({
          id: i + 1,
          name: `Runner ${i + 1}`,
          pace: 420, // 7:00 pace default
          van: (i < 6 ? 1 : 2) as 1 | 2,
          remoteId: undefined,
          updated_at: null
        }));
        
        // Update runners first, then initialize legs
        const initialLegs = initializeRace(state.startTime, defaultRunners);
        return { runners: defaultRunners, legs: initialLegs };
      }

      // Validate existing runners before initialization
      const validRunners = state.runners.filter(runner => 
        runner && 
        typeof runner.id === 'number' && 
        runner.id > 0 && 
        typeof runner.pace === 'number' && 
        runner.pace > 0 &&
        (runner.van === 1 || runner.van === 2)
      );

      if (validRunners.length === 0) {
        console.warn('[initializeLegs] No valid runners found, creating default runners');
        const defaultRunners: Runner[] = Array.from({ length: 12 }, (_, i) => ({
          id: i + 1,
          name: `Runner ${i + 1}`,
          pace: 420, // 7:00 pace default
          van: (i < 6 ? 1 : 2) as 1 | 2,
          remoteId: undefined,
          updated_at: null
        }));
        
        const initialLegs = initializeRace(state.startTime, defaultRunners);
        return { runners: defaultRunners, legs: initialLegs };
      }

      if (validRunners.length !== state.runners.length) {
        console.warn(`[initializeLegs] Filtered out ${state.runners.length - validRunners.length} invalid runners`);
        // Use only valid runners for initialization
        const initialLegs = initializeRace(state.startTime, validRunners);
        return { runners: validRunners, legs: initialLegs };
      }

      // All runners are valid, proceed with initialization
      const initialLegs = initializeRace(state.startTime, state.runners);
      return { legs: initialLegs };
    } catch (error) {
      console.error('[initializeLegs] Failed to initialize legs:', error);
      
      // Fallback: create default race state
      const defaultRunners: Runner[] = Array.from({ length: 12 }, (_, i) => ({
        id: i + 1,
        name: `Runner ${i + 1}`,
        pace: 420, // 7:00 pace default
        van: (i < 6 ? 1 : 2) as 1 | 2,
        remoteId: undefined,
        updated_at: null
      }));
      
      try {
        const fallbackLegs = initializeRace(state.startTime, defaultRunners);
        console.log('[initializeLegs] Successfully created fallback race state');
        return { runners: defaultRunners, legs: fallbackLegs };
      } catch (fallbackError) {
        console.error('[initializeLegs] Fallback initialization also failed:', fallbackError);
        // Return empty legs array as last resort
        return { legs: [] };
      }
    }
  }),

  setTeamId: (teamId: string | undefined) => {
    set({ teamId });
  },

  setRaceData: (data: Partial<{ runners: Runner[]; legs: Leg[]; startTime: number; isSetupComplete: boolean }>) => {
    // Clear runner cache if legs data is being updated
    if (data.legs) {
      clearRunnerCache();
    }
    
    // Attempt data repair if we have complete race data
    if (data.runners && data.legs && data.startTime) {
      const raceData = { runners: data.runners, legs: data.legs, startTime: data.startTime };
      const repairedData = repairRaceDataComprehensive(raceData);
      
      if (repairedData) {
        console.log('[RaceStore] Data repair applied:', createRepairReport(raceData, repairedData));
        set((state) => ({ ...state, ...repairedData, ...data }));
        return;
      } else {
        console.warn('[RaceStore] Data repair failed, using original data');
      }
    }
    
    set((state) => ({ ...state, ...data }));
  },

  setLastSyncedAt: (ts) => set({ lastSyncedAt: ts }),

  isDataConsistent: () => {
    const state = get();
    
    const hasValidRunners = state.runners.length === 12 &&
      state.runners.every(r =>
        r.id >= 1 && r.id <= 12 &&
        typeof r.pace === 'number' && r.pace > 0 &&
        (r.van === 1 || r.van === 2)
      );
    
    // Check for leg-runner consistency
    const hasValidLegs = state.legs.every(leg => {
      if (!leg.runnerId || leg.runnerId <= 0) {
        console.warn(`[isDataConsistent] Leg ${leg.id} has invalid runnerId: ${leg.runnerId}`);
        return false;
      }
      const runner = state.runners.find(r => r.id === leg.runnerId);
      if (!runner) {
        console.warn(`[isDataConsistent] Leg ${leg.id} assigned to non-existent runner ${leg.runnerId}`);
        return false;
      }
      return true;
    });
    
    return hasValidRunners && hasValidLegs;
  },

  fixDataInconsistencies: () => {
    const state = get();
    let hasChanges = false;
    const issues: string[] = [];
    
    // First, ensure we have valid runners
    const validRunners = state.runners.filter(runner => 
      runner && 
      typeof runner.id === 'number' && 
      runner.id > 0 && 
      typeof runner.pace === 'number' && 
      runner.pace > 0 &&
      (runner.van === 1 || runner.van === 2)
    );
    
    if (validRunners.length === 0) {
      console.warn('[fixDataInconsistencies] No valid runners found, creating default runners');
      const defaultRunners: Runner[] = Array.from({ length: 12 }, (_, i) => ({
        id: i + 1,
        name: `Runner ${i + 1}`,
        pace: 420, // 7:00 pace default
        van: (i < 6 ? 1 : 2) as 1 | 2,
        remoteId: undefined,
        updated_at: null
      }));
      
      set({ runners: defaultRunners });
      hasChanges = true;
      issues.push('Created default runners due to invalid runner data');
    } else if (validRunners.length !== state.runners.length) {
      console.warn(`[fixDataInconsistencies] Filtered out ${state.runners.length - validRunners.length} invalid runners`);
      set({ runners: validRunners });
      hasChanges = true;
      issues.push(`Removed ${state.runners.length - validRunners.length} invalid runners`);
    }
    
    // Fix legs with invalid runnerIds by reassigning them based on leg number
    const fixedLegs = state.legs.map(leg => {
      if (!leg.runnerId || leg.runnerId <= 0) {
        console.warn(`[fixDataInconsistencies] Fixing leg ${leg.id} with invalid runnerId: ${leg.runnerId}`);
        // Reassign based on leg number (round-robin assignment)
        const runnerIndex = (leg.id - 1) % validRunners.length;
        const newRunnerId = validRunners[runnerIndex]?.id || 1;
        hasChanges = true;
        issues.push(`Fixed leg ${leg.id}: assigned runner ${newRunnerId} (was ${leg.runnerId})`);
        return { ...leg, runnerId: newRunnerId };
      }
      
      // Check if assigned runner exists
      const runner = validRunners.find(r => r.id === leg.runnerId);
      if (!runner) {
        console.warn(`[fixDataInconsistencies] Fixing leg ${leg.id} assigned to non-existent runner ${leg.runnerId}`);
        // Reassign based on leg number
        const runnerIndex = (leg.id - 1) % validRunners.length;
        const newRunnerId = validRunners[runnerIndex]?.id || 1;
        hasChanges = true;
        issues.push(`Fixed leg ${leg.id}: reassigned from non-existent runner ${leg.runnerId} to runner ${newRunnerId}`);
        return { ...leg, runnerId: newRunnerId };
      }
      
      return leg;
    });
    
    // Validate leg sequence integrity
    const sortedLegs = [...fixedLegs].sort((a, b) => a.id - b.id);
    for (let i = 0; i < sortedLegs.length - 1; i++) {
      const currentLeg = sortedLegs[i];
      const nextLeg = sortedLegs[i + 1];
      
      // Check for non-sequential leg IDs
      if (nextLeg.id !== currentLeg.id + 1) {
        issues.push(`Warning: Gap in leg sequence: ${currentLeg.id} -> ${nextLeg.id}`);
      }
    }
    
    if (hasChanges) {
      console.log('[fixDataInconsistencies] Fixed data inconsistencies:', issues);
      const recalculatedLegs = recalculateProjections(fixedLegs, 0, validRunners, state.startTime);
      set({ legs: recalculatedLegs });
    } else {
      console.log('[fixDataInconsistencies] No data inconsistencies found');
    }
    
    return hasChanges;
  },

  forceReset: () => {
    const currentStart = get().startTime;
    const defaultRunners: Runner[] = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      name: `Runner ${i + 1}`,
      pace: 420,
      van: (i < 6 ? 1 : 2) as 1 | 2,
      remoteId: undefined,
      updated_at: null
    }));
    
    set({
      startTime: currentStart,
      runners: defaultRunners,
      legs: [],
      currentVan: 1,
      setupStep: 1,
      isSetupComplete: false,
      teamId: undefined
    });
  },

  hasOfflineData: () => {
    const state = get();
    if (!state.teamId) return false;
    
    try {
      const offlineRunners = localStorage.getItem(`relay_tracker_${state.teamId}_runners`);
      const offlineLegs = localStorage.getItem(`relay_tracker_${state.teamId}_legs`);
      const offlineSetup = localStorage.getItem(`relay_tracker_${state.teamId}_setup`);
      
      return !!(offlineRunners || offlineLegs || offlineSetup);
    } catch (error) {
      return false;
    }
  },

  // CRITICAL FIX: Enhanced data recovery that prioritizes stored data over defaults
  restoreFromOffline: (runners: Runner[], legs: Leg[], isSetupComplete: boolean) => {
    set((state) => {
      // CRITICAL FIX: Always try to recover runner data from localStorage first
      let recoveredRunners = runners;
      if (state.teamId) {
        try {
          const storedRunners = localStorage.getItem(`relay_runners_${state.teamId}`);
          const storedTimestamp = localStorage.getItem(`relay_runners_timestamp_${state.teamId}`);
          
          if (storedRunners && storedTimestamp) {
            const parsedRunners = JSON.parse(storedRunners);
            const timestamp = parseInt(storedTimestamp);
            
            // Use stored data if it's recent (within last 24 hours) and has real names
            if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
              // CRITICAL FIX: Only use stored data if it has real runner names (not defaults)
              const hasRealNames = parsedRunners.some((r: Runner) => 
                r.name && !r.name.startsWith('Runner ')
              );
              
              if (hasRealNames) {
                console.log('[RaceStore] Recovered runner data from localStorage');
                recoveredRunners = parsedRunners;
              } else {
                console.log('[RaceStore] Stored data has default names, using provided data');
              }
            }
          }
        } catch (error) {
          console.error('[RaceStore] Failed to recover runner data from localStorage:', error);
        }
      }
      
      // CRITICAL FIX: Ensure we never display default names if we have real data
      const finalRunners = recoveredRunners.map(runner => {
        // If we have a real name, use it; otherwise keep the provided name
        if (runner.name && !runner.name.startsWith('Runner ')) {
          return runner;
        }
        return runner;
      });
      
      return {
        ...state,
        runners: finalRunners,
        legs: legs,
        isSetupComplete: isSetupComplete
      };
    });
  },

  assignRunnerToLegs: (runnerId, legIds) => set((state) => {
    if (!Array.isArray(legIds) || legIds.length === 0) return state;
    const updatedLegs = state.legs.map(leg =>
      legIds.includes(leg.id) ? { ...leg, runnerId } : leg
    );
    const finalLegs = recalculateProjections(updatedLegs, 0, state.runners, state.startTime);
    return { legs: finalLegs };
  }),

  setLegPaceOverride: (legIds, paceSeconds) => set((state) => {
    if (!Array.isArray(legIds) || legIds.length === 0) return state;
    const updatedLegs = state.legs.map(leg =>
      legIds.includes(leg.id)
        ? { ...leg, paceOverride: paceSeconds }
        : leg
    );
    const finalLegs = recalculateProjections(updatedLegs, 0, state.runners, state.startTime);
    return { legs: finalLegs };
  }),

  upsertRunner: (runner) => set((state) => {
    const runnerIndex = state.runners.findIndex((r) => r.id === runner.id);
    const updatedRunners = [...state.runners];
    if (runnerIndex > -1) {
      updatedRunners[runnerIndex] = runner;
    } else {
      updatedRunners.push(runner);
    }
    const updatedLegs = recalculateProjections(state.legs, 0, updatedRunners, state.startTime);
    return { runners: updatedRunners, legs: updatedLegs };
  }),

  deleteRunner: (runnerId) => set((state) => {
    const updatedRunners = state.runners.filter((r) => r.id !== runnerId);
    const updatedLegs = recalculateProjections(state.legs, 0, updatedRunners, state.startTime);
    return { runners: updatedRunners, legs: updatedLegs };
  }),

  upsertLeg: (leg) => set((state) => {
    const legIndex = state.legs.findIndex((l) => l.id === leg.id);
    const updatedLegs = [...state.legs];
    if (legIndex > -1) {
      updatedLegs[legIndex] = leg;
    } else {
      updatedLegs.push(leg);
    }
    const finalLegs = recalculateProjections(updatedLegs, 0, state.runners, state.startTime);
    return { legs: finalLegs };
  }),

  deleteLeg: (legId) => set((state) => {
    const updatedLegs = state.legs.filter((l) => l.id !== legId);
    const finalLegs = recalculateProjections(updatedLegs, 0, state.runners, state.startTime);
    return { legs: finalLegs };
  }),



  undoLastStartRunner: () => {
    const { legs } = get();
    
    // Find the most recent leg with an actual start time
    const legsWithStartTimes = legs
      .filter(leg => leg.actualStart !== undefined && leg.actualStart !== null)
      .sort((a, b) => (b.actualStart || 0) - (a.actualStart || 0));
    
    if (legsWithStartTimes.length === 0) return;
    
    const mostRecentLeg = legsWithStartTimes[0];
    const isFinalLeg = mostRecentLeg.id === 36; // Check if this is the final leg
    const hasBothStartAndFinish = mostRecentLeg.actualStart !== null && mostRecentLeg.actualFinish !== null;
    
    // EDGE CASE: When the race is over (leg 36 has both start and finish times),
    // we want to "unfinish" the race by only removing the finish time.
    // This preserves the actual start time of the final runner while allowing
    // the race to continue from where it was "unfinished".
    if (isFinalLeg && hasBothStartAndFinish) {
      console.log('[undoLastStartRunner] Undoing race finish for final leg');
      
      // Use direct sync for final leg undo to avoid duplicate events
      set((state) => {
        const updatedLegs = state.legs.map(leg => 
          leg.id === mostRecentLeg.id 
            ? { ...leg, actualFinish: null }
            : leg
        );
        
        const finalLegs = recalculateProjections(updatedLegs, 0, state.runners, state.startTime);
        
        // Sync directly to database
        import('@/integrations/supabase/edge').then(async ({ invokeEdge }) => {
          try {
            const deviceId = localStorage.getItem('relay_device_id') || 'unknown';
            const leg = finalLegs.find(l => l.id === mostRecentLeg.id);
            
            if (leg?.remoteId) {
              const legUpdate = {
                id: leg.remoteId,
                number: leg.id,
                distance: leg.distance || 0,
                start_time: leg.actualStart ? new Date(leg.actualStart).toISOString() : null,
                finish_time: null // This is the undo action
              };
              
              console.log('[undoLastStartRunner] Syncing final leg undo:', legUpdate);
              
              const result = await invokeEdge('legs-upsert', {
                teamId: state.teamId,
                deviceId,
                legs: [legUpdate],
                action: 'upsert'
              });
              
              if ((result as any).error) {
                console.error('[undoLastStartRunner] Failed to sync final leg undo:', (result as any).error);
              } else {
                console.log('[undoLastStartRunner] Successfully synced final leg undo');
              }
            }
          } catch (error) {
            console.error('[undoLastStartRunner] Error syncing final leg undo:', error);
          }
        }).catch(error => {
          console.error('[undoLastStartRunner] Failed to import sync function for final leg:', error);
        });
        
        return { legs: finalLegs, lastSyncedAt: Date.now() };
      });
      
      return;
    }
    
    // LOGICAL UNDO: Undo the last start/finish action
    // Batch all changes together to avoid validation conflicts
    
    // Prepare all the changes we need to make
    const changes: Array<{legId: number, field: 'actualStart' | 'actualFinish', value: number | null}> = [];
    
    // Remove the start time from the most recent leg
    changes.push({
      legId: mostRecentLeg.id,
      field: 'actualStart',
      value: null
    });
    
    // If this leg also has a finish time, remove it too
    if (mostRecentLeg.actualFinish !== undefined && mostRecentLeg.actualFinish !== null) {
      changes.push({
        legId: mostRecentLeg.id,
        field: 'actualFinish',
        value: null
      });
    }
    
    // If this isn't the first leg, restore the previous runner to "running" state
    if (mostRecentLeg.id > 1) {
      const previousLeg = legs.find(leg => leg.id === mostRecentLeg.id - 1);
      if (previousLeg && previousLeg.actualFinish !== undefined && previousLeg.actualFinish !== null) {
        changes.push({
          legId: previousLeg.id,
          field: 'actualFinish',
          value: null
        });
      }
    }
    
    // Apply all changes at once to avoid validation conflicts
    set((state) => {
      let updatedLegs = [...state.legs];
      
      // Capture previous values BEFORE making changes
      const previousValues = new Map();
      changes.forEach(change => {
        const originalLeg = state.legs.find(leg => leg.id === change.legId);
        if (originalLeg) {
          previousValues.set(change.legId, originalLeg[change.field]);
        }
      });
      
      console.log('[undoLastStartRunner] Changes to apply:', changes);
      console.log('[undoLastStartRunner] Previous values:', Object.fromEntries(previousValues));
      
      // Apply all changes
      changes.forEach(change => {
        updatedLegs = updatedLegs.map(leg => 
          leg.id === change.legId 
            ? { ...leg, [change.field]: change.value }
            : leg
        );
      });
      
      // Verify changes were applied
      changes.forEach(change => {
        const updatedLeg = updatedLegs.find(leg => leg.id === change.legId);
        console.log(`[undoLastStartRunner] After update - Leg ${change.legId} ${change.field}:`, updatedLeg?.[change.field]);
      });
      
      // IMPORTANT: Skip auto-repair during undo operations to avoid interference
      // The undo operation intentionally creates temporary "impossible" states
      // that will be resolved when the user takes the next action
      console.log('[undoLastStartRunner] Skipping auto-repair during undo operation');
      
      // Recalculate projections after all changes (without auto-repair)
      const finalLegs = recalculateProjections(updatedLegs, 0, state.runners, state.startTime);
      
      // Verify final state
      changes.forEach(change => {
        const finalLeg = finalLegs.find(leg => leg.id === change.legId);
        console.log(`[undoLastStartRunner] Final state - Leg ${change.legId} ${change.field}:`, finalLeg?.[change.field]);
      });
      
      // For undo operations, sync directly to avoid race conditions
      // This bypasses the event bus and syncs immediately
      console.log('[undoLastStartRunner] Syncing undo changes directly to database');
      
      // Import the sync function directly
      import('@/integrations/supabase/edge').then(async ({ invokeEdge }) => {
        try {
          const deviceId = localStorage.getItem('relay_device_id') || 'unknown';
          
          // Prepare all leg updates for batch sync
          const legUpdates = changes.map(change => {
            const leg = finalLegs.find(l => l.id === change.legId);
            if (!leg?.remoteId) {
              console.warn(`[undoLastStartRunner] Leg ${change.legId} has no remoteId, skipping sync`);
              return null;
            }
            
            return {
              id: leg.remoteId,
              number: leg.id,
              distance: leg.distance || 0,
              start_time: change.field === 'actualStart' ? (change.value ? new Date(change.value).toISOString() : null) : (leg.actualStart ? new Date(leg.actualStart).toISOString() : null),
              finish_time: change.field === 'actualFinish' ? (change.value ? new Date(change.value).toISOString() : null) : (leg.actualFinish ? new Date(leg.actualFinish).toISOString() : null)
            };
          }).filter(Boolean);
          
          if (legUpdates.length > 0) {
            console.log('[undoLastStartRunner] Syncing leg updates:', legUpdates);
            
            const result = await invokeEdge('legs-upsert', {
              teamId: state.teamId,
              deviceId,
              legs: legUpdates,
              action: 'upsert'
            });
            
            if ((result as any).error) {
              console.error('[undoLastStartRunner] Failed to sync undo changes:', (result as any).error);
            } else {
              console.log('[undoLastStartRunner] Successfully synced undo changes');
            }
          }
        } catch (error) {
          console.error('[undoLastStartRunner] Error syncing undo changes:', error);
        }
      }).catch(error => {
        console.error('[undoLastStartRunner] Failed to import sync function:', error);
      });
      
      // Clear runner cache to ensure immediate UI updates
      clearRunnerCache();
      
      // Update last synced timestamp to indicate local change
      return { legs: finalLegs, lastSyncedAt: Date.now() };
    });
  },

  canUndo: () => {
    const { legs, startTime } = get();
    
    console.log('[canUndo] Checking undo availability:', { startTime, legsCount: legs.length });
    
    // Find legs with actual start times
    const legsWithStartTimes = legs.filter(leg => leg.actualStart !== undefined && leg.actualStart !== null);
    
    console.log('[canUndo] Legs with start times:', legsWithStartTimes.length);
    
    // Can undo if there are any legs with start times
    // This allows undo in these scenarios:
    // 1. When someone is currently running (can undo their start)
    // 2. When the race is finished (can undo the finish to continue)
    // 3. When someone has both start and finish times (can undo both)
    const canUndo = legsWithStartTimes.length > 0;
    console.log('[canUndo] Final result:', canUndo);
    return canUndo;
  },

  // Helper function to get what the undo action will do
  getUndoDescription: () => {
    const { legs, startTime } = get();
    
    console.log('[getUndoDescription] Getting description:', { startTime, legsCount: legs.length });
    
    // Find the most recent leg with an actual start time
    const legsWithStartTimes = legs
      .filter(leg => leg.actualStart !== undefined && leg.actualStart !== null)
      .sort((a, b) => (b.actualStart || 0) - (a.actualStart || 0));
    
    console.log('[getUndoDescription] Legs with start times:', legsWithStartTimes.length);
    
    if (legsWithStartTimes.length === 0) {
      console.log('[getUndoDescription] No legs with start times, returning null');
      return null;
    }
    
    const mostRecentLeg = legsWithStartTimes[0];
    const isFinalLeg = mostRecentLeg.id === 36;
    const hasBothStartAndFinish = mostRecentLeg.actualStart !== null && mostRecentLeg.actualFinish !== null;
    
    let description;
    if (isFinalLeg && hasBothStartAndFinish) {
      description = "Restore Race (Continue)";
    } else if (mostRecentLeg.actualFinish !== null) {
      description = "Restore Previous Runner";
    } else {
      description = "Restore Previous Runner";
    }
    
    console.log('[getUndoDescription] Final description:', description);
    return description;
  },

  // Validate and fix race state inconsistencies
  validateAndFixRaceState: () => {
    // Disable automatic fixing - let the simple timekeeping system work
    const state = get();
    const validation = validateRaceState(state.legs);
    
    if (validation.isValid) {
      return { isValid: true, issues: [], fixed: false };
    }
    
    console.warn('[validateAndFixRaceState] Found issues (not auto-fixing):', validation.issues);
    
    return { 
      isValid: validation.isValid, 
      issues: validation.issues, 
      fixed: false 
    };
  },

  validateRaceData: () => {
    const state = get();
    return validateRaceData(state.runners, state.legs);
  },

  validateSingleRunnerRule: () => {
    const state = get();
    return validateSingleRunnerRule(state.legs);
  },

  autoFixSingleRunnerViolations: () => {
    const state = get();
    const result = autoFixSingleRunnerViolations(state.legs);
    if (result.fixed) {
      set({ legs: result.updatedLegs });
    }
    return { fixed: result.fixed, changes: result.changes };
  },

  getValidationReport: () => {
    const state = get();
    return createValidationReport(state.runners, state.legs, state.startTime);
  },

  validateAndRepairLegStates: () => {
    const state = get();
    
    // First, validate the current state
    const integrityValidation = validateLegStateIntegrity(state.legs);
    
    // Then attempt to repair any impossible states
    const repairResult = detectAndRepairImpossibleLegStates(state.legs);
    
    if (repairResult.repaired) {
      console.log('[validateAndRepairLegStates] Auto-repaired impossible leg states:', repairResult.changes);
      
      // Update the store with repaired legs
      set({ legs: repairResult.updatedLegs });
      
      // Recalculate projections after repair
      const updatedLegs = recalculateProjections(repairResult.updatedLegs, 0, state.runners, state.startTime);
      set({ legs: updatedLegs });
      
      // Clear runner cache to ensure immediate UI updates
      clearRunnerCache();
      
      // CRITICAL: Publish sync events for each repaired leg
      repairResult.changes.forEach(change => {
        // Extract leg ID from change message (e.g., "Auto-finished Leg 3 because Leg 4 started")
        const legMatch = change.match(/Leg (\d+)/);
        if (legMatch) {
          const legId = parseInt(legMatch[1]);
          const repairedLeg = updatedLegs.find(l => l.id === legId);
          
          if (repairedLeg && repairedLeg.actualFinish) {
            console.log(`[validateAndRepairLegStates] Publishing sync event for repaired leg ${legId}`);
            
            // Publish sync event for the repaired finish time
            eventBus.publish({
              type: EVENT_TYPES.LEG_UPDATE,
              payload: {
                legId: legId,
                field: 'finish',
                value: repairedLeg.actualFinish,
                previousValue: null, // We don't know the previous value
                runnerId: repairedLeg.runnerId,
                timestamp: Date.now(),
                source: 'autoRepair'
              },
              priority: 'high',
              source: 'autoRepair'
            });
          }
        }
      });
    }
    
    return {
      isValid: integrityValidation.isValid && !repairResult.repaired,
      issues: integrityValidation.issues,
      repaired: repairResult.repaired,
      changes: repairResult.changes
    };
  }
}));
