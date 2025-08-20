import { fetchLeaderboardData, fetchTeamLeaderboardData, clearAllLeaderboardCache } from '@/services/leaderboard';
import { eventBus, EVENT_TYPES } from '@/utils/eventBus';

/**
 * Debug utility to test leaderboard update functionality
 */
export class LeaderboardDebugger {
  private static instance: LeaderboardDebugger;
  private isEnabled = false;

  static getInstance(): LeaderboardDebugger {
    if (!LeaderboardDebugger.instance) {
      LeaderboardDebugger.instance = new LeaderboardDebugger();
    }
    return LeaderboardDebugger.instance;
  }

  enable() {
    this.isEnabled = true;
    console.log('[LeaderboardDebugger] Debug mode enabled');
  }

  disable() {
    this.isEnabled = false;
    console.log('[LeaderboardDebugger] Debug mode disabled');
  }

  log(message: string, data?: any) {
    if (this.isEnabled) {
      console.log(`[LeaderboardDebugger] ${message}`, data || '');
    }
  }

  /**
   * Test leaderboard data fetching
   */
  async testLeaderboardFetch() {
    this.log('Testing leaderboard data fetch...');
    
    try {
      const data = await fetchLeaderboardData();
      this.log('Leaderboard fetch successful:', data);
      return data;
    } catch (error) {
      this.log('Leaderboard fetch failed:', error);
      throw error;
    }
  }

  /**
   * Test team-specific leaderboard data fetching
   */
  async testTeamLeaderboardFetch(teamId: string) {
    this.log(`Testing team leaderboard fetch for team: ${teamId}`);
    
    try {
      const data = await fetchTeamLeaderboardData(teamId);
      this.log('Team leaderboard fetch successful:', data);
      return data;
    } catch (error) {
      this.log('Team leaderboard fetch failed:', error);
      throw error;
    }
  }

  /**
   * Test cache clearing
   */
  testCacheClearing() {
    this.log('Testing cache clearing...');
    
    try {
      clearAllLeaderboardCache();
      this.log('Cache cleared successfully');
    } catch (error) {
      this.log('Cache clearing failed:', error);
      throw error;
    }
  }

  /**
   * Test real-time update event publishing
   */
  testRealtimeUpdate(teamId: string, currentLeg: number = 5) {
    this.log(`Testing real-time update for team: ${teamId}, leg: ${currentLeg}`);
    
    const testEvent = {
      type: EVENT_TYPES.REALTIME_UPDATE,
      payload: {
        type: 'leaderboard',
        action: 'updated',
        team_id: teamId,
        current_leg: currentLeg,
        projected_finish_time: Date.now() + 3600000,
        timestamp: new Date().toISOString()
      },
      priority: 'high' as const,
      source: 'debug'
    };
    
    this.log('Publishing test event:', testEvent);
    eventBus.publish(testEvent);
    this.log('Test event published successfully');
  }

  /**
   * Monitor real-time events
   */
  startEventMonitoring() {
    this.log('Starting event monitoring...');
    
    const unsubscribe = eventBus.subscribe(EVENT_TYPES.REALTIME_UPDATE, (event) => {
      this.log('Received real-time event:', event);
    });
    
    this.log('Event monitoring started');
    return unsubscribe;
  }

  /**
   * Comprehensive test of leaderboard update flow
   */
  async runComprehensiveTest(teamId: string) {
    this.log('Running comprehensive leaderboard test...');
    
    try {
      // Step 1: Clear cache
      this.testCacheClearing();
      
      // Step 2: Fetch initial data
      const initialData = await this.testLeaderboardFetch();
      
      // Step 3: Fetch team-specific data
      const teamData = await this.testTeamLeaderboardFetch(teamId);
      
      // Step 4: Test real-time update
      this.testRealtimeUpdate(teamId);
      
      // Step 5: Wait a moment and fetch again
      await new Promise(resolve => setTimeout(resolve, 1000));
      const updatedData = await this.testLeaderboardFetch();
      
      this.log('Comprehensive test completed successfully');
      return {
        initialData,
        teamData,
        updatedData
      };
    } catch (error) {
      this.log('Comprehensive test failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const leaderboardDebugger = LeaderboardDebugger.getInstance();

// Add to window for debugging in console
if (typeof window !== 'undefined') {
  (window as any).leaderboardDebugger = leaderboardDebugger;
}
