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

    // Additional check for Android Chrome after user interaction
    const checkAndroidChromeInstall = () => {
      const userAgent = navigator.userAgent;
      const isAndroid = /Android/.test(userAgent);
      const isChrome = /Chrome/.test(userAgent);
      
      if (isAndroid && isChrome && !canInstall) {
        // On Android Chrome, we might need to wait for user engagement
        setTimeout(() => {
          const updatedCanInstall = pwaManager.canInstall();
          if (updatedCanInstall !== canInstall) {
            setCanInstall(updatedCanInstall);
          }
        }, 2000); // Check after 2 seconds of user interaction
      }
    };

    // Listen for user interaction to trigger Android Chrome install check
    const events = ['click', 'scroll', 'touchstart', 'keydown'];
    events.forEach(event => {
      document.addEventListener(event, checkAndroidChromeInstall, { once: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, checkAndroidChromeInstall);
      });
    };
  }, [canInstall]);

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
