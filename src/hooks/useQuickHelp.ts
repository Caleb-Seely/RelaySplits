import { useState, useEffect } from 'react';
import { useTeam } from '@/contexts/TeamContext';

export const useQuickHelp = () => {
  const { deviceInfo, isInTeam } = useTeam();
  const [shouldShowHelp, setShouldShowHelp] = useState(false);

  useEffect(() => {
    console.log('[useQuickHelp] Effect triggered:', { isInTeam, deviceInfo });
    
    if (!isInTeam || !deviceInfo) {
      console.log('[useQuickHelp] Not in team or no device info, returning');
      return;
    }

    // Check if this device has seen the help before
    const helpKey = `relay_help_completed_${deviceInfo.deviceId}`;
    const hasSeenHelp = localStorage.getItem(helpKey);
    
    console.log('[useQuickHelp] Help status:', { helpKey, hasSeenHelp });
    
    if (!hasSeenHelp) {
      console.log('[useQuickHelp] Device has not seen help, will show after delay');
      // Add a small delay to ensure Dashboard is fully loaded
      const timer = setTimeout(() => {
        console.log('[useQuickHelp] Setting shouldShowHelp to true');
        setShouldShowHelp(true);
      }, 500); // 500ms delay

      return () => clearTimeout(timer);
    } else {
      console.log('[useQuickHelp] Device has already seen help');
    }
  }, [isInTeam, deviceInfo]);

  const dismissHelp = () => {
    console.log('[useQuickHelp] Dismissing help');
    if (deviceInfo) {
      // Mark this specific device as having seen the help
      const helpKey = `relay_help_completed_${deviceInfo.deviceId}`;
      try {
        localStorage.setItem(helpKey, 'true');
        console.log('[useQuickHelp] Saved help completion status');
      } catch (error) {
        console.warn('Could not save help completion status:', error);
      }
    }
    setShouldShowHelp(false);
  };

  console.log('[useQuickHelp] Current state:', { shouldShowHelp });

  return {
    shouldShowHelp,
    dismissHelp
  };
};
