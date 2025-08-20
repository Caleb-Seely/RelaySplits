import React, { useEffect, useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchLeaderboardData, fetchTeamLeaderboardData, clearTeamLeaderboardCache, clearAllLeaderboardCache } from '@/services/leaderboard';
import { LoadingSpinner } from '@/components/ui/loading-states';
import LeaderboardErrorBoundary from '@/components/ErrorBoundary';
import { useTeam } from '@/contexts/TeamContext';
import { eventBus, EVENT_TYPES } from '@/utils/eventBus';
import { Button } from '@/components/ui/button';
import { RefreshCw, Zap, Trophy, Users, Clock, MapPin, Flame, Star, Play, Bug } from 'lucide-react';
import { leaderboardDebugger } from '@/utils/leaderboardDebug';
import { formatDuration } from '@/utils/raceUtils';

const PodiumCard = ({ team, position, isCurrentTeam = false }: { team: any; position: number; isCurrentTeam?: boolean }) => {
  const podiumHeight = position === 1 ? 'h-32' : position === 2 ? 'h-24' : 'h-20';
  const glowColor = position === 1 ? 'shadow-yellow-500/50' : position === 2 ? 'shadow-gray-400/50' : 'shadow-orange-400/50';
  const borderColor = position === 1 ? 'border-yellow-400' : position === 2 ? 'border-gray-300' : 'border-orange-400';
  const bgGradient = position === 1 
    ? 'bg-gradient-to-br from-yellow-50 to-yellow-100' 
    : position === 2 
    ? 'bg-gradient-to-br from-gray-50 to-gray-100'
    : 'bg-gradient-to-br from-orange-50 to-orange-100';

  const formatTime = (timestamp: number) => {
    if (!timestamp) return '--:--';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col items-center">
      <div className={`relative ${podiumHeight} w-20 ${bgGradient} rounded-t-xl border-2 ${borderColor} shadow-lg ${glowColor} flex items-end justify-center pb-3 transition-all duration-300 hover:shadow-xl hover:scale-105`}>
        <div className="absolute -top-8 w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center border-2 border-gray-200">
          <span className="text-2xl font-bold text-gray-700">{position}</span>
        </div>
        <div className="text-center">
          {position === 1 && <Trophy className="h-6 w-6 text-yellow-500 mx-auto" />}
          {position === 2 && <Star className="h-6 w-6 text-gray-500 mx-auto" />}
          {position === 3 && <Flame className="h-6 w-6 text-orange-500 mx-auto" />}
        </div>
      </div>
      <div className="mt-2 text-center bg-white rounded-lg p-3 shadow-md border border-gray-100 min-w-[140px] max-w-[200px]">
        <h3 className={`font-bold text-sm truncate w-full ${isCurrentTeam ? 'text-blue-600' : 'text-gray-800'}`}>
          {team.team_name || `Team ${team.id}`}
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Current: Leg {team.current_leg || 0}
        </p>
        <p className="text-xs font-medium text-gray-700 mt-1">
          ETA: {formatTime(team.projected_finish_time)}
        </p>
      </div>
    </div>
  );
};

const TeamCard = ({ team, position, isCurrentTeam = false }: { team: any; position: number; isCurrentTeam?: boolean }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  const formatTime = (timestamp: number) => {
    if (!timestamp) return '--:--';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getProgressPercentage = (currentLeg: number, totalLegs = 36) => {
    return Math.min((currentLeg / totalLegs) * 100, 100);
  };

  const getMinutesToFinishLeg = () => {
    // Calculate time remaining for the current leg
    if (!team.current_leg_projected_finish || !team.last_updated_at) return null;
    
    const projectedFinishTime = new Date(team.current_leg_projected_finish);
    const lastUpdatedTime = new Date(team.last_updated_at);
    const now = currentTime.getTime();
    
    // Calculate how much time has passed since the projection was made
    const timePassedSinceUpdate = now - lastUpdatedTime.getTime();
    
    // Calculate the original remaining time when the projection was made
    const originalRemainingTime = projectedFinishTime.getTime() - lastUpdatedTime.getTime();
    
    // Current remaining time = original remaining time - time passed since update
    const currentRemainingTime = originalRemainingTime - timePassedSinceUpdate;
    
    // If the remaining time is negative, the leg should be finished
    if (currentRemainingTime < 0) {
      return 0; // Leg should be finished
    }
    
    const remainingMinutes = Math.round(currentRemainingTime / (1000 * 60));
    
    // Cap at a reasonable maximum (e.g., 4 hours) to handle edge cases
    return Math.min(remainingMinutes, 240);
  };

  // Calculate total race time for finished teams
  const getTotalRaceTime = () => {
    if (!team.team_start_time || !team.projected_finish_time) return null;
    return team.projected_finish_time - team.team_start_time;
  };

  // Check if team is finished (on leg 37)
  const isFinished = team.current_leg === 37;

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const minutesToFinish = getMinutesToFinishLeg();
  const totalRaceTime = getTotalRaceTime();

    return (
    <div className="flex items-center space-x-2 w-full">
      {/* Rank Badge - More inline with team name */}
      <div className="w-6 h-6 bg-gradient-to-br from-gray-700 to-gray-800 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-lg flex-shrink-0">
        {position}
      </div>
      
      {/* Main Card */}
      <div className={`group relative bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-gray-700/50 hover:shadow-xl hover:border-gray-600/50 transition-all duration-300 flex-1 ${isCurrentTeam ? 'ring-2 ring-blue-500/50 ring-opacity-50 bg-gradient-to-r from-blue-900/20 to-indigo-900/20' : ''}`}>
        {/* Current Team Indicator */}
        {isCurrentTeam && (
          <div className="absolute top-2 right-2 w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
        )}

                 {/* Header Row - Team Name and Leg Info */}
         <div className="flex items-center justify-between mb-3 gap-3">
           {/* Team Name */}
           <div className="min-w-0 flex-1 max-w-full">
             <h3 className="text-base font-bold text-gray-100 group-hover:text-blue-400 transition-colors truncate w-full">
               {team.team_name || `Team ${team.id}`}
             </h3>
           </div>
           
           {/* Next Leg with Time Badge or Total Race Time for finished teams */}
           <div className="flex items-center flex-shrink-0">
             {isFinished ? (
               // Show total race time for finished teams
               <div className="flex items-center space-x-1 text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm bg-green-600">
                 <Trophy className="h-3 w-3 text-white" />
                 <span>Total: {totalRaceTime ? formatDuration(totalRaceTime) : '--:--'}</span>
               </div>
             ) : (
               // Show leg badge for active teams
               minutesToFinish !== null && (
                 <div className={`flex items-center space-x-1 text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm ${
                   minutesToFinish === 0
                     ? 'bg-gray-500' // Finished or should be finished
                     : minutesToFinish <= 10 
                     ? 'bg-red-500 animate-pulse' 
                     : minutesToFinish <= 30 
                     ? 'bg-orange-500' 
                     : 'bg-blue-500'
                 }`}>
                   <Play className="h-3 w-3 text-white" />
                   <span>Leg {(team.current_leg || 0) + 1}:</span>
                   <span>{minutesToFinish === 0 ? 'now' : `${minutesToFinish}m`}</span>
                 </div>
               )
             )}
           </div>
         </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-1000 ease-out relative"
            style={{ width: `${getProgressPercentage(team.current_leg)}%` }}
          >
            <div className="absolute inset-0 bg-white opacity-20 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* Bottom Row - Start Time and Projected Finish */}
      <div className="flex justify-between items-center text-xs text-gray-400">
        {/* Start Time */}
        <div className="flex items-center">
          <span>Start: {formatTime(team.team_start_time)}</span>
        </div>
        
        {/* Projected Finish or Finish Time */}
        <div className="flex items-center">
          {isFinished ? (
            <span className="text-green-400 font-medium">Finish: {formatTime(team.projected_finish_time)}</span>
          ) : (
            <span>Proj. Finish: {formatTime(team.projected_finish_time)}</span>
          )}
        </div>
      </div>

      {/* Hover Effect Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover:opacity-10 rounded-xl transition-opacity duration-300"></div>
      </div>
    </div>
  );
};

export const LeaderboardPage = () => {
  const queryClient = useQueryClient();
  const { deviceInfo } = useTeam();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => fetchLeaderboardData(),
    staleTime: 30000, // 30 seconds - reduced from Infinity to allow more frequent updates
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchOnMount: true, // Always refetch on mount
  });

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Clear all caches before refreshing
      clearAllLeaderboardCache();
      
      // Force a fresh fetch
      await refetch();
      setLastUpdateTime(new Date());
      
      console.log('[LeaderboardPage] Manual refresh completed successfully');
    } catch (error) {
      console.error('[LeaderboardPage] Manual refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const forceRefresh = useCallback(async () => {
    console.log('[LeaderboardPage] Force refreshing leaderboard...');
    
    // Clear all caches
    clearAllLeaderboardCache();
    
    // Invalidate the query to force a fresh fetch
    queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    
    // Trigger a refetch
    await refetch();
    setLastUpdateTime(new Date());
  }, [queryClient, refetch]);

  const handleTestRealtime = useCallback(() => {
    console.log('[LeaderboardPage] Testing real-time update...');
    console.log('[LeaderboardPage] Current device info:', deviceInfo);
    
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

  const handleDebugTest = useCallback(async () => {
    if (!deviceInfo?.teamId) {
      console.warn('[LeaderboardPage] No team ID available for debug test');
      return;
    }
    
    console.log('[LeaderboardPage] Running debug test for team:', deviceInfo.teamId);
    
    try {
      // Enable debug mode
      leaderboardDebugger.enable();
      
      // Run comprehensive test
      const result = await leaderboardDebugger.runComprehensiveTest(deviceInfo.teamId);
      
      console.log('[LeaderboardPage] Debug test completed:', result);
      
      // Refresh the leaderboard after test
      await refetch();
      setLastUpdateTime(new Date());
      
    } catch (error) {
      console.error('[LeaderboardPage] Debug test failed:', error);
    } finally {
      // Disable debug mode after test
      leaderboardDebugger.disable();
    }
  }, [deviceInfo?.teamId, refetch]);

  const updateTeamInCache = useCallback(async (teamId: string) => {
    console.log('[LeaderboardPage] Updating team in cache:', teamId);
    
    try {
      clearTeamLeaderboardCache(teamId);
      const updatedTeamData = await fetchTeamLeaderboardData(teamId);
      
      console.log('[LeaderboardPage] Fetched updated team data:', updatedTeamData);
      
      if (updatedTeamData) {
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
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    }
  }, [queryClient]);

  useEffect(() => {
    if (!deviceInfo?.teamId) return;

    console.log('[LeaderboardPage] Setting up real-time event listeners for team:', deviceInfo.teamId);
    
    const unsubscribeRealtime = eventBus.subscribe(EVENT_TYPES.REALTIME_UPDATE, (event) => {
      console.log('[LeaderboardPage] Received real-time update:', event.payload);
      
      if (event.payload.type === 'leaderboard') {
        const updatedTeamId = event.payload.team_id;
        console.log('[LeaderboardPage] Leaderboard update for team:', updatedTeamId);
        
        // Clear cache and refetch immediately for leaderboard updates
        clearTeamLeaderboardCache(updatedTeamId);
        clearAllLeaderboardCache();
        
        // Force a refetch of the leaderboard data
        refetch();
        setLastUpdateTime(new Date());
      } else if (event.payload.type === 'legs' || event.payload.type === 'runners') {
        console.log('[LeaderboardPage] Data updated, refreshing our team leaderboard data');
        
        // For leg/runner updates, update our team's data specifically
        updateTeamInCache(deviceInfo.teamId);
        
        // Also trigger a full refetch after a short delay to ensure we get all updates
        setTimeout(() => {
          refetch();
        }, 1000);
      }
    });

    return () => {
      console.log('[LeaderboardPage] Cleaning up real-time event listeners');
      unsubscribeRealtime();
    };
  }, [deviceInfo?.teamId, updateTeamInCache, refetch]);

  // Periodic refresh for time-sensitive data
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const lastUpdate = lastUpdateTime?.getTime() || 0;
      
      // Determine refresh interval based on race activity
      let refreshInterval = 2 * 60 * 1000; // Default: 2 minutes (reduced from 5)
      
      // If we have teams in the race, refresh more frequently
      if (data?.teams && data.teams.length > 0) {
        const activeTeams = data.teams.filter((team: any) => 
          team.current_leg > 1 && team.current_leg <= 36
        );
        
        if (activeTeams.length > 0) {
          // If teams are actively racing, refresh every 1 minute (reduced from 2)
          refreshInterval = 1 * 60 * 1000;
        }
      }
      
      if (now - lastUpdate > refreshInterval) {
        console.log('[LeaderboardPage] Periodic refresh triggered for time-sensitive data');
        refetch();
        setLastUpdateTime(new Date());
      }
    }, 30000); // Check every 30 seconds (reduced from 60)

    return () => clearInterval(interval);
  }, [refetch, lastUpdateTime, data?.teams]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <div className="container mx-auto px-4 py-8">
                     {/* Header */}
           <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-12">
             <div className="mb-4 lg:mb-0">
               <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                 Race Leaderboard
               </h1>
               <p className="text-gray-300 text-lg">Live race standings and team progress</p>
             </div>
                           <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button 
                  onClick={handleTestRealtime} 
                  className="inline-flex items-center justify-center rounded-full px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium border border-gray-600 text-gray-300 bg-transparent hover:bg-gray-800 hover:border-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                >
                  <Zap className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Test RT</span>
                  <span className="sm:hidden">RT</span>
                </button>
                <button 
                  onClick={forceRefresh} 
                  className="inline-flex items-center justify-center rounded-full px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium border border-orange-600 text-orange-300 bg-transparent hover:bg-orange-800 hover:border-orange-500 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                >
                  <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Force Refresh</span>
                  <span className="sm:hidden">Force</span>
                </button>
                <button 
                  onClick={handleManualRefresh} 
                  disabled={isRefreshing}
                  className="inline-flex items-center justify-center rounded-full px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium border border-gray-600 text-gray-300 bg-transparent hover:bg-gray-800 hover:border-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
           </div>
          
          {/* Loading State */}
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <LoadingSpinner />
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-600 opacity-20 rounded-full animate-pulse"></div>
            </div>
            <p className="mt-6 text-gray-300 text-lg">Loading race data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <div className="container mx-auto px-4 py-8">
                     <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-12">
             <div className="mb-4 lg:mb-0">
               <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                 Race Leaderboard
               </h1>
               <p className="text-gray-300 text-lg">Live race standings and team progress</p>
             </div>
                           <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button 
                  onClick={handleTestRealtime} 
                  className="inline-flex items-center justify-center rounded-full px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium border border-gray-600 text-gray-300 bg-transparent hover:bg-gray-800 hover:border-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                >
                  <Zap className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Test RT</span>
                  <span className="sm:hidden">RT</span>
                </button>
                <button 
                  onClick={handleDebugTest} 
                  className="inline-flex items-center justify-center rounded-full px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium border border-purple-600 text-purple-300 bg-transparent hover:bg-purple-800 hover:border-purple-500 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                >
                  <Bug className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Debug
                </button>
                <button 
                  onClick={forceRefresh} 
                  className="inline-flex items-center justify-center rounded-full px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium border border-orange-600 text-orange-300 bg-transparent hover:bg-orange-800 hover:border-orange-500 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                >
                  <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Force Refresh</span>
                  <span className="sm:hidden">Force</span>
                </button>
                <button 
                  onClick={handleManualRefresh} 
                  disabled={isRefreshing}
                  className="inline-flex items-center justify-center rounded-full px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium border border-gray-600 text-gray-300 bg-transparent hover:bg-gray-800 hover:border-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
           </div>
          <div className="bg-red-900/20 border border-red-700/50 text-red-300 px-6 py-4 rounded-2xl shadow-lg backdrop-blur-sm">
            <p className="font-medium">Unable to load leaderboard data</p>
            <p className="text-sm mt-1">Please check your connection and try again.</p>
          </div>
        </div>
      </div>
    );
  }

  const teams = data?.teams || [];

  return (
    <LeaderboardErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-12">
            <div className="mb-4 lg:mb-0">
              <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                Race Leaderboard
              </h1>
              <p className="text-gray-300 text-lg">Live race standings and team progress</p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              {lastUpdateTime && (
                <div className="hidden lg:flex items-center text-sm text-gray-300 bg-gray-800/50 backdrop-blur-sm px-3 py-2 rounded-full shadow-lg border border-gray-700/50">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                  Last updated: {lastUpdateTime.toLocaleTimeString()}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button 
                  onClick={handleTestRealtime} 
                  className="inline-flex items-center justify-center rounded-full px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium border border-gray-600 text-gray-300 bg-transparent hover:bg-gray-800 hover:border-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                >
                  <Zap className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Test RT</span>
                  <span className="sm:hidden">RT</span>
                </button>
                <button 
                  onClick={handleDebugTest} 
                  className="inline-flex items-center justify-center rounded-full px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium border border-purple-600 text-purple-300 bg-transparent hover:bg-purple-800 hover:border-purple-500 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                >
                  <Bug className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Debug
                </button>
                <button 
                  onClick={forceRefresh} 
                  className="inline-flex items-center justify-center rounded-full px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium border border-orange-600 text-orange-300 bg-transparent hover:bg-orange-800 hover:border-orange-500 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                >
                  <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Force Refresh</span>
                  <span className="sm:hidden">Force</span>
                </button>
                <button 
                  onClick={handleManualRefresh} 
                  disabled={isRefreshing}
                  className="inline-flex items-center justify-center rounded-full px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium border border-gray-600 text-gray-300 bg-transparent hover:bg-gray-800 hover:border-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* All Teams */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-100">Race Standings</h2>
              <div className="text-sm text-gray-300 bg-gray-800/50 backdrop-blur-sm px-3 py-2 rounded-full shadow-lg border border-gray-700/50">
                {teams.length} teams competing
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {teams.map((team, index) => (
                <TeamCard
                  key={team.id || index}
                  team={team}
                  position={index + 1}
                  isCurrentTeam={team.id === deviceInfo?.teamId}
                />
              ))}
            </div>
          </div>

          {teams.length === 0 && (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-gray-800/50 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-700/50">
                <Trophy className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-100 mb-2">No Teams Yet</h3>
              <p className="text-gray-400">Teams will appear here once the race begins</p>
            </div>
          )}
        </div>
      </div>
    </LeaderboardErrorBoundary>
  );
};

export default LeaderboardPage;