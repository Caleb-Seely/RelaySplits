
import React, { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertCircle, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTeam } from '@/contexts/TeamContext';
import { useTeamSync } from '@/hooks/useTeamSync';
import { useEnhancedSyncManager } from '@/hooks/useEnhancedSyncManager';
import { useConflictResolution } from '@/contexts/ConflictResolutionContext';
import { useRaceStore } from '@/store/raceStore';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
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
  const { getQueueStatus: getEnhancedQueueStatus } = useEnhancedSyncManager();
  const queueStatus = getEnhancedQueueStatus();
  const isOnline = navigator.onLine;
  const offlineChangesCount = queueStatus.pendingCount;
  const hasRestoredOfflineRef = useRef(false);

  // CRITICAL FIX: Synchronize race store start time with team start time from localStorage
  useEffect(() => {
    const storedTeamStartTime = localStorage.getItem('relay_team_start_time');
    if (storedTeamStartTime) {
      const teamStartTime = new Date(storedTeamStartTime).getTime();
      const placeholderDate = new Date('2099-12-31T23:59:59Z');
      
      // Only sync if it's not the placeholder
      if (Math.abs(teamStartTime - placeholderDate.getTime()) > 1000) {
        const { startTime, setStartTime } = useRaceStore.getState();
        
        // Only update if the times differ significantly
        if (Math.abs(teamStartTime - startTime) > 1000) {
          console.log('[Index] Syncing race store start time with team start time from localStorage');
          console.log('  Team start time:', new Date(teamStartTime).toISOString());
          console.log('  Race store start time:', new Date(startTime).toISOString());
          setStartTime(teamStartTime);
        }
      }
    }
  }, []);

  // Initialize Supabase sync and offline queue
  const { onConflictDetected } = useConflictResolution();
  const { fetchLatestData } = useEnhancedSyncManager();
  const { processQueue, getQueueStatus, isProcessing: isQueueProcessing } = useOfflineQueue();

  // Component render - removed excessive logging

  useEffect(() => {
    // Ensure store knows current teamId so sync hooks can run
    if (team?.id) {
      const current = useRaceStore.getState().teamId;
      if (current !== team.id) {
        useRaceStore.getState().setTeamId(team.id);
      }
      
      // If this is a new team and setup is complete, remove the flag
      if (isNewTeam && useRaceStore.getState().isSetupComplete) {
        localStorage.removeItem('relay_is_new_team');
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
    if (flag) {
      setIsNewTeam(true);
      hasProcessedFlagRef.current = true;
      // Don't remove the flag yet - wait until SetupWizard completes the save
    } else {
      // If no flag is found, explicitly set to false to indicate this is not a new team
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
        useRaceStore.getState().markSetupComplete();
        hasRestoredSetupStateRef.current = true;
        return;
      }
      
      // Check for offline setup state
      const offlineSetup = localStorage.getItem(`relay_tracker_${teamId}_setup`);
      if (offlineSetup) {
        const setupData = JSON.parse(offlineSetup);
        if (setupData.isSetupComplete) {
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
    
    // Prevent multiple fetches for the same team
    if (hasFetchedInitialDataRef.current && teamId === useRaceStore.getState().teamId) {
      return;
    }
    
    if (teamId && deviceInfo?.role !== 'viewer' && isNewTeam === false) {
      console.log('[Index] Calling fetchLatestData for team:', teamId);
      fetchLatestData();
      hasFetchedInitialDataRef.current = true;
    } else if (teamId && deviceInfo?.role !== 'viewer' && isNewTeam === undefined) {
      // If isNewTeam is undefined, we haven't determined yet - skip for now
      console.log('[Index] Skipping fetchInitialData - isNewTeam is undefined');
    }
  }, [teamId, fetchLatestData, deviceInfo?.role, isNewTeam]);

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
      
      // CRITICAL FIX: Use team start time from localStorage instead of race store startTime
      // The race store startTime might still be the default, not the team's saved time
      const storedTeamStartTime = localStorage.getItem('relay_team_start_time');
      let actualStartTime = startTime; // Default to race store time
      
      if (storedTeamStartTime) {
        const teamStartTime = new Date(storedTeamStartTime).getTime();
        const placeholderDate = new Date('2099-12-31T23:59:59Z');
        
        // Only use team start time if it's not the placeholder
        if (Math.abs(teamStartTime - placeholderDate.getTime()) > 1000) {
          actualStartTime = teamStartTime;
        }
      }
      
      if (typeof firstLeg.actualStart !== 'number' && now >= actualStartTime) {
        updateLegActualTime(1, 'actualStart', actualStartTime);
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

    // Offline state restoration is now handled by the enhanced sync manager
    console.log('🔄 [OFFLINE] Offline state restoration handled by enhanced sync manager');
    // Ensure we only attempt restore once per mount/team session
    hasRestoredOfflineRef.current = true;
  }, [team, teamLoading, teamId]);

  // Process offline queue when coming back online or when team changes
  useEffect(() => {
    if (!teamId || !isOnline) return;
    
    const queueStatus = getQueueStatus();
    if (queueStatus.pendingCount > 0) {
      console.log(`[Index] Processing offline queue with ${queueStatus.pendingCount} pending changes`);
      processQueue(teamId);
    }
  }, [isOnline, teamId, processQueue, getQueueStatus]);
  
  // Also process queue periodically when online to catch any missed changes
  useEffect(() => {
    if (!teamId || !isOnline) return;
    
    const interval = setInterval(() => {
      const queueStatus = getQueueStatus();
      if (queueStatus.pendingCount > 0 && !queueStatus.isProcessing) {
        console.log(`[Index] Periodic queue check - processing ${queueStatus.pendingCount} pending changes`);
        processQueue(teamId);
      }
    }, 10000); // Check every 10 seconds
    
    return () => clearInterval(interval);
  }, [teamId, isOnline, processQueue, getQueueStatus]);

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

      {/* Queue status indicator */}
      {isQueueProcessing && (
        <Alert className="m-2 sm:m-4 border-blue-200 bg-blue-50">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Syncing offline changes...
          </AlertDescription>
        </Alert>
      )}

      {/* Main content */}
      <main className="container mx-auto px-2 sm:px-4 py-2">
        {(() => {
          // Rendering decision - removed excessive logging
                      if (isSetupComplete || isSetupLocked || !isAdmin) {
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
