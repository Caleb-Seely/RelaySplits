import { useCallback, useRef } from 'react';
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

  // Deduplication windows (ms)
  const RUNNER_SYNC_COOLDOWN_MS = 3000; // Increased further
  const LEG_SYNC_COOLDOWN_MS = 3000; // Increased further

  // Track last sync timestamps to avoid duplicate syncs in a short window
  const lastRunnerSyncRef = useRef<Map<number, number>>(new Map());
  const lastLegFieldSyncRef = useRef<Map<string, number>>(new Map()); // key: `${legId}:${field}`

  // Track in-flight requests to avoid overlapping calls for same entity
  const inflightRunnerRef = useRef<Set<number>>(new Set());
  const inflightLegFieldRef = useRef<Set<string>>(new Set());

  /**
   * Sync leg actual times (start/finish) to database
   */
  const syncLegActualTime = useCallback(async (
    legId: number, 
    field: 'actualStart' | 'actualFinish', 
    time: number | null
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
      [field === 'actualStart' ? 'start_time' : 'finish_time']: time ? new Date(time).toISOString() : null
    };

    try {
      const key = `${legId}:${field}`;
      const now = Date.now();
      const last = lastLegFieldSyncRef.current.get(key) ?? 0;
      if (now - last < LEG_SYNC_COOLDOWN_MS) {
        return;
      }
      if (inflightLegFieldRef.current.has(key)) {
        return;
      }
      inflightLegFieldRef.current.add(key);

      const result = await safeUpdate('legs', teamId, leg.remoteId, payload);
      
      if (result.error) {
        console.error(`[useRunnerSync] Failed to sync ${field} for leg ${legId}:`, result.error);
        toast.error(`Failed to sync ${field === 'actualStart' ? 'start' : 'finish'} time`);
      } else {
        // Update last sync timestamp
        lastLegFieldSyncRef.current.set(key, now);
        store.setLastSyncedAt(now);
      }
    } catch (error) {
      console.error(`[useRunnerSync] Error syncing ${field}:`, error);
      toast.error(`Error syncing ${field === 'actualStart' ? 'start' : 'finish'} time`);
    } finally {
      const key = `${legId}:${field}`;
      inflightLegFieldRef.current.delete(key);
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
      const now = Date.now();
      const last = lastRunnerSyncRef.current.get(runnerId) ?? 0;
      if (now - last < RUNNER_SYNC_COOLDOWN_MS) {
        return;
      }
      if (inflightRunnerRef.current.has(runnerId)) {
        return;
      }
      inflightRunnerRef.current.add(runnerId);

      const result = await safeUpdate('runners', teamId, runner.remoteId, payload);
      
      if (result.error) {
        console.error(`[useRunnerSync] Failed to sync runner ${runnerId}:`, result.error);
        toast.error('Failed to sync runner changes');
      } else {
        // Update last sync timestamp
        lastRunnerSyncRef.current.set(runnerId, now);
        store.setLastSyncedAt(now);
      }
    } catch (error) {
      console.error(`[useRunnerSync] Error syncing runner:`, error);
      toast.error('Error syncing runner changes');
    } finally {
      inflightRunnerRef.current.delete(runnerId);
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
      const key = `${legId}:assignment`;
      const now = Date.now();
      const last = lastLegFieldSyncRef.current.get(key) ?? 0;
      if (now - last < LEG_SYNC_COOLDOWN_MS) {
        return;
      }
      if (inflightLegFieldRef.current.has(key)) {
        return;
      }
      inflightLegFieldRef.current.add(key);

      const result = await safeUpdate('legs', teamId, leg.remoteId, payload);
      
      if (result.error) {
        console.error(`[useRunnerSync] Failed to sync leg assignment for leg ${legId}:`, result.error);
        toast.error('Failed to sync leg assignment');
      } else {
        // Update last sync timestamp
        lastLegFieldSyncRef.current.set(key, now);
        store.setLastSyncedAt(now);
      }
    } catch (error) {
      console.error(`[useRunnerSync] Error syncing leg assignment:`, error);
      toast.error('Error syncing leg assignment');
    } finally {
      const key = `${legId}:assignment`;
      inflightLegFieldRef.current.delete(key);
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
