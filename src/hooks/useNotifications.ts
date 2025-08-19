import { useEffect, useRef, useCallback } from 'react';
import { useRaceStore } from '@/store/raceStore';
import { useTeam } from '@/contexts/TeamContext';
import { notificationManager, generateFirstLegStartNotification, generateFinishNotification } from '@/utils/notifications';

// Interface for stored notification records
interface NotificationRecord {
  type: 'first_leg_start' | 'finish' | 'handoff';
  legId: number;
  runnerName: string;
  nextRunnerName?: string;
  timestamp: number; // When the event actually happened
  sentAt: number; // When we sent the notification
}

export const useNotifications = () => {
  const { legs, runners, teamId } = useRaceStore();
  const { deviceInfo } = useTeam();
  const prevLegsRef = useRef(legs);
  const isInitialized = useRef(false);
  const isPageVisible = useRef(true);
  
  // Persistent storage key for notification history
  const getNotificationHistoryKey = useCallback(() => {
    return `relay_notifications_${teamId || 'no-team'}`;
  }, [teamId]);

  // Monitor page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      isPageVisible.current = !document.hidden;
      console.log(`[useNotifications] Page visibility changed: ${isPageVisible.current ? 'visible' : 'hidden'}`);
    };

    // Set initial visibility state
    isPageVisible.current = !document.hidden;
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Load notification history from localStorage
  const loadNotificationHistory = useCallback((): NotificationRecord[] => {
    if (!teamId) return [];
    
    try {
      const stored = localStorage.getItem(getNotificationHistoryKey());
      if (stored) {
        const history = JSON.parse(stored) as NotificationRecord[];
        // Clean up old records (older than 24 hours)
        const cutoff = Date.now() - (24 * 60 * 60 * 1000);
        const filtered = history.filter(record => record.sentAt > cutoff);
        
        // Update storage with cleaned data
        if (filtered.length !== history.length) {
          localStorage.setItem(getNotificationHistoryKey(), JSON.stringify(filtered));
        }
        
        return filtered;
      }
    } catch (error) {
      console.error('[useNotifications] Error loading notification history:', error);
    }
    return [];
  }, [teamId, getNotificationHistoryKey]);

  // Save notification record to localStorage
  const saveNotificationRecord = useCallback((record: NotificationRecord) => {
    if (!teamId) return;
    
    try {
      const history = loadNotificationHistory();
      history.push(record);
      
      // Keep only the last 100 records to prevent localStorage bloat
      if (history.length > 100) {
        history.splice(0, history.length - 100);
      }
      
      localStorage.setItem(getNotificationHistoryKey(), JSON.stringify(history));
    } catch (error) {
      console.error('[useNotifications] Error saving notification record:', error);
    }
  }, [teamId, loadNotificationHistory, getNotificationHistoryKey]);

  // Check if notification was already sent for this event
  const wasNotificationSent = useCallback((
    type: 'first_leg_start' | 'finish' | 'handoff',
    legId: number,
    runnerName: string,
    nextRunnerName?: string
  ): boolean => {
    const history = loadNotificationHistory();
    
    // Look for a recent notification for this exact event
    // Use a 5-minute window to allow for slight timing differences
    const cutoff = Date.now() - (5 * 60 * 1000);
    
    return history.some(record => 
      record.type === type &&
      record.legId === legId &&
      record.runnerName === runnerName &&
      record.nextRunnerName === nextRunnerName &&
      record.sentAt > cutoff
    );
  }, [loadNotificationHistory]);

  // Check if we should skip notification based on event age
  const shouldSkipOldEvent = useCallback((eventTimestamp: number): boolean => {
    // Skip events older than 10 minutes to prevent spam after refresh
    const cutoff = Date.now() - (10 * 60 * 1000);
    const shouldSkip = eventTimestamp < cutoff;
    
    if (shouldSkip) {
      console.log(`[useNotifications] Skipping old event: ${new Date(eventTimestamp).toISOString()} (${Math.round((Date.now() - eventTimestamp) / 1000)}s old)`);
    }
    
    return shouldSkip;
  }, []);

  // Get notification history for debugging
  const getNotificationHistory = useCallback((): NotificationRecord[] => {
    return loadNotificationHistory();
  }, [loadNotificationHistory]);

  // Initialize notification manager (but don't request permission automatically)
  useEffect(() => {
    if (!isInitialized.current) {
      notificationManager.initialize().then((success) => {
        if (success) {
          console.log('[useNotifications] Notification system initialized successfully');
        } else {
          console.log('[useNotifications] Notification system initialization failed');
        }
      });
      isInitialized.current = true;
    }
  }, []);

  // Clean up old notification history when team changes
  useEffect(() => {
    if (teamId) {
      // Clean up old records when team changes
      const history = loadNotificationHistory();
      const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
      const filtered = history.filter(record => record.sentAt > cutoff);
      
      if (filtered.length !== history.length) {
        localStorage.setItem(getNotificationHistoryKey(), JSON.stringify(filtered));
        console.log(`[useNotifications] Cleaned up ${history.length - filtered.length} old notification records`);
      }
    }
  }, [teamId, loadNotificationHistory, getNotificationHistoryKey]);

  // Save current state for background sync
  const saveCurrentStateForBackgroundSync = useCallback(() => {
    if (!teamId || legs.length === 0) return;
    
    try {
      const currentState = {
        legs: legs.map(leg => ({
          number: leg.id,
          runner_id: leg.runnerId,
          actual_start: leg.actualStart,
          actual_finish: leg.actualFinish,
          distance: leg.distance
        })),
        runners: runners.map(runner => ({
          id: runner.id,
          name: runner.name,
          pace: runner.pace,
          van: runner.van
        })),
        timestamp: Date.now()
      };
      
      localStorage.setItem('relay_last_known_state', JSON.stringify(currentState));
      console.log('[useNotifications] Saved current state for background sync');
    } catch (error) {
      console.error('[useNotifications] Error saving state for background sync:', error);
    }
  }, [teamId, legs, runners]);

  // Save state whenever legs or runners change
  useEffect(() => {
    saveCurrentStateForBackgroundSync();
  }, [saveCurrentStateForBackgroundSync]);

  // Monitor leg changes and trigger notifications
  useEffect(() => {
    if (!isInitialized.current || legs.length === 0 || !teamId) {
      console.log('[useNotifications] Skipping notification check - not initialized, no legs, or no team');
      return;
    }
    
    // Only send notifications if user has enabled them
    if (!notificationManager.isNotificationPreferenceEnabled()) {
      console.log('[useNotifications] Notifications disabled by user preference');
      return;
    }

    console.log(`[useNotifications] Checking for notifications - Page visible: ${isPageVisible.current}, Legs: ${legs.length}`);

    const prevLegs = prevLegsRef.current;
    const currentLegs = legs;

    // Check for start and finish time changes
    currentLegs.forEach((currentLeg) => {
      const prevLeg = prevLegs.find(l => l.id === currentLeg.id);
      if (!prevLeg) return;

      // Check if a runner just started (actualStart was added) - only for first leg
      if (currentLeg.actualStart && !prevLeg.actualStart && currentLeg.id === 1) {
        const runner = runners.find(r => r.id === currentLeg.runnerId);
        if (runner) {
          // Skip notification if the current user is the one who performed this action
          if (deviceInfo?.displayName && runner.name === deviceInfo.displayName) {
            console.log(`[useNotifications] Skipping notification for current user's action: ${runner.name}`);
            return;
          }

          // Get the event timestamp (when the start time was set)
          const eventTimestamp = currentLeg.actualStart;
          
          // Skip old events to prevent spam after refresh
          if (shouldSkipOldEvent(eventTimestamp)) {
            console.log(`[useNotifications] Skipping old event for leg ${currentLeg.id} (${runner.name})`);
            return;
          }

          // Only send notifications when the page is NOT visible (app is in background)
          if (isPageVisible.current) {
            console.log(`[useNotifications] Page is visible, skipping notification for leg ${currentLeg.id} (${runner.name})`);
            return;
          }

          // Send start notification for first leg only
          if (!wasNotificationSent('first_leg_start', currentLeg.id, runner.name)) {
            const notification = generateFirstLegStartNotification(runner.name);
            notificationManager.showNotification(notification).then(() => {
              console.log(`[useNotifications] Sent first leg start notification for ${runner.name}`);
              saveNotificationRecord({
                type: 'first_leg_start',
                legId: currentLeg.id,
                runnerName: runner.name,
                timestamp: eventTimestamp,
                sentAt: Date.now()
              });
            });
          } else {
            console.log(`[useNotifications] First leg start notification already sent for leg ${currentLeg.id} (${runner.name})`);
          }
        }
      }

      // Check if a runner just finished (actualFinish was added)
      if (currentLeg.actualFinish && !prevLeg.actualFinish) {
        const runner = runners.find(r => r.id === currentLeg.runnerId);
        if (runner) {
          // Skip notification if the current user is the one who performed this action
          if (deviceInfo?.displayName && runner.name === deviceInfo.displayName) {
            console.log(`[useNotifications] Skipping notification for current user's action: ${runner.name}`);
            return;
          }

          // Get the event timestamp (when the finish time was set)
          const eventTimestamp = currentLeg.actualFinish;
          
          // Skip old events to prevent spam after refresh
          if (shouldSkipOldEvent(eventTimestamp)) {
            console.log(`[useNotifications] Skipping old event for leg ${currentLeg.id} (${runner.name})`);
            return;
          }

          // Only send notifications when the page is NOT visible (app is in background)
          if (isPageVisible.current) {
            console.log(`[useNotifications] Page is visible, skipping notification for leg ${currentLeg.id} (${runner.name})`);
            return;
          }

          const isFinalLeg = currentLeg.id === 36; // Assuming 36 legs total
          
          // For final leg, send a finish notification (special case)
          if (isFinalLeg) {
            if (!wasNotificationSent('finish', currentLeg.id, runner.name)) {
              const notification = generateFinishNotification(
                runner.name,
                currentLeg.id,
                undefined,
                undefined,
                true
              );
              notificationManager.showNotification(notification).then(() => {
                console.log(`[useNotifications] Sent final leg finish notification for ${runner.name}`);
                saveNotificationRecord({
                  type: 'finish',
                  legId: currentLeg.id,
                  runnerName: runner.name,
                  timestamp: eventTimestamp,
                  sentAt: Date.now()
                });
              });
            } else {
              console.log(`[useNotifications] Finish notification already sent for leg ${currentLeg.id} (${runner.name})`);
            }
          }
          // For all other legs, send a handoff notification (combines finish + start)
          else {
            // Find next runner
            const nextLeg = currentLegs.find(l => l.id === currentLeg.id + 1);
            const nextRunner = nextLeg ? runners.find(r => r.id === nextLeg.runnerId) : null;
            
            if (nextRunner && nextLeg && !wasNotificationSent('handoff', currentLeg.id, runner.name, nextRunner.name)) {
              const notification = generateFinishNotification(
                runner.name,
                currentLeg.id,
                nextRunner.name,
                nextLeg.id,
                false // Not the final leg
              );
              notificationManager.showNotification(notification).then(() => {
                console.log(`[useNotifications] Sent handoff notification: ${runner.name} → ${nextRunner.name}`);
                saveNotificationRecord({
                  type: 'handoff',
                  legId: currentLeg.id,
                  runnerName: runner.name,
                  nextRunnerName: nextRunner.name,
                  timestamp: eventTimestamp,
                  sentAt: Date.now()
                });
              });
            } else if (nextRunner) {
              console.log(`[useNotifications] Handoff notification already sent for leg ${currentLeg.id} (${runner.name} → ${nextRunner.name})`);
            }
          }
        }
      }
    });

    // Update ref for next comparison
    prevLegsRef.current = currentLegs;
  }, [legs, runners, teamId, deviceInfo?.displayName, wasNotificationSent, shouldSkipOldEvent, saveNotificationRecord]);

  // Clear notification history for current team
  const clearNotificationHistory = useCallback(() => {
    if (!teamId) return;
    
    try {
      localStorage.removeItem(getNotificationHistoryKey());
      console.log('[useNotifications] Cleared notification history for team:', teamId);
    } catch (error) {
      console.error('[useNotifications] Error clearing notification history:', error);
    }
  }, [teamId, getNotificationHistoryKey]);

  // Return notification manager methods for manual control
  return {
    notificationManager,
    isSupported: notificationManager.isSupported(),
    getPermission: notificationManager.getPermission.bind(notificationManager),
    requestPermission: notificationManager.requestPermission.bind(notificationManager),
    isNotificationPreferenceEnabled: notificationManager.isNotificationPreferenceEnabled.bind(notificationManager),
    clearNotificationPreference: notificationManager.clearNotificationPreference.bind(notificationManager),
    setNotificationPreference: notificationManager.setNotificationPreference.bind(notificationManager),
    getNotificationPreferenceValue: notificationManager.getNotificationPreferenceValue.bind(notificationManager),
    resetNotificationPreference: notificationManager.resetNotificationPreference.bind(notificationManager),
    clearNotificationHistory,
    getNotificationHistory
  };
};
