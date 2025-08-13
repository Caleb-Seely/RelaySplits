
import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRaceStore } from '@/store/raceStore';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamSync } from '@/hooks/useTeamSync';
import { useSecureSync } from '@/hooks/useSecureSync';
import type { Runner, Leg } from '@/types/race';
import { initializeRace, recalculateProjections } from '@/utils/raceUtils';

// Offline data persistence keys
const getOfflineKey = (teamId: string, dataType: string) => `relay_tracker_${teamId}_${dataType}`;
const getOfflineChangesKey = (teamId: string) => `relay_tracker_${teamId}_offline_changes`;

// Offline change interface
interface OfflineChange {
  id: string;
  timestamp: number;
  type: 'runner' | 'leg' | 'setup';
  data: any;
}

export const useSupabaseSync = () => {
  const raceStore = useRaceStore();
  const { user } = useAuth();
  const { team } = useTeamSync();
  const { secureQuery, secureUpdate } = useSecureSync();
  const lastTeamIdRef = useRef<string | undefined>();
  const lastUserIdRef = useRef<string | undefined>();
  const syncInProgressRef = useRef(false);
  const isInitialSyncRef = useRef(false);
  const lastSyncDataRef = useRef<{ runners: string; legs: string }>({ runners: '', legs: '' });
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastConsistencyWarnAtRef = useRef<number>(0);
  const warnedForTeamRef = useRef<Record<string, boolean>>({});

  // Save data to localStorage for offline persistence
  const saveToLocalStorage = useCallback((teamId: string, data: any, type: string) => {
    try {
      const key = getOfflineKey(teamId, type);
      let payload = data;
      if (type === 'setup') {
        payload = { ...(data || {}), savedAt: Date.now() };
      }
      localStorage.setItem(key, JSON.stringify(payload));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }, []);

  // Helper: store last-synced runner names by local runner.id to detect renames reliably
  const getRunnerNamesKey = useCallback((teamId: string) => getOfflineKey(teamId, 'runner_names_map'), []);
  const loadLastSyncedRunnerNames = useCallback((teamId: string): Record<string, string> => {
    try {
      const raw = localStorage.getItem(getRunnerNamesKey(teamId));
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, [getRunnerNamesKey]);
  const saveLastSyncedRunnerNames = useCallback((teamId: string, runners: { id: number; name: string }[]) => {
    try {
      const map: Record<string, string> = {};
      runners.forEach(r => { map[String(r.id)] = r.name; });
      localStorage.setItem(getRunnerNamesKey(teamId), JSON.stringify(map));
    } catch {}
  }, [getRunnerNamesKey]);

  // Load data from localStorage for offline recovery
  const loadFromLocalStorage = useCallback((teamId: string, type: string) => {
    try {
      const key = getOfflineKey(teamId, type);
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
      return null;
    }
  }, []);

  const hasQueuedOfflineChanges = useCallback((teamId: string) => {
    try {
      const key = getOfflineChangesKey(teamId);
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const list = JSON.parse(raw);
      return Array.isArray(list) && list.length > 0;
    } catch {
      return false;
    }
  }, []);

  // Queue offline changes for later sync
  const queueOfflineChange = useCallback((teamId: string, change: Omit<OfflineChange, 'id' | 'timestamp'>) => {
    try {
      const key = getOfflineChangesKey(teamId);
      const existingChanges = JSON.parse(localStorage.getItem(key) || '[]');
      const newChange: OfflineChange = {
        ...change,
        id: `${Date.now()}_${Math.random()}`,
        timestamp: Date.now()
      };
      existingChanges.push(newChange);
      localStorage.setItem(key, JSON.stringify(existingChanges));
    } catch (error) {
      console.warn('Failed to queue offline change:', error);
    }
  }, []);

  // Process queued offline changes when back online
  const processOfflineChanges = useCallback(async (teamId: string) => {
    try {
      const key = getOfflineChangesKey(teamId);
      const changes = JSON.parse(localStorage.getItem(key) || '[]');
      
      if (changes.length === 0) return;

      for (const change of changes) {
        try {
          switch (change.type) {
            case 'runner':
              // Add-only upsert: update if exists, else insert
              {
                const existing = await secureQuery(
                  supabase
                    .from('runners')
                    .select('id')
                    .eq('team_id', teamId)
                    .eq('name', change.data.name)
                    .maybeSingle(),
                  'check existing runner for offline change'
                );
                if (existing && existing.data) {
                  await secureUpdate(
                    supabase
                      .from('runners')
                      .update({ pace: change.data.pace, van: change.data.van })
                      .eq('team_id', teamId)
                      .eq('name', change.data.name),
                    'update runner from offline change'
                  );
                } else {
                  await secureUpdate(
                    supabase
                      .from('runners')
                      .insert([{ team_id: teamId, name: change.data.name, pace: change.data.pace, van: change.data.van }]),
                    'insert runner from offline change'
                  );
                }
              }
              break;
            case 'leg':
              // Add-only upsert for legs by team_id + number
              {
                const existingLeg = await secureQuery(
                  supabase
                    .from('legs')
                    .select('id')
                    .eq('team_id', teamId)
                    .eq('number', change.data.number)
                    .maybeSingle(),
                  'check existing leg for offline change'
                );
                if (existingLeg && existingLeg.data) {
                  await secureUpdate(
                    supabase
                      .from('legs')
                      .update({
                        runner_id: change.data.runner_id ?? null,
                        distance: change.data.distance,
                        start_time: change.data.start_time ?? null,
                        finish_time: change.data.finish_time ?? null
                      })
                      .eq('team_id', teamId)
                      .eq('number', change.data.number),
                    'update leg from offline change'
                  );
                } else {
                  await secureUpdate(
                    supabase
                      .from('legs')
                      .insert([{
                        team_id: teamId,
                        number: change.data.number,
                        runner_id: change.data.runner_id ?? null,
                        distance: change.data.distance,
                        start_time: change.data.start_time ?? null,
                        finish_time: change.data.finish_time ?? null
                      }]),
                    'insert leg from offline change'
                  );
                }
              }
              break;
            case 'setup':
              break;
          }
        } catch (error) {
          console.error('Failed to apply offline change:', error);
        }
      }

      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to process offline changes:', error);
    }
  }, [secureUpdate]);

  // Reset data when user changes (switching accounts)
  useEffect(() => {
    if (user?.id && user.id !== lastUserIdRef.current) {
      const defaultRunners: Runner[] = Array.from({ length: 12 }, (_, i) => ({
        id: i + 1,
        name: `Runner ${i + 1}`,
        pace: 420,
        van: (i < 6 ? 1 : 2) as 1 | 2
      }));
      
      raceStore.setRaceData({
        runners: defaultRunners,
        legs: [],
        isSetupComplete: false
      });
      
      raceStore.setupStep = 1;
      raceStore.setTeamId(undefined);
      
      lastTeamIdRef.current = undefined;
      lastUserIdRef.current = user.id;
      isInitialSyncRef.current = false;
    }
  }, [user?.id, raceStore]);

  // Set team ID in race store when team changes - but only once per team
  useEffect(() => {
    if (team?.id && team.id !== raceStore.teamId) {
      raceStore.setTeamId(team.id);
    }
  }, [team?.id, raceStore]);

  const syncToSupabase = useCallback(async () => {
    if (!team || !user || syncInProgressRef.current) {
      return;
    }

    if (raceStore.teamId !== team.id) {
      return;
    }

    if (isInitialSyncRef.current) {
      return;
    }

    if (syncInProgressRef.current) {
      return;
    }

    syncInProgressRef.current = true;

    try {
      // If we have no local data, do not modify remote (add-only semantics)
      if (raceStore.runners.length === 0 && raceStore.legs.length === 0) {
        return;
      }

      // Fetch existing server state to compute diffs (avoid deletes)
      const existingRunnersResult = await secureQuery(
        supabase
          .from('runners')
          .select('*')
          .eq('team_id', team.id),
        'fetch existing runners for diff'
      );
      const existingLegsResult = await secureQuery(
        supabase
          .from('legs')
          .select('*')
          .eq('team_id', team.id),
        'fetch existing legs for diff'
      );

      const existingRunners = (existingRunnersResult && existingRunnersResult.data) || [];
      const existingLegs = (existingLegsResult && existingLegsResult.data) || [];

      // Build maps for quick lookup
      const existingRunnerByName = new Map<string, any>();
      existingRunners.forEach((r: any) => existingRunnerByName.set(r.name, r));

      const existingLegByNumber = new Map<number, any>();
      existingLegs.forEach((l: any) => existingLegByNumber.set(l.number, l));

      // Prepare runner inserts/updates (match by name within team), with rename support via last-synced names
      const runnersToInsert: any[] = [];
      const runnersToUpdateByName: Array<{ name: string; pace: number; van: string }> = [];

      // 1) Handle renames first using last-synced name mapping
      const lastNamesMap = loadLastSyncedRunnerNames(team.id);
      for (const localRunner of raceStore.runners) {
        const prevName = lastNamesMap[String(localRunner.id)];
        const newName = localRunner.name;
        if (prevName && prevName !== newName && existingRunnerByName.has(prevName)) {
          const desiredVan = localRunner.van.toString();
          await secureUpdate(
            supabase
              .from('runners')
              .update({ name: newName, pace: localRunner.pace, van: desiredVan })
              .eq('team_id', team.id)
              .eq('name', prevName),
            'rename runner and update pace/van'
          );
          // Update in-memory map to reflect rename
          const row = existingRunnerByName.get(prevName);
          existingRunnerByName.delete(prevName);
          row.name = newName;
          row.pace = localRunner.pace;
          row.van = desiredVan;
          existingRunnerByName.set(newName, row);
        }
      }

      // 2) Compute inserts/updates by current names
      raceStore.runners.forEach(localRunner => {
        const found = existingRunnerByName.get(localRunner.name);
        if (!found) {
          runnersToInsert.push({
            team_id: team.id,
            name: localRunner.name,
            pace: localRunner.pace,
            van: localRunner.van.toString(),
            leg_ids: []
          });
        } else {
          const desiredVan = localRunner.van.toString();
          if (Number(found.pace) !== localRunner.pace || String(found.van) !== desiredVan) {
            runnersToUpdateByName.push({ name: localRunner.name, pace: localRunner.pace, van: desiredVan });
          }
        }
      });

      // Apply runner updates (batch via individual updates)
      for (const upd of runnersToUpdateByName) {
        await secureUpdate(
          supabase
            .from('runners')
            .update({ pace: upd.pace, van: upd.van })
            .eq('team_id', team.id)
            .eq('name', upd.name),
          'update runner pace/van'
        );
      }

      // Insert new runners
      let insertedRunners: any[] = [];
      if (runnersToInsert.length > 0) {
        const insertRes = await secureUpdate(
          supabase
            .from('runners')
            .insert(runnersToInsert)
            .select(),
          'insert new runners'
        );
        if (!insertRes.error && insertRes.data) {
          insertedRunners = insertRes.data;
        }
      }

      // Refresh mapping of runner name -> id (use existing + newly inserted)
      const runnerIdByName = new Map<string, string>();
      existingRunners.forEach((r: any) => runnerIdByName.set(r.name, r.id));
      insertedRunners.forEach((r: any) => runnerIdByName.set(r.name, r.id));

      // Prepare legs inserts/updates (match by number within team), only when changed
      const legsToInsert: any[] = [];
      const legsToUpdate: any[] = [];

      raceStore.legs.forEach(localLeg => {
        const found = existingLegByNumber.get(localLeg.id);
        const localRunner = raceStore.runners.find(r => r.id === localLeg.runnerId);
        const runnerId = localRunner ? runnerIdByName.get(localRunner.name) || null : null;
        const payload = {
          team_id: team.id,
          number: localLeg.id,
          runner_id: runnerId,
          distance: localLeg.distance,
          start_time: localLeg.actualStart ? new Date(localLeg.actualStart).toISOString() : null,
          finish_time: localLeg.actualFinish ? new Date(localLeg.actualFinish).toISOString() : null
        };
        if (!found) {
          legsToInsert.push(payload);
        } else {
          const changed = (
            (found.runner_id || null) !== payload.runner_id ||
            Number(found.distance) !== payload.distance ||
            (found.start_time || null) !== payload.start_time ||
            (found.finish_time || null) !== payload.finish_time
          );
          if (changed) {
            legsToUpdate.push(payload);
          }
        }
      });

      // Apply leg updates (by number)
      for (const leg of legsToUpdate) {
        await secureUpdate(
          supabase
            .from('legs')
            .update({
              runner_id: leg.runner_id,
              distance: leg.distance,
              start_time: leg.start_time,
              finish_time: leg.finish_time
            })
            .eq('team_id', team.id)
            .eq('number', leg.number),
          'update leg'
        );
      }

      // Insert new legs
      if (legsToInsert.length > 0) {
        await secureUpdate(
          supabase
            .from('legs')
            .insert(legsToInsert),
          'insert new legs'
        );
      }

      // Persist to localStorage for offline use and save last-synced runner names for rename tracking
      saveToLocalStorage(team.id, raceStore.runners, 'runners');
      saveToLocalStorage(team.id, raceStore.legs, 'legs');
      saveToLocalStorage(team.id, { isSetupComplete: raceStore.isSetupComplete }, 'setup');
      saveLastSyncedRunnerNames(team.id, raceStore.runners.map(r => ({ id: r.id, name: r.name })));

      // Mark last successful sync time
      raceStore.setLastSyncedAt(Date.now());

    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      syncInProgressRef.current = false;
    }
  }, [team, user, raceStore.runners, raceStore.legs, raceStore.teamId, secureQuery, secureUpdate, saveToLocalStorage, loadLastSyncedRunnerNames, saveLastSyncedRunnerNames]);

  const syncFromSupabase = useCallback(async () => {
    if (!team || syncInProgressRef.current) {
      return;
    }

    // Evaluate offline snapshot/queued changes, but only push if server is empty
    const offlineRunners = loadFromLocalStorage(team.id, 'runners');
    const offlineLegs = loadFromLocalStorage(team.id, 'legs');
    const offlineSetup = loadFromLocalStorage(team.id, 'setup');
    const hasLocalSnapshot = offlineRunners && offlineRunners.length > 0;
    const hasQueued = hasQueuedOfflineChanges(team.id);

    // Otherwise, pull from DB
    syncInProgressRef.current = true;
    isInitialSyncRef.current = true;

    try {
      const runnersResult = await secureQuery(
        supabase
          .from('runners')
          .select('*')
          .eq('team_id', team.id)
          .order('name'),
        'fetch team runners'
      );

      const legsResult = await secureQuery(
        supabase
          .from('legs')
          .select('*')
          .eq('team_id', team.id)
          .order('number'),
        'fetch team legs'
      );

      const runners = runnersResult.data;
      const legs = legsResult.data;

      if (runners && runners.length > 0) {
        let incomingRunners: Runner[] = runners.map((runner, index) => {
          const parsedPace = Number(runner.pace);
          const safePace = Number.isFinite(parsedPace) && parsedPace > 0 ? parsedPace : 420;
          const parsedVan = parseInt(runner.van);
          const safeVan = (parsedVan === 1 || parsedVan === 2) ? parsedVan as 1 | 2 : ((index < 6 ? 1 : 2) as 1 | 2);
          return {
            id: index + 1,
            name: runner.name,
            pace: safePace,
            van: safeVan
          };
        });
        // Ensure we always have 12 runners locally to keep projections and UI consistent
        if (incomingRunners.length < 12) {
          const defaults: Runner[] = Array.from({ length: 12 }, (_, i) => ({
            id: i + 1,
            name: `Runner ${i + 1}`,
            pace: 420,
            van: (i < 6 ? 1 : 2) as 1 | 2
          }));
          // Overlay server-provided onto defaults by index
          incomingRunners = defaults.map((d, i) => incomingRunners[i] ? { ...d, ...incomingRunners[i], id: i + 1 } : d);
        }

        // Avoid clobbering in-progress local edits during initial setup.
        const current = useRaceStore.getState();
        const localNames = (current.runners || []).map(r => r.name);
        const incomingNames = incomingRunners.map(r => r.name);
        const defaultNames = Array.from({ length: 12 }, (_, i) => `Runner ${i + 1}`);
        const isAllDefaultLocal = localNames.length === 12 && localNames.every((n, i) => n === defaultNames[i]);
        const matchesIncoming = localNames.length === incomingNames.length && localNames.every((n, i) => n === incomingNames[i]);

        const safeToOverwrite = current.isSetupComplete || isAllDefaultLocal || matchesIncoming;

        if (safeToOverwrite) {
          raceStore.setRaceData({
            runners: incomingRunners,
            isSetupComplete: true
          });
        } else {
          // Preserve local edits; just mark setup complete so autosync can proceed later.
          raceStore.setRaceData({ isSetupComplete: true });
        }

        // Normalize runners to ensure we always have 12 with valid fields (without clobbering local names)
        {
          const currentAfter = useRaceStore.getState().runners || [];
          const normalized: Runner[] = Array.from({ length: 12 }, (_, i) => {
            const existing = currentAfter[i];
            const pace = Number(existing?.pace);
            const safePace = Number.isFinite(pace) && pace > 0 ? pace : 420;
            const van = existing?.van;
            const safeVan: 1 | 2 = (van === 1 || van === 2) ? van : ((i < 6 ? 1 : 2) as 1 | 2);
            return {
              id: i + 1,
              name: existing?.name ?? `Runner ${i + 1}`,
              pace: safePace,
              van: safeVan
            };
          });
          raceStore.setRaceData({ runners: normalized });
        }

        if (legs && legs.length > 0) {
          // Build base projections from current official start time and incoming runners
          const baseStartTime = useRaceStore.getState().startTime;
          let projectedLegs: Leg[] = initializeRace(baseStartTime, incomingRunners);

          // Map Supabase runner IDs -> local runner ids (1..12 based on incoming order above)
          const runnerIdMapping = new Map<number, number>();
          runners.forEach((supabaseRunner, index) => {
            runnerIdMapping.set(supabaseRunner.id, index + 1);
          });

          // Overlay server-provided assignments, distances, and actual times
          projectedLegs = projectedLegs.map((leg) => {
            const dbLeg = legs.find((l: any) => l.number === leg.id);
            if (!dbLeg) return leg;
            const actualStart = dbLeg.start_time ? new Date(dbLeg.start_time).getTime() : undefined;
            const actualFinish = dbLeg.finish_time ? new Date(dbLeg.finish_time).getTime() : undefined;
            const mappedRunnerId = dbLeg.runner_id ? (runnerIdMapping.get(dbLeg.runner_id) || leg.runnerId) : leg.runnerId;
            const dist = Number(dbLeg.distance);
            return {
              ...leg,
              runnerId: mappedRunnerId,
              distance: isNaN(dist) ? leg.distance : dist,
              // Do NOT set projectedStart/Finish from DB; treat DB times as actuals only
              actualStart,
              actualFinish
            } as Leg;
          });

          // Recalculate projections across all legs after overlay
          const finalLegs = recalculateProjections(projectedLegs, 0, incomingRunners);
          raceStore.setRaceData({ legs: finalLegs });
        } else {
          raceStore.initializeLegs();
        }

        // Save synced data to localStorage
        saveToLocalStorage(team.id, incomingRunners, 'runners');
        if (legs && legs.length > 0) {
          saveToLocalStorage(team.id, legs, 'legs');
        }
        saveToLocalStorage(team.id, { isSetupComplete: true }, 'setup');

        // Mark last successful sync time after pulling from DB
        raceStore.setLastSyncedAt(Date.now());

      } else {
        // No server data: if we have an offline snapshot, push it; otherwise initialize defaults
        if (hasLocalSnapshot) {
          // Load local into store first (for projection consistency)
          raceStore.setRaceData({
            runners: offlineRunners,
            legs: offlineLegs || [],
            isSetupComplete: !!offlineSetup?.isSetupComplete
          });
          if (!offlineLegs || offlineLegs.length === 0) {
            raceStore.initializeLegs();
          }
          // Allow a push, then re-block until wrap-up finishes
          isInitialSyncRef.current = false;
          await syncToSupabase();
          isInitialSyncRef.current = true;
          // Mark last successful sync time after offline-first push
          raceStore.setLastSyncedAt(Date.now());
        } else {
          // No server data. If locals have diverged from defaults (user started typing), do not reset.
          const current = useRaceStore.getState();
          const localNames = (current.runners || []).map(r => r.name);
          const defaultNames = Array.from({ length: 12 }, (_, i) => `Runner ${i + 1}`);
          const isAllDefaultLocal = localNames.length === 12 && localNames.every((n, i) => n === defaultNames[i]);

          if (isAllDefaultLocal) {
            const defaultRunners: Runner[] = Array.from({ length: 12 }, (_, i) => ({
              id: i + 1,
              name: `Runner ${i + 1}`,
              pace: 420,
              van: (i < 6 ? 1 : 2) as 1 | 2
            }));
            raceStore.setRaceData({
              runners: defaultRunners,
              legs: [],
              isSetupComplete: false
            });
            raceStore.setupStep = 1;
          } else {
            // Preserve local runner edits
            if (!current.legs || current.legs.length === 0) {
              raceStore.initializeLegs();
            }
          }
        }
      }

      // After pulling from server (or pushing an offline snapshot), apply queued granular changes additively
      await processOfflineChanges(team.id);

    } catch (error) {
      console.error('Error syncing from Supabase:', error);
      
      // Fallback to offline data if sync fails
      const offlineRunners = loadFromLocalStorage(team.id, 'runners');
      const offlineLegs = loadFromLocalStorage(team.id, 'legs');
      const offlineSetup = loadFromLocalStorage(team.id, 'setup');

      if (offlineRunners && offlineRunners.length > 0) {
        raceStore.setRaceData({
          runners: offlineRunners,
          legs: offlineLegs || [],
          isSetupComplete: offlineSetup?.isSetupComplete || false
        });
      }
    } finally {
      syncInProgressRef.current = false;
      
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      
      syncTimeoutRef.current = setTimeout(() => {
        isInitialSyncRef.current = false;
      }, 3000);
    }
  }, [team, raceStore, secureQuery, saveToLocalStorage, loadFromLocalStorage, processOfflineChanges, hasQueuedOfflineChanges, syncToSupabase]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!team) return;

    const runnersChannel = supabase
      .channel(`runners:${team.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'runners',
          filter: `team_id=eq.${team.id}`
        },
        () => {
          syncFromSupabase();
        }
      )
      .subscribe();

    const legsChannel = supabase
      .channel(`legs:${team.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'legs',
          filter: `team_id=eq.${team.id}`
        },
        () => {
          syncFromSupabase();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(runnersChannel);
      supabase.removeChannel(legsChannel);
    };
  }, [team?.id, syncFromSupabase]);

  // Initial sync when team changes - but only once per team
  useEffect(() => {
    if (team?.id && team.id !== lastTeamIdRef.current) {
      lastTeamIdRef.current = team.id;
      syncFromSupabase();
    }
  }, [team?.id, syncFromSupabase]);

  // Auto-sync to Supabase when race data changes (after setup is complete)
  useEffect(() => {
    const isDataConsistent = raceStore.isDataConsistent();
    
    const shouldSync = !!team && 
                      raceStore.isSetupComplete && 
                      raceStore.teamId === team.id && 
                      !syncInProgressRef.current &&
                      !isInitialSyncRef.current &&
                      isDataConsistent;
                      
    if (shouldSync) {
      const currentData = {
        runners: JSON.stringify(raceStore.runners.map(r => ({ id: r.id, name: r.name, pace: r.pace, van: r.van }))),
        // Include runnerId in the hash so that assignments trigger a sync
        legs: JSON.stringify(raceStore.legs.map(l => ({ id: l.id, runnerId: l.runnerId, distance: l.distance, actualStart: l.actualStart, actualFinish: l.actualFinish })))
      };
      
      const hasDataChanged = currentData.runners !== lastSyncDataRef.current.runners || 
                            currentData.legs !== lastSyncDataRef.current.legs;
      
      if (hasDataChanged) {
        const timeoutId = setTimeout(() => {
          syncToSupabase();
          lastSyncDataRef.current = currentData;
        }, 800);

        return () => clearTimeout(timeoutId);
      }
    } else {
      // Only attempt inconsistency recovery AFTER setup is complete to avoid clobbering edits
      // Suppress during initial or in-progress syncs, and throttle warnings.
      if (
        team &&
        raceStore.teamId === team.id &&
        raceStore.isSetupComplete &&
        !isDataConsistent &&
        !syncInProgressRef.current &&
        !isInitialSyncRef.current
      ) {
        const now = Date.now();
        const sinceLast = now - (lastConsistencyWarnAtRef.current || 0);
        const hasWarnedThisTeam = warnedForTeamRef.current[team.id] === true;
        if (sinceLast > 30000 && !hasWarnedThisTeam) {
          lastConsistencyWarnAtRef.current = now;
          warnedForTeamRef.current[team.id] = true;
          console.warn('⚠️ [SYNC] Data inconsistency detected post-setup, attempting soft recovery (no reset).');
        }
        // Soft recovery: avoid flipping isSetupComplete; just re-sync from server (debounced)
        if (!hasWarnedThisTeam) {
          const timeoutId = setTimeout(() => {
            if (!syncInProgressRef.current) {
              syncFromSupabase();
            }
          }, 800);
          return () => clearTimeout(timeoutId);
        }
      }
    }
  }, [team, raceStore.runners, raceStore.legs, raceStore.isSetupComplete, raceStore.teamId, syncToSupabase, syncFromSupabase]);

  // Trigger sync when connection is restored
  useEffect(() => {
    const handleOnline = () => {
      if (team?.id) {
        (async () => {
          try {
            // Push local first (offline is source of truth), then apply any queued granular changes
            await syncToSupabase();
            await processOfflineChanges(team.id);
            // Optionally pull to ensure local IDs mapping stays consistent if needed
            await syncFromSupabase();
          } catch (e) {
            console.error('Error during online recovery sync:', e);
          }
        })();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [team?.id, processOfflineChanges, syncFromSupabase, syncToSupabase]);

  return {
    syncToSupabase,
    syncFromSupabase,
    queueOfflineChange,
    processOfflineChanges
  };
};
