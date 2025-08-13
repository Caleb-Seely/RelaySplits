import { useCallback, useEffect, useState } from 'react';
import { useRaceStore } from '@/store/raceStore';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamSync } from '@/hooks/useTeamSync';

// Offline data management hook
export const useOfflineData = () => {
  const raceStore = useRaceStore();
  const { user } = useAuth();
  const { team } = useTeamSync();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineChangesCount, setOfflineChangesCount] = useState(0);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('🌐 [OFFLINE] Connection restored');
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('📴 [OFFLINE] Connection lost - working offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check for offline changes
  const checkOfflineChanges = useCallback(() => {
    if (!team?.id) return 0;

    try {
      const offlineChangesKey = `relay_tracker_${team.id}_offline_changes`;
      const offlineChanges = localStorage.getItem(offlineChangesKey);
      if (offlineChanges) {
        const changes = JSON.parse(offlineChanges);
        return changes.length;
      }
    } catch (error) {
      console.warn('Error checking offline changes:', error);
    }
    return 0;
  }, [team?.id]);

  // Update offline changes count when team changes
  useEffect(() => {
    if (team?.id) {
      const count = checkOfflineChanges();
      setOfflineChangesCount(count);
    }
  }, [team?.id, checkOfflineChanges]);

  // Save current state to localStorage for offline persistence
  const saveCurrentState = useCallback(() => {
    const storageKey = team?.id && raceStore.teamId === team.id ? team.id : 'local';

    try {
      // Save runners
      localStorage.setItem(
        `relay_tracker_${storageKey}_runners`,
        JSON.stringify(raceStore.runners)
      );

      // Save legs if they exist
      localStorage.setItem(
        `relay_tracker_${storageKey}_legs`,
        JSON.stringify(raceStore.legs)
      );

      // Save setup status
      localStorage.setItem(
        `relay_tracker_${storageKey}_setup`,
        JSON.stringify({ isSetupComplete: raceStore.isSetupComplete })
      );

      // console.log('💾 [OFFLINE] State saved to localStorage');
    } catch (error) {
      console.warn('Failed to save state to localStorage:', error);
    }
  }, [team?.id, raceStore.teamId, raceStore.runners, raceStore.legs, raceStore.isSetupComplete]);

  // Load state from localStorage for offline recovery
  const loadOfflineState = useCallback(() => {
    if (!team?.id) return null;

    try {
      const runners = localStorage.getItem(`relay_tracker_${team.id}_runners`);
      const legs = localStorage.getItem(`relay_tracker_${team.id}_legs`);
      const setup = localStorage.getItem(`relay_tracker_${team.id}_setup`);

      if (runners) {
        const parsedRunners = JSON.parse(runners);
        const parsedLegs = legs ? JSON.parse(legs) : [];
        const parsedSetup = setup ? JSON.parse(setup) : { isSetupComplete: false };

        return {
          runners: parsedRunners,
          legs: parsedLegs,
          isSetupComplete: parsedSetup.isSetupComplete
        };
      }
    } catch (error) {
      console.warn('Failed to load state from localStorage:', error);
    }
    return null;
  }, [team?.id]);

  // Queue a change for offline processing
  const queueOfflineChange = useCallback((change: { type: string; data: any }) => {
    if (!team?.id) return;

    try {
      const offlineChangesKey = `relay_tracker_${team.id}_offline_changes`;
      const existingChanges = JSON.parse(localStorage.getItem(offlineChangesKey) || '[]');
      
      const newChange = {
        ...change,
        id: `${Date.now()}_${Math.random()}`,
        timestamp: Date.now()
      };
      
      existingChanges.push(newChange);
      localStorage.setItem(offlineChangesKey, JSON.stringify(existingChanges));
      
      setOfflineChangesCount(existingChanges.length);
      console.log('📝 [OFFLINE] Change queued for later sync');
    } catch (error) {
      console.warn('Failed to queue offline change:', error);
    }
  }, [team?.id]);

  // Auto-save state when data changes (always, debounced)
  useEffect(() => {
    if (team?.id && raceStore.teamId === team.id) {
      const timeoutId = setTimeout(saveCurrentState, 800);
      return () => clearTimeout(timeoutId);
    }
  }, [team?.id, raceStore.teamId, raceStore.runners, raceStore.legs, raceStore.isSetupComplete, saveCurrentState]);

  // Auto-save when going offline
  useEffect(() => {
    if (!isOnline && team?.id && raceStore.teamId === team.id) {
      saveCurrentState();
    }
  }, [isOnline, team?.id, raceStore.teamId, saveCurrentState]);

  return {
    isOnline,
    offlineChangesCount,
    saveCurrentState,
    loadOfflineState,
    queueOfflineChange,
    checkOfflineChanges
  };
}; 