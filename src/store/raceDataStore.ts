import { create } from 'zustand';
import type { RaceData, Runner, Leg } from '@/types/race';

interface RaceDataStore extends RaceData {
  // Data state
  runners: (Runner & { updated_at: string | null; remoteId?: string })[];
  legs: (Leg & { updated_at: string | null; remoteId?: string })[];
  startTime: number;
  teamId?: string;
  
  // Data operations
  setStartTime: (time: number) => void;
  setRunners: (runners: Runner[]) => void;
  setLegs: (legs: Leg[]) => void;
  setTeamId: (teamId: string | undefined) => void;
  setRaceData: (data: Partial<{ runners: Runner[]; legs: Leg[]; startTime: number }>) => void;
  
  // Runner operations
  updateRunner: (id: number, updates: Partial<Runner>) => void;
  upsertRunner: (runner: Runner) => void;
  deleteRunner: (runnerId: number) => void;
  
  // Leg operations
  updateLeg: (id: number, updates: Partial<Leg>) => void;
  upsertLeg: (leg: Leg) => void;
  deleteLeg: (legId: number) => void;
  updateLegDistance: (id: number, distance: number) => void;
  updateLegActualTime: (id: number, field: 'actualStart' | 'actualFinish', time: number | null) => void;
  
  // Utility operations
  getRunner: (id: number) => Runner | undefined;
  getLeg: (id: number) => Leg | undefined;
  hasData: () => boolean;
  clearData: () => void;
  cleanupInvalidData: () => void;
}

export const useRaceDataStore = create<RaceDataStore>((set, get) => ({
  startTime: new Date('2025-08-22T13:00').getTime(),
  runners: [],
  legs: [],
  teamId: undefined,

  setStartTime: (time) => set({ startTime: time }),
  
  setRunners: (runners) => set({ runners: [...runners] }),
  
  setLegs: (legs) => set({ legs: [...legs] }),
  
  setTeamId: (teamId) => set({ teamId }),
  
  setRaceData: (data) => set((state) => ({
    ...state,
    ...data
  })),

  updateRunner: (id, updates) => set((state) => {
    const updatedRunners = state.runners.map(runner => 
      runner.id === id ? { ...runner, ...updates } : runner
    );
    return { runners: updatedRunners };
  }),

  upsertRunner: (runner) => set((state) => {
    const existingIndex = state.runners.findIndex(r => r.id === runner.id);
    if (existingIndex >= 0) {
      const updatedRunners = [...state.runners];
      updatedRunners[existingIndex] = { ...updatedRunners[existingIndex], ...runner };
      return { runners: updatedRunners };
    } else {
      return { runners: [...state.runners, runner] };
    }
  }),

  deleteRunner: (runnerId) => set((state) => ({
    runners: state.runners.filter(r => r.id !== runnerId)
  })),

  updateLeg: (id, updates) => set((state) => {
    const updatedLegs = state.legs.map(leg => 
      leg.id === id ? { ...leg, ...updates } : leg
    );
    return { legs: updatedLegs };
  }),

  upsertLeg: (leg) => set((state) => {
    const existingIndex = state.legs.findIndex(l => l.id === leg.id);
    if (existingIndex >= 0) {
      const updatedLegs = [...state.legs];
      updatedLegs[existingIndex] = { ...updatedLegs[existingIndex], ...leg };
      return { legs: updatedLegs };
    } else {
      return { legs: [...state.legs, leg] };
    }
  }),

  deleteLeg: (legId) => set((state) => ({
    legs: state.legs.filter(l => l.id !== legId)
  })),

  updateLegDistance: (id, distance) => set((state) => {
    const updatedLegs = state.legs.map(leg => 
      leg.id === id ? { ...leg, distance } : leg
    );
    return { legs: updatedLegs };
  }),

  updateLegActualTime: (id, field, time) => set((state) => {
    const updatedLegs = state.legs.map(leg => 
      leg.id === id ? { ...leg, [field]: time } : leg
    );
    return { legs: updatedLegs };
  }),

  getRunner: (id) => get().runners.find(r => r.id === id),
  
  getLeg: (id) => get().legs.find(l => l.id === id),
  
  hasData: () => {
    const state = get();
    return state.runners.length > 0 || state.legs.length > 0;
  },
  
  clearData: () => set({
    runners: [],
    legs: [],
    startTime: new Date('2025-08-22T13:00').getTime(),
    teamId: undefined
  }),

  // Clean up invalid data (legs with finish times but no start times, or future finish times)
  cleanupInvalidData: () => set((state) => {
    const cleanedLegs = state.legs.map(leg => {
      // Remove finish times that don't have start times
      if (leg.actualFinish && !leg.actualStart) {
        console.warn('[RaceDataStore] Cleaning up leg with finish time but no start time:', leg);
        return { ...leg, actualFinish: undefined };
      }
      // Remove finish times that are in the future
      if (leg.actualFinish && leg.actualFinish > Date.now()) {
        console.warn('[RaceDataStore] Cleaning up leg with future finish time:', leg);
        return { ...leg, actualFinish: undefined };
      }
      // Remove finish times that are before start times
      if (leg.actualFinish && leg.actualStart && leg.actualFinish <= leg.actualStart) {
        console.warn('[RaceDataStore] Cleaning up leg with invalid finish time:', leg);
        return { ...leg, actualFinish: undefined };
      }
      return leg;
    });

    return { legs: cleanedLegs };
  })
}));
