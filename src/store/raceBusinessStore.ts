import { create } from 'zustand';
import { useRaceDataStore } from './raceDataStore';
import { recalculateProjections, initializeRace } from '@/utils/raceUtils';
import { validateRaceData, createValidationReport } from '@/utils/validation';
import { eventBus, EVENT_TYPES } from '@/utils/eventBus';
import type { Runner, Leg } from '@/types/race';

interface RaceBusinessStore {
  // Business operations
  startNextRunner: (currentLegId: number | null, nextLegId: number) => void;
  assignRunnerToLegs: (runnerId: number, legIds: number[]) => void;
  setLegPaceOverride: (legIds: number[], paceSeconds?: number) => void;
  initializeLegs: () => void;
  
  // Race state operations
  validateAndFixRaceState: () => { isValid: boolean; issues: string[]; fixed: boolean };
  validateRaceData: () => { isValid: boolean; issues: string[]; warnings: string[]; suggestions: string[] };
  getValidationReport: () => string;
  
  // Undo functionality
  undoLastStartRunner: () => void;
  canUndo: () => boolean;
  getUndoDescription: () => string | null;
  
  // Data consistency
  isDataConsistent: () => boolean;
  fixDataInconsistencies: () => boolean;
  forceReset: () => void;
  
  // Offline data management
  hasOfflineData: () => boolean;
  restoreFromOffline: (runners: Runner[], legs: Leg[], isSetupComplete: boolean) => void;
}

export const useRaceBusinessStore = create<RaceBusinessStore>((set, get) => {
  // Access data store for operations
  const getDataStore = () => useRaceDataStore.getState();
  const setDataStore = (updates: any) => useRaceDataStore.setState(updates);

  return {
    startNextRunner: (currentLegId, nextLegId) => {
      const dataStore = getDataStore();
      const now = Date.now();
      
      // Update current leg finish time
      if (currentLegId) {
        const currentLeg = dataStore.getLeg(currentLegId);
        if (currentLeg && !currentLeg.actualFinish) {
          setDataStore({
            legs: dataStore.legs.map(leg => 
              leg.id === currentLegId 
                ? { ...leg, actualFinish: now }
                : leg
            )
          });
        }
      }
      
      // Update next leg start time
      if (nextLegId) {
        const nextLeg = dataStore.getLeg(nextLegId);
        if (nextLeg && !nextLeg.actualStart) {
          setDataStore({
            legs: dataStore.legs.map(leg => 
              leg.id === nextLegId 
                ? { ...leg, actualStart: now }
                : leg
            )
          });
        }
      }
      
      // Publish event for sync
      eventBus.publish({
        type: EVENT_TYPES.START_RUNNER,
        payload: {
          currentLegId,
          nextLegId,
          finishTime: currentLegId ? now : undefined,
          startTime: nextLegId ? now : undefined,
          timestamp: now
        },
        priority: 'high',
        source: 'raceBusinessStore'
      });
    },

    assignRunnerToLegs: (runnerId, legIds) => {
      const dataStore = getDataStore();
      
      setDataStore({
        legs: dataStore.legs.map(leg => 
          legIds.includes(leg.id) 
            ? { ...leg, runnerId }
            : leg
        )
      });
      
      // Recalculate projections for affected legs
      const updatedLegs = dataStore.legs.map(leg => 
        legIds.includes(leg.id) 
          ? { ...leg, runnerId }
          : leg
      );
      
      const recalculatedLegs = recalculateProjections(updatedLegs, 0, dataStore.runners, dataStore.startTime);
      setDataStore({ legs: recalculatedLegs });
    },

    setLegPaceOverride: (legIds, paceSeconds) => {
      const dataStore = getDataStore();
      
      setDataStore({
        legs: dataStore.legs.map(leg => 
          legIds.includes(leg.id) 
            ? { ...leg, paceOverride: paceSeconds }
            : leg
        )
      });
      
      // Recalculate projections
      const updatedLegs = dataStore.legs.map(leg => 
        legIds.includes(leg.id) 
          ? { ...leg, paceOverride: paceSeconds }
          : leg
      );
      
      const recalculatedLegs = recalculateProjections(updatedLegs, 0, dataStore.runners, dataStore.startTime);
      setDataStore({ legs: recalculatedLegs });
    },

    initializeLegs: () => {
      const dataStore = getDataStore();
      if (dataStore.legs.length === 0 && dataStore.runners.length > 0) {
        const initializedLegs = initializeRace(dataStore.runners, dataStore.startTime);
        setDataStore({ legs: initializedLegs });
      }
    },

    validateAndFixRaceState: () => {
      const dataStore = getDataStore();
      const validation = validateRaceData(dataStore.runners, dataStore.legs, dataStore.startTime);
      
      // Simple auto-fix for common issues
      let fixed = false;
      const issues = [...validation.issues];
      
      // Fix leg sequence issues
      for (let i = 1; i < dataStore.legs.length; i++) {
        const prevLeg = dataStore.legs[i - 1];
        const currLeg = dataStore.legs[i];
        
        if (prevLeg.actualFinish && currLeg.actualStart && currLeg.actualStart < prevLeg.actualFinish) {
          // Auto-fix: set current leg start to previous leg finish
          setDataStore({
            legs: dataStore.legs.map(leg => 
              leg.id === currLeg.id 
                ? { ...leg, actualStart: prevLeg.actualFinish }
                : leg
            )
          });
          fixed = true;
          issues.splice(issues.indexOf(`Leg ${currLeg.id} started before leg ${prevLeg.id} finished`), 1);
        }
      }
      
      return {
        isValid: validation.isValid && issues.length === 0,
        issues: issues,
        fixed
      };
    },

    validateRaceData: () => {
      const dataStore = getDataStore();
      return validateRaceData(dataStore.runners, dataStore.legs, dataStore.startTime);
    },

    getValidationReport: () => {
      const dataStore = getDataStore();
      return createValidationReport(dataStore.runners, dataStore.legs, dataStore.startTime);
    },

    undoLastStartRunner: () => {
      // Implementation would track undo history
      console.log('Undo functionality not yet implemented');
    },

    canUndo: () => {
      // Implementation would check undo history
      return false;
    },

    getUndoDescription: () => {
      // Implementation would return undo description
      return null;
    },

    isDataConsistent: () => {
      const dataStore = getDataStore();
      const validation = validateRaceData(dataStore.runners, dataStore.legs, dataStore.startTime);
      return validation.isValid;
    },

    fixDataInconsistencies: () => {
      const result = get().validateAndFixRaceState();
      return result.fixed;
    },

    forceReset: () => {
      setDataStore({
        runners: [],
        legs: [],
        startTime: new Date('2025-08-22T13:00').getTime(),
        teamId: undefined
      });
    },

    hasOfflineData: () => {
      try {
        const storedRunners = localStorage.getItem('relay_offline_runners');
        const storedLegs = localStorage.getItem('relay_offline_legs');
        return !!(storedRunners && storedLegs);
      } catch {
        return false;
      }
    },

    restoreFromOffline: (runners, legs, isSetupComplete) => {
      setDataStore({
        runners,
        legs,
        isSetupComplete
      });
    }
  };
});
