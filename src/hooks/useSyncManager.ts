import { useCallback } from 'react';
import { useRaceStore } from '@/store/raceStore';
import { supabase } from '@/integrations/supabase/client';
import type { Runner, Leg } from '@/types/race';
import type { Tables } from '@/integrations/supabase/types';

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

      // Perform the conditional update
      const { data, error } = await supabase
        .from(table)
        .update(payload)
        .match({ id: remoteId, updated_at: localItem.updated_at })
        .select()
        .single();

      if (error) {
        console.error(`[safeUpdate] Error updating ${table}:`, error);
        return { error };
      }

      if (!data) {
        // This means the .match() condition failed -> A conflict occurred!
        console.warn(`[safeUpdate] Conflict detected for ${table} with id ${remoteId}. Refetching data.`);
        // Fetch the latest data to resolve the conflict
        await fetchInitialData(teamId);
        return { error: new Error('Update conflict resolved by refetching.') };
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
    const handleSubscriptionEvent = (payload: any, table: 'runners' | 'legs') => {
      const storeState = useRaceStore.getState();
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        const newItem = payload.new as unknown as Syncable;
        merge(
          [newItem],
          table === 'runners' ? storeState.runners : storeState.legs,
          table === 'runners'
            ? storeState.setRunners
            : (items) => storeState.setRaceData({ legs: items as Leg[] })
        );
      } else if (payload.eventType === 'DELETE') {
        const oldId = payload.old.id;
        if (table === 'runners') {
          storeState.setRunners(storeState.runners.filter(r => r.remoteId !== oldId));
        } else {
          storeState.setRaceData({ legs: storeState.legs.filter(l => l.remoteId !== oldId) });
        }
      }
    };

    const runnersChannel = supabase
      .channel(`realtime-runners-${teamId}`)
      .on<Tables<'runners'>>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'runners', filter: `team_id=eq.${teamId}` },
        (payload) => handleSubscriptionEvent(payload, 'runners')
      )
      .subscribe();

    const legsChannel = supabase
      .channel(`realtime-legs-${teamId}`)
      .on<Tables<'legs'>>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'legs', filter: `team_id=eq.${teamId}` },
        (payload) => handleSubscriptionEvent(payload, 'legs')
      )
      .subscribe();

    return () => {
      supabase.removeChannel(runnersChannel);
      supabase.removeChannel(legsChannel);
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
