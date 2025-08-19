import { useRaceDataStore } from './raceDataStore';
import { useRaceUIStore } from './raceUIStore';
import { useRaceBusinessStore } from './raceBusinessStore';

/**
 * Unified race store hook that combines data, UI, and business logic stores
 * This provides a clean interface for components while maintaining separation of concerns
 */
export const useRaceStore = () => {
  const dataStore = useRaceDataStore();
  const uiStore = useRaceUIStore();
  const businessStore = useRaceBusinessStore();

  return {
    // Data state
    ...dataStore,
    
    // UI state
    ...uiStore,
    
    // Business operations
    ...businessStore,
    
    // Convenience methods that combine multiple stores
    updateRunner: (id: number, updates: Partial<any>) => {
      dataStore.updateRunner(id, updates);
      
      // If pace changed, recalculate projections
      if (updates.pace && dataStore.legs.length > 0) {
        const updatedRunners = dataStore.runners.map(runner => 
          runner.id === id ? { ...runner, ...updates } : runner
        );
        
        // This would trigger projection recalculation
        // For now, we'll let the business store handle this
        businessStore.assignRunnerToLegs(id, dataStore.legs.filter(l => l.runnerId === id).map(l => l.id));
      }
    },

    updateLegActualTime: (id: number, field: 'actualStart' | 'actualFinish', time: number | null) => {
      dataStore.updateLegActualTime(id, field, time);
      
      // Auto-set next leg start if we're setting a finish time
      if (field === 'actualFinish' && time !== null) {
        const legIndex = dataStore.legs.findIndex(leg => leg.id === id);
        if (legIndex >= 0 && legIndex < dataStore.legs.length - 1) {
          const nextLeg = dataStore.legs[legIndex + 1];
          if (!nextLeg.actualStart) {
            dataStore.updateLegActualTime(nextLeg.id, 'actualStart', time);
          }
        }
      }
    },

    // Setup completion that updates both data and UI
    completeSetup: () => {
      uiStore.completeSetup();
      businessStore.initializeLegs();
    },

    // Team initialization
    initializeFromTeam: (teamId: string, runners: any[], legs: any[], startTime: number) => {
      dataStore.setTeamId(teamId);
      dataStore.setRunners(runners);
      dataStore.setLegs(legs);
      dataStore.setStartTime(startTime);
      uiStore.markSetupComplete();
      uiStore.setDidInitFromTeam(true);
    },

    // Validation with auto-fix
    validateAndFix: () => {
      const result = businessStore.validateAndFixRaceState();
      if (result.fixed) {
        console.log('Auto-fixed race state issues');
      }
      return result;
    },

    // Sync status
    getSyncStatus: () => ({
      lastSyncedAt: uiStore.lastSyncedAt,
      hasData: dataStore.hasData(),
      isSetupComplete: uiStore.isSetupComplete,
      dataConsistent: businessStore.isDataConsistent()
    }),

    // Reset everything
    reset: () => {
      dataStore.clearData();
      uiStore.resetSetup();
    }
  };
};
