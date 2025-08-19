import { useCallback, useRef, useEffect } from 'react';
import { useRaceStore } from '@/store/raceStore';
import { useConflictResolution } from '@/contexts/ConflictResolutionContext';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { eventBus, EVENT_TYPES } from '@/utils/eventBus';
import { invokeEdge, getDeviceId } from '@/integrations/supabase/edge';
import type { Runner, Leg } from '@/types/race';
import type { Tables } from '@/integrations/supabase/types';
import { recalculateProjections } from '@/utils/raceUtils';

// Enhanced sync manager that prioritizes data accuracy and integrates with existing systems
export const useEnhancedSyncManager = () => {
  const store = useRaceStore();
  const { onConflictDetected } = useConflictResolution();
  const { queueChange, processQueue, getQueueStatus } = useOfflineQueue();
  
  // Track sync state
  const isProcessingSync = useRef(false);
  const lastSyncAttempt = useRef(0);
  const SYNC_COOLDOWN_MS = 2000; // 2 second cooldown between sync attempts

  // Subscribe to high-priority data events for immediate sync
  useEffect(() => {
    const unsubscribeLegUpdates = eventBus.subscribe(EVENT_TYPES.LEG_UPDATE, async (event) => {
      const { legId, field, value, previousValue, runnerId, timestamp } = event.payload;
      
      // Skip if no actual change
      if (value === previousValue) return;
      
      // Skip if we're processing a sync operation
      if (isProcessingSync.current) return;
      
      // Rate limiting
      const now = Date.now();
      if (now - lastSyncAttempt.current < SYNC_COOLDOWN_MS) return;
      lastSyncAttempt.current = now;
      
      await handleLegSync(legId, field, value, previousValue, runnerId);
    });

    const unsubscribeRunnerUpdates = eventBus.subscribe(EVENT_TYPES.RUNNER_UPDATE, async (event) => {
      const { runnerId, updates, previousValues, timestamp } = event.payload;
      
      // Skip if we're processing a sync operation
      if (isProcessingSync.current) return;
      
      // Rate limiting
      const now = Date.now();
      if (now - lastSyncAttempt.current < SYNC_COOLDOWN_MS) return;
      lastSyncAttempt.current = now;
      
      await handleRunnerSync(runnerId, updates, previousValues);
    });

    return () => {
      unsubscribeLegUpdates();
      unsubscribeRunnerUpdates();
    };
  }, []);

  // Handle leg synchronization with conflict detection
  const handleLegSync = useCallback(async (
    legId: number,
    field: 'actualStart' | 'actualFinish',
    value: number | null,
    previousValue: number | null,
    runnerId: number
  ) => {
    if (!store.teamId) return;

    const leg = store.legs.find(l => l.id === legId);
    if (!leg?.remoteId) return;

    isProcessingSync.current = true;

    try {
      // Check if we're offline
      if (!navigator.onLine) {
        console.log(`[useEnhancedSyncManager] Offline - queuing leg update for ${field}`);
        
        // Queue the change for later sync
        const payload = {
          [field === 'actualStart' ? 'start_time' : 'finish_time']: value ? new Date(value).toISOString() : null,
          number: leg.id,
          distance: leg.distance
        };
        
        queueChange({
          table: 'legs',
          remoteId: leg.remoteId,
          payload
        });
        
        return;
      }

      // Online - attempt immediate sync
      const deviceId = getDeviceId();
      const syncPayload = {
        id: leg.remoteId,
        number: leg.id,
        distance: leg.distance,
        [field === 'actualStart' ? 'start_time' : 'finish_time']: value ? new Date(value).toISOString() : null
      };

      const result = await invokeEdge('legs-upsert', {
        teamId: store.teamId,
        deviceId,
        legs: [syncPayload],
        action: 'upsert'
      });

      if ((result as any).error) {
        console.error(`[useEnhancedSyncManager] Leg sync failed:`, (result as any).error);
        
        // Queue for retry if it's a network error
        if ((result as any).error.message?.includes('network') || (result as any).error.message?.includes('timeout')) {
          const payload = {
            [field === 'actualStart' ? 'start_time' : 'finish_time']: value ? new Date(value).toISOString() : null,
            number: leg.id,
            distance: leg.distance
          };
          
          queueChange({
            table: 'legs',
            remoteId: leg.remoteId,
            payload
          });
        }
      } else {
        console.log(`[useEnhancedSyncManager] Leg ${legId} ${field} synced successfully`);
        store.setLastSyncedAt(Date.now());
      }
    } catch (error) {
      console.error(`[useEnhancedSyncManager] Error syncing leg ${legId}:`, error);
      
      // Queue for retry
      const payload = {
        [field === 'actualStart' ? 'start_time' : 'finish_time']: value ? new Date(value).toISOString() : null,
        number: leg.id,
        distance: leg.distance
      };
      
      queueChange({
        table: 'legs',
        remoteId: leg.remoteId,
        payload
      });
    } finally {
      isProcessingSync.current = false;
    }
  }, [store.teamId, store.legs, store.setLastSyncedAt, queueChange]);

  // Handle runner synchronization
  const handleRunnerSync = useCallback(async (
    runnerId: number,
    updates: any,
    previousValues: any
  ) => {
    if (!store.teamId) return;

    const runner = store.runners.find(r => r.id === runnerId);
    if (!runner?.remoteId) return;

    isProcessingSync.current = true;

    try {
      // Check if we're offline
      if (!navigator.onLine) {
        console.log(`[useEnhancedSyncManager] Offline - queuing runner update`);
        
        const payload = {
          ...updates,
          ...(updates.van && { van: updates.van.toString() })
        };
        
        queueChange({
          table: 'runners',
          remoteId: runner.remoteId,
          payload
        });
        
        return;
      }

      // Online - attempt immediate sync
      const deviceId = getDeviceId();
      const syncPayload = {
        id: runner.remoteId,
        name: updates.name || runner.name,
        pace: updates.pace || runner.pace,
        van: typeof (updates.van || runner.van) === 'number' ? String(updates.van || runner.van) : (updates.van || runner.van)
      };

      const result = await invokeEdge('runners-upsert', {
        teamId: store.teamId,
        deviceId,
        runners: [syncPayload],
        action: 'upsert'
      });

      if ((result as any).error) {
        console.error(`[useEnhancedSyncManager] Runner sync failed:`, (result as any).error);
        
        // Queue for retry if it's a network error
        if ((result as any).error.message?.includes('network') || (result as any).error.message?.includes('timeout')) {
          const payload = {
            ...updates,
            ...(updates.van && { van: updates.van.toString() })
          };
          
          queueChange({
            table: 'runners',
            remoteId: runner.remoteId,
            payload
          });
        }
      } else {
        console.log(`[useEnhancedSyncManager] Runner ${runnerId} synced successfully`);
        store.setLastSyncedAt(Date.now());
      }
    } catch (error) {
      console.error(`[useEnhancedSyncManager] Error syncing runner ${runnerId}:`, error);
      
      // Queue for retry
      const payload = {
        ...updates,
        ...(updates.van && { van: updates.van.toString() })
      };
      
      queueChange({
        table: 'runners',
        remoteId: runner.remoteId,
        payload
      });
    } finally {
      isProcessingSync.current = false;
    }
  }, [store.teamId, store.runners, store.setLastSyncedAt, queueChange]);

  // Smart sync operation for when coming back online
  const performSmartSync = useCallback(async () => {
    if (!store.teamId || !navigator.onLine) return;

    console.log('[useEnhancedSyncManager] Performing smart sync...');
    
    // First, process any queued offline changes
    await processQueue(store.teamId);
    
    // Then fetch latest data from server
    await fetchLatestData();
  }, [store.teamId, processQueue]);

  // Fetch latest data from server
  const fetchLatestData = useCallback(async () => {
    if (!store.teamId) return;

    try {
      const deviceId = getDeviceId();
      
      // Fetch latest runners
      const runnersResult = await invokeEdge<{ runners: Tables<'runners'>[] }>('runners-list', { 
        teamId: store.teamId, 
        deviceId 
      });
      
      if (!(runnersResult as any).error) {
        const remoteRunners = (runnersResult as any).data?.runners ?? [];
        const existingRemoteToLocalId = new Map<string, number>(
          store.runners
            .filter((rr) => !!rr.remoteId)
            .map((rr) => [rr.remoteId as string, rr.id as number])
        );

        const runners: Runner[] = remoteRunners.map((r: Tables<'runners'>, index: number) => ({
          id: existingRemoteToLocalId.get(r.id) ?? (index + 1),
          name: r.name,
          pace: r.pace,
          van: r.van === '1' ? 1 : 2,
          remoteId: r.id,
          updated_at: r.updated_at,
        }));

        // Merge with conflict detection
        mergeWithConflictDetection(runners, store.runners, store.setRunners, 'runners');
      }

      // Fetch latest legs
      const legsResult = await invokeEdge<{ legs: Tables<'legs'>[] }>('legs-list', { 
        teamId: store.teamId, 
        deviceId 
      });
      
      if (!(legsResult as any).error) {
        const remoteLegs = (legsResult as any).data?.legs ?? [];
        const remoteToLocalRunnerMap = new Map<string, number>(
          store.runners.map(r => [r.remoteId as string, r.id as number])
        );
        
        const legs: Leg[] = remoteLegs.map((l: Tables<'legs'>) => {
          let mappedRunnerId: number;
          if (l.runner_id) {
            const remoteMappedId = remoteToLocalRunnerMap.get(l.runner_id);
            if (remoteMappedId !== undefined) {
              mappedRunnerId = remoteMappedId;
            } else {
              const existingLeg = store.legs.find(leg => leg.remoteId === l.id);
              mappedRunnerId = existingLeg?.runnerId || 0;
            }
          } else {
            const existingLeg = store.legs.find(leg => leg.remoteId === l.id);
            mappedRunnerId = existingLeg?.runnerId || 0;
          }

          return {
            id: l.number,
            runnerId: mappedRunnerId,
            distance: l.distance,
            projectedStart: 0,
            projectedFinish: 0,
            actualStart: l.start_time ? new Date(l.start_time).getTime() : undefined,
            actualFinish: l.finish_time ? new Date(l.finish_time).getTime() : undefined,
            remoteId: l.id,
            updated_at: l.updated_at,
          };
        }).filter(Boolean) as Leg[];

        // Merge with conflict detection
        mergeWithConflictDetection(legs, store.legs, (items) => {
          store.setRaceData({ legs: items });
          if (items.length > 0) {
            const recalculatedLegs = recalculateProjections(items, 0, store.runners);
            store.setRaceData({ legs: recalculatedLegs });
          }
        }, 'legs');
      }

      console.log('[useEnhancedSyncManager] Smart sync completed');
    } catch (error) {
      console.error('[useEnhancedSyncManager] Error during smart sync:', error);
    }
  }, [store.teamId, store.runners, store.legs, store.setRunners, store.setRaceData]);

  // Merge function with conflict detection
  const mergeWithConflictDetection = useCallback((
    incomingItems: any[],
    localItems: any[],
    updateAction: (items: any[]) => void,
    table: 'runners' | 'legs'
  ) => {
    const localItemsMap = new Map(localItems.map((item) => [item.id, item]));
    let hasChanges = false;

    const mergedItems = [...localItems];

    for (const incomingItem of incomingItems) {
      const localItem = localItemsMap.get(incomingItem.id);

      // Check for timing conflicts if this is a leg with timing data
      if (table === 'legs' && localItem && onConflictDetected) {
        const localLeg = localItem as any;
        const serverLeg = incomingItem as any;
        
        // Check for start time conflicts
        if (localLeg.actualStart && serverLeg.actualStart && 
            Math.abs(localLeg.actualStart - serverLeg.actualStart) > 60000) { // 1 minute difference
          console.log(`[useEnhancedSyncManager] Timing conflict detected for leg ${localLeg.id} start time`);
          onConflictDetected({
            type: 'timing',
            localLeg,
            serverLeg,
            field: 'start'
          });
          continue; // Skip this item, let UI handle the conflict
        }
        
        // Check for finish time conflicts
        if (localLeg.actualFinish && serverLeg.actualFinish && 
            Math.abs(localLeg.actualFinish - serverLeg.actualFinish) > 60000) { // 1 minute difference
          console.log(`[useEnhancedSyncManager] Timing conflict detected for leg ${localLeg.id} finish time`);
          onConflictDetected({
            type: 'timing',
            localLeg,
            serverLeg,
            field: 'finish'
          });
          continue; // Skip this item, let UI handle the conflict
        }
      }

      // If the item doesn't exist locally, or if the incoming item is newer, we update it.
      if (!localItem || !localItem.updated_at || new Date(incomingItem.updated_at!) > new Date(localItem.updated_at)) {
        const existingIndex = mergedItems.findIndex(item => item.id === incomingItem.id);
        if (existingIndex !== -1) {
          mergedItems[existingIndex] = incomingItem;
        } else {
          mergedItems.push(incomingItem);
        }
        hasChanges = true;
      }
    }

    if (hasChanges) {
      updateAction(mergedItems);
    }
  }, [onConflictDetected]);

  // Monitor network status for smart sync
  useEffect(() => {
    const handleOnline = () => {
      console.log('[useEnhancedSyncManager] Network back online, performing smart sync');
      performSmartSync();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [performSmartSync]);

  return {
    performSmartSync,
    fetchLatestData,
    getQueueStatus,
    isProcessingSync: () => isProcessingSync.current
  };
};
