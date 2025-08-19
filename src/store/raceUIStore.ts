import { create } from 'zustand';

interface RaceUIStore {
  // UI state
  currentVan: 1 | 2;
  setupStep: number;
  isSetupComplete: boolean;
  didInitFromTeam: boolean;
  lastSyncedAt?: number;
  
  // UI operations
  setCurrentVan: (van: 1 | 2) => void;
  nextSetupStep: () => void;
  prevSetupStep: () => void;
  setSetupStep: (step: number) => void;
  completeSetup: () => void;
  markSetupComplete: () => void;
  setDidInitFromTeam: (val: boolean) => void;
  setLastSyncedAt: (ts: number) => void;
  
  // Setup state
  resetSetup: () => void;
  isSetupInProgress: () => boolean;
}

export const useRaceUIStore = create<RaceUIStore>((set, get) => ({
  currentVan: 1,
  setupStep: 1,
  isSetupComplete: false,
  didInitFromTeam: false,
  lastSyncedAt: undefined,

  setCurrentVan: (van) => set({ currentVan: van }),
  
  nextSetupStep: () => set((state) => ({
    setupStep: Math.min(state.setupStep + 1, 3)
  })),
  
  prevSetupStep: () => set((state) => ({
    setupStep: Math.max(state.setupStep - 1, 1)
  })),
  
  setSetupStep: (step) => set({ setupStep: step }),
  
  completeSetup: () => set({ 
    isSetupComplete: true,
    setupStep: 3
  }),
  
  markSetupComplete: () => set({ isSetupComplete: true }),
  
  setDidInitFromTeam: (val) => set({ didInitFromTeam: val }),
  
  setLastSyncedAt: (ts) => set({ lastSyncedAt: ts }),
  
  resetSetup: () => set({
    setupStep: 1,
    isSetupComplete: false,
    didInitFromTeam: false
  }),
  
  isSetupInProgress: () => {
    const state = get();
    return !state.isSetupComplete && state.setupStep > 1;
  }
}));
