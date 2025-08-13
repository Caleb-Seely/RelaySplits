import { create } from 'zustand';
import type { RaceData, Runner, Leg } from '@/types/race';
import { initializeRace, recalculateProjections } from '@/utils/raceUtils';

interface RaceStore extends RaceData {
  currentVan: 1 | 2;
  setupStep: number;
  isSetupComplete: boolean;
  teamId?: string;
  // Tracks if SetupWizard has initialized from team start time
  didInitFromTeam: boolean;
  // Timestamp (ms) of last successful sync to/from backend
  lastSyncedAt?: number;
  
  // Actions
  setStartTime: (time: number) => void;
  updateRunner: (id: number, updates: Partial<Runner>) => void;
  setRunners: (runners: Runner[]) => void;
  updateLegDistance: (id: number, distance: number) => void;
  updateLegActualTime: (id: number, field: 'actualStart' | 'actualFinish', time: number) => void;
  setCurrentVan: (van: 1 | 2) => void;
  nextSetupStep: () => void;
  prevSetupStep: () => void;
  setSetupStep: (step: number) => void;
  completeSetup: () => void;
  initializeLegs: () => void;
  setTeamId: (teamId: string) => void;
  setRaceData: (data: Partial<{ runners: Runner[]; legs: Leg[]; startTime: number; isSetupComplete: boolean }>) => void;
  isDataConsistent: () => boolean;
  forceReset: () => void;
  // Set last sync time
  setLastSyncedAt: (ts: number) => void;
  // New offline support methods
  hasOfflineData: () => boolean;
  restoreFromOffline: (runners: Runner[], legs: Leg[], isSetupComplete: boolean) => void;
  markSetupComplete: () => void;
  setDidInitFromTeam: (val: boolean) => void;
  // New: reassign provided legs to a runner
  assignRunnerToLegs: (runnerId: number, legIds: number[]) => void;
  // New: set or clear per-leg pace override (seconds per mile) for given legs
  setLegPaceOverride: (legIds: number[], paceSeconds?: number) => void;
}

const defaultRunners: Runner[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  name: `Runner ${i + 1}`,
  pace: 420, // 7:00 pace default
  van: (i < 6 ? 1 : 2) as 1 | 2
}));

export const useRaceStore = create<RaceStore>((set, get) => ({
  startTime: Date.now(),
  runners: defaultRunners,
  legs: [],
  currentVan: 1,
  setupStep: 1,
  isSetupComplete: false,
  teamId: undefined,
  didInitFromTeam: false,
  lastSyncedAt: undefined,

  setStartTime: (time) => set((state) => {
    // If legs are already initialized, update projections and handle leg 1 actual start reset if needed
    if (state.legs.length > 0) {
      const updatedLegs = [...state.legs];
      const firstLeg = updatedLegs[0];
      // Always update projected start to the new official start time
      updatedLegs[0] = {
        ...firstLeg,
        projectedStart: time,
        // Note: we don't set actualStart here unless we are explicitly resetting it below
      };

      // Simplified rule: leg 1 actual start is the official start time if it's in the past; otherwise undefined
      const now = Date.now();
      // Only set actualStart if it is not already defined; never overwrite a real actual start
      if (typeof updatedLegs[0].actualStart !== 'number') {
        updatedLegs[0] = {
          ...updatedLegs[0],
          actualStart: time <= now ? time : undefined
        } as typeof updatedLegs[number];
      }

      // Recalculate all projections from the first leg
      const finalLegs = recalculateProjections(updatedLegs, 0, state.runners);
      return { startTime: time, legs: finalLegs };
    }
    return { startTime: time };
  }),
  
  updateRunner: (id, updates) => set((state) => {
    const updatedRunners = state.runners.map(runner => 
      runner.id === id ? { ...runner, ...updates } : runner
    );
    
    // If pace is updated and legs are initialized, recalculate all projections
    if (updates.pace && state.legs.length > 0) {
      const updatedLegs = recalculateProjections(state.legs, 0, updatedRunners);
      return { runners: updatedRunners, legs: updatedLegs };
    }
    
    return { runners: updatedRunners };
  }),

  setRunners: (runners) => {
    set((state) => ({ 
      ...state,
      runners: [...runners] // Force array copy to ensure reactivity
    }));
  },

  updateLegDistance: (id, distance) => set((state) => {
    const updatedLegs = state.legs.map(leg => 
      leg.id === id ? { ...leg, distance } : leg
    );
    
    // Recalculate projections from the updated leg onwards
    const updatedIndex = updatedLegs.findIndex(leg => leg.id === id);
    const finalLegs = recalculateProjections(updatedLegs, updatedIndex, state.runners);
    
    return { legs: finalLegs };
  }),

  updateLegActualTime: (id, field, time) => set((state) => {
    const legIndex = state.legs.findIndex(leg => leg.id === id);
    if (legIndex === -1) return state;

    const updatedLegs = [...state.legs];
    updatedLegs[legIndex] = { ...updatedLegs[legIndex], [field]: time };

    // If we're setting actualFinish, auto-populate next leg's actualStart
    if (field === 'actualFinish' && legIndex < updatedLegs.length - 1) {
      const nextLeg = updatedLegs[legIndex + 1];
      if (!nextLeg.actualStart) {
        updatedLegs[legIndex + 1] = { ...nextLeg, actualStart: time };
      }
    }

    // Always recalculate projections when actual times are updated
    const finalLegs = recalculateProjections(updatedLegs, legIndex, state.runners);

    return { legs: finalLegs };
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
    set({ isSetupComplete: true });
  },

  // New method to mark setup as complete (alias for better semantics)
  markSetupComplete: () => {
    set({ isSetupComplete: true });
  },

  setDidInitFromTeam: (val) => set({ didInitFromTeam: val }),

  initializeLegs: () => set((state) => {
    const initialLegs = initializeRace(state.startTime, state.runners);
    // Do NOT set the first leg's actual start time here.
    // actualStart should remain undefined until the race actually starts.
    return { legs: initialLegs };
  }),

  setTeamId: (teamId) => {
    set({ teamId });
  },

  // CRITICAL: New method to set multiple properties atomically to prevent race conditions
  setRaceData: (data: Partial<{ runners: Runner[]; legs: Leg[]; startTime: number; isSetupComplete: boolean }>) => {
    set((state) => ({ ...state, ...data }));
  },

  setLastSyncedAt: (ts) => set({ lastSyncedAt: ts }),

  // CRITICAL: Method to check if data is in a consistent state
  isDataConsistent: () => {
    const state = get();
    
    // Data is consistent if we have valid runners with reasonable data
    // Names can be empty when coming from server; only validate structural fields
    const hasValidRunners = state.runners.length === 12 &&
      state.runners.every(r =>
        r.id >= 1 && r.id <= 12 &&
        typeof r.pace === 'number' && r.pace > 0 &&
        (r.van === 1 || r.van === 2)
      );
    
    return hasValidRunners;
  },

  // CRITICAL: Method to force reset store if data corruption is detected
  forceReset: () => {
    const currentStart = get().startTime; // Preserve existing official start time
    const defaultRunners: Runner[] = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      name: `Runner ${i + 1}`,
      pace: 420, // 7:00 pace default
      van: (i < 6 ? 1 : 2) as 1 | 2
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

  // New offline support methods
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
    const finalLegs = recalculateProjections(updatedLegs, 0, state.runners);
    return { legs: finalLegs };
  }),

  setLegPaceOverride: (legIds, paceSeconds) => set((state) => {
    if (!Array.isArray(legIds) || legIds.length === 0) return state;
    const updatedLegs = state.legs.map(leg =>
      legIds.includes(leg.id)
        ? { ...leg, paceOverride: paceSeconds }
        : leg
    );
    const finalLegs = recalculateProjections(updatedLegs, 0, state.runners);
    return { legs: finalLegs };
  })
}));
