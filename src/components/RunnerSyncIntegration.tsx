import { useEffect, useRef } from 'react';
import { useRaceStore } from '@/store/raceStore';
import { useRunnerSync } from '@/hooks/useRunnerSync';

/**
 * Component that integrates database synchronization with race store changes
 * This component monitors store changes and automatically syncs to database
 */
export const RunnerSyncIntegration = () => {
  const { legs, runners, teamId } = useRaceStore();
  const { syncLegActualTime, syncRunnerUpdate, syncLegAssignment } = useRunnerSync();
  
  // Track previous state to detect changes
  const prevLegsRef = useRef(legs);
  const prevRunnersRef = useRef(runners);

  useEffect(() => {
    // Only sync if we have a team (not during initial setup)
    if (!teamId) return;

    const prevLegs = prevLegsRef.current;
    const currentLegs = legs;

    // Check for leg actual time changes
    currentLegs.forEach((currentLeg) => {
      const prevLeg = prevLegs.find(l => l.id === currentLeg.id);
      if (!prevLeg) return;

      // Check for actualStart changes
      if (currentLeg.actualStart !== prevLeg.actualStart && currentLeg.actualStart) {
        console.log(`[RunnerSyncIntegration] Detected actualStart change for leg ${currentLeg.id}`);
        syncLegActualTime(currentLeg.id, 'actualStart', currentLeg.actualStart);
      }

      // Check for actualFinish changes
      if (currentLeg.actualFinish !== prevLeg.actualFinish && currentLeg.actualFinish) {
        console.log(`[RunnerSyncIntegration] Detected actualFinish change for leg ${currentLeg.id}`);
        syncLegActualTime(currentLeg.id, 'actualFinish', currentLeg.actualFinish);
      }

      // Check for runner assignment changes
      if (currentLeg.runnerId !== prevLeg.runnerId) {
        console.log(`[RunnerSyncIntegration] Detected runner assignment change for leg ${currentLeg.id}`);
        syncLegAssignment(currentLeg.id, currentLeg.runnerId || null);
      }
    });

    // Update ref for next comparison
    prevLegsRef.current = currentLegs;
  }, [legs, teamId, syncLegActualTime, syncLegAssignment]);

  useEffect(() => {
    // Only sync if we have a team (not during initial setup)
    if (!teamId) return;

    const prevRunners = prevRunnersRef.current;
    const currentRunners = runners;

    // Check for runner changes (name, pace, van)
    currentRunners.forEach((currentRunner) => {
      const prevRunner = prevRunners.find(r => r.id === currentRunner.id);
      if (!prevRunner) return;

      const hasChanges = 
        currentRunner.name !== prevRunner.name ||
        currentRunner.pace !== prevRunner.pace ||
        currentRunner.van !== prevRunner.van;

      if (hasChanges) {
        console.log(`[RunnerSyncIntegration] Detected runner changes for runner ${currentRunner.id}`);
        
        const updates: { name?: string; pace?: number; van?: number } = {};
        if (currentRunner.name !== prevRunner.name) updates.name = currentRunner.name;
        if (currentRunner.pace !== prevRunner.pace) updates.pace = currentRunner.pace;
        if (currentRunner.van !== prevRunner.van) updates.van = currentRunner.van;
        
        syncRunnerUpdate(currentRunner.id, updates);
      }
    });

    // Update ref for next comparison
    prevRunnersRef.current = currentRunners;
  }, [runners, teamId, syncRunnerUpdate]);

  // This component doesn't render anything, it just handles sync logic
  return null;
};
