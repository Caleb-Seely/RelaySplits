import { useEffect, useRef } from 'react';
import { useRaceStore } from '@/store/raceStore';
import { notificationManager, generateStartNotification, generateFinishNotification } from '@/utils/notifications';

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

    // Check for start time changes (runner starting)
    currentLegs.forEach((currentLeg) => {
      const prevLeg = prevLegs.find(l => l.id === currentLeg.id);
      if (!prevLeg) return;

      // Check if a runner just started (actualStart was added)
      if (currentLeg.actualStart && !prevLeg.actualStart) {
        const runner = runners.find(r => r.id === currentLeg.runnerId);
        if (runner) {
          const notificationKey = `start_${currentLeg.id}`;
          
          // Only send notification if we haven't already sent one for this leg
          if (!sentNotificationsRef.current.has(notificationKey)) {
            const isFirstLeg = currentLeg.id === 1;
            const notification = generateStartNotification(runner.name, currentLeg.id, isFirstLeg);
            
            notificationManager.showNotification(notification).then(() => {
              console.log(`[useNotifications] Sent start notification for ${runner.name} on Leg ${currentLeg.id}`);
              sentNotificationsRef.current.add(notificationKey);
            });
          }
        }
      }
    });

    // Check for finish time changes (runner finishing)
    currentLegs.forEach((currentLeg) => {
      const prevLeg = prevLegs.find(l => l.id === currentLeg.id);
      if (!prevLeg) return;

      // Check if a runner just finished (actualFinish was added)
      if (currentLeg.actualFinish && !prevLeg.actualFinish) {
        const runner = runners.find(r => r.id === currentLeg.runnerId);
        if (runner) {
          const notificationKey = `finish_${currentLeg.id}`;
          
          // Only send notification if we haven't already sent one for this leg
          if (!sentNotificationsRef.current.has(notificationKey)) {
            const isFinalLeg = currentLeg.id === 36; // Assuming 36 legs total
            
            // Find next runner if not final leg
            let nextRunner = null;
            let nextLeg = null;
            if (!isFinalLeg) {
              nextLeg = currentLegs.find(l => l.id === currentLeg.id + 1);
              if (nextLeg) {
                nextRunner = runners.find(r => r.id === nextLeg.runnerId);
              }
            }

            const notification = generateFinishNotification(
              runner.name,
              currentLeg.id,
              nextRunner?.name,
              nextLeg?.id,
              isFinalLeg
            );
            
            notificationManager.showNotification(notification).then(() => {
              console.log(`[useNotifications] Sent finish notification for ${runner.name} on Leg ${currentLeg.id}`);
              sentNotificationsRef.current.add(notificationKey);
            });
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
