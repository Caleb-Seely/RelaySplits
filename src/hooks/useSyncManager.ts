import { useCallback, useRef } from 'react';
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

export const useSyncManager = () => {
  const store = useRaceStore();

  // Debounce refetches triggered by broadcast to avoid loops/storms
  // and ignore broadcasts originating from this device.
  let lastBroadcastRefetchAt = 0;
  const BROADCAST_REFETCH_COOLDOWN_MS = 1500;

  // In-flight guards and debounced broadcast timer
  const isFetchingRunners = useRef(false);
  const isFetchingLegs = useRef(false);
  const broadcastRefetchTimerRef = useRef<number | undefined>(undefined);

  // Lightweight local queue to avoid circular hook dependency
  const enqueueChange = (change: { table: 'runners' | 'legs'; remoteId: string; payload: any }) => {
    try {
      const key = 'relay-splits-offline-queue';
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : [];
      arr.push({ ...change, timestamp: Date.now() });
      localStorage.setItem(key, JSON.stringify(arr));
    } catch (e) {
      console.error('[useSyncManager] Failed to enqueue offline change', e);
    }
  };

  /**
   * Merges an array of incoming items (from Supabase) into the local Zustand store.
   * It only updates a local item if the incoming item has a newer `updated_at` timestamp.
   *
   * @param incomingItems The array of items from Supabase (e.g., runners or legs).
   * @param localItems The corresponding array of items from the Zustand store.
   * @param updateAction The Zustand action to update the items (e.g., `store.setRunners`).
   */
  const merge = useCallback(
    <T extends Syncable>( 
      incomingItems: T[],
      localItems: T[],
      updateAction: (items: T[]) => void
    ) => {
      const localItemsMap = new Map(localItems.map((item) => [item.id, item]));
      let hasChanges = false;

      const mergedItems = [...localItems];

      for (const incomingItem of incomingItems) {
        const localItem = localItemsMap.get(incomingItem.id);

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
    []
  );

  // Fetch helpers with in-flight guards
  const fetchAndMergeRunners = useCallback(async (teamId: string) => {
    if (isFetchingRunners.current) {
      console.log('[fetch] Runners fetch already in progress, skipping.');
      return;
    }
    isFetchingRunners.current = true;
    try {
      const deviceId = getDeviceId();
      const res = await invokeEdge<{ runners: Tables<'runners'>[] }>('runners-list', { teamId, deviceId });
      if ((res as any).error) {
        console.error('Error fetching runners:', (res as any).error);
        return;
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
      merge(runners, useRaceStore.getState().runners, store.setRunners);
    } finally {
      isFetchingRunners.current = false;
    }
  }, [merge, store.setRunners]);

  const fetchAndMergeLegs = useCallback(async (teamId: string) => {
    if (isFetchingLegs.current) {
      console.log('[fetch] Legs fetch already in progress, skipping.');
      return;
    }
    isFetchingLegs.current = true;
    try {
      const deviceId = getDeviceId();
      const res = await invokeEdge<{ legs: Tables<'legs'>[] }>('legs-list', { teamId, deviceId });
      if ((res as any).error) {
        console.error('Error fetching legs:', (res as any).error);
        return;
      }
      const remoteLegs = (res as any).data?.legs ?? [];
      const remoteToLocalRunnerMap = new Map<string, number>(
        useRaceStore.getState().runners.map(r => [r.remoteId as string, r.id as number])
      );
      const legs: Leg[] = remoteLegs.map((l: Tables<'legs'>) => ({
        id: l.number,
        runnerId: l.runner_id ? remoteToLocalRunnerMap.get(l.runner_id) || 0 : 0,
        distance: l.distance,
        projectedStart: 0,
        projectedFinish: 0,
        actualStart: l.start_time ? new Date(l.start_time).getTime() : undefined,
        actualFinish: l.finish_time ? new Date(l.finish_time).getTime() : undefined,
        remoteId: l.id,
        updated_at: l.updated_at,
      }));
      merge(legs, useRaceStore.getState().legs, (items) => useRaceStore.getState().setRaceData({ legs: items }));
    } finally {
      isFetchingLegs.current = false;
    }
  }, [merge]);

  const fetchInitialData = useCallback(async (teamId: string) => {
    console.log('[fetchInitialData] Fetching via Edge Functions for team', teamId);
    await fetchAndMergeRunners(teamId);
    await fetchAndMergeLegs(teamId);
    console.log('[fetchInitialData] Merge complete');
    // Do NOT auto-mark setup complete here. The Setup Wizard controls completion
    // explicitly via `completeSetup()` after the user confirms. Auto-completing
    // based on presence of remote rows can prematurely finish setup for newly
    // created teams and appear to submit default names/paces.
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
        enqueueChange({ table, remoteId, payload });
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
        const leg = { id: remoteId, ...(payload as any) };
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
          : (items) => storeState.setRaceData({ legs: items as Leg[] })
      );

      return { data: updatedItem };
    },
    [fetchInitialData, merge]
  );

  const setupRealtimeSubscriptions = useCallback((teamId: string) => {
    console.log('[realtime] Setting up subscriptions for team', teamId);
    // Simple exponential backoff helper
    const makeBackoff = () => {
      let attempt = 0;
      return {
        nextDelay() {
          // Exponential backoff with full jitter
          // base grows 1s,2s,4s,... up to 30s; jitter randomizes delay in [minDelay, base]
          const base = Math.min(30000, 1000 * Math.pow(2, attempt));
          attempt = Math.min(attempt + 1, 10);
          const minDelay = 500; // ensure we don't hammer on immediate retries
          const delay = Math.max(minDelay, Math.floor(Math.random() * base));
          return delay;
        },
        reset() { attempt = 0; }
      };
    };

    const runnersBackoff = makeBackoff();
    const legsBackoff = makeBackoff();
    let reconcileTimer: number | undefined;
    let onlineHandler: ((this: Window, ev: Event) => any) | undefined;

    const subscribeWithRetry = (
      channelName: string,
      table: 'runners' | 'legs',
      onEvent: (payload: any) => void,
      onStatusLog: (status: string) => void,
    ) => {
      const backoff = table === 'runners' ? runnersBackoff : legsBackoff;

      const doSubscribe = () => {
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
              backoff.reset();
            }
            if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
              const delay = backoff.nextDelay();
              console.warn(`[realtime] ${table} channel ${status}. Retrying in ${delay}ms`);
              setTimeout(() => {
                try {
                  supabase.removeChannel(ch);
                } catch {}
                doSubscribe();
              }, delay);
            }
          });
        return ch;
      };
      return doSubscribe();
    };
    const handleSubscriptionEvent = (payload: any, table: 'runners' | 'legs') => {
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

    const runnersChannel = subscribeWithRetry(
      `realtime-runners-${teamId}`,
      'runners',
      (payload) => {
        console.log('[realtime] runners event', {
          eventType: payload.eventType,
          new: (payload as any).new?.id,
          old: (payload as any).old?.id,
        });
        handleSubscriptionEvent(payload, 'runners');
      },
      (status) => console.log('[realtime] runners channel status:', status)
    );

    const legsChannel = subscribeWithRetry(
      `legs-${teamId}`,
      'legs',
      (payload) => {
        handleSubscriptionEvent(payload, 'legs');
      },
      (status) => console.log('[realtime] legs channel status:', status)
    );

    // Subscribe to broadcast channel for realtime updates from Edge Functions
    // Coalesced, selective refetch on broadcast
    let pendingFetch: { runners: boolean; legs: boolean } = { runners: false, legs: false };
    const broadcastChannel = supabase
      .channel(`team-${teamId}`)
      .on('broadcast', { event: 'data_updated' }, (outer) => {
        try {
          const payload = (outer as any)?.payload;
          console.log('[broadcast] Received data update:', payload);
          const originDeviceId = payload?.device_id;
          const myDeviceId = getDeviceId();
          if (originDeviceId && myDeviceId && originDeviceId === myDeviceId) {
            console.log('[broadcast] Ignoring self-originated broadcast');
            return;
          }

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

    // Periodic reconciliation (defense-in-depth) e.g., every 60s
    reconcileTimer = window.setInterval(() => {
      const state = useRaceStore.getState();
      if (state.teamId) {
        console.log('[realtime] reconciling state via fetchInitialData');
        fetchInitialData(state.teamId);
      }
    }, 60000) as unknown as number;

    // Resubscribe on network re-connection
    onlineHandler = () => {
      console.log('[realtime] online event: triggering reconciliation');
      const state = useRaceStore.getState();
      if (state.teamId) fetchInitialData(state.teamId);
    };
    window.addEventListener('online', onlineHandler);

    return () => {
      console.log('[realtime] Cleaning up subscriptions for team', teamId);
      supabase.removeChannel(runnersChannel);
      supabase.removeChannel(legsChannel);
      supabase.removeChannel(broadcastChannel);
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
    };
  }, [merge]);

  const initialSave = useCallback(async (teamName: string) => {
    const storeState = useRaceStore.getState();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.error('User not authenticated for initial save.');
      return { error: new Error('User not authenticated.') };
    }

    // 1. Create the team
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .insert({
        name: teamName,
        owner_id: user.id,
        start_time: new Date(storeState.startTime).toISOString(),
      })
      .select()
      .single();

    if (teamError) {
      console.error('Error creating team:', teamError);
      return { error: teamError };
    }

    const teamId = teamData.id;

    // 2. Prepare and insert runners
    const runnersToInsert = storeState.runners.map(r => ({
      team_id: teamId,
      name: r.name,
      pace: r.pace,
      van: r.van.toString(),
    }));

    const { data: insertedRunners, error: runnersError } = await supabase
      .from('runners')
      .insert(runnersToInsert)
      .select();
    
    if (runnersError) {
      console.error('Error saving runners:', runnersError);
      // TODO: Add rollback logic for the created team
      return { error: runnersError };
    }

    // Create mapping from local runner IDs to remote runner IDs
    const localToRemoteRunnerMap = new Map<number, string>();
    insertedRunners.forEach((remoteRunner, index) => {
      const localRunnerId = index + 1; // Local IDs are 1-12
      localToRemoteRunnerMap.set(localRunnerId, remoteRunner.id);
    });

    // 3. Prepare and insert legs with proper runner_id linkage
    console.log('[saveInitialRows] Store state legs:', storeState.legs.map(l => ({ id: l.id, runnerId: l.runnerId })));
    console.log('[saveInitialRows] Local to remote runner map:', Array.from(localToRemoteRunnerMap.entries()));
    
    const legsToInsert = storeState.legs.map(l => {
      const remoteRunnerId = l.runnerId ? localToRemoteRunnerMap.get(l.runnerId) : null;
      console.log(`[saveInitialRows] Leg ${l.id}: local runnerId=${l.runnerId}, remote runnerId=${remoteRunnerId}`);
      return {
        team_id: teamId,
        number: l.id,
        distance: l.distance,
        runner_id: remoteRunnerId,
      };
    });

    const { error: legsError } = await supabase.from('legs').insert(legsToInsert);
    if (legsError) {
      console.error('Error saving legs:', legsError);
      // TODO: Add rollback logic
      return { error: legsError };
    }

    // 4. Update local store with the new teamId
    storeState.setTeamId(teamId);
    
    // 5. Fetch initial data to get all remoteIds and created_at timestamps
    await fetchInitialData(teamId);

    return { teamId };

  }, [fetchInitialData]);

  // Idempotent: if team already has runners, do nothing. Uses Edge Functions.
  const saveInitialRows = useCallback(async (teamId: string) => {
    const storeState = useRaceStore.getState();
    const deviceId = getDeviceId();

    // If remote data exists, just fetch it
    const runnersList = await invokeEdge<{ runners: any[] }>('runners-list', { teamId, deviceId });
    if (!(runnersList as any).error && (runnersList as any).data?.runners?.length > 0) {
      console.log('[saveInitialRows] Remote runners exist. Skipping inserts.');
      await fetchInitialData(teamId);
      return { ok: true };
    }

    // Insert runners via Edge
    console.log('[saveInitialRows] Inserting runners via Edge…');
    const runnersPayload = storeState.runners.map(r => ({ id: undefined, name: r.name, pace: r.pace, van: r.van.toString() }));
    const upsertR = await invokeEdge('runners-upsert', { teamId, deviceId, runners: runnersPayload, action: 'upsert' });
    if ((upsertR as any).error) {
      console.error('Error saving runners via Edge:', (upsertR as any).error);
      return { error: (upsertR as any).error };
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
    const upsertL = await invokeEdge('legs-upsert', { teamId, deviceId, legs: legsPayload, action: 'upsert' });
    if ((upsertL as any).error) {
      console.error('Error saving legs via Edge:', (upsertL as any).error);
      return { error: (upsertL as any).error };
    }

    await fetchInitialData(teamId);
    console.log('[saveInitialRows] Initial rows saved via Edge and fetched successfully');
    return { ok: true };
  }, [fetchInitialData]);

  return { fetchInitialData, safeUpdate, setupRealtimeSubscriptions, initialSave, saveInitialRows, merge };
};
