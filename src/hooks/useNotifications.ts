import { useEffect, useRef } from 'react';
import { useRaceStore } from '@/store/raceStore';
import { notificationManager, generateStartNotification, generateFinishNotification, generateHandoffNotification } from '@/utils/notifications';

export const useNotifications = () => {
  const { legs, runners } = useRaceStore();
  const prevLegsRef = useRef(legs);
  const isInitialized = useRef(false);
  const sentNotificationsRef = useRef<Set<string>>(new Set()); // Track sent notifications to prevent duplicates

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

  // Monitor leg changes and trigger notifications
  useEffect(() => {
    if (!isInitialized.current || legs.length === 0) return;
    
    // Only send notifications if user has enabled them
    if (!notificationManager.isNotificationPreferenceEnabled()) return;

    const prevLegs = prevLegsRef.current;
    const currentLegs = legs;

    // Check for finish time changes (runner finishing) - this is where we send handoff notifications
    currentLegs.forEach((currentLeg) => {
      const prevLeg = prevLegs.find(l => l.id === currentLeg.id);
      if (!prevLeg) return;

      // Check if a runner just finished (actualFinish was added)
      if (currentLeg.actualFinish && !prevLeg.actualFinish) {
        const runner = runners.find(r => r.id === currentLeg.runnerId);
        if (runner) {
          const isFinalLeg = currentLeg.id === 36; // Assuming 36 legs total
          const isFirstLeg = currentLeg.id === 1;
          
          // For first leg, send a start notification (special case)
          if (isFirstLeg) {
            const notificationKey = `start_${currentLeg.id}`;
            if (!sentNotificationsRef.current.has(notificationKey)) {
              const notification = generateStartNotification(runner.name, currentLeg.id, true);
              notificationManager.showNotification(notification).then(() => {
                console.log(`[useNotifications] Sent first leg start notification for ${runner.name}`);
                sentNotificationsRef.current.add(notificationKey);
              });
            }
          }
          // For final leg, send a finish notification (special case)
          else if (isFinalLeg) {
            const notificationKey = `finish_${currentLeg.id}`;
            if (!sentNotificationsRef.current.has(notificationKey)) {
              const notification = generateFinishNotification(
                runner.name,
                currentLeg.id,
                undefined,
                undefined,
                true
              );
              notificationManager.showNotification(notification).then(() => {
                console.log(`[useNotifications] Sent final leg finish notification for ${runner.name}`);
                sentNotificationsRef.current.add(notificationKey);
              });
            }
          }
          // For all other legs, send a handoff notification (combines finish + start)
          else {
            const notificationKey = `handoff_${currentLeg.id}`;
            if (!sentNotificationsRef.current.has(notificationKey)) {
              // Find next runner
              const nextLeg = currentLegs.find(l => l.id === currentLeg.id + 1);
              const nextRunner = nextLeg ? runners.find(r => r.id === nextLeg.runnerId) : null;
              
              if (nextRunner) {
                const notification = generateHandoffNotification(
                  runner.name,
                  currentLeg.id,
                  nextRunner.name,
                  nextLeg.id
                );
                notificationManager.showNotification(notification).then(() => {
                  console.log(`[useNotifications] Sent handoff notification: ${runner.name} → ${nextRunner.name}`);
                  sentNotificationsRef.current.add(notificationKey);
                });
              }
            }
          }
        }
      }
    });

    // Update ref for next comparison
    prevLegsRef.current = currentLegs;
  }, [legs, runners]);

  // Return notification manager methods for manual control
  return {
    notificationManager,
    isSupported: notificationManager.isSupported(),
    getPermission: notificationManager.getPermission.bind(notificationManager),
    requestPermission: notificationManager.requestPermission.bind(notificationManager),
    isNotificationPreferenceEnabled: notificationManager.isNotificationPreferenceEnabled.bind(notificationManager),
    clearNotificationPreference: notificationManager.clearNotificationPreference.bind(notificationManager),
    setNotificationPreference: notificationManager.setNotificationPreference.bind(notificationManager)
  };
};
