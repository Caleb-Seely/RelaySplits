
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamSync } from '@/hooks/useTeamSync';
import { useSupabaseSync } from '@/hooks/useSupabaseSync';
import { useOfflineData } from '@/hooks/useOfflineData';
import { useRaceStore } from '@/store/raceStore';
import { runDiagnostics } from '@/utils/diagnostics';
import Dashboard from '@/components/Dashboard';
import SetupWizard from '@/components/SetupWizard';
import TeamSetup from '@/components/TeamSetup';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const { user } = useAuth();
    const { team, teamMember, loading: teamLoading, createTeam, joinTeam } = useTeamSync();
  const [isNewTeam, setIsNewTeam] = useState(false);
  const raceStore = useRaceStore();
  const { isOnline, offlineChangesCount, loadOfflineState } = useOfflineData();
  
  // Initialize Supabase sync
  useSupabaseSync();

  // Check if we're within free hours (8 hours from start)
  const startTime = new Date('2024-08-12T00:00:00Z').getTime();
  const currentTime = Date.now();
  const isWithinFreeHours = (currentTime - startTime) < (8 * 60 * 60 * 1000);
  const isSetupComplete = raceStore.isSetupComplete;

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
    if (team && !teamLoading && raceStore.teamId === team.id) {
      const offlineState = loadOfflineState();
      if (offlineState && !raceStore.isDataConsistent()) {
        console.log('🔄 [OFFLINE] Restoring state from offline storage...');
        raceStore.restoreFromOffline(
          offlineState.runners,
          offlineState.legs,
          offlineState.isSetupComplete
        );
      }
    }
  }, [team, teamLoading, raceStore.teamId, loadOfflineState, raceStore]);

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

  // Show loading state
  if (teamLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading RelayTracker...</p>
          {!isOnline && (
            <p className="text-sm text-orange-600 mt-2">Working offline - using cached data</p>
          )}
        </div>
      </div>
    );
  }

  // Show authentication prompt for non-authenticated users
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <h1 className="text-4xl font-bold mb-4">RelayTracker</h1>
          <p className="text-muted-foreground mb-6">
            Track your relay race in real-time.
          </p>
          <div className="space-y-3">
            <Link to="/auth">
              <Button className="w-full">
                Sign In / Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Show team setup if user doesn't have a team
  if (!team) {
    return (
      <TeamSetup
        createTeam={createTeam}
        joinTeam={joinTeam}
        loading={teamLoading}
        onTeamReady={(action) => {
          if (action === 'create') {
            setIsNewTeam(true);
          }
        }}
      />
    );
  }

  // Show free tier warning
  const showFreeWarning = !isWithinFreeHours;

  return (
    <div className="min-h-screen bg-background">
      {/* Offline status and free tier warnings */}
      {!isOnline && (
        <Alert className="m-4 border-orange-200 bg-orange-50">
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
      <main className="container mx-auto px-4 py-2">
        {isSetupComplete ? (
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
