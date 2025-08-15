
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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
import TeamSetup from '@/components/TeamSetup';
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

  useEffect(() => {
    // Ensure store knows current teamId so sync hooks can run
    if (team?.id) {
      const current = useRaceStore.getState().teamId;
      if (current !== team.id) {
        useRaceStore.getState().setTeamId(team.id);
      }
    }
  }, [team?.id]);

  // Detect freshly-created team and show Setup Wizard as new team once
  useEffect(() => {
    const flag = localStorage.getItem('relay_is_new_team');
    if (flag) {
      setIsNewTeam(true);
      localStorage.removeItem('relay_is_new_team');
    }
  }, []);

  useEffect(() => {
    if (teamId) {
      fetchInitialData(teamId);
    }
  }, [teamId, fetchInitialData]);

  // Realtime subscriptions are established in Dashboard.tsx

  // Check if we're within free hours (8 hours from start)
  const startTime = new Date('2024-08-12T00:00:00Z').getTime();
  const currentTime = Date.now();
  const isWithinFreeHours = (currentTime - startTime) < (8 * 60 * 60 * 1000);

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
    // Do NOT restore offline state during setup wizard to avoid resetting form inputs
    if (!isSetupComplete) return;
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
  }, [isSetupComplete, team, teamLoading, teamId, loadOfflineState, isDataConsistent, restoreFromOffline]);

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

  // Show team join/create prompt only when there is no team in state AND nothing stored
  if (!(team || hasStoredTeam)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <h1 className="text-4xl font-bold mb-4">TeamSplits</h1>
          <p className="text-muted-foreground mb-6">
            Track your relay race in real-time with your team.
          </p>
          <div className="space-y-3">
            <Link to="/auth">
              <Button className="w-full">
                Create or Join Team
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Show free tier warning
  const showFreeWarning = !isWithinFreeHours;

  return (
    <div className="min-h-screen bg-background">
      {/* Offline status and free tier warnings */}
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

      {/* {showFreeWarning && (
        <Alert className="m-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your free 8-hour trial has expired. Editing is now restricted. 
            <Button variant="link" className="p-0 h-auto font-semibold ml-1">
              Upgrade to continue editing
            </Button>
          </AlertDescription>
        </Alert>
      )} */}

      {/* Main content */}
      <main className="container mx-auto px-2 sm:px-4 py-2">
        {isSetupComplete || isSetupLocked || !isAdmin ? (
          <>
            <Dashboard />
          </>
        ) : (
          <>
            <SetupWizard isNewTeam={isNewTeam} />
          </>
        )}
      </main>
    </div>
  );
};

export default Index;
