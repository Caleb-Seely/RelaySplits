import { useEffect, useRef, useCallback } from 'react';

import { useRaceStore } from '@/store/raceStore';
import { useTeam } from '@/contexts/TeamContext';
import { eventBus, EVENT_TYPES } from '@/utils/eventBus';
import { notificationManager, generateFirstLegStartNotification, generateFinishNotification } from '@/utils/notifications';

// Interface for notification events
interface NotificationEvent {
  type: 'first_leg_start' | 'finish' | 'handoff';
  legId: number;
  runnerName: string;
  nextRunnerName?: string;
  timestamp: number;
  deviceId?: string;
}

// Enhanced notification state tracking
interface NotificationState {
  lastProcessedEvents: Map<string, number>; // key: `${type}-${legId}-${runnerName}`
  isProcessing: boolean;
  pendingNotifications: NotificationEvent[];
  isEnabled: boolean;
}

export const useDecoupledNotifications = () => {
  const { legs, runners, teamId } = useRaceStore();
  const { deviceInfo } = useTeam();
  const prevLegsRef = useRef(legs);
  const isInitialized = useRef(false);
  const isPageVisible = useRef(true);
  
  // Enhanced state tracking
  const notificationState = useRef<NotificationState>({
    lastProcessedEvents: new Map(),
    isProcessing: false,
    pendingNotifications: [],
    isEnabled: false
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

  // Monitor page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      const wasVisible = isPageVisible.current;
      isPageVisible.current = !document.hidden;
      
      // Publish visibility change event
      eventBus.publish({
        type: EVENT_TYPES.APP_VISIBILITY_CHANGE,
        payload: { isVisible: isPageVisible.current, wasVisible },
        priority: 'low',
        source: 'useDecoupledNotifications'
      });
      
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

  // Load notification history from localStorage
  const loadNotificationHistory = useCallback((): NotificationEvent[] => {
    if (!teamId) return [];
    
    try {
      const stored = localStorage.getItem(getNotificationHistoryKey());
      if (stored) {
        const history = JSON.parse(stored) as NotificationEvent[];
        // Clean up old records (older than 24 hours)
        const cutoff = Date.now() - (24 * 60 * 60 * 1000);
        const filtered = history.filter(record => record.timestamp > cutoff);
        
        // Update storage with cleaned data
        if (filtered.length !== history.length) {
          localStorage.setItem(getNotificationHistoryKey(), JSON.stringify(filtered));
          console.log(`[useDecoupledNotifications] Cleaned up ${history.length - filtered.length} old notification records`);
        }
        
        return filtered;
      }
    } catch (error) {
      console.error('[useDecoupledNotifications] Error loading notification history:', error);
    }
    return [];
  }, [teamId, getNotificationHistoryKey]);

  // Save notification record to localStorage
  const saveNotificationRecord = useCallback((record: NotificationEvent) => {
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
      console.log(`[useDecoupledNotifications] Saved notification record: ${enhancedRecord.type} for leg ${enhancedRecord.legId}`);
    } catch (error) {
      console.error('[useDecoupledNotifications] Error saving notification record:', error);
    }
  }, [teamId, loadNotificationHistory, getNotificationHistoryKey, deviceInfo?.deviceId]);

  // Enhanced duplicate detection
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
      record.timestamp > cutoff
    );
    
    if (recentNotification) {
      console.log(`[useDecoupledNotifications] Duplicate notification detected: ${dedupKey} (sent ${Math.round((Date.now() - recentNotification.timestamp) / 1000)}s ago)`);
    }
    
    return !!recentNotification;
  }, [loadNotificationHistory, getNotificationDeduplicationKey]);

  // Enhanced old event detection
  const shouldSkipOldEvent = useCallback((eventTimestamp: number, thresholdMinutes: number = 15): boolean => {
    // Skip events older than threshold to prevent spam after refresh
    const cutoff = Date.now() - (thresholdMinutes * 60 * 1000);
    const shouldSkip = eventTimestamp < cutoff;
    
    if (shouldSkip) {
      console.log(`[useDecoupledNotifications] Skipping old event: ${new Date(eventTimestamp).toISOString()} (${Math.round((Date.now() - eventTimestamp) / 1000)}s old, threshold: ${thresholdMinutes}m)`);
    }
    
    return shouldSkip;
  }, []);

  // Process pending notifications with rate limiting
  const processPendingNotifications = useCallback(async () => {
    console.log('[useDecoupledNotifications] processPendingNotifications called, pending count:', notificationState.current.pendingNotifications.length);
    
    if (notificationState.current.isProcessing) {
      console.log('[useDecoupledNotifications] Already processing notifications, skipping');
      return;
    }
    
    if (notificationState.current.pendingNotifications.length === 0) {
      console.log('[useDecoupledNotifications] No pending notifications to process');
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
              timestamp: pending.timestamp
            });
            console.log(`[useDecoupledNotifications] Sent ${pending.type} notification for leg ${pending.legId}`);
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

  // Initialize notification manager
  useEffect(() => {
    if (!isInitialized.current) {
      notificationManager.initialize().then((success) => {
        if (success) {
          console.log('[useDecoupledNotifications] Notification system initialized successfully');
          notificationState.current.isEnabled = notificationManager.isNotificationPreferenceEnabled();
        } else {
          console.log('[useDecoupledNotifications] Notification system initialization failed');
        }
      });
      isInitialized.current = true;
    }
  }, []);

  // Subscribe to data events for notification processing
  useEffect(() => {
    if (!isInitialized.current || !notificationManager.isNotificationPreferenceEnabled()) {
      return;
    }

    // Subscribe to leg update events
    const unsubscribeLegUpdates = eventBus.subscribe(EVENT_TYPES.LEG_UPDATE, (event) => {
      const { legId, field, value, previousValue } = event.payload;
      
      console.log('[useDecoupledNotifications] Received LEG_UPDATE event:', { legId, field, value, previousValue });
      
      // Only process if we have a value change
      if (value === previousValue) {
        console.log('[useDecoupledNotifications] Skipping event - no value change');
        return;
      }
      
      const currentLegs = legs;
      const prevLegs = prevLegsRef.current;
      
      // Find the leg that was updated
      const currentLeg = currentLegs.find(l => l.id === legId);
      const prevLeg = prevLegs.find(l => l.id === legId);
      
      if (!currentLeg || !prevLeg) return;
      
      // Check if a runner just started (actualStart was added) - only for first leg
      if (field === 'start' && currentLeg.actualStart && !prevLeg.actualStart && currentLeg.id === 1) {
        const runner = runners.find(r => r.id === currentLeg.runnerId);
        if (runner) {
          // Skip notification if the current user is the one who performed this action
          if (deviceInfo?.displayName && runner.name === deviceInfo.displayName) {
            console.log('[useDecoupledNotifications] Skipping first leg start notification - current user performed this action');
            return;
          }

          // Get the event timestamp (when the start time was set)
          const eventTimestamp = currentLeg.actualStart;
          
          // Skip old events to prevent spam after refresh
          if (shouldSkipOldEvent(eventTimestamp, 15)) {
            return;
          }

          // Add to pending notifications
          notificationState.current.pendingNotifications.push({
            type: 'first_leg_start',
            legId: currentLeg.id,
            runnerName: runner.name,
            timestamp: eventTimestamp
          });
          
          console.log('[useDecoupledNotifications] Queued first leg start notification');
          
          // Process notifications immediately if page is not visible
          if (!isPageVisible.current) {
            console.log('[useDecoupledNotifications] Processing notifications immediately due to page not being visible');
            processPendingNotifications();
          } else {
            // For testing: also process when page is visible (remove this in production)
            console.log('[useDecoupledNotifications] Processing notifications immediately for testing (page visible)');
            processPendingNotifications();
          }
        }
      }

      // Check if a runner just finished (actualFinish was added)
      if (field === 'finish' && currentLeg.actualFinish && !prevLeg.actualFinish) {
        const runner = runners.find(r => r.id === currentLeg.runnerId);
        if (runner) {
          // Skip notification if the current user is the one who performed this action
          if (deviceInfo?.displayName && runner.name === deviceInfo.displayName) {
            console.log('[useDecoupledNotifications] Skipping finish notification - current user performed this action');
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
            console.log('[useDecoupledNotifications] Queued final leg finish notification');
            
            // Process notifications immediately if page is not visible
            if (!isPageVisible.current) {
              console.log('[useDecoupledNotifications] Processing notifications immediately due to page not being visible');
              processPendingNotifications();
            } else {
              // For testing: also process when page is visible (remove this in production)
              console.log('[useDecoupledNotifications] Processing notifications immediately for testing (page visible)');
              processPendingNotifications();
            }
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
              console.log('[useDecoupledNotifications] Queued handoff notification');
              
              // Process notifications immediately if page is not visible
              if (!isPageVisible.current) {
                console.log('[useDecoupledNotifications] Processing notifications immediately due to page not being visible');
                processPendingNotifications();
              } else {
                // For testing: also process when page is visible (remove this in production)
                console.log('[useDecoupledNotifications] Processing notifications immediately for testing (page visible)');
                processPendingNotifications();
              }
            }
          }
        }
      }
    });

    return () => {
      unsubscribeLegUpdates();
    };
  }, [legs, runners, teamId, deviceInfo?.displayName, shouldSkipOldEvent]);

  // Process pending notifications when page is not visible
  useEffect(() => {
    console.log('[useDecoupledNotifications] Page visibility effect triggered, pageVisible:', isPageVisible.current, 'pendingCount:', notificationState.current.pendingNotifications.length);
    if (!isPageVisible.current && notificationState.current.pendingNotifications.length > 0) {
      console.log('[useDecoupledNotifications] Processing notifications due to page not being visible');
      processPendingNotifications();
    }
  }, [processPendingNotifications]);

  // Update ref for next comparison
  useEffect(() => {
    prevLegsRef.current = legs;
  }, [legs]);

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
    // New methods for debugging and control
    getPendingNotificationsCount: () => notificationState.current.pendingNotifications.length,
    forceProcessPendingNotifications: processPendingNotifications,
    getNotificationState: () => ({ ...notificationState.current })
  };
};
