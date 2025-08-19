import { useCallback, useRef, useEffect } from 'react';
import { useRaceStore } from '@/store/raceStore';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdge, getDeviceId } from '@/integrations/supabase/edge';
import type { Runner, Leg } from '@/types/race';
import type { Tables } from '@/integrations/supabase/types';
import { recalculateProjections } from '@/utils/raceUtils';

// A generic type for items that have an ID and an updated_at timestamp
interface Syncable {
  id: string | number;
  updated_at: string | null;
}

export const useSyncManager = (onConflictDetected?: (conflict: any) => void) => {
  const store = useRaceStore();

  // Reset mounted state on mount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Debounce refetches triggered by broadcast to avoid loops/storms
  // and ignore broadcasts originating from this device.
  let lastBroadcastRefetchAt = 0;
  const BROADCAST_REFETCH_COOLDOWN_MS = 1500;

  // In-flight guards and debounced broadcast timer
  const isFetchingRunners = useRef(false);
  const isFetchingLegs = useRef(false);
  const broadcastRefetchTimerRef = useRef<number | undefined>(undefined);

  // Broadcast deduplication to prevent processing duplicate messages
  const recentBroadcasts = useRef<Map<string, number>>(new Map());
  const BROADCAST_DEDUP_WINDOW_MS = 2000; // 2 second window for deduplication
  
  // Manual retry function ref
  const manualRetryRef = useRef<(() => void) | null>(null);
  
  // Track if component is mounted to prevent retries after unmount
  const isMountedRef = useRef(true);
  
  // Track if manual retry is in progress to prevent conflicts
  const isManualRetryInProgress = useRef(false);

  // Lightweight local queue to avoid circular hook dependency
  const enqueueChange = (change: { table: 'runners' | 'legs'; remoteId: string; payload: any }) => {
    try {
      const key = 'relay-splits-offline-queue';
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : [];
      const queueItem = { ...change, timestamp: Date.now() };
      arr.push(queueItem);
      localStorage.setItem(key, JSON.stringify(arr));
      console.log(`[useSyncManager] Successfully enqueued offline change:`, queueItem);
      console.log(`[useSyncManager] Total queued changes: ${arr.length}`);
    } catch (e) {
      console.error('[useSyncManager] Failed to enqueue offline change', e);
    }
  };

  /**
   * Smart merge function that considers offline changes when merging data.
   * It checks for pending offline changes and preserves local modifications.
   *
   * @param incomingItems The array of items from Supabase (e.g., runners or legs).
   * @param localItems The corresponding array of items from the Zustand store.
   * @param updateAction The Zustand action to update the items (e.g., `store.setRunners`).
   * @param table The table name for checking offline queue.
   */
  const merge = useCallback(
    <T extends Syncable>( 
      incomingItems: T[],
      localItems: T[],
      updateAction: (items: T[]) => void,
      table?: 'runners' | 'legs'
    ) => {
      // Get pending offline changes for this table
      const pendingChanges = new Map<string, any>();
      if (table) {
        try {
          const queue = localStorage.getItem('relay-splits-offline-queue');
          if (queue) {
            const queueData = JSON.parse(queue);
            queueData.forEach((change: any) => {
              if (change.table === table && change.remoteId) {
                pendingChanges.set(change.remoteId, change.payload);
              }
            });
          }
        } catch (e) {
          console.warn('[merge] Error reading offline queue:', e);
        }
      }

      const localItemsMap = new Map(localItems.map((item) => [item.id, item]));
      let hasChanges = false;

      const mergedItems = [...localItems];

      for (const incomingItem of incomingItems) {
        const localItem = localItemsMap.get(incomingItem.id);
        const remoteId = (incomingItem as any).remoteId;
        const pendingChange = remoteId ? pendingChanges.get(remoteId) : null;

        // If there's a pending offline change for this item, preserve local changes
        if (pendingChange) {
          console.log(`[merge] Preserving local changes for ${table}:${remoteId} due to pending offline change`);
          continue; // Skip this item, keep local version
        }

        // Check for timing conflicts if this is a leg with timing data
        if (table === 'legs' && localItem && onConflictDetected) {
          const localLeg = localItem as any;
          const serverLeg = incomingItem as any;
          
          // Check for start time conflicts
          if (localLeg.actualStart && serverLeg.actualStart && 
              Math.abs(localLeg.actualStart - serverLeg.actualStart) > 60000) { // 1 minute difference
            console.log(`[merge] Timing conflict detected for leg ${localLeg.id} start time`);
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
            console.log(`[merge] Timing conflict detected for leg ${localLeg.id} finish time`);
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
    },
    [onConflictDetected]
  );

  // Fetch helpers with in-flight guards
  const fetchAndMergeRunners = useCallback(async (teamId: string): Promise<number> => {
    if (isFetchingRunners.current) {
      console.log('[fetch] Runners fetch already in progress, skipping.');
      return 0;
    }
    isFetchingRunners.current = true;
    try {
      const deviceId = getDeviceId();
      const res = await invokeEdge<{ runners: Tables<'runners'>[] }>('runners-list', { teamId, deviceId });
      if ((res as any).error) {
        console.error('Error fetching runners:', (res as any).error);
        return 0;
      }
      const remoteRunners = (res as any).data?.runners ?? [];
      // Stabilize local runner IDs by mapping incoming remoteIds to existing local IDs.
      // This avoids reshuffling runner IDs when the remote list order changes,
      // which can otherwise trigger sync loops.
      const existingRemoteToLocalId = new Map<string, number>(
        useRaceStore
          .getState()
          .runners
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
      merge(runners, useRaceStore.getState().runners, store.setRunners, 'runners');
      return remoteRunners.length;
    } finally {
      isFetchingRunners.current = false;
    }
  }, [merge, store.setRunners]);

  const fetchAndMergeLegs = useCallback(async (teamId: string): Promise<number> => {
    if (isFetchingLegs.current) {
      console.log('[fetch] Legs fetch already in progress, skipping.');
      return 0;
    }
    isFetchingLegs.current = true;
    try {
      const deviceId = getDeviceId();
      console.log('[fetchAndMergeLegs] Fetching legs for team:', teamId, 'deviceId:', deviceId);
      const res = await invokeEdge<{ legs: Tables<'legs'>[] }>('legs-list', { teamId, deviceId });
      console.log('[fetchAndMergeLegs] Raw response:', res);
      
      if ((res as any).error) {
        console.error('Error fetching legs:', (res as any).error);
        return 0;
      }
      
      const remoteLegs = (res as any).data?.legs ?? [];
      console.log('[fetchAndMergeLegs] Remote legs received:', remoteLegs);
      
      const remoteToLocalRunnerMap = new Map<string, number>(
        useRaceStore.getState().runners.map(r => [r.remoteId as string, r.id as number])
      );
      console.log('[fetchAndMergeLegs] Runner map:', Object.fromEntries(remoteToLocalRunnerMap));
      
      const legs: Leg[] = remoteLegs.map((l: Tables<'legs'>) => {
        // Get the mapped runner ID, but preserve existing local mapping if remote mapping fails
        let mappedRunnerId: number;
        if (l.runner_id) {
          const remoteMappedId = remoteToLocalRunnerMap.get(l.runner_id);
          if (remoteMappedId !== undefined) {
            mappedRunnerId = remoteMappedId;
          } else {
            // If remote mapping fails, try to find existing leg with same remoteId and preserve its runnerId
            const existingLeg = useRaceStore.getState().legs.find(leg => leg.remoteId === l.id);
            if (existingLeg && existingLeg.runnerId > 0) {
              console.warn(`[fetchAndMergeLegs] Runner mapping failed for leg ${l.number}, preserving existing runnerId ${existingLeg.runnerId}`);
              mappedRunnerId = existingLeg.runnerId;
            } else {
              console.error(`[fetchAndMergeLegs] No runner mapping found for leg ${l.number} with runner_id ${l.runner_id}, skipping leg`);
              return null; // Skip this leg to prevent runnerId=0
            }
          }
        } else {
          // No runner_id in remote data, preserve existing mapping if available
          const existingLeg = useRaceStore.getState().legs.find(leg => leg.remoteId === l.id);
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
      }).filter(Boolean) as Leg[]; // Remove null entries
      console.log('[fetchAndMergeLegs] Mapped legs:', legs);
      
      merge(legs, useRaceStore.getState().legs, (items) => {
        console.log('[fetchAndMergeLegs] Setting', items.length, 'legs in store');
        useRaceStore.getState().setRaceData({ legs: items });
        // Recalculate projections after merging legs from remote
        const storeState = useRaceStore.getState();
        if (items.length > 0) {
          const recalculatedLegs = recalculateProjections(items, 0, storeState.runners);
          useRaceStore.getState().setRaceData({ legs: recalculatedLegs });
        }
      }, 'legs');
      return remoteLegs.length;
    } catch (error) {
      console.error('[fetchAndMergeLegs] Error fetching legs:', error);
      return 0;
    } finally {
      isFetchingLegs.current = false;
    }
  }, [merge]);

  const isFetchingInitialData = useRef(false);
  const lastFetchTime = useRef(0);
  const FETCH_DEBOUNCE_MS = 2000; // 2 second debounce
  
  const fetchInitialData = useCallback(async (teamId: string) => {
    const now = Date.now();
    const stackTrace = new Error().stack?.split('\n').slice(2, 5).join('\n') || 'No stack trace';
    
    console.log('[fetchInitialData] Called with teamId:', teamId, 'from:', stackTrace);
    
    if (isFetchingInitialData.current) {
      console.log('[fetchInitialData] Already in progress, skipping');
      return;
    }
    
    // Debounce rapid successive calls
    if (now - lastFetchTime.current < FETCH_DEBOUNCE_MS) {
      console.log('[fetchInitialData] Debouncing rapid successive calls');
      return;
    }
    
    isFetchingInitialData.current = true;
    lastFetchTime.current = now;
    console.log('[fetchInitialData] Fetching via Edge Functions for team', teamId);
    
    let runnersCount = 0;
    let legsCount = 0;
    
    try {
      runnersCount = await fetchAndMergeRunners(teamId);
      
      // Ensure runners are properly loaded before fetching legs
      const storeState = useRaceStore.getState();
      const runnersWithRemoteIds = storeState.runners.filter(r => r.remoteId);
      console.log(`[fetchInitialData] Runners loaded: ${runnersCount}, runners with remoteIds: ${runnersWithRemoteIds.length}`);
      
      // Only fetch legs if we have runners with remoteIds to ensure proper mapping
      if (runnersWithRemoteIds.length > 0) {
        legsCount = await fetchAndMergeLegs(teamId);
      } else {
        console.warn('[fetchInitialData] No runners with remoteIds found, skipping leg fetch to prevent mapping issues');
      }
      
      console.log('[fetchInitialData] Merge complete');
    } finally {
      isFetchingInitialData.current = false;
    }
    
    // Ensure projections are recalculated after initial data fetch
    const storeState = useRaceStore.getState();
    if (storeState.legs.length > 0) {
      const recalculatedLegs = recalculateProjections(storeState.legs, 0, storeState.runners);
      storeState.setRaceData({ legs: recalculatedLegs });
    }
    
    // Auto-lock setup once any remote runners exist for this team.
    try {
      const anyRemoteRunners = runnersCount > 0 || storeState.runners.some(r => !!r.remoteId);
      if (anyRemoteRunners) {
        const lockKey = `relay_setup_locked_${teamId}`;
        localStorage.setItem(lockKey, '1');
        if (!storeState.isSetupComplete) {
          storeState.setRaceData({ isSetupComplete: true });
        }
      }
    } catch (e) {
      console.warn('[fetchInitialData] failed to persist/setup lock flag', e);
    }
  }, [fetchAndMergeRunners, fetchAndMergeLegs]);

  const safeUpdate = useCallback(
    async <T extends { updated_at?: string | null }>(
      table: 'runners' | 'legs',
      teamId: string,
      remoteId: string,
      payload: Partial<T>
    ) => {
      const storeState = useRaceStore.getState();
      const localItem =
        table === 'runners'
          ? storeState.runners.find((r) => r.remoteId === remoteId)
          : storeState.legs.find((l) => l.remoteId === remoteId);

      if (!navigator.onLine) {
        console.log(`[safeUpdate] App is offline. Queuing update for ${table}:${remoteId}`);
        console.log(`[safeUpdate] Payload:`, payload);
        
        // For legs, include the number field in the queued payload
        let queuedPayload = payload;
        if (table === 'legs' && localItem) {
          queuedPayload = {
            ...payload,
            number: (localItem as any).id, // Include the leg number
            distance: (localItem as any).distance // Include the distance
          };
        }
        
        enqueueChange({ table, remoteId, payload: queuedPayload });
        // Perform optimistic update locally, assuming it will succeed.
        // The merge function handles this.
        const optimisticItem = { ...localItem, ...payload, remoteId } as unknown as Syncable;
        merge(
          [optimisticItem],
          table === 'runners' ? storeState.runners : storeState.legs,
          table === 'runners'
            ? storeState.setRunners
            : (items) => storeState.setRaceData({ legs: items as Leg[] })
        );
        return { data: optimisticItem }; // Return optimistic data
      }

      if (!localItem) {
        console.error(`[safeUpdate] Local item with remoteId ${remoteId} not found.`);
        return { error: new Error('Local item not found for update.') };
      }

      // Build Edge Function payload
      const deviceId = getDeviceId();
      let edgeName: 'runners-upsert' | 'legs-upsert';
      let body: any;
      if (table === 'runners') {
        edgeName = 'runners-upsert';
        const merged = { ...(localItem as any), ...(payload as any) };
        const runner = {
          id: remoteId,
          name: merged.name,
          pace: merged.pace,
          van: typeof merged.van === 'number' ? String(merged.van) : merged.van,
        };
        body = { teamId, deviceId, runners: [runner], action: 'upsert' };
      } else {
        edgeName = 'legs-upsert';
        // payload may contain runner_id, start_time, finish_time, distance
        // For legs, we need to map the frontend id to the database number field
        const store = useRaceStore.getState();
        const localLeg = store.legs.find(l => l.remoteId === remoteId);
        if (!localLeg) {
          console.error('[safeUpdate] Local leg not found for remoteId:', remoteId, 'Available legs:', store.legs.map(l => ({ id: l.id, remoteId: l.remoteId })));
          return { error: new Error('Local leg not found for sync.') };
        }
        const leg = { 
          id: remoteId, 
          number: localLeg.id, // Map frontend id to database number field
          distance: localLeg.distance, // Always include distance for validation
          ...(payload as any) 
        };
        body = { teamId, deviceId, legs: [leg], action: 'upsert' };
      }

      const res = await invokeEdge(edgeName, body);
      if ((res as any).error) {
        console.error(`[safeUpdate] Edge ${edgeName} error:`, (res as any).error);
        return { error: (res as any).error };
      }

      // Optimistically merge local change since Edge Functions don't return rows
      const updatedItem = { ...(localItem as any), ...(payload as any) } as unknown as Syncable;
      (updatedItem as any).updated_at = new Date().toISOString();
      merge(
        [updatedItem],
        table === 'runners' ? storeState.runners : storeState.legs,
        table === 'runners'
          ? storeState.setRunners
          : (items) => {
              storeState.setRaceData({ legs: items as Leg[] });
              // Recalculate projections after leg updates
              if (table === 'legs' && items.length > 0) {
                const recalculatedLegs = recalculateProjections(items as Leg[], 0, storeState.runners);
                storeState.setRaceData({ legs: recalculatedLegs });
              }
            }
      );

      return { data: updatedItem };
    },
    [fetchInitialData, merge]
  );

  const setupRealtimeSubscriptions = useCallback((teamId: string) => {
    console.log('[realtime] Setting up subscriptions for team', teamId);
    
    // Check if current device is a viewer - viewers don't need realtime subscriptions
    const deviceInfo = JSON.parse(localStorage.getItem('relay_device_info') || '{}');
    if (deviceInfo.role === 'viewer') {
      console.log('[realtime] Skipping realtime setup for viewer role');
      return () => {}; // Return no-op cleanup function
    }
    
    // Enhanced backoff helper with max retries and connection state tracking
    const makeBackoff = () => {
      let attempt = 0;
      const MAX_ATTEMPTS = 5; // Limit retries to prevent infinite loops
      let isRetrying = false;
      
      return {
        nextDelay() {
          if (attempt >= MAX_ATTEMPTS) {
            console.warn('[realtime] Max retry attempts reached, stopping retries');
            return -1; // Signal to stop retrying
          }
          
          // Exponential backoff with full jitter
          // base grows 1s,2s,4s,... up to 30s; jitter randomizes delay in [minDelay, base]
          const base = Math.min(30000, 1000 * Math.pow(2, attempt));
          attempt = Math.min(attempt + 1, MAX_ATTEMPTS);
          const minDelay = 1000; // Increased minimum delay
          const delay = Math.max(minDelay, Math.floor(Math.random() * base));
          return delay;
        },
        reset() { 
          attempt = 0; 
          isRetrying = false;
        },
        isMaxAttemptsReached() {
          return attempt >= MAX_ATTEMPTS;
        },
        setRetrying(retrying: boolean) {
          isRetrying = retrying;
        },
        getIsRetrying() {
          return isRetrying;
        }
      };
    };

    const runnersBackoff = makeBackoff();
    const legsBackoff = makeBackoff();
    let reconcileTimer: number | undefined;
    let onlineHandler: ((this: Window, ev: Event) => any) | undefined;
    
    // Track active channels to prevent duplicate subscriptions
    const activeChannels = new Map<string, any>();

    const subscribeWithRetry = (
      channelName: string,
      table: 'runners' | 'legs',
      onEvent: (payload: any) => void,
      onStatusLog: (status: string) => void,
    ) => {
      const backoff = table === 'runners' ? runnersBackoff : legsBackoff;

      const doSubscribe = () => {
        // Prevent multiple subscriptions to the same channel
        if (activeChannels.has(channelName)) {
          console.log(`[realtime] Channel ${channelName} already active, skipping subscription`);
          return activeChannels.get(channelName);
        }
        
        // Check if component is still mounted
        if (!isMountedRef.current) {
          console.log(`[realtime] Component unmounted, skipping ${table} channel subscription`);
          return null;
        }
        
        // Check if we've exceeded max retry attempts
        if (backoff.isMaxAttemptsReached()) {
          console.error(`[realtime] Max retry attempts reached for ${table} channel, giving up`);
          return null;
        }
        
        // Check if we're already retrying
        if (backoff.getIsRetrying()) {
          console.log(`[realtime] Already retrying ${table} channel, skipping`);
          return null;
        }

        // Check network connectivity before attempting subscription
        if (!navigator.onLine) {
          console.warn(`[realtime] Network is offline, skipping ${table} channel subscription`);
          return null;
        }

        // Check if Supabase client is available
        if (!supabase) {
          console.error(`[realtime] Supabase client not available, skipping ${table} channel subscription`);
          return null;
        }

        console.log(`[realtime] Subscribing to ${table} channel: ${channelName}`);
        
        const ch = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table, filter: `team_id=eq.${teamId}` },
            onEvent
          )
          .subscribe((status) => {
            onStatusLog(status);
            
            if (status === 'SUBSCRIBED') {
              console.log(`[realtime] ${table} channel successfully subscribed`);
              backoff.reset();
              activeChannels.set(channelName, ch);
            }
            
            if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
              console.warn(`[realtime] ${table} channel ${status}`);
              
              // Remove from active channels
              activeChannels.delete(channelName);
              
              // Only retry if we haven't exceeded max attempts and we're not already retrying
              if (!backoff.isMaxAttemptsReached() && !backoff.getIsRetrying()) {
                const delay = backoff.nextDelay();
                if (delay > 0) {
                  backoff.setRetrying(true);
                  console.warn(`[realtime] ${table} channel ${status}. Retrying in ${delay}ms (attempt ${backoff.isMaxAttemptsReached() ? 'MAX' : 'remaining'})`);
                  
                  setTimeout(() => {
                    // Check if we're still mounted and not in manual retry mode
                    if (!isMountedRef.current || backoff.getIsRetrying()) {
                      console.log(`[realtime] Skipping retry for ${table} - component unmounted or already retrying`);
                      return;
                    }
                    
                    // If manual retry is in progress, let it handle the reconnection
                    if (isManualRetryInProgress.current) {
                      console.log(`[realtime] Skipping automatic retry for ${table} - manual retry in progress`);
                      backoff.setRetrying(false);
                      return;
                    }
                    
                    try {
                      // Clean up the old channel
                      supabase.removeChannel(ch);
                    } catch (e) {
                      console.warn(`[realtime] Error removing ${table} channel:`, e);
                    }
                    
                    backoff.setRetrying(false);
                    doSubscribe();
                  }, delay);
                } else {
                  console.error(`[realtime] ${table} channel max retry attempts reached, stopping retries`);
                }
              } else {
                if (backoff.getIsRetrying()) {
                  console.log(`[realtime] ${table} channel ${status} - already retrying`);
                } else {
                  console.error(`[realtime] ${table} channel max retry attempts reached, giving up`);
                }
              }
            }
          });
          
        return ch;
      };
      
      return doSubscribe();
    };
    const handleSubscriptionEvent = (payload: any, table: 'runners' | 'legs') => {
      // Check if current device is a viewer - viewers don't need subscription events
      const deviceInfo = JSON.parse(localStorage.getItem('relay_device_info') || '{}');
      if (deviceInfo.role === 'viewer') {
        console.log('[realtime] Ignoring subscription event for viewer role');
        return;
      }
      
      const storeState = useRaceStore.getState();
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        if (table === 'runners') {
          const r = payload.new as Tables<'runners'>;
          const idx = storeState.runners.findIndex((x) => x.remoteId === r.id);
          if (idx !== -1) {
            const updated = {
              ...storeState.runners[idx],
              name: r.name,
              pace: r.pace,
              van: r.van === '1' ? 1 : 2,
              updated_at: r.updated_at,
            } as (typeof storeState.runners)[number];
            const arr = [...storeState.runners];
            arr[idx] = updated;
            storeState.setRunners(arr);
            // Recalculate legs projections since runner pace/van can affect timing
            if (storeState.legs.length > 0) {
              const finalLegs = recalculateProjections(storeState.legs as unknown as Leg[], 0, arr as unknown as Runner[]);
              storeState.setRaceData({ legs: finalLegs });
            }
          } else {
            // Optional: handle remote runner INSERT by appending or ignoring
            console.warn('[realtime] runner update for unknown remoteId', r.id);
          }
        } else {
          const l = payload.new as Tables<'legs'>;
          const idx = storeState.legs.findIndex((x) => x.remoteId === l.id);
          if (idx !== -1) {
            const mappedRunnerId = l.runner_id
              ? storeState.runners.find((rr) => rr.remoteId === l.runner_id)?.id || 0
              : 0;
            const updated = {
              ...storeState.legs[idx],
              runnerId: mappedRunnerId,
              distance: l.distance,
              actualStart: l.start_time ? new Date(l.start_time).getTime() : undefined,
              actualFinish: l.finish_time ? new Date(l.finish_time).getTime() : undefined,
              updated_at: l.updated_at,
            } as (typeof storeState.legs)[number];
            const arr = [...storeState.legs];
            arr[idx] = updated;
            // Recalculate projections from the changed index
            const finalLegs = recalculateProjections(arr as unknown as Leg[], idx, storeState.runners as unknown as Runner[]);
            storeState.setRaceData({ legs: finalLegs });
          } else {
            console.warn('[realtime] leg update for unknown remoteId', l.id);
          }
        }
      } else if (payload.eventType === 'DELETE') {
        const oldId = payload.old.id;
        if (table === 'runners') {
          storeState.setRunners(storeState.runners.filter((r) => r.remoteId !== oldId));
        } else {
          storeState.setRaceData({ legs: storeState.legs.filter((l) => l.remoteId !== oldId) });
        }
      }
    };

    const createSubscription = (table: 'runners' | 'legs') => {
      const channelName = table === 'runners' ? `realtime-runners-${teamId}` : `legs-${teamId}`;
      const eventHandler = (payload: any) => {
        if (table === 'runners') {
          console.log('[realtime] runners event', {
            eventType: payload.eventType,
            new: (payload as any).new?.id,
            old: (payload as any).old?.id,
          });
        }
        handleSubscriptionEvent(payload, table);
      };
      const statusHandler = (status: string) => console.log(`[realtime] ${table} channel status:`, status);
      
      return subscribeWithRetry(channelName, table, eventHandler, statusHandler);
    };

    const runnersChannel = createSubscription('runners');
    const legsChannel = createSubscription('legs');

    // Subscribe to broadcast channel for realtime updates from Edge Functions
    // Coalesced, selective refetch on broadcast
    let pendingFetch: { runners: boolean; legs: boolean } = { runners: false, legs: false };
    const broadcastChannel = supabase
      .channel(`team-${teamId}`)
      .on('broadcast', { event: 'data_updated' }, (outer) => {
        try {
          // Check if current device is a viewer - viewers don't need broadcast updates
          const deviceInfo = JSON.parse(localStorage.getItem('relay_device_info') || '{}');
          if (deviceInfo.role === 'viewer') {
            console.log('[broadcast] Ignoring broadcast for viewer role');
            return;
          }
          
          const payload = (outer as any)?.payload;
          const originDeviceId = payload?.device_id;
          const myDeviceId = getDeviceId();
          
          // Ignore self-originated broadcasts
          if (originDeviceId && myDeviceId && originDeviceId === myDeviceId) {
            console.log('[broadcast] Ignoring self-originated broadcast');
            return;
          }

          // Create deduplication key based on device_id, type, and timestamp (rounded to nearest second)
          const timestamp = payload?.timestamp ? new Date(payload.timestamp).getTime() : Date.now();
          const roundedTimestamp = Math.floor(timestamp / 1000) * 1000; // Round to nearest second
          const dedupKey = `${originDeviceId}-${payload?.type}-${roundedTimestamp}`;
          const now = Date.now();
          
          // Check if we've seen this broadcast recently
          const lastSeen = recentBroadcasts.current.get(dedupKey);
          if (lastSeen && (now - lastSeen) < BROADCAST_DEDUP_WINDOW_MS) {
            console.log('[broadcast] Ignoring duplicate broadcast within dedup window:', payload);
            return;
          }
          
          // Clean up old entries from deduplication map
          for (const [key, time] of recentBroadcasts.current.entries()) {
            if (now - time > BROADCAST_DEDUP_WINDOW_MS) {
              recentBroadcasts.current.delete(key);
            }
          }
          
          // Record this broadcast
          recentBroadcasts.current.set(dedupKey, now);
          console.log('[broadcast] Received data update:', payload);

          const type = payload?.type as 'runners' | 'legs' | undefined;
          if (!type) {
            // Unknown type, fall back to full refetch
            pendingFetch.runners = true;
            pendingFetch.legs = true;
          } else {
            if (type === 'runners') pendingFetch.runners = true;
            if (type === 'legs') pendingFetch.legs = true;
          }

          if (!broadcastRefetchTimerRef.current) {
            console.log('[broadcast] Scheduling debounced selective refetch in 500ms');
            broadcastRefetchTimerRef.current = window.setTimeout(() => {
              const state = useRaceStore.getState();
              if (state.teamId) {
                if (pendingFetch.runners) fetchAndMergeRunners(state.teamId);
                if (pendingFetch.legs) fetchAndMergeLegs(state.teamId);
              }
              pendingFetch = { runners: false, legs: false };
              broadcastRefetchTimerRef.current = undefined;
            }, 500) as unknown as number;
          }
        } catch (e) {
          console.warn('[broadcast] Handler error', e);
        }
      })
      .subscribe((status) => {
        console.log('[broadcast] Channel status:', status);
      });

    // Periodic reconciliation and health check (defense-in-depth) e.g., every 60s
    reconcileTimer = window.setInterval(() => {
      console.log('[realtime] Reconciliation timer triggered');
      const state = useRaceStore.getState();
      if (state.teamId) {
        // Check if current device is a viewer - viewers don't need realtime reconciliation
        const deviceInfo = JSON.parse(localStorage.getItem('relay_device_info') || '{}');
        console.log('[realtime] Device info from localStorage:', deviceInfo);
        if (deviceInfo.role === 'viewer') {
          console.log('[realtime] Skipping reconciliation for viewer role');
          return;
        }
        
        console.log('[realtime] reconciling state via fetchInitialData');
        fetchInitialData(state.teamId);
        
        // Health check: if we have no active channels but should, try to resubscribe
        if (activeChannels.size === 0 && navigator.onLine) {
          console.log('[realtime] No active channels detected, attempting resubscription');
          runnersBackoff.reset();
          legsBackoff.reset();
          
          // This will trigger resubscription on next interval
          setTimeout(() => {
            createSubscription('runners');
            createSubscription('legs');
          }, 1000);
        }
      }
    }, 60000) as unknown as number;

    // Resubscribe on network re-connection
    onlineHandler = () => {
      console.log('[realtime] online event: triggering reconciliation and channel resubscription');
      const state = useRaceStore.getState();
      if (state.teamId) {
        // Check if current device is a viewer - viewers don't need realtime reconciliation
        const deviceInfo = JSON.parse(localStorage.getItem('relay_device_info') || '{}');
        if (deviceInfo.role === 'viewer') {
          console.log('[realtime] Skipping online reconciliation for viewer role');
          return;
        }
        
        // Reset backoff states when network comes back online
        runnersBackoff.reset();
        legsBackoff.reset();
        
        // Clear any existing channels and resubscribe
        for (const [channelName, channel] of activeChannels.entries()) {
          try {
            supabase.removeChannel(channel);
          } catch (e) {
            console.warn(`[realtime] Error removing channel ${channelName} during online event:`, e);
          }
        }
        activeChannels.clear();
        
        // Trigger initial data fetch and resubscribe
        fetchInitialData(state.teamId);
      }
    };
    window.addEventListener('online', onlineHandler);

    // Manual retry function for debugging
    const manualRetry = () => {
      // Check if current device is a viewer - viewers don't need manual retry
      const deviceInfo = JSON.parse(localStorage.getItem('relay_device_info') || '{}');
      if (deviceInfo.role === 'viewer') {
        console.log('[realtime] Skipping manual retry for viewer role');
        return;
      }
      
      if (isManualRetryInProgress.current) {
        console.log('[realtime] Manual retry already in progress, skipping');
        return;
      }
      
      console.log('[realtime] Manual retry triggered');
      isManualRetryInProgress.current = true;
      
      // Reset backoff states
      runnersBackoff.reset();
      legsBackoff.reset();
      
      // Clear existing channels and wait for cleanup
      const cleanupPromises = [];
      for (const [channelName, channel] of activeChannels.entries()) {
        try {
          console.log(`[realtime] Removing channel ${channelName} during manual retry`);
          supabase.removeChannel(channel);
          cleanupPromises.push(Promise.resolve());
        } catch (e) {
          console.warn(`[realtime] Error removing channel ${channelName} during manual retry:`, e);
          cleanupPromises.push(Promise.resolve());
        }
      }
      activeChannels.clear();
      
      // Wait for cleanup to complete, then resubscribe with a delay
      Promise.all(cleanupPromises).then(() => {
        console.log('[realtime] Cleanup complete, resubscribing in 500ms');
        setTimeout(() => {
          console.log('[realtime] Starting resubscription');
          // Create subscriptions sequentially to avoid conflicts
          const runnersChannel = createSubscription('runners');
          if (runnersChannel) {
            setTimeout(() => {
              console.log('[realtime] Creating legs subscription');
              createSubscription('legs');
              // Reset manual retry flag after both subscriptions are attempted
              setTimeout(() => {
                isManualRetryInProgress.current = false;
                console.log('[realtime] Manual retry completed');
              }, 1000);
            }, 200);
          } else {
            console.log('[realtime] Runners subscription failed, skipping legs');
            isManualRetryInProgress.current = false;
          }
        }, 500);
      });
    };

    // Store the manual retry function in the ref so it can be accessed outside this callback
    manualRetryRef.current = manualRetry;

    return () => {
      console.log('[realtime] Cleaning up subscriptions for team', teamId);
      
      // Mark component as unmounted to prevent new retries
      isMountedRef.current = false;
      isManualRetryInProgress.current = false;
      
      // Clean up all active channels
      for (const [channelName, channel] of activeChannels.entries()) {
        try {
          console.log(`[realtime] Removing channel: ${channelName}`);
          supabase.removeChannel(channel);
        } catch (e) {
          console.warn(`[realtime] Error removing channel ${channelName}:`, e);
        }
      }
      activeChannels.clear();
      
      // Clean up broadcast channel
      try {
        supabase.removeChannel(broadcastChannel);
      } catch (e) {
        console.warn('[realtime] Error removing broadcast channel:', e);
      }
      
      // Clean up timers
      if (broadcastRefetchTimerRef.current) {
        clearTimeout(broadcastRefetchTimerRef.current);
        broadcastRefetchTimerRef.current = undefined;
      }
      if (reconcileTimer) {
        clearInterval(reconcileTimer);
      }
      if (onlineHandler) {
        window.removeEventListener('online', onlineHandler);
      }
      
      // Reset backoff states
      runnersBackoff.reset();
      legsBackoff.reset();
    };
  }, [merge]);



  // Idempotent: if team already has runners, do nothing. Uses Edge Functions.
  const saveInitialRows = useCallback(async (teamId: string) => {
    console.log('[saveInitialRows] Starting saveInitialRows for team:', teamId);
    const storeState = useRaceStore.getState();
    const deviceId = getDeviceId();
    console.log('[saveInitialRows] Device ID:', deviceId);
    console.log('[saveInitialRows] Store state runners count:', storeState.runners.length);
    console.log('[saveInitialRows] Store state legs count:', storeState.legs.length);
    console.log('[saveInitialRows] Start time:', storeState.startTime, 'ISO:', new Date(storeState.startTime).toISOString());

    // Validate data before proceeding
    if (storeState.runners.length === 0) {
      console.error('[saveInitialRows] No runners in store state');
      return { error: new Error('No runners found in store state') };
    }
    
    if (storeState.legs.length === 0) {
      console.error('[saveInitialRows] No legs in store state');
      return { error: new Error('No legs found in store state') };
    }

    // Verify device is registered with the team
    console.log('[saveInitialRows] Verifying device registration...');
    try {
      const deviceCheck = await invokeEdge('devices-list', { teamId, deviceId });
      console.log('[saveInitialRows] Device check response:', deviceCheck);
      
      if ((deviceCheck as any).error || !(deviceCheck as any).data?.devices?.length) {
        console.error('[saveInitialRows] Device not registered with team');
        return { error: new Error('Device not registered with team. Please refresh the page and try again.') };
      }
      
      const device = (deviceCheck as any).data.devices[0];
      console.log('[saveInitialRows] Device verified:', device);
    } catch (e) {
      console.error('[saveInitialRows] Error checking device registration:', e);
      return { error: new Error('Failed to verify device registration') };
    }

    // If remote data exists, just fetch it
    console.log('[saveInitialRows] Checking if remote data exists...');
    const runnersList = await invokeEdge<{ runners: any[] }>('runners-list', { teamId, deviceId });
    console.log('[saveInitialRows] Runners list response:', runnersList);
    if (!(runnersList as any).error && (runnersList as any).data?.runners?.length > 0) {
      console.log('[saveInitialRows] Remote runners exist. Skipping inserts.');
      await fetchInitialData(teamId);
      return { ok: true };
    }

    // Insert runners via Edge
    console.log('[saveInitialRows] Inserting runners via Edge…');
    const runnersPayload = storeState.runners.map(r => ({ id: undefined, name: r.name, pace: r.pace, van: r.van.toString() }));
    console.log('[saveInitialRows] Runners payload:', runnersPayload);
    console.log('[saveInitialRows] Runners payload sample:', runnersPayload[0]);
    console.log('[saveInitialRows] Calling runners-upsert with:', { teamId, deviceId, runnersCount: runnersPayload.length, action: 'upsert' });
    
    try {
      const upsertR = await invokeEdge('runners-upsert', { teamId, deviceId, runners: runnersPayload, action: 'upsert' });
      console.log('[saveInitialRows] Runners upsert response:', upsertR);
      
      if ((upsertR as any).error) {
        console.error('[saveInitialRows] Error saving runners via Edge:', (upsertR as any).error);
        console.error('[saveInitialRows] Failed payload:', runnersPayload);
        console.error('[saveInitialRows] Device ID:', deviceId);
        console.error('[saveInitialRows] Team ID:', teamId);
        return { error: (upsertR as any).error };
      }
    } catch (e) {
      console.error('[saveInitialRows] Exception during runners upsert:', e);
      console.error('[saveInitialRows] Failed payload:', runnersPayload);
      console.error('[saveInitialRows] Device ID:', deviceId);
      console.error('[saveInitialRows] Team ID:', teamId);
      return { error: { message: `Network error: ${(e as Error)?.message || 'Unknown error'}` } };
    }

    // Build runnerId lookup by refetching
    const afterR = await invokeEdge<{ runners: any[] }>('runners-list', { teamId, deviceId });
    if ((afterR as any).error) {
      console.error('Error listing runners after insert:', (afterR as any).error);
      return { error: (afterR as any).error };
    }
    const remoteRunners = (afterR as any).data?.runners ?? [];
    const localToRemoteRunnerMap = new Map<number, string>();
    remoteRunners.forEach((rr: any, index: number) => {
      const localRunnerId = index + 1;
      if (!localToRemoteRunnerMap.has(localRunnerId)) {
        localToRemoteRunnerMap.set(localRunnerId, rr.id);
      }
    });

    // Insert legs via Edge
    console.log('[saveInitialRows] Inserting legs via Edge…');
    const legsPayload = storeState.legs.map(l => ({
      id: undefined,
      number: l.id,
      distance: l.distance,
      runner_id: l.runnerId ? localToRemoteRunnerMap.get(l.runnerId) : null,
    }));
    console.log('[saveInitialRows] Legs payload:', legsPayload);
    console.log('[saveInitialRows] Legs payload sample:', legsPayload[0]);
    console.log('[saveInitialRows] Calling legs-upsert with:', { teamId, deviceId, legsCount: legsPayload.length, action: 'upsert' });
    
    try {
      const upsertL = await invokeEdge('legs-upsert', { teamId, deviceId, legs: legsPayload, action: 'upsert' });
      console.log('[saveInitialRows] Legs upsert response:', upsertL);
      
      if ((upsertL as any).error) {
        console.error('[saveInitialRows] Error saving legs via Edge:', (upsertL as any).error);
        console.error('[saveInitialRows] Failed legs payload:', legsPayload);
        console.error('[saveInitialRows] Device ID:', deviceId);
        console.error('[saveInitialRows] Team ID:', teamId);
        return { error: (upsertL as any).error };
      }
    } catch (e) {
      console.error('[saveInitialRows] Exception during legs upsert:', e);
      console.error('[saveInitialRows] Failed legs payload:', legsPayload);
      console.error('[saveInitialRows] Device ID:', deviceId);
      console.error('[saveInitialRows] Team ID:', teamId);
      return { error: { message: `Network error: ${(e as Error)?.message || 'Unknown error'}` } };
    }

    await fetchInitialData(teamId);
    console.log('[saveInitialRows] Initial rows saved via Edge and fetched successfully');
    return { ok: true };
  }, [fetchInitialData]);

  return { 
    fetchInitialData, 
    safeUpdate, 
    setupRealtimeSubscriptions, 
    saveInitialRows, 
    merge, 
    manualRetry: () => {
      console.log('[useSyncManager] Manual retry called');
      manualRetryRef.current?.();
    }
  };
};
