import { useState, useEffect } from 'react';
import { pwaManager } from '@/utils/serviceWorker';

export const usePWA = () => {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    console.log('[usePWA] Hook initialized');
    
    // Check initial state
    const initialCanInstall = pwaManager.canInstall();
    console.log('[usePWA] Initial canInstall state:', initialCanInstall);
    setCanInstall(initialCanInstall);

    // Listen for changes
    const handleInstallStateChange = (canInstall: boolean) => {
      console.log('[usePWA] Install state changed to:', canInstall);
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
