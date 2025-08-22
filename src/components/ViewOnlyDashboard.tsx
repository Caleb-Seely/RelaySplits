import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { useRaceStore } from '@/store/raceStore';
import { useEnhancedSyncManager } from '@/hooks/useEnhancedSyncManager';
import { useTeam } from '@/contexts/TeamContext';
import { useConflictResolution } from '@/contexts/ConflictResolutionContext';
import Dashboard from './Dashboard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, Users, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ViewTeamResponse {
  teamId: string;
  role: 'viewer';
  teamName: string;
  viewer_code: string;
  start_time: string;
  isSetUp: boolean;
  runnersCount: number;
  legsCount: number;
}

const ViewOnlyDashboard = () => {
  const { viewerCode } = useParams();
  const navigate = useNavigate();
  const isOnline = navigator.onLine;
  const [teamData, setTeamData] = useState<ViewTeamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamNotSetUp, setTeamNotSetUp] = useState(false);
  const { onConflictDetected } = useConflictResolution();
  const { fetchLatestData } = useEnhancedSyncManager();
  const setTeamId = useRaceStore((s) => s.setTeamId);
  const initializeLegs = useRaceStore((s) => s.initializeLegs);
  const { setDeviceInfo } = useTeam();
  const hasFetchedData = useRef(false);
  const fetchLatestDataRef = useRef(fetchLatestData);
  const isMounted = useRef(true);
  const hasUnmounted = useRef(false);
  const fetchInProgress = useRef(false);
  const hasShownToast = useRef(false);
  
  console.log('[ViewOnlyDashboard] Component render - viewerCode:', viewerCode, 'hasFetchedData:', hasFetchedData.current, 'isMounted:', isMounted.current, 'hasUnmounted:', hasUnmounted.current);
  
  // Update ref when fetchLatestData changes
  useEffect(() => {
    console.log('[ViewOnlyDashboard] fetchLatestData changed, updating ref');
    fetchLatestDataRef.current = fetchLatestData;
  }, [fetchLatestData]);
  
  // Create stable callbacks to prevent useEffect re-runs
  const stableSetTeamId = useCallback(setTeamId, []);
  const stableSetDeviceInfo = useCallback(setDeviceInfo, []);
  const stableInitializeLegs = useCallback(initializeLegs, []);
  
  // Cleanup on unmount
  useEffect(() => {
    console.log('[ViewOnlyDashboard] Component mounted');
    return () => {
      console.log('[ViewOnlyDashboard] Component unmounting');
      isMounted.current = false;
      hasUnmounted.current = true;
      // Only reset hasFetchedData on actual unmount
      hasFetchedData.current = false;
      fetchInProgress.current = false;
      hasShownToast.current = false;
      // Clean up viewer-specific localStorage items
    };
  }, []);

  useEffect(() => {
    console.log('[ViewOnlyDashboard] Main useEffect triggered - viewerCode:', viewerCode);
    
    // Prevent running if component has unmounted
    if (hasUnmounted.current) {
      console.log('[ViewOnlyDashboard] Component has unmounted, skipping useEffect');
      return;
    }
    
    if (!viewerCode) {
      console.log('[ViewOnlyDashboard] No viewer code, setting error');
      setError('No viewer code provided');
      setLoading(false);
      return;
    }
    
    const loadTeamData = async () => {
      console.log('[ViewOnlyDashboard] loadTeamData started');
      try {
        // Call the teams-view Edge Function
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/teams-view`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({ viewer_code: viewerCode })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load team');
        }
        
        const data: ViewTeamResponse = await response.json();
        console.log('[ViewOnlyDashboard] Team data received:', data);
        setTeamData(data);
        
        // Set team ID in race store so Dashboard can access the data
        stableSetTeamId(data.teamId);
        
        // Set temporary device info for viewer (no device registration, no persistence)
        console.log('[ViewOnlyDashboard] Setting device info for viewer');
        const deviceInfo = {
          deviceId: `viewer-${Date.now()}`,
          teamId: data.teamId,
          role: 'viewer',
          firstName: 'Viewer',
          lastName: '',
          displayName: 'Viewer'
        };
        stableSetDeviceInfo(deviceInfo);
        
        // Don't persist viewer info to localStorage - viewers are stateless
        localStorage.removeItem('relay_team_id');
        localStorage.removeItem('relay_device_info');
        

        
        // Debug: Check what's in localStorage after setting device info
        console.log('[ViewOnlyDashboard] Device info set:', deviceInfo);
        console.log('[ViewOnlyDashboard] localStorage after cleanup:', {
          relay_team_id: localStorage.getItem('relay_team_id'),
          relay_device_info: localStorage.getItem('relay_device_info')
        });
        
        // Fetch initial team data (only once, with additional safety check)
        console.log('[ViewOnlyDashboard] Checking if should fetch data - hasFetchedData:', hasFetchedData.current, 'fetchInProgress:', fetchInProgress.current, 'teamId:', data.teamId);
        if (!hasFetchedData.current && !fetchInProgress.current && data.teamId) {
          console.log('[ViewOnlyDashboard] Fetching initial data for team:', data.teamId);
          fetchInProgress.current = true;
          try {
            await fetchLatestDataRef.current();
            console.log('[ViewOnlyDashboard] Setting hasFetchedData to true');
            hasFetchedData.current = true;
            
            // Wait a moment for the state to update
            await new Promise(resolve => setTimeout(resolve, 500));
            
                         // Debug: Check what data is in the race store
             const storeState = useRaceStore.getState();
             console.log('[ViewOnlyDashboard] Race store state after fetch:', {
               teamId: storeState.teamId,
               runnersCount: storeState.runners.length,
               legsCount: storeState.legs.length,
               isSetupComplete: storeState.isSetupComplete
             });
             
             // Check if team is set up using the same logic as Dashboard
             // A team is considered set up if it has legs OR if it has runners and is marked as setup complete
             const hasLegs = storeState.legs.length > 0;
             const hasRunners = storeState.runners.length > 0;
             const isSetupComplete = storeState.isSetupComplete;
             
             console.log('[ViewOnlyDashboard] Team setup check:', {
               hasLegs,
               hasRunners,
               isSetupComplete,
               totalRunners: storeState.runners.length
             });
             
             // Team is not set up if it has no legs AND either has no runners OR is not marked as setup complete
             if (!hasLegs && (!hasRunners || !isSetupComplete)) {
               console.log('[ViewOnlyDashboard] Team not set up - no legs and insufficient setup data');
               setTeamNotSetUp(true);
             } else if (!hasLegs && hasRunners && isSetupComplete) {
               // Team has runners and is marked as setup complete but no legs - try to initialize legs
               console.log('[ViewOnlyDashboard] Team has runners and is setup complete but no legs - attempting to initialize legs');
               try {
                 stableInitializeLegs();
                 
                 // Check state after initialization
                 const stateAfterInit = useRaceStore.getState();
                 console.log('[ViewOnlyDashboard] State after leg init - legs:', stateAfterInit.legs.length, 'runners:', stateAfterInit.runners.length);
                 
                 if (stateAfterInit.legs.length > 0) {
                   console.log('[ViewOnlyDashboard] Legs initialized successfully');
                   setTeamNotSetUp(false);
                 } else {
                   console.log('[ViewOnlyDashboard] Failed to initialize legs');
                   setTeamNotSetUp(true);
                 }
               } catch (error) {
                 console.error('[ViewOnlyDashboard] Error initializing legs:', error);
                 setTeamNotSetUp(true);
               }
             } else {
               console.log('[ViewOnlyDashboard] Team appears to be set up');
               setTeamNotSetUp(false);
             }
             
             // Fallback: Use server-side setup information if client-side check is inconclusive
             if (teamData && !hasLegs && !hasRunners) {
               console.log('[ViewOnlyDashboard] Using server-side setup info as fallback:', {
                 serverIsSetUp: teamData.isSetUp,
                 serverRunnersCount: teamData.runnersCount,
                 serverLegsCount: teamData.legsCount
               });
               
               if (!teamData.isSetUp) {
                 console.log('[ViewOnlyDashboard] Server indicates team is not set up');
                 setTeamNotSetUp(true);
               } else {
                 console.log('[ViewOnlyDashboard] Server indicates team is set up, but client data missing - will retry fetch');
                 // Don't set teamNotSetUp here, let the retry logic handle it
               }
             }
             
             // If we still don't have legs but have runners, try one more fetch attempt
             if (storeState.legs.length === 0 && storeState.runners.length > 0) {
               console.log('[ViewOnlyDashboard] No legs after initial fetch, trying one more fetch attempt...');
               try {
                 await fetchLatestDataRef.current();
                 
                 // Wait again for state update
                 await new Promise(resolve => setTimeout(resolve, 500));
                 
                 const finalState = useRaceStore.getState();
                 console.log('[ViewOnlyDashboard] Final state after retry - legs:', finalState.legs.length, 'runners:', finalState.runners.length);
                 
                 if (finalState.legs.length === 0) {
                   console.log('[ViewOnlyDashboard] Still no legs after retry - team not set up');
                   setTeamNotSetUp(true);
                 } else {
                   console.log('[ViewOnlyDashboard] Legs found after retry - team is set up');
                   setTeamNotSetUp(false);
                 }
               } catch (error) {
                 console.error('[ViewOnlyDashboard] Error in retry fetch:', error);
                 setTeamNotSetUp(true);
               }
             }
          } catch (error) {
            console.error('[ViewOnlyDashboard] Error fetching initial data:', error);
          } finally {
            fetchInProgress.current = false;
          }
        } else {
          console.log('[ViewOnlyDashboard] Skipping fetch - hasFetchedData:', hasFetchedData.current, 'fetchInProgress:', fetchInProgress.current, 'teamId:', data.teamId);
        }
        
        // Only show toast once per session
        if (!hasShownToast.current) {
          toast.success(`Viewing ${data.teamName}`);
          hasShownToast.current = true;
        }
      } catch (err) {
        console.error('Error loading team data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load team');
      } finally {
        setLoading(false);
      }
    };

    loadTeamData();
    
    // No cleanup needed here - we'll handle cleanup on actual unmount
  }, [viewerCode, stableSetTeamId, stableSetDeviceInfo, stableInitializeLegs]); // Removed teamData to prevent notification spam

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading team data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Team Not Found</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => navigate('/demo')}>
            Join a Team
          </Button>
        </div>
      </div>
    );
  }

  if (!teamData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-red-600">No team data available</p>
        </div>
      </div>
    );
  }

  if (teamNotSetUp) {
    return (
      <div className="min-h-screen bg-background">
        {/* View Only Header */}
        <div className="bg-blue-50 border-b border-blue-200 p-4">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600" />
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                View Only
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {teamData.teamName}
              </span>
            </div>
          </div>
        </div>

        {/* Team Not Set Up Message */}
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <AlertCircle className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2 text-yellow-800">Team Not Set Up Yet</h2>
              <p className="text-yellow-700 mb-4">
                This team has {teamData?.runnersCount || useRaceStore.getState().runners.length} runners but hasn't been configured for the race yet. 
                The team needs to complete setup before you can view race data.
              </p>
              <p className="text-sm text-yellow-600">
                Check back later once the team has set up their race configuration.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* View Only Header */}
      <div className="bg-blue-50 border-b border-blue-200 p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-blue-600" />
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              View Only Mode
            </Badge>
            {!isOnline && (
              <Badge variant="outline" className="text-orange-600">
                Offline - Using Cached Data
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {teamData.teamName}
            </span>
            
          </div>
        </div>
      </div>

      {/* Offline warning */}
      {!isOnline && (
        <Alert className="m-2 sm:m-4 border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            You're currently offline. Viewing cached data from previous sessions.
          </AlertDescription>
        </Alert>
      )}

      {/* Dashboard with view-only mode */}
      <Dashboard isViewOnly={true} viewOnlyTeamName={teamData.teamName} />
    </div>
  );
};

export default ViewOnlyDashboard;



