import { create } from 'zustand';
import type { RaceData, Runner, Leg } from '@/types/race';
import { initializeRace, recalculateProjections, validateRaceState, clearRunnerCache } from '@/utils/raceUtils';
import { validateRaceData, createValidationReport } from '@/utils/validation';
import { eventBus, EVENT_TYPES } from '@/utils/eventBus';

// Subscribe to real-time updates from other devices
eventBus.subscribe(EVENT_TYPES.REALTIME_UPDATE, (event) => {
  console.log('[RaceStore] Received real-time update:', event.payload);
  
  // This will trigger a UI refresh when data is updated from other devices
  // The actual data fetching is handled by useEnhancedSyncManager
});



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
  validateRaceData: () => { isValid: boolean; issues: string[]; warnings: string[]; suggestions: string[] };
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

      const now = Date.now();
      if (typeof updatedLegs[0].actualStart !== 'number') {
        updatedLegs[0] = {
          ...updatedLegs[0],
          actualStart: time <= now ? time : undefined
        } as typeof updatedLegs[number];
      }

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
    set((state) => ({ 
      ...state,
      runners: [...runners]
    }));
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

    const updatedLegs = [...state.legs];
    updatedLegs[legIndex] = { ...updatedLegs[legIndex], [field]: time };

    // Only auto-set next leg start if we're setting a finish time (not clearing it)
    if (field === 'actualFinish' && time !== null && legIndex < updatedLegs.length - 1) {
      const nextLeg = updatedLegs[legIndex + 1];
      if (!nextLeg.actualStart) {
        updatedLegs[legIndex + 1] = { ...nextLeg, actualStart: time };
      }
    }

    const finalLegs = recalculateProjections(updatedLegs, legIndex, state.runners, state.startTime);

    // Clear runner cache to ensure immediate UI updates
    clearRunnerCache();

    // Publish high-priority data event for sync
    eventBus.publish({
      type: EVENT_TYPES.LEG_UPDATE,
      payload: {
        legId: id,
        field,
        value: time,
        previousValue,
        runnerId: currentLeg.runnerId,
        timestamp: Date.now()
      },
      priority: 'high',
      source: 'raceStore'
    });

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

    // Start the next leg
    console.log('[startNextRunner] Starting leg:', nextLegId);
    updatedLegs[nextLegIndex] = { 
      ...updatedLegs[nextLegIndex], 
      actualStart: now 
    };

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

  restoreFromOffline: (runners: Runner[], legs: Leg[], isSetupComplete: boolean) => {
    set((state) => ({
      ...state,
      runners: [...runners],
      legs: [...legs],
      isSetupComplete,
      setupStep: isSetupComplete ? 3 : 1
    }));
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
      get().updateLegActualTime(mostRecentLeg.id, 'actualFinish', null);
      return;
    }
    
    // Standard case: Remove the start time from the most recent leg
    get().updateLegActualTime(mostRecentLeg.id, 'actualStart', null);
    
    // If this leg also has a finish time, remove it too
    if (mostRecentLeg.actualFinish !== undefined && mostRecentLeg.actualFinish !== null) {
      get().updateLegActualTime(mostRecentLeg.id, 'actualFinish', null);
    }
    
    // If this isn't the first leg, also remove the finish time from the previous leg
    // to restore the previous runner to "running" state
    if (mostRecentLeg.id > 1) {
      const previousLeg = legs.find(leg => leg.id === mostRecentLeg.id - 1);
      if (previousLeg && previousLeg.actualFinish !== undefined && previousLeg.actualFinish !== null) {
        get().updateLegActualTime(previousLeg.id, 'actualFinish', null);
      }
    }
  },

  canUndo: () => {
    const { legs } = get();
    
    // Find legs with actual start times
    const legsWithStartTimes = legs.filter(leg => leg.actualStart !== undefined && leg.actualStart !== null);
    
    // Check if there are currently running runners (legs with start but no finish)
    const currentlyRunning = legs.some(leg => 
      leg.actualStart !== undefined && 
      leg.actualStart !== null && 
      (leg.actualFinish === undefined || leg.actualFinish === null)
    );
    
    // Can undo if there are legs with start times AND there are currently running runners
    // This prevents undo when no one is currently running
    return legsWithStartTimes.length > 0 && currentlyRunning;
  },

  // Helper function to get what the undo action will do
  getUndoDescription: () => {
    const { legs } = get();
    
    // Find the most recent leg with an actual start time
    const legsWithStartTimes = legs
      .filter(leg => leg.actualStart !== undefined && leg.actualStart !== null)
      .sort((a, b) => (b.actualStart || 0) - (a.actualStart || 0));
    
    if (legsWithStartTimes.length === 0) return null;
    
    const mostRecentLeg = legsWithStartTimes[0];
    const isFinalLeg = mostRecentLeg.id === 36;
    const hasBothStartAndFinish = mostRecentLeg.actualStart !== null && mostRecentLeg.actualFinish !== null;
    
    if (isFinalLeg && hasBothStartAndFinish) {
      return "Undo Race Finish";
    } else if (mostRecentLeg.actualFinish !== null) {
      return "Undo Last Start/Finish";
    } else {
      return "Undo Last Start";
    }
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
    const validation = validateRaceData(state.runners, state.legs, state.startTime);
    return validation;
  },

  getValidationReport: () => {
    const state = get();
    return createValidationReport(state.runners, state.legs, state.startTime);
  }
}));
