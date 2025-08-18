import { useState, useEffect } from 'react';
import { useTeam } from '@/contexts/TeamContext';

export const useQuickHelp = () => {
  const { deviceInfo, isInTeam } = useTeam();
  const [shouldShowHelp, setShouldShowHelp] = useState(false);

  useEffect(() => {
    if (!isInTeam || !deviceInfo) {
      return;
    }

    // Check if this device has seen the help before
    const helpKey = `relay_help_completed_${deviceInfo.deviceId}`;
    const hasSeenHelp = localStorage.getItem(helpKey);
    
    if (!hasSeenHelp) {
      // Add a small delay to ensure Dashboard is fully loaded
      const timer = setTimeout(() => {
        setShouldShowHelp(true);
      }, 500); // 500ms delay

      return () => clearTimeout(timer);
    }
  }, [isInTeam, deviceInfo]);

  const dismissHelp = () => {
    if (deviceInfo) {
      // Mark this specific device as having seen the help
      const helpKey = `relay_help_completed_${deviceInfo.deviceId}`;
      try {
        localStorage.setItem(helpKey, 'true');
      } catch (error) {
        console.warn('Could not save help completion status:', error);
      }
    }
    setShouldShowHelp(false);
  };

  return {
    shouldShowHelp,
    dismissHelp
  };
};
