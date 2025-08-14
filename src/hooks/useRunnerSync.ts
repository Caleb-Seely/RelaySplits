import { useCallback } from 'react';
import { useRaceStore } from '@/store/raceStore';
import { useSyncManager } from '@/hooks/useSyncManager';
import { toast } from 'sonner';

/**
 * Hook for syncing runner-related state changes to the database
 * Integrates with existing sync infrastructure for real-time updates
 */
export const useRunnerSync = () => {
  const { teamId } = useRaceStore();
  const { safeUpdate } = useSyncManager();

  /**
   * Sync leg actual times (start/finish) to database
   */
  const syncLegActualTime = useCallback(async (
    legId: number, 
    field: 'actualStart' | 'actualFinish', 
    time: number
  ) => {
    if (!teamId) {
      console.warn('[useRunnerSync] No teamId available for sync');
      return;
    }

    const store = useRaceStore.getState();
    const leg = store.legs.find(l => l.id === legId);
    
    if (!leg?.remoteId) {
      console.warn(`[useRunnerSync] No remoteId found for leg ${legId}`);
      return;
    }

    const payload = {
      [field === 'actualStart' ? 'start_time' : 'finish_time']: new Date(time).toISOString()
    };

    try {
      const result = await safeUpdate('legs', teamId, leg.remoteId, payload);
      
      if (result.error) {
        console.error(`[useRunnerSync] Failed to sync ${field} for leg ${legId}:`, result.error);
        toast.error(`Failed to sync ${field === 'actualStart' ? 'start' : 'finish'} time`);
      } else {
        console.log(`[useRunnerSync] Successfully synced ${field} for leg ${legId}`);
        // Update last sync timestamp
        store.setLastSyncedAt(Date.now());
      }
    } catch (error) {
      console.error(`[useRunnerSync] Error syncing ${field}:`, error);
      toast.error(`Error syncing ${field === 'actualStart' ? 'start' : 'finish'} time`);
    }
  }, [teamId, safeUpdate]);

  /**
   * Sync runner updates (name, pace, van) to database
   */
  const syncRunnerUpdate = useCallback(async (
    runnerId: number,
    updates: { name?: string; pace?: number; van?: number }
  ) => {
    if (!teamId) {
      console.warn('[useRunnerSync] No teamId available for sync');
      return;
    }

    const store = useRaceStore.getState();
    const runner = store.runners.find(r => r.id === runnerId);
    
    if (!runner?.remoteId) {
      console.warn(`[useRunnerSync] No remoteId found for runner ${runnerId}`);
      return;
    }

    const payload = {
      ...updates,
      ...(updates.van && { van: updates.van.toString() }),
      updated_at: new Date().toISOString()
    };

    try {
      const result = await safeUpdate('runners', teamId, runner.remoteId, payload);
      
      if (result.error) {
        console.error(`[useRunnerSync] Failed to sync runner ${runnerId}:`, result.error);
        toast.error('Failed to sync runner changes');
      } else {
        console.log(`[useRunnerSync] Successfully synced runner ${runnerId}`);
        // Update last sync timestamp
        store.setLastSyncedAt(Date.now());
      }
    } catch (error) {
      console.error(`[useRunnerSync] Error syncing runner:`, error);
      toast.error('Error syncing runner changes');
    }
  }, [teamId, safeUpdate]);

  /**
   * Sync leg assignment changes to database
   */
  const syncLegAssignment = useCallback(async (
    legId: number,
    runnerId: number | null
  ) => {
    if (!teamId) {
      console.warn('[useRunnerSync] No teamId available for sync');
      return;
    }

    const store = useRaceStore.getState();
    const leg = store.legs.find(l => l.id === legId);
    
    if (!leg?.remoteId) {
      console.warn(`[useRunnerSync] No remoteId found for leg ${legId}`);
      return;
    }

    // Find the remote runner ID if runnerId is provided
    let remoteRunnerId = null;
    if (runnerId) {
      const runner = store.runners.find(r => r.id === runnerId);
      remoteRunnerId = runner?.remoteId || null;
    }

    const payload = {
      runner_id: remoteRunnerId,
      updated_at: new Date().toISOString()
    };

    try {
      const result = await safeUpdate('legs', teamId, leg.remoteId, payload);
      
      if (result.error) {
        console.error(`[useRunnerSync] Failed to sync leg assignment for leg ${legId}:`, result.error);
        toast.error('Failed to sync leg assignment');
      } else {
        console.log(`[useRunnerSync] Successfully synced leg assignment for leg ${legId}`);
        // Update last sync timestamp
        store.setLastSyncedAt(Date.now());
      }
    } catch (error) {
      console.error(`[useRunnerSync] Error syncing leg assignment:`, error);
      toast.error('Error syncing leg assignment');
    }
  }, [teamId, safeUpdate]);

  /**
   * Sync multiple leg assignments at once (for bulk operations)
   */
  const syncMultipleLegAssignments = useCallback(async (
    assignments: Array<{ legId: number; runnerId: number | null }>
  ) => {
    // Process assignments sequentially to avoid overwhelming the database
    for (const { legId, runnerId } of assignments) {
      await syncLegAssignment(legId, runnerId);
      // Small delay between updates to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }, [syncLegAssignment]);

  return {
    syncLegActualTime,
    syncRunnerUpdate,
    syncLegAssignment,
    syncMultipleLegAssignments
  };
};
