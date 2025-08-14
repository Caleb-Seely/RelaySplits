import { create } from 'zustand';
import type { RaceData, Runner, Leg } from '@/types/race';
import { initializeRace, recalculateProjections } from '@/utils/raceUtils';

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

      const finalLegs = recalculateProjections(updatedLegs, 0, state.runners);
      return { startTime: time, legs: finalLegs };
    }
    return { startTime: time };
  }),
  
  updateRunner: (id, updates) => set((state) => {
    const updatedRunners = state.runners.map(runner => 
      runner.id === id ? { ...runner, ...updates } : runner
    );
    
    if (updates.pace && state.legs.length > 0) {
      const updatedLegs = recalculateProjections(state.legs, 0, updatedRunners);
      return { runners: updatedRunners, legs: updatedLegs };
    }
    
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
    const finalLegs = recalculateProjections(updatedLegs, updatedIndex, state.runners);
    
    return { legs: finalLegs };
  }),

  updateLegActualTime: (id, field, time) => set((state) => {
    const legIndex = state.legs.findIndex(leg => leg.id === id);
    if (legIndex === -1) return state;

    const updatedLegs = [...state.legs];
    updatedLegs[legIndex] = { ...updatedLegs[legIndex], [field]: time };

    if (field === 'actualFinish' && legIndex < updatedLegs.length - 1) {
      const nextLeg = updatedLegs[legIndex + 1];
      if (!nextLeg.actualStart) {
        updatedLegs[legIndex + 1] = { ...nextLeg, actualStart: time };
      }
    }

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

  markSetupComplete: () => {
    set({ isSetupComplete: true });
  },

  setDidInitFromTeam: (val) => set({ didInitFromTeam: val }),

  initializeLegs: () => set((state) => {
    const initialLegs = initializeRace(state.startTime, state.runners);
    return { legs: initialLegs };
  }),

  setTeamId: (teamId) => {
    set({ teamId });
  },

  setRaceData: (data: Partial<{ runners: Runner[]; legs: Leg[]; startTime: number; isSetupComplete: boolean }>) => {
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
    
    return hasValidRunners;
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
  }),

  upsertRunner: (runner) => set((state) => {
    const runnerIndex = state.runners.findIndex((r) => r.id === runner.id);
    const updatedRunners = [...state.runners];
    if (runnerIndex > -1) {
      updatedRunners[runnerIndex] = runner;
    } else {
      updatedRunners.push(runner);
    }
    const updatedLegs = recalculateProjections(state.legs, 0, updatedRunners);
    return { runners: updatedRunners, legs: updatedLegs };
  }),

  deleteRunner: (runnerId) => set((state) => {
    const updatedRunners = state.runners.filter((r) => r.id !== runnerId);
    const updatedLegs = recalculateProjections(state.legs, 0, updatedRunners);
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
    const finalLegs = recalculateProjections(updatedLegs, 0, state.runners);
    return { legs: finalLegs };
  }),

  deleteLeg: (legId) => set((state) => {
    const updatedLegs = state.legs.filter((l) => l.id !== legId);
    const finalLegs = recalculateProjections(updatedLegs, 0, state.runners);
    return { legs: finalLegs };
  })
}));
