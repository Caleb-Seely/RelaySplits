import { useState, useEffect } from 'react';
import { pwaManager } from '@/utils/serviceWorker';

export const usePWA = () => {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Check initial state
    setCanInstall(pwaManager.canInstall());

    // Listen for changes
    const handleInstallStateChange = (canInstall: boolean) => {
      setCanInstall(canInstall);
    };

    pwaManager.onInstallStateChange(handleInstallStateChange);

    return () => {
      // Cleanup would go here if needed
    };
  }, []);

  const install = async () => {
    if (!canInstall) return false;
    
    setIsInstalling(true);
    try {
      const success = await pwaManager.install();
      return success;
    } catch (error) {
      console.error('PWA installation failed:', error);
      return false;
    } finally {
      setIsInstalling(false);
    }
  };

  return {
    canInstall,
    isInstalling,
    install
  };
};
