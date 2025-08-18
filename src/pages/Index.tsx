
import React, { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useTeam } from '@/contexts/TeamContext';
import { useTeamSync } from '@/hooks/useTeamSync';
import { useSyncManager } from '@/hooks/useSyncManager';
import { useRaceStore } from '@/store/raceStore';
import { useOfflineData } from '@/hooks/useOfflineData';
import { runDiagnostics } from '@/utils/diagnostics';
import Dashboard from '@/components/Dashboard';
import SetupWizard from '@/components/SetupWizard';

import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const { deviceInfo, isInTeam, loading: teamContextLoading } = useTeam();
  const { team, deviceInfo: teamSyncDeviceInfo, loading: teamLoading, createTeam, joinTeam } = useTeamSync();
  const [isNewTeam, setIsNewTeam] = useState(false);
  const isAdmin = teamSyncDeviceInfo?.role === 'admin';
  // Select only the pieces we need from the store to avoid effect thrash
  const teamId = useRaceStore((s) => s.teamId);
  const isSetupComplete = useRaceStore((s) => s.isSetupComplete);
  // If the lock flag is present for this team, treat setup as complete locally to avoid any wizard flash
  const isSetupLocked = (() => {
    try {
      return teamId ? localStorage.getItem(`relay_setup_locked_${teamId}`) === '1' : false;
    } catch {
      return false;
    }
  })();
  const restoreFromOffline = useRaceStore((s) => s.restoreFromOffline);
  const isDataConsistent = useRaceStore((s) => s.isDataConsistent);
  const { isOnline, offlineChangesCount, loadOfflineState } = useOfflineData();
  const hasRestoredOfflineRef = useRef(false);
  
  // Initialize Supabase sync
  const { fetchInitialData } = useSyncManager();

  console.log('[Index] Component render - current state:', {
    teamId,
    deviceInfo,
    teamSyncDeviceInfo,
    isNewTeam,
    isInTeam,
    teamContextLoading,
    teamLoading,
    isAdmin,
    isSetupComplete,
    isSetupLocked
  });

  useEffect(() => {
    console.log('[Index] Team context updated - team?.id:', team?.id, 'isNewTeam:', isNewTeam);
    // Ensure store knows current teamId so sync hooks can run
    if (team?.id) {
      const current = useRaceStore.getState().teamId;
      if (current !== team.id) {
        console.log('[Index] Setting teamId in store from', current, 'to', team.id);
        useRaceStore.getState().setTeamId(team.id);
      }
      
      // If this is a new team and setup is complete, remove the flag
      if (isNewTeam && useRaceStore.getState().isSetupComplete) {
        console.log('[Index] Team context loaded and setup complete, removing new team flag');
        console.log('[Index] Flag before removal:', localStorage.getItem('relay_is_new_team'));
        localStorage.removeItem('relay_is_new_team');
        console.log('[Index] Flag after removal:', localStorage.getItem('relay_is_new_team'));
        // Set isNewTeam to false after removing the flag to prevent further loops
        setIsNewTeam(false);
      }
    }
  }, [team?.id, isNewTeam]);

  // Detect freshly-created team and show Setup Wizard as new team once
  const hasProcessedFlagRef = useRef(false);
  useEffect(() => {
    if (hasProcessedFlagRef.current) return; // Prevent re-processing
    
    const flag = localStorage.getItem('relay_is_new_team');
    console.log('[Index] Checking for new team flag:', flag);
    console.log('[Index] Current team context state - teamId:', teamId, 'deviceInfo:', deviceInfo);
    if (flag) {
      console.log('[Index] Setting isNewTeam to true');
      setIsNewTeam(true);
      hasProcessedFlagRef.current = true;
      // Don't remove the flag yet - wait until SetupWizard completes the save
    } else {
      // If no flag is found, explicitly set to false to indicate this is not a new team
      console.log('[Index] No new team flag found, setting isNewTeam to false');
      setIsNewTeam(false);
      hasProcessedFlagRef.current = true;
    }
  }, []); // Revert back to empty array



  // Restore setup completion state from localStorage on mount
  const hasRestoredSetupStateRef = useRef(false);
  useEffect(() => {
    if (hasRestoredSetupStateRef.current) return;
    if (!teamId) return;
    
    try {
      // Check for setup lock first
      const setupLocked = localStorage.getItem(`relay_setup_locked_${teamId}`) === '1';
      if (setupLocked) {
        console.log('[Index] Setup is locked, marking as complete');
        useRaceStore.getState().markSetupComplete();
        hasRestoredSetupStateRef.current = true;
        return;
      }
      
      // Check for offline setup state
      const offlineSetup = localStorage.getItem(`relay_tracker_${teamId}_setup`);
      if (offlineSetup) {
        const setupData = JSON.parse(offlineSetup);
        if (setupData.isSetupComplete) {
          console.log('[Index] Restoring setup completion state from offline storage');
          useRaceStore.getState().markSetupComplete();
          hasRestoredSetupStateRef.current = true;
        }
      }
    } catch (error) {
      console.warn('[Index] Error restoring setup state:', error);
    }
  }, [teamId]);

  const hasFetchedInitialDataRef = useRef(false);
  useEffect(() => {
    // Only fetch initial data if we have a teamId, user is not a viewer, and we've determined it's not a new team
    console.log('[Index] fetchInitialData useEffect - teamId:', teamId, 'isNewTeam:', isNewTeam, 'deviceInfo?.role:', deviceInfo?.role);
    
    // Prevent multiple fetches for the same team
    if (hasFetchedInitialDataRef.current && teamId === useRaceStore.getState().teamId) {
      console.log('[Index] Skipping fetchInitialData - already fetched for this team');
      return;
    }
    
    if (teamId && deviceInfo?.role !== 'viewer' && isNewTeam === false) {
      console.log('[Index] Calling fetchInitialData for team:', teamId);
      fetchInitialData(teamId);
      hasFetchedInitialDataRef.current = true;
    } else if (teamId && deviceInfo?.role !== 'viewer' && isNewTeam === undefined) {
      // If isNewTeam is undefined, we haven't determined yet - skip for now
      console.log('[Index] Skipping fetchInitialData - isNewTeam is undefined');
    }
  }, [teamId, fetchInitialData, deviceInfo?.role, isNewTeam]);

  // Realtime subscriptions are established in Dashboard.tsx

  // Global auto-start: ensure leg 1 starts at or after official start time regardless of view mounted
  useEffect(() => {
    const id = setInterval(() => {
      const { legs, startTime, updateLegActualTime, initializeLegs } = useRaceStore.getState();
      if (legs.length === 0) {
        initializeLegs();
        return;
      }
      const firstLeg = legs[0];
      const now = Date.now();
      if (typeof firstLeg.actualStart !== 'number' && now >= startTime) {
        updateLegActualTime(1, 'actualStart', startTime);
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Initialize offline data if available and no current data
  useEffect(() => {
    // Don't restore if team is still loading or if we've already restored
    if (!team || teamLoading) return;
    if (hasRestoredOfflineRef.current) return;
    if (teamId !== team.id) return;

    const offlineState = loadOfflineState();
    if (offlineState && !isDataConsistent()) {
      console.log('🔄 [OFFLINE] Restoring state from offline storage...');
      restoreFromOffline(
        offlineState.runners,
        offlineState.legs,
        offlineState.isSetupComplete
      );
    }
    // Ensure we only attempt restore once per mount/team session
    hasRestoredOfflineRef.current = true;
  }, [team, teamLoading, teamId, loadOfflineState, isDataConsistent, restoreFromOffline]);

  // Run comprehensive diagnostics when team is loaded - MUST BE AT TOP LEVEL
//   useEffect(() => {
//     if (team && user && !teamLoading) {
//       // Add a small delay to ensure all state updates are complete
//       const timeoutId = setTimeout(() => {
//         runDiagnostics(user, team, teamMember, raceStore, supabase);
//       }, 500);

//       return () => clearTimeout(timeoutId);
//     }
//   }, [team, user, teamMember, raceStore, teamLoading]);

  // Treat localStorage presence as a bootstrap hint to avoid flashing the landing CTA
  const hasStoredTeam = typeof window !== 'undefined' && !!localStorage.getItem('relay_team_id');

  // Show loading state while either context is loading, or while bootstrapping team from storage
  if (teamLoading || teamContextLoading || (hasStoredTeam && !team)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading TeamSplits...</p>
          {!isOnline && (
            <p className="text-sm text-orange-600 mt-2">Working offline - using cached data</p>
          )}
        </div>
      </div>
    );
  }

  // Show demo landing page if no team is found
  if (!isInTeam && !hasStoredTeam) {
    return <Navigate to="/demo" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Offline status warnings */}
      {!isOnline && (
        <Alert className="m-2 sm:m-4 border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            You're currently offline. Changes will be saved locally and synced when you're back online.
            {offlineChangesCount > 0 && (
              <span className="font-semibold ml-1">
                ({offlineChangesCount} change{offlineChangesCount !== 1 ? 's' : ''} pending)
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Main content */}
      <main className="container mx-auto px-2 sm:px-4 py-2">
        {(() => {
          console.log('[Index] Rendering decision - isSetupComplete:', isSetupComplete, 'isSetupLocked:', isSetupLocked, 'isAdmin:', isAdmin, 'isNewTeam:', isNewTeam);
          if (isSetupComplete || isSetupLocked || !isAdmin) {
            console.log('[Index] Showing Dashboard');
            return <Dashboard />;
          } else {
            console.log('[Index] Showing SetupWizard with isNewTeam:', isNewTeam);
            return <SetupWizard isNewTeam={isNewTeam} />;
          }
        })()}
      </main>
    </div>
  );
};

export default Index;
