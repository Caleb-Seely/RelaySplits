import React, { useEffect, useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchLeaderboardData, fetchTeamLeaderboardData, clearTeamLeaderboardCache } from '@/services/leaderboard';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { LoadingSpinner } from '@/components/ui/loading-states';
import LeaderboardErrorBoundary from '@/components/ErrorBoundary';
import { useTeam } from '@/contexts/TeamContext';
import { eventBus, EVENT_TYPES } from '@/utils/eventBus';
import { Button } from '@/components/ui/button';
import { RefreshCw, Zap } from 'lucide-react';

export const LeaderboardPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { deviceInfo } = useTeam();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => fetchLeaderboardData(),
    // Remove polling - rely on real-time updates
    staleTime: Infinity, // Data never goes stale automatically
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  // Manual refresh function
  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      setLastUpdateTime(new Date());
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  // Test real-time update function
  const handleTestRealtime = useCallback(() => {
    console.log('[LeaderboardPage] Testing real-time update...');
    console.log('[LeaderboardPage] Current device info:', deviceInfo);
    
    // Simulate a leaderboard update event
    const testEvent = {
      type: EVENT_TYPES.REALTIME_UPDATE,
      payload: {
        type: 'leaderboard',
        action: 'updated',
        team_id: deviceInfo?.teamId,
        current_leg: 5,
        projected_finish_time: Date.now() + 3600000,
        device_id: 'test-device',
        timestamp: new Date().toISOString()
      },
      priority: 'high' as const,
      source: 'test'
    };
    
    console.log('[LeaderboardPage] Publishing test event:', testEvent);
    eventBus.publish(testEvent);
  }, [deviceInfo?.teamId]);

  // Update specific team data in the leaderboard cache
  const updateTeamInCache = useCallback(async (teamId: string) => {
    console.log('[LeaderboardPage] Updating team in cache:', teamId);
    
    try {
      // Clear the team's cache to force fresh data
      clearTeamLeaderboardCache(teamId);
      
      // Fetch updated data for this specific team
      const updatedTeamData = await fetchTeamLeaderboardData(teamId);
      
      console.log('[LeaderboardPage] Fetched updated team data:', updatedTeamData);
      
      if (updatedTeamData) {
        // Update the leaderboard query cache with the new team data
        queryClient.setQueryData(['leaderboard'], (oldData: any) => {
          console.log('[LeaderboardPage] Current cache data:', oldData);
          
          if (!oldData || !oldData.teams) {
            console.log('[LeaderboardPage] No existing cache data, cannot update');
            return oldData;
          }
          
          console.log('[LeaderboardPage] Looking for team with ID:', teamId);
          console.log('[LeaderboardPage] Current teams in cache:', oldData.teams);
          
          const updatedTeams = oldData.teams.map((team: any) => {
            const isMatch = team.id === teamId || team.team_id === teamId;
            console.log(`[LeaderboardPage] Team ${team.id || team.team_id} matches ${teamId}:`, isMatch);
            return isMatch ? updatedTeamData : team;
          });
          
          console.log('[LeaderboardPage] Updated teams array:', updatedTeams);
          
          // Re-sort teams by projected finish time
          updatedTeams.sort((a: any, b: any) => {
            if (!a.projected_finish_time && !b.projected_finish_time) return 0;
            if (!a.projected_finish_time) return 1;
            if (!b.projected_finish_time) return -1;
            return a.projected_finish_time - b.projected_finish_time;
          });
          
          const newData = {
            ...oldData,
            teams: updatedTeams,
            last_updated: new Date().toISOString()
          };
          
          console.log('[LeaderboardPage] New cache data:', newData);
          return newData;
        });
        
        setLastUpdateTime(new Date());
        console.log('[LeaderboardPage] Successfully updated team data in cache');
      } else {
        console.log('[LeaderboardPage] No team data returned from fetch');
      }
    } catch (error) {
      console.error('[LeaderboardPage] Failed to update team in cache:', error);
      // Fallback: invalidate the entire query if update fails
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    }
  }, [queryClient]);

  // Listen to real-time update events (these are published by the Dashboard's subscription)
  useEffect(() => {
    if (!deviceInfo?.teamId) return;

    console.log('[LeaderboardPage] Setting up real-time event listeners for team:', deviceInfo.teamId);
    
    // Subscribe to real-time update events from the eventBus
    const unsubscribeRealtime = eventBus.subscribe(EVENT_TYPES.REALTIME_UPDATE, (event) => {
      console.log('[LeaderboardPage] Received real-time update:', event.payload);
      
      // Handle different types of updates
      if (event.payload.type === 'leaderboard') {
        // Leaderboard-specific update - we know exactly which team was updated
        const updatedTeamId = event.payload.team_id;
        console.log('[LeaderboardPage] Leaderboard update for team:', updatedTeamId);
        updateTeamInCache(updatedTeamId);
      } else if (event.payload.type === 'legs' || event.payload.type === 'runners') {
        // Leg/runner update - refresh our team's leaderboard data
        console.log('[LeaderboardPage] Data updated, refreshing our team leaderboard data');
        updateTeamInCache(deviceInfo.teamId);
      }
    });

    return () => {
      console.log('[LeaderboardPage] Cleaning up real-time event listeners');
      unsubscribeRealtime();
    };
  }, [deviceInfo?.teamId, updateTeamInCache]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Race Leaderboard</h1>
          <div className="flex gap-2">
            <Button 
              onClick={handleTestRealtime}
              variant="outline"
              size="sm"
            >
              <Zap className="h-4 w-4 mr-2" />
              Test RT
            </Button>
            <Button 
              onClick={handleManualRefresh} 
              disabled={isRefreshing}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Race Leaderboard</h1>
          <div className="flex gap-2">
            <Button 
              onClick={handleTestRealtime}
              variant="outline"
              size="sm"
            >
              <Zap className="h-4 w-4 mr-2" />
              Test RT
            </Button>
            <Button 
              onClick={handleManualRefresh} 
              disabled={isRefreshing}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error loading leaderboard. Please try again.
        </div>
      </div>
    );
  }

  return (
    <LeaderboardErrorBoundary>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Race Leaderboard</h1>
          <div className="flex items-center gap-4">
            {lastUpdateTime && (
              <span className="text-sm text-gray-500">
                Last updated: {lastUpdateTime.toLocaleTimeString()}
              </span>
            )}
            <div className="flex gap-2">
              <Button 
                onClick={handleTestRealtime}
                variant="outline"
                size="sm"
              >
                <Zap className="h-4 w-4 mr-2" />
                Test RT
              </Button>
              <Button 
                onClick={handleManualRefresh} 
                disabled={isRefreshing}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
        <LeaderboardTable teams={data?.teams || []} />
      </div>
    </LeaderboardErrorBoundary>
  );
};

export default LeaderboardPage;
