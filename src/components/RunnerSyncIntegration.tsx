import { useEffect, useRef } from 'react';
import { useRaceStore } from '@/store/raceStore';
import { useRunnerSync } from '@/hooks/useRunnerSync';

/**
 * Component that integrates database synchronization with race store changes
 * This component monitors store changes and automatically syncs to database
 */
export const RunnerSyncIntegration = () => {
  const { legs, runners, teamId, isSetupComplete } = useRaceStore();
  const { syncLegActualTime, syncRunnerUpdate, syncLegAssignment } = useRunnerSync();
  
  // Track previous state to detect changes
  const prevLegsRef = useRef(legs);
  const prevRunnersRef = useRef(runners);
  const isInitializedRef = useRef(false);

  // Initialize sync tracking when setup is complete
  useEffect(() => {
    if (!teamId || !isSetupComplete) return;
    
    if (!isInitializedRef.current && legs.length > 0) {
      prevLegsRef.current = legs;
      prevRunnersRef.current = runners;
      isInitializedRef.current = true;
    }
  }, [teamId, isSetupComplete, legs, runners]);

  // Sync leg changes
  useEffect(() => {
    if (!teamId || !isSetupComplete || !isInitializedRef.current) return;

    const prevLegs = prevLegsRef.current;
    const currentLegs = legs;

    // Skip initial load
    if (prevLegs.length === 0 && currentLegs.length > 0) {
      prevLegsRef.current = currentLegs;
      return;
    }

    // Only sync if we have previous legs to compare against
    if (prevLegs.length === 0) return;

    // Check for changes and sync with delays
    let changeCount = 0;
    currentLegs.forEach((currentLeg) => {
      const prevLeg = prevLegs.find(l => l.id === currentLeg.id);
      if (!prevLeg) return;

      if (currentLeg.actualStart !== prevLeg.actualStart) {
        setTimeout(() => {
          syncLegActualTime(currentLeg.id, 'actualStart', currentLeg.actualStart || null);
        }, changeCount * 500);
        changeCount++;
      }

      if (currentLeg.actualFinish !== prevLeg.actualFinish) {
        setTimeout(() => {
          syncLegActualTime(currentLeg.id, 'actualFinish', currentLeg.actualFinish || null);
        }, changeCount * 500);
        changeCount++;
      }

      if (currentLeg.runnerId !== prevLeg.runnerId) {
        setTimeout(() => {
          syncLegAssignment(currentLeg.id, currentLeg.runnerId || null);
        }, changeCount * 500);
        changeCount++;
      }
    });

    prevLegsRef.current = currentLegs;
  }, [legs, teamId, isSetupComplete, syncLegActualTime, syncLegAssignment]);

  // Sync runner changes
  useEffect(() => {
    if (!teamId || !isSetupComplete || !isInitializedRef.current) return;

    const prevRunners = prevRunnersRef.current;
    const currentRunners = runners;

    // Skip initial load
    if (prevRunners.length === 0 && currentRunners.length > 0) {
      prevRunnersRef.current = currentRunners;
      return;
    }

    // Only sync if we have previous runners to compare against
    if (prevRunners.length === 0) return;

    let changeCount = 0;
    currentRunners.forEach((currentRunner) => {
      const prevRunner = prevRunners.find(r => r.id === currentRunner.id);
      if (!prevRunner) return;

      const hasChanges = 
        currentRunner.name !== prevRunner.name ||
        currentRunner.pace !== prevRunner.pace ||
        currentRunner.van !== prevRunner.van;

      if (hasChanges) {
        const updates: { name?: string; pace?: number; van?: number } = {};
        if (currentRunner.name !== prevRunner.name) updates.name = currentRunner.name;
        if (currentRunner.pace !== prevRunner.pace) updates.pace = currentRunner.pace;
        if (currentRunner.van !== prevRunner.van) updates.van = currentRunner.van;
        
        setTimeout(() => {
          syncRunnerUpdate(currentRunner.id, updates);
        }, changeCount * 500);
        changeCount++;
      }
    });

    prevRunnersRef.current = currentRunners;
  }, [runners, teamId, isSetupComplete, syncRunnerUpdate]);

  return null;
};
