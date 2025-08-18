import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Download, Smartphone, Monitor, Bell, BellOff } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';
import { useNotifications } from '@/hooks/useNotifications';
import { notificationManager } from '@/utils/notifications';
import { toast } from 'sonner';

interface DashboardPromptsProps {
  onDismiss?: () => void;
}

const DashboardPrompts: React.FC<DashboardPromptsProps> = ({ onDismiss }) => {
  const { canInstall, isInstalling, install } = usePWA();
  const { isSupported: notificationsSupported, getPermission, requestPermission, isNotificationPreferenceEnabled } = useNotifications();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showPWA, setShowPWA] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasShownPrompts, setHasShownPrompts] = useState(false);

  // Initialize notification system when component mounts
  useEffect(() => {
    notificationManager.initialize().then((success) => {
      if (success) {
        console.log('[DashboardPrompts] Notification system initialized successfully');
      } else {
        console.log('[DashboardPrompts] Notification system initialization failed');
      }
    });
  }, []);

  // Check PWA installability manually
  useEffect(() => {
    const checkPWAInstallability = () => {
      // Check if the app meets PWA install criteria
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const hasServiceWorker = 'serviceWorker' in navigator;
      const hasManifest = document.querySelector('link[rel="manifest"]') !== null;
      
      console.log('[DashboardPrompts] PWA Installability Check:', {
        isStandalone,
        hasServiceWorker,
        hasManifest,
        userAgent: navigator.userAgent
      });
    };

    checkPWAInstallability();
  }, []);

  useEffect(() => {
    // Add a small delay to ensure user has seen the dashboard first
    const timer = setTimeout(() => {
      setHasShownPrompts(true);
    }, 2000); // 2 second delay

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hasShownPrompts) return; // Don't show prompts until delay has passed
    // Check if user has already dismissed this session
    const dismissed = sessionStorage.getItem('dashboard-prompts-dismissed');
    if (dismissed) {
      setIsDismissed(true);
      return;
    }

    // Debug PWA state
    console.log('[DashboardPrompts] PWA Debug - canInstall:', canInstall, 'isInstalling:', isInstalling);

    // Check PWA install status
    if (canInstall) {
      const pwaDismissed = sessionStorage.getItem('pwa-install-dismissed');
      console.log('[DashboardPrompts] PWA can install, dismissed:', pwaDismissed);
      if (!pwaDismissed) {
        console.log('[DashboardPrompts] Setting showPWA to true');
        setShowPWA(true);
      }
    } else {
      console.log('[DashboardPrompts] PWA cannot install - criteria not met');
    }

    // Check notification permission status and initialize if needed
    if (notificationsSupported) {
      const permission = getPermission();
      console.log('[DashboardPrompts] Notification permission:', permission);
      if (permission === 'default') {
        const notificationDismissed = sessionStorage.getItem('notification-permission-dismissed');
        if (!notificationDismissed) {
          setShowNotifications(true);
        }
      }
    }
  }, [canInstall, notificationsSupported, getPermission, hasShownPrompts, isInstalling]);

  const handlePWAInstall = async () => {
    const success = await install();
    if (success) {
      console.log('PWA installation successful');
      setShowPWA(false);
      sessionStorage.setItem('pwa-install-dismissed', 'true');
    } else {
      console.log('PWA installation declined or failed');
    }
  };

  const handlePWAInstallDismiss = () => {
    setShowPWA(false);
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  };

  const handleNotificationRequest = async () => {
    const permission = await requestPermission();
    if (permission === 'granted') {
      toast.success('Notifications enabled! You\'ll receive alerts for runner updates.');
      setShowNotifications(false);
      sessionStorage.setItem('notification-permission-dismissed', 'true');
    } else {
      toast.error('Notification permission denied. You can enable them later in your browser settings.');
      setShowNotifications(false);
      sessionStorage.setItem('notification-permission-dismissed', 'true');
    }
  };

  const handleNotificationDismiss = () => {
    setShowNotifications(false);
    sessionStorage.setItem('notification-permission-dismissed', 'true');
  };

  const handleDismissAll = () => {
    setIsDismissed(true);
    sessionStorage.setItem('dashboard-prompts-dismissed', 'true');
    sessionStorage.setItem('pwa-install-dismissed', 'true');
    sessionStorage.setItem('notification-permission-dismissed', 'true');
    onDismiss?.();
  };

  // Don't show anything if dismissed, no prompts to show, or haven't shown prompts yet
  if (isDismissed || (!showPWA && !showNotifications) || !hasShownPrompts) {
    return null;
  }



  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80 space-y-4">
      {/* PWA Install Prompt */}
      {showPWA && (
        <Card className="shadow-lg border-2 border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Install RelaySplits</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePWAInstallDismiss}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>
              Get the full app experience with offline support
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary" className="text-xs">
                <Smartphone className="h-3 w-3 mr-1" />
                Mobile
              </Badge>
              <Badge variant="secondary" className="text-xs">
                <Monitor className="h-3 w-3 mr-1" />
                Desktop
              </Badge>
            </div>
            
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                Works offline
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                Faster loading
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                App-like experience
              </div>
            </div>

            <Button
              onClick={handlePWAInstall}
              disabled={isInstalling}
              className="w-full"
              size="sm"
            >
              {isInstalling ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Installing...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Install App
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Notification Permission Prompt */}
      {showNotifications && (
        <Card className="shadow-lg border-2 border-blue-200">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-lg">Enable Notifications</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNotificationDismiss}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>
              Get notified when runners start and finish their legs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                Runner start alerts
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                Handoff notifications
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                Race completion alerts
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleNotificationRequest}
                className="flex-1"
                size="sm"
                variant="default"
              >
                <Bell className="h-4 w-4 mr-2" />
                Enable
              </Button>
              <Button
                onClick={handleNotificationDismiss}
                className="flex-1"
                size="sm"
                variant="outline"
              >
                <BellOff className="h-4 w-4 mr-2" />
                Not Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dismiss All Button */}
      {(showPWA || showNotifications) && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismissAll}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Don't show again
          </Button>
        </div>
      )}


    </div>
  );
};

export default DashboardPrompts;
