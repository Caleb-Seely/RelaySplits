import React, { useState, useEffect } from 'react';

import { useAnalytics, useRaceTracking, useRunnerTracking, useTimerTracking } from '@/hooks/useAnalytics';
import { measureAsyncPerformance } from '@/services/performance';
import { captureSentryError } from '@/services/sentry';

// Example component showing how to integrate analytics
export function AnalyticsExample() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Main analytics hook
  const { trackFeature, trackError, trackPerformance, setUserId } = useAnalytics();
  
  // Feature-specific tracking hooks
  const { trackRaceCreate, trackRaceUpdate } = useRaceTracking();
  const { trackRunnerAdd } = useRunnerTracking();
  const { trackTimerStart, trackTimerStop } = useTimerTracking();

  // Example: Track component mount
  useEffect(() => {
    trackFeature('AnalyticsExample', 'component_mount', {
      component_name: 'AnalyticsExample',
      timestamp: Date.now()
    });
  }, [trackFeature]);

  // Example: Simulate race creation with analytics
  const handleCreateRace = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Track the start of the operation
      trackFeature('race_creation', 'start', {
        operation: 'create_race'
      });

      // Measure performance of the operation
      const result = await measureAsyncPerformance('race_creation', async () => {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { raceId: 'race-123', name: 'Example Race' };
      });

      // Track successful race creation
      trackRaceCreate({
        race_id: result.raceId,
        race_name: result.name,
        team_size: 5,
        operation_duration: 1000
      });

      // Track business event
      trackFeature('business', 'race_created', {
        race_id: result.raceId,
        revenue_impact: 'positive'
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      // Track error in analytics
      trackError(err instanceof Error ? err : errorMessage, {
        operation: 'create_race',
        component: 'AnalyticsExample'
      });

      // Capture error in Sentry
      captureSentryError(err instanceof Error ? err : errorMessage, {
        operation: 'create_race',
        component: 'AnalyticsExample'
      }, {
        error_type: 'race_creation_failed'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Example: Simulate runner addition
  const handleAddRunner = () => {
    trackRunnerAdd({
      runner_name: 'John Doe',
      team_id: 'team-123',
      runner_position: 1
    });
  };

  // Example: Simulate timer operations
  const handleTimerStart = () => {
    trackTimerStart({
      race_id: 'race-123',
      leg_number: 1,
      runner_id: 'runner-456'
    });
  };

  const handleTimerStop = () => {
    trackTimerStop({
      race_id: 'race-123',
      leg_number: 1,
      runner_id: 'runner-456',
      duration: 1800000 // 30 minutes in ms
    });
  };

  // Example: Set user context
  const handleSetUser = () => {
    setUserId('user-123');
    trackFeature('user', 'user_identified', {
      user_id: 'user-123',
      user_type: 'team_captain'
    });
  };

  // Example: Track custom performance metric
  const handleTrackPerformance = () => {
    trackPerformance({
      metric_name: 'custom_operation',
      value: 250,
      unit: 'ms'
    });
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold">Analytics Integration Example</h2>
      
      <div className="space-y-2">
        <button
          onClick={handleCreateRace}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {isLoading ? 'Creating Race...' : 'Create Race (with Analytics)'}
        </button>

        <button
          onClick={handleAddRunner}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          Add Runner
        </button>

        <button
          onClick={handleTimerStart}
          className="px-4 py-2 bg-yellow-500 text-white rounded"
        >
          Start Timer
        </button>

        <button
          onClick={handleTimerStop}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          Stop Timer
        </button>

        <button
          onClick={handleSetUser}
          className="px-4 py-2 bg-purple-500 text-white rounded"
        >
          Set User Context
        </button>

        <button
          onClick={handleTrackPerformance}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Track Performance
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          Error: {error}
        </div>
      )}

      <div className="mt-6 p-4 bg-gray-100 rounded">
        <h3 className="font-semibold mb-2">Analytics Events Tracked:</h3>
        <ul className="text-sm space-y-1">
          <li>• Component mount/unmount</li>
          <li>• Race creation with performance measurement</li>
          <li>• Runner addition</li>
          <li>• Timer start/stop</li>
          <li>• User identification</li>
          <li>• Custom performance metrics</li>
          <li>• Error tracking (analytics + Sentry)</li>
        </ul>
      </div>
    </div>
  );
}

export default AnalyticsExample;
