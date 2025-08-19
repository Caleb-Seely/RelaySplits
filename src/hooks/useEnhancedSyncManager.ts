import { useCallback, useRef, useEffect } from 'react';
import { useRaceStore } from '@/store/raceStore';
import { useConflictResolution } from '@/contexts/ConflictResolutionContext';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { eventBus, EVENT_TYPES } from '@/utils/eventBus';
import { invokeEdge, getDeviceId } from '@/integrations/supabase/edge';
import { supabase } from '@/integrations/supabase/client';
import type { Runner, Leg } from '@/types/race';
import type { Tables } from '@/integrations/supabase/types';
import { recalculateProjections } from '@/utils/raceUtils';
import { syncLogger } from '@/utils/logger';

// Enhanced sync manager that prioritizes data accuracy and integrates with existing systems
export const useEnhancedSyncManager = () => {
  const store = useRaceStore();
  const { onConflictDetected } = useConflictResolution();
  const { queueChange, processQueue, getQueueStatus } = useOfflineQueue();
  
  // Track sync state
  const isProcessingSync = useRef(false);
  const lastSyncAttempt = useRef(0);
  const SYNC_COOLDOWN_MS = 2000; // 2 second cooldown between sync attempts
  
  // Real-time subscription tracking
  const realtimeSubscription = useRef<any>(null);
  const deviceId = useRef(getDeviceId());
  
  // Debounce tracking to prevent duplicate API calls
  const pendingSyncs = useRef(new Set<string>());
  
  // Store refs for stable access to frequently changing values
  const storeRef = useRef(store);
  storeRef.current = store;

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
    if (!storeRef.current.teamId) return;

    const leg = storeRef.current.legs.find(l => l.id === legId);
    if (!leg?.remoteId) return;

    // Create a unique key for this sync operation
    const syncKey = `${legId}-${field}-${value}`;
    
    // Check if this exact sync is already pending
    if (pendingSyncs.current.has(syncKey)) {
      syncLogger.debug(`Sync already pending for ${syncKey}, skipping`);
      return;
    }
    
    // Add to pending syncs
    pendingSyncs.current.add(syncKey);

    isProcessingSync.current = true;

    try {
      // Check if we're offline
      if (!navigator.onLine) {
        console.log(`[useEnhancedSyncManager] Offline - queuing leg update for ${field}`);
        queueChange({
          table: 'legs',
          remoteId: leg.remoteId,
          payload: {
            number: leg.id,
            distance: leg.distance,
            [field === 'actualStart' ? 'start_time' : 'finish_time']: value ? new Date(value).toISOString() : null
          }
        });
        return;
      }

      // Build the payload for the leg update
      const payload = {
        id: leg.remoteId,
        number: leg.id,
        distance: leg.distance,
        [field === 'actualStart' ? 'start_time' : 'finish_time']: value ? new Date(value).toISOString() : null
      };

      console.log(`[useEnhancedSyncManager] Syncing leg ${legId} ${field}:`, payload);

      const deviceId = getDeviceId();
      const result = await invokeEdge('legs-upsert', {
        teamId: storeRef.current.teamId,
        deviceId,
        legs: [payload],
        action: 'upsert'
      });
      
      if ((result as any).error) {
        console.error(`[useEnhancedSyncManager] Failed to sync leg ${legId}:`, (result as any).error);
        // Queue the change for retry
        queueChange({
          table: 'legs',
          remoteId: leg.remoteId,
          payload: {
            number: leg.id,
            distance: leg.distance,
            [field === 'actualStart' ? 'start_time' : 'finish_time']: value ? new Date(value).toISOString() : null
          }
        });
      } else {
        console.log(`[useEnhancedSyncManager] Successfully synced leg ${legId} ${field}`);
        // Update last synced timestamp
        storeRef.current.setLastSyncedAt(Date.now());
      }
    } catch (error) {
      console.error(`[useEnhancedSyncManager] Error syncing leg ${legId}:`, error);
      // Queue the change for retry
      queueChange({
        table: 'legs',
        remoteId: leg.remoteId,
        payload: {
          number: leg.id,
          distance: leg.distance,
          [field === 'actualStart' ? 'start_time' : 'finish_time']: value ? new Date(value).toISOString() : null
        }
      });
    } finally {
      // Remove from pending syncs
      pendingSyncs.current.delete(syncKey);
      isProcessingSync.current = false;
    }
  }, [queueChange]);

  // Handle runner synchronization
  const handleRunnerSync = useCallback(async (
    runnerId: number,
    updates: any,
    previousValues: any
  ) => {
    if (!storeRef.current.teamId) return;

    const runner = storeRef.current.runners.find(r => r.id === runnerId);
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
        teamId: storeRef.current.teamId,
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
        storeRef.current.setLastSyncedAt(Date.now());
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
  }, [queueChange]);

  // Smart sync operation for when coming back online
  const performSmartSync = useCallback(async () => {
    if (!storeRef.current.teamId || !navigator.onLine) return;

    console.log('[useEnhancedSyncManager] Performing smart sync...');
    
    // First, process any queued offline changes
    await processQueue(storeRef.current.teamId);
    
    // Then fetch latest data from server
    await fetchLatestData();
  }, [processQueue]);

  // Fetch latest data from server
  const fetchLatestData = useCallback(async () => {
    if (!storeRef.current.teamId) return;
    
    // Prevent multiple simultaneous syncs
    if (isProcessingSync.current) {
      console.log('[useEnhancedSyncManager] Sync already in progress, skipping');
      return;
    }

    try {
      isProcessingSync.current = true;
      console.log('[useEnhancedSyncManager] Fetching latest data from server...');
      const deviceId = getDeviceId();
      
      // Fetch latest runners
      const runnersResult = await invokeEdge<{ runners: Tables<'runners'>[] }>('runners-list', { 
        teamId: storeRef.current.teamId, 
        deviceId 
      });
      
      if (!(runnersResult as any).error) {
        const remoteRunners = (runnersResult as any).data?.runners ?? [];
        console.log('[useEnhancedSyncManager] Fetched runners:', remoteRunners.length);
        
        const existingRemoteToLocalId = new Map<string, number>(
          storeRef.current.runners
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
        mergeWithConflictDetection(runners, storeRef.current.runners, storeRef.current.setRunners, 'runners');
      }

      // Fetch latest legs
      const legsResult = await invokeEdge<{ legs: Tables<'legs'>[] }>('legs-list', { 
        teamId: storeRef.current.teamId, 
        deviceId 
      });
      
      if (!(legsResult as any).error) {
        const remoteLegs = (legsResult as any).data?.legs ?? [];
        console.log('[useEnhancedSyncManager] Fetched legs:', remoteLegs.length);
        
        const remoteToLocalRunnerMap = new Map<string, number>(
          storeRef.current.runners.map(r => [r.remoteId as string, r.id as number])
        );
        
        const legs: Leg[] = remoteLegs.map((l: Tables<'legs'>) => {
          let mappedRunnerId: number;
          if (l.runner_id) {
            const remoteMappedId = remoteToLocalRunnerMap.get(l.runner_id);
            if (remoteMappedId !== undefined) {
              mappedRunnerId = remoteMappedId;
            } else {
              const existingLeg = storeRef.current.legs.find(leg => leg.remoteId === l.id);
              mappedRunnerId = existingLeg?.runnerId || 0;
            }
          } else {
            const existingLeg = storeRef.current.legs.find(leg => leg.remoteId === l.id);
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

        // Merge with conflict detection and recalculate projections
        mergeWithConflictDetection(legs, storeRef.current.legs, (items) => {
          console.log('[useEnhancedSyncManager] Updating legs with new data:', items.length);
          storeRef.current.setRaceData({ legs: items });
          if (items.length > 0) {
            const recalculatedLegs = recalculateProjections(items, 0, storeRef.current.runners);
            storeRef.current.setRaceData({ legs: recalculatedLegs });
            console.log('[useEnhancedSyncManager] Legs updated and projections recalculated');
          }
        }, 'legs');
      }

      console.log('[useEnhancedSyncManager] Smart sync completed');
    } catch (error) {
      console.error('[useEnhancedSyncManager] Error during smart sync:', error);
    } finally {
      isProcessingSync.current = false;
    }
  }, []);

  // Merge function with conflict detection
  const mergeWithConflictDetection = useCallback((
    incomingItems: any[],
    localItems: any[],
    updateAction: (items: any[]) => void,
    table: 'runners' | 'legs'
  ) => {
    const localItemsMap = new Map(localItems.map((item) => [item.id, item]));
    let hasChanges = false;
    let updatedCount = 0;
    let conflictCount = 0;

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
          conflictCount++;
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
          conflictCount++;
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
        updatedCount++;
      }
    }

    if (hasChanges) {
      syncLogger.sync(`Applied ${updatedCount} updates to ${table} (${conflictCount} conflicts)`);
      updateAction(mergedItems);
    } else {
      syncLogger.debug(`No changes needed for ${table}`);
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

  // Set up real-time subscriptions for data updates
  const setupRealtimeSubscriptions = useCallback((teamId: string) => {
    syncLogger.sync('Setting up real-time subscriptions for team', teamId);
    
    // Check if current device is a viewer - viewers don't need realtime subscriptions
    const deviceInfo = JSON.parse(localStorage.getItem('relay_device_info') || '{}');
    if (deviceInfo.role === 'viewer') {
      syncLogger.info('Skipping realtime setup for viewer role');
      return () => {}; // Return no-op cleanup function
    }
    
    // Prevent multiple subscription setups for the same team
    if (realtimeSubscription.current && realtimeSubscription.current.topic === `team-${teamId}`) {
      syncLogger.debug('Subscription already exists for team, skipping setup');
      return () => {
        if (realtimeSubscription.current) {
          syncLogger.sync('Cleaning up existing subscription');
          supabase.removeChannel(realtimeSubscription.current);
          realtimeSubscription.current = null;
        }
      };
    }
    
    // Clean up existing subscription
    if (realtimeSubscription.current) {
      supabase.removeChannel(realtimeSubscription.current);
      realtimeSubscription.current = null;
    }
    
    // Create new real-time subscription
    const channel = supabase.channel(`team-${teamId}`)
      .on('broadcast', { event: 'data_updated' }, (payload) => {
        console.log('[useEnhancedSyncManager] Received real-time update:', payload);
        
        // Only process updates from other devices
        if (payload.payload.device_id !== deviceId.current) {
          console.log('[useEnhancedSyncManager] Processing update from other device');
          
          // Publish real-time update event for other systems to handle
          eventBus.publish({
            type: EVENT_TYPES.REALTIME_UPDATE,
            payload: {
              table: payload.payload.type,
              action: payload.payload.action,
              count: payload.payload.count,
              device_id: payload.payload.device_id,
              timestamp: payload.payload.timestamp
            },
            priority: 'high',
            source: 'realtime'
          });
          
          // Trigger immediate data fetch for the updated table
          if (payload.payload.type === 'legs' || payload.payload.type === 'runners') {
            // Small delay to ensure server has processed the change
            setTimeout(() => {
              console.log('[useEnhancedSyncManager] Fetching latest data after real-time update');
              fetchLatestData();
            }, 500);
          }
        }
      })
      .subscribe((status) => {
        syncLogger.sync('Real-time subscription status:', status);
        // Only warn about unexpected closures if we're not in cleanup mode
        if (status === 'CLOSED' && realtimeSubscription.current) {
          syncLogger.warn('Real-time subscription was closed unexpectedly');
        }
      });
    
    realtimeSubscription.current = channel;
    
    // Only perform initial sync if we haven't synced recently and have data
    const lastSync = storeRef.current.lastSyncedAt || 0;
    const timeSinceLastSync = Date.now() - lastSync;
    const shouldPerformInitialSync = navigator.onLine && 
                                   storeRef.current.legs.length > 0 && 
                                   timeSinceLastSync > 30000; // 30 seconds
    
    if (shouldPerformInitialSync) {
      syncLogger.sync('Performing initial sync after subscription setup');
      performSmartSync();
    } else {
      syncLogger.debug('Skipping initial sync (recent sync or no data)');
    }
    
    // Set up periodic sync as backup (every 60 seconds instead of 30)
    const syncInterval = setInterval(() => {
      if (navigator.onLine && storeRef.current.teamId) {
        fetchLatestData();
      }
    }, 60000);
    
    return () => {
      clearInterval(syncInterval);
      if (realtimeSubscription.current) {
        syncLogger.sync('Cleaning up real-time subscription');
        supabase.removeChannel(realtimeSubscription.current);
        realtimeSubscription.current = null;
      }
    };
  }, [performSmartSync, fetchLatestData]);

  // Save initial team data (for setup wizard)
  const saveInitialRows = useCallback(async (teamId: string) => {
    if (!store.runners.length || !store.legs.length) {
      console.error('[useEnhancedSyncManager] No data to save');
      return { error: new Error('No data to save') };
    }

    try {
      const deviceId = getDeviceId();
      
      console.log('[useEnhancedSyncManager] Saving initial data for team:', teamId);
      console.log('[useEnhancedSyncManager] Device ID being used:', deviceId);
      console.log('[useEnhancedSyncManager] Runners to save:', store.runners);
      console.log('[useEnhancedSyncManager] Legs to save:', store.legs);
      
      // Verify device is registered with the team before proceeding
      const deviceInfo = JSON.parse(localStorage.getItem('relay_device_info') || '{}');
      console.log('[useEnhancedSyncManager] Device info from localStorage:', deviceInfo);
      
      if (deviceInfo.deviceId !== deviceId) {
        console.warn('[useEnhancedSyncManager] Device ID mismatch! localStorage deviceId:', deviceInfo.deviceId, 'getDeviceId():', deviceId);
        // Update the device ID to match what's in localStorage
        localStorage.setItem('relay_device_id', deviceInfo.deviceId);
        console.log('[useEnhancedSyncManager] Updated relay_device_id to match deviceInfo');
      }
      
      // Step 1: Save runners first
      const runnerPayloads = store.runners.map(runner => ({
        id: runner.remoteId || crypto.randomUUID(), // Use proper UUID for new runners
        name: runner.name,
        pace: runner.pace,
        van: String(runner.van)
      }));

      console.log('[useEnhancedSyncManager] Runner payloads:', runnerPayloads);

      const runnersResult = await invokeEdge('runners-upsert', {
        teamId,
        deviceId,
        runners: runnerPayloads,
        action: 'upsert'
      });

      if ((runnersResult as any).error) {
        console.error('[useEnhancedSyncManager] Failed to save runners:', (runnersResult as any).error);
        return { error: (runnersResult as any).error };
      }

      console.log('[useEnhancedSyncManager] Runners saved successfully:', runnersResult);

      // Step 2: Create a mapping from local runner ID to remote runner ID
      const localToRemoteRunnerMap = new Map<number, string>();
      store.runners.forEach((runner, index) => {
        const localId = runner.id;
        const remoteId = runnerPayloads[index].id;
        localToRemoteRunnerMap.set(localId, remoteId);
      });

      console.log('[useEnhancedSyncManager] Runner ID mapping:', Object.fromEntries(localToRemoteRunnerMap));

      // Step 3: Save legs with proper runner_id references
      const legPayloads = store.legs.map(leg => {
        const runnerRemoteId = leg.runnerId ? localToRemoteRunnerMap.get(leg.runnerId) : null;
        console.log(`[useEnhancedSyncManager] Leg ${leg.id} -> Runner ${leg.runnerId} -> Remote ID: ${runnerRemoteId}`);
        
        return {
          id: leg.remoteId || crypto.randomUUID(), // Use proper UUID for new legs
          number: leg.id,
          distance: leg.distance,
          runner_id: runnerRemoteId
        };
      });

      console.log('[useEnhancedSyncManager] Leg payloads:', legPayloads);

      const legsResult = await invokeEdge('legs-upsert', {
        teamId,
        deviceId,
        legs: legPayloads,
        action: 'upsert'
      });

      if ((legsResult as any).error) {
        console.error('[useEnhancedSyncManager] Failed to save legs:', (legsResult as any).error);
        return { error: (legsResult as any).error };
      }

      console.log('[useEnhancedSyncManager] Legs saved successfully:', legsResult);

      // Step 4: Update the store with remote IDs
      const updatedRunners = store.runners.map((runner, index) => ({
        ...runner,
        remoteId: runnerPayloads[index].id
      }));
      store.setRunners(updatedRunners);

      // Update legs with remote IDs (keep existing runnerId relationships)
      const updatedLegs = store.legs.map((leg, index) => {
        const legPayload = legPayloads[index];
        
        console.log(`[useEnhancedSyncManager] Updating leg ${leg.id}: runnerId ${leg.runnerId}, remoteId: ${legPayload.id}`);
        
        return {
          ...leg,
          remoteId: legPayload.id
          // Keep the existing runnerId - it should already be correct from initializeLegs
        };
      });
      store.setRaceData({ legs: updatedLegs });

      console.log('[useEnhancedSyncManager] Initial data saved successfully');
      store.setLastSyncedAt(Date.now());
      return { error: null };
    } catch (error) {
      console.error('[useEnhancedSyncManager] Error saving initial data:', error);
      return { error };
    }
  }, [store.runners, store.legs, store.setLastSyncedAt, store.setRunners, store.setRaceData]);

  return {
    performSmartSync,
    fetchLatestData,
    getQueueStatus,
    isProcessingSync: () => isProcessingSync.current,
    // Real-time subscription setup
    setupRealtimeSubscriptions,
    // Setup wizard compatibility
    saveInitialRows,
    manualRetry: () => {
      console.log('[useEnhancedSyncManager] Manual retry triggered');
      performSmartSync();
    }
  };
};
