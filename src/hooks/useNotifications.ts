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
  deviceId?: string; // Track which device sent the notification
}

// Enhanced notification state tracking
interface NotificationState {
  lastProcessedLegs: Map<number, { actualStart?: number; actualFinish?: number }>;
  lastProcessedTime: number;
  isProcessing: boolean;
  pendingNotifications: Array<{
    type: 'first_leg_start' | 'finish' | 'handoff';
    legId: number;
    runnerName: string;
    nextRunnerName?: string;
    timestamp: number;
  }>;
}

export const useNotifications = () => {
  const { legs, runners, teamId } = useRaceStore();
  const { deviceInfo } = useTeam();
  const prevLegsRef = useRef(legs);
  const isInitialized = useRef(false);
  const isPageVisible = useRef(true);
  
  // Enhanced state tracking
  const notificationState = useRef<NotificationState>({
    lastProcessedLegs: new Map(),
    lastProcessedTime: 0,
    isProcessing: false,
    pendingNotifications: []
  });
  
  // Persistent storage key for notification history
  const getNotificationHistoryKey = useCallback(() => {
    return `relay_notifications_${teamId || 'no-team'}`;
  }, [teamId]);

  // Enhanced deduplication with device tracking
  const getNotificationDeduplicationKey = useCallback((
    type: 'first_leg_start' | 'finish' | 'handoff',
    legId: number,
    runnerName: string,
    nextRunnerName?: string
  ): string => {
    return `${type}-${legId}-${runnerName}-${nextRunnerName || ''}`;
  }, []);

  // Monitor page visibility changes with enhanced logging
  useEffect(() => {
    const handleVisibilityChange = () => {
      const wasVisible = isPageVisible.current;
      isPageVisible.current = !document.hidden;
      
      // Process any pending notifications when page becomes hidden
      if (!isPageVisible.current && notificationState.current.pendingNotifications.length > 0) {
        processPendingNotifications();
      }
    };

    // Set initial visibility state
    isPageVisible.current = !document.hidden;
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Load notification history from localStorage with enhanced error handling
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
          console.log(`[useNotifications] Cleaned up ${history.length - filtered.length} old notification records`);
        }
        
        return filtered;
      }
    } catch (error) {
      console.error('[useNotifications] Error loading notification history:', error);
    }
    return [];
  }, [teamId, getNotificationHistoryKey]);

  // Save notification record to localStorage with device tracking
  const saveNotificationRecord = useCallback((record: NotificationRecord) => {
    if (!teamId) return;
    
    try {
      const history = loadNotificationHistory();
      const enhancedRecord = {
        ...record,
        deviceId: deviceInfo?.deviceId || 'unknown'
      };
      history.push(enhancedRecord);
      
      // Keep only the last 100 records to prevent localStorage bloat
      if (history.length > 100) {
        history.splice(0, history.length - 100);
      }
      
      localStorage.setItem(getNotificationHistoryKey(), JSON.stringify(history));
      console.log(`[useNotifications] Saved notification record: ${enhancedRecord.type} for leg ${enhancedRecord.legId}`);
    } catch (error) {
      console.error('[useNotifications] Error saving notification record:', error);
    }
  }, [teamId, loadNotificationHistory, getNotificationHistoryKey, deviceInfo?.deviceId]);

  // Enhanced duplicate detection with time window and device tracking
  const wasNotificationSent = useCallback((
    type: 'first_leg_start' | 'finish' | 'handoff',
    legId: number,
    runnerName: string,
    nextRunnerName?: string
  ): boolean => {
    const history = loadNotificationHistory();
    const dedupKey = getNotificationDeduplicationKey(type, legId, runnerName, nextRunnerName);
    
    // Look for a recent notification for this exact event
    // Use a 10-minute window to allow for slight timing differences and retries
    const cutoff = Date.now() - (10 * 60 * 1000);
    
    const recentNotification = history.find(record => 
      getNotificationDeduplicationKey(record.type, record.legId, record.runnerName, record.nextRunnerName) === dedupKey &&
      record.sentAt > cutoff
    );
    
    if (recentNotification) {
      console.log(`[useNotifications] Duplicate notification detected: ${dedupKey} (sent ${Math.round((Date.now() - recentNotification.sentAt) / 1000)}s ago)`);
    }
    
    return !!recentNotification;
  }, [loadNotificationHistory, getNotificationDeduplicationKey]);

  // Enhanced old event detection with configurable threshold
  const shouldSkipOldEvent = useCallback((eventTimestamp: number, thresholdMinutes: number = 15): boolean => {
    // Skip events older than threshold to prevent spam after refresh
    const cutoff = Date.now() - (thresholdMinutes * 60 * 1000);
    const shouldSkip = eventTimestamp < cutoff;
    
    if (shouldSkip) {
      console.log(`[useNotifications] Skipping old event: ${new Date(eventTimestamp).toISOString()} (${Math.round((Date.now() - eventTimestamp) / 1000)}s old, threshold: ${thresholdMinutes}m)`);
    }
    
    return shouldSkip;
  }, []);

  // Process pending notifications with rate limiting
  const processPendingNotifications = useCallback(async () => {
    if (notificationState.current.isProcessing) {
      console.log('[useNotifications] Already processing notifications, skipping');
      return;
    }
    
    if (notificationState.current.pendingNotifications.length === 0) {
      return;
    }
    
    notificationState.current.isProcessing = true;
    
    try {
      // Process notifications with a small delay between each to prevent overwhelming the system
      for (const pending of notificationState.current.pendingNotifications) {
        if (!wasNotificationSent(pending.type, pending.legId, pending.runnerName, pending.nextRunnerName)) {
          let notification;
          
          if (pending.type === 'first_leg_start') {
            notification = generateFirstLegStartNotification(pending.runnerName);
          } else if (pending.type === 'finish') {
            notification = generateFinishNotification(
              pending.runnerName,
              pending.legId,
              undefined,
              undefined,
              true
            );
          } else if (pending.type === 'handoff') {
            notification = generateFinishNotification(
              pending.runnerName,
              pending.legId,
              pending.nextRunnerName!,
              pending.legId + 1,
              false
            );
          }
          
          if (notification) {
            await notificationManager.showNotification(notification);
            saveNotificationRecord({
              type: pending.type,
              legId: pending.legId,
              runnerName: pending.runnerName,
              nextRunnerName: pending.nextRunnerName,
              timestamp: pending.timestamp,
              sentAt: Date.now()
            });
            console.log(`[useNotifications] Sent ${pending.type} notification for leg ${pending.legId}`);
          }
          
          // Small delay between notifications
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } finally {
      notificationState.current.pendingNotifications = [];
      notificationState.current.isProcessing = false;
    }
  }, [wasNotificationSent, saveNotificationRecord]);

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
        console.log(`[useNotifications] Cleaned up ${history.length - filtered.length} old notification records for team change`);
      }
    }
  }, [teamId, loadNotificationHistory, getNotificationHistoryKey]);

  // Save current state for background sync with enhanced data
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
        timestamp: Date.now(),
        deviceId: deviceInfo?.deviceId || 'unknown'
      };
      
      localStorage.setItem('relay_last_known_state', JSON.stringify(currentState));
      // Removed frequent logging - only log on errors
    } catch (error) {
      console.error('[useNotifications] Error saving state for background sync:', error);
    }
  }, [teamId, legs, runners, deviceInfo?.deviceId]);

  // Save state whenever legs or runners change
  useEffect(() => {
    saveCurrentStateForBackgroundSync();
  }, [saveCurrentStateForBackgroundSync]);

  // Enhanced leg change monitoring with better state tracking
  useEffect(() => {
    if (!isInitialized.current || legs.length === 0 || !teamId) {
      return;
    }
    
    // Only send notifications if user has enabled them
    if (!notificationManager.isNotificationPreferenceEnabled()) {
      return;
    }

    const prevLegs = prevLegsRef.current;
    const currentLegs = legs;
    const currentTime = Date.now();

    // Prevent processing the same leg changes multiple times
    if (currentTime - notificationState.current.lastProcessedTime < 1000) {
      return;
    }

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
            return;
          }

          // Get the event timestamp (when the start time was set)
          const eventTimestamp = currentLeg.actualStart;
          
          // Skip old events to prevent spam after refresh
          if (shouldSkipOldEvent(eventTimestamp, 15)) {
            return;
          }

          // Add to pending notifications instead of sending immediately
          notificationState.current.pendingNotifications.push({
            type: 'first_leg_start',
            legId: currentLeg.id,
            runnerName: runner.name,
            timestamp: eventTimestamp
          });
          
          // Queued first leg start notification
        }
      }

      // Check if a runner just finished (actualFinish was added)
      if (currentLeg.actualFinish && !prevLeg.actualFinish) {
        const runner = runners.find(r => r.id === currentLeg.runnerId);
        if (runner) {
          // Skip notification if the current user is the one who performed this action
          if (deviceInfo?.displayName && runner.name === deviceInfo.displayName) {
            return;
          }

          // Get the event timestamp (when the finish time was set)
          const eventTimestamp = currentLeg.actualFinish;
          
          // Skip old events to prevent spam after refresh
          if (shouldSkipOldEvent(eventTimestamp, 15)) {
            return;
          }

          const isFinalLeg = currentLeg.id === 36; // Assuming 36 legs total
          
          // For final leg, send a finish notification (special case)
          if (isFinalLeg) {
            notificationState.current.pendingNotifications.push({
              type: 'finish',
              legId: currentLeg.id,
              runnerName: runner.name,
              timestamp: eventTimestamp
            });
            // Queued final leg finish notification
          }
          // For all other legs, send a handoff notification (combines finish + start)
          else {
            // Find next runner
            const nextLeg = currentLegs.find(l => l.id === currentLeg.id + 1);
            const nextRunner = nextLeg ? runners.find(r => r.id === nextLeg.runnerId) : null;
            
            if (nextRunner) {
              notificationState.current.pendingNotifications.push({
                type: 'handoff',
                legId: currentLeg.id,
                runnerName: runner.name,
                nextRunnerName: nextRunner.name,
                timestamp: eventTimestamp
              });
              // Queued handoff notification
            }
          }
        }
      }
    });

    // Update tracking state
    notificationState.current.lastProcessedTime = currentTime;
    currentLegs.forEach(leg => {
      notificationState.current.lastProcessedLegs.set(leg.id, {
        actualStart: leg.actualStart,
        actualFinish: leg.actualFinish
      });
    });

    // Process pending notifications if page is not visible
    if (!isPageVisible.current && notificationState.current.pendingNotifications.length > 0) {
      processPendingNotifications();
    }

    // Update ref for next comparison
    prevLegsRef.current = currentLegs;
  }, [legs, runners, teamId, deviceInfo?.displayName, shouldSkipOldEvent, processPendingNotifications]);

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
    getNotificationHistory,
    // New methods for debugging and control
    getPendingNotificationsCount: () => notificationState.current.pendingNotifications.length,
    forceProcessPendingNotifications: processPendingNotifications,
    getNotificationState: () => ({ ...notificationState.current })
  };
};
