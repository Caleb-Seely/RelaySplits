import { useCallback } from 'react';
import { useRaceStore } from '@/store/raceStore';
import { supabase } from '@/integrations/supabase/client';
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

    const fetchInitialData = useCallback(async (teamId: string) => {
    console.log('[fetchInitialData] Fetching runners for team', teamId);
    const { data: remoteRunners, error: runnersError } = await supabase
      .from('runners')
      .select('*')
      .eq('team_id', teamId);
    console.log('[fetchInitialData] Fetching legs for team', teamId);
    const { data: remoteLegs, error: legsError } = await supabase
      .from('legs')
      .select('*')
      .eq('team_id', teamId);

    if (runnersError || legsError) {
      console.error('Error fetching initial data:', runnersError || legsError);
      return;
    }

    // Map Supabase data to our local store's data structure
    // Create a mapping from remote runner IDs to local runner IDs (1-12)
    const remoteToLocalRunnerMap = new Map<string, number>();
    const runners: Runner[] = remoteRunners.map((r: Tables<'runners'>, index) => {
      const localId = index + 1; // Local IDs are 1-12
      remoteToLocalRunnerMap.set(r.id, localId);
      return {
        id: localId,
        name: r.name,
        pace: r.pace,
        van: r.van === '1' ? 1 : 2,
        remoteId: r.id,
        updated_at: r.updated_at,
      };
    });

    const legs: Leg[] = remoteLegs.map((l: Tables<'legs'>) => ({
      id: l.number,
      runnerId: l.runner_id ? remoteToLocalRunnerMap.get(l.runner_id) || 0 : 0,
      distance: l.distance,
      projectedStart: 0, // Will be recalculated
      projectedFinish: 0, // Will be recalculated
      actualStart: l.start_time ? new Date(l.start_time).getTime() : undefined,
      actualFinish: l.finish_time ? new Date(l.finish_time).getTime() : undefined,
      remoteId: l.id,
      updated_at: l.updated_at,
    }));

    console.log('[fetchInitialData] Loaded', remoteRunners?.length ?? 0, 'runners and', remoteLegs?.length ?? 0, 'legs');
    // Merge the fetched data into the store
    merge(runners, store.runners, store.setRunners);
    merge(legs, store.legs, (items) => store.setRaceData({ legs: items }));

    console.log('[fetchInitialData] Merge complete');

    // If remote data exists (e.g., when joining a team), consider setup complete
    if ((remoteRunners?.length ?? 0) === 12 && (remoteLegs?.length ?? 0) > 0) {
      console.log('[fetchInitialData] Remote data present. Marking setup complete.');
      store.setRaceData({ isSetupComplete: true });
    }

  }, [merge]);

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

      // Ensure we have an updated_at to match against; if missing, fetch latest
      let matchUpdatedAt = (localItem as any).updated_at as string | null | undefined;
      if (!matchUpdatedAt) {
        const { data: fresh, error: freshErr } = await supabase
          .from(table)
          .select('*')
          .eq('id', remoteId)
          .single();
        if (freshErr) {
          console.error(`[safeUpdate] Failed to fetch fresh ${table} before update:`, freshErr);
          return { error: freshErr };
        }
        const freshItem = fresh as unknown as Syncable;
        // Merge fresh into local to align state
        merge(
          [freshItem],
          table === 'runners' ? storeState.runners : storeState.legs,
          table === 'runners'
            ? storeState.setRunners
            : (items) => storeState.setRaceData({ legs: items as Leg[] })
        );
        matchUpdatedAt = (fresh as any).updated_at as string | null | undefined;
      }

      // Perform the conditional update with current matchUpdatedAt
      let { data, error } = await supabase
        .from(table)
        .update(payload)
        .eq('id', remoteId)
        .select()
        .single();

      // If conflict (no rows) or explicit PGRST116, refetch latest and retry once
      if (error || !data) {
        const code = (error as any)?.code;
        if (code === 'PGRST116' || !data) {
          console.warn(`[safeUpdate] Conflict detected for ${table}:${remoteId}. Retrying with fresh updated_at.`);
          const { data: fresh2, error: freshErr2 } = await supabase
            .from(table)
            .select('*')
            .eq('id', remoteId)
            .single();
          if (freshErr2 || !fresh2) {
            console.error(`[safeUpdate] Failed to fetch fresh ${table} on retry:`, freshErr2);
            return { error: error || freshErr2 || new Error('Unknown update conflict') };
          }

          // Merge fresh2 into local state so UI reflects latest
          const freshSyncable = fresh2 as unknown as Syncable;
          merge(
            [freshSyncable],
            table === 'runners' ? storeState.runners : storeState.legs,
            table === 'runners'
              ? storeState.setRunners
              : (items) => storeState.setRaceData({ legs: items as Leg[] })
          );

          // Retry update with the newly fetched updated_at
          const retryMatch = (fresh2 as any).updated_at as string | null | undefined;
          const retry = await supabase
            .from(table)
            .update(payload)
            .match({ id: remoteId, updated_at: retryMatch })
            .select()
            .single();

          if (retry.error) {
            console.error(`[safeUpdate] Retry failed for ${table}:${remoteId}:`, retry.error);
            return { error: retry.error };
          }
          data = retry.data as any;
        } else {
          console.error(`[safeUpdate] Error updating ${table}:`, error);
          return { error };
        }
      }

      // Success! Merge the updated item back into the store.
      const updatedItem = data as unknown as Syncable;
      merge(
        [updatedItem],
        table === 'runners' ? storeState.runners : storeState.legs,
        table === 'runners'
          ? storeState.setRunners
          : (items) => storeState.setRaceData({ legs: items as Leg[] })
      );

      return { data };
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
      `realtime-legs-${teamId}`,
      'legs',
      (payload) => {
        console.log('[realtime] legs event', {
          eventType: payload.eventType,
          new: (payload as any).new?.id,
          old: (payload as any).old?.id,
        });
        handleSubscriptionEvent(payload, 'legs');
      },
      (status) => console.log('[realtime] legs channel status:', status)
    );

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

  // Idempotent: if team already has runners, do nothing
  const saveInitialRows = useCallback(async (teamId: string) => {
    const storeState = useRaceStore.getState();

    // Check if runners already exist for this team
    console.log('[saveInitialRows] Checking existing runners for team', teamId);
    const { count, error: countError } = await supabase
      .from('runners')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId);

    if (countError) {
      console.error('Error checking existing runners:', countError);
      return { error: countError };
    }

    if ((count ?? 0) > 0) {
      console.log('[saveInitialRows] Runners already exist (count =', count, '). Skipping inserts.');
      // Already initialized; just fetch to populate remoteIds/updated_at
      await fetchInitialData(teamId);
      console.log('[saveInitialRows] Refetch complete');
      return { ok: true };
    }

    // Insert runners
    console.log('[saveInitialRows] Inserting runners…');
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
      return { error: runnersError };
    }
    console.log('[saveInitialRows] Runners inserted:', runnersToInsert.length);

    // Build local->remote runner ID map (local IDs are 1-12 in store order)
    const localToRemoteRunnerMap = new Map<number, string>();
    insertedRunners?.forEach((remoteRunner: any, index: number) => {
      const localRunnerId = index + 1;
      localToRemoteRunnerMap.set(localRunnerId, remoteRunner.id);
    });

    // Insert legs with proper runner_id linkage
    console.log('[saveInitialRows] Inserting legs…');
    const legsToInsert = storeState.legs.map(l => {
      const remoteRunnerId = l.runnerId ? localToRemoteRunnerMap.get(l.runnerId) : null;
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
      return { error: legsError };
    }
    console.log('[saveInitialRows] Legs inserted:', legsToInsert.length);

    console.log('[saveInitialRows] Refetching to populate remoteIds/updated_at…');
    await fetchInitialData(teamId);
    console.log('[saveInitialRows] Initial rows saved and fetched successfully');
    return { ok: true };
  }, [fetchInitialData]);

  return { fetchInitialData, safeUpdate, setupRealtimeSubscriptions, initialSave, saveInitialRows, merge };
};
