import React from 'react';
import { 
  Settings, 
  Eye, 
  Users, 
  Share2, 
  Bell, 
  BellOff, 
  HelpCircle, 
  Cloud, 
  Undo, 
  Download 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface DashboardFooterProps {
  canEdit: boolean;
  isViewOnly: boolean;
  team?: any;
  teamId: string;
  canInstall: boolean;
  install: () => Promise<boolean>;
  notificationsSupported: boolean;
  notificationPermission: () => NotificationPermission;
  isNotificationPreferenceEnabled: () => boolean;
  clearNotificationPreference: () => void;
  setNotificationPreference: (enabled: boolean) => void;
  notificationManager: any;
  getPendingNotificationsCount: () => number;
  getNotificationState: () => any;
  onSettingsClick: () => void;
  onAboutMeClick: () => void;
  manualRetry: () => void;
  isDevelopment: boolean;
}

const DashboardFooter: React.FC<DashboardFooterProps> = ({
  canEdit,
  isViewOnly,
  team,
  teamId,
  canInstall,
  install,
  notificationsSupported,
  notificationPermission,
  isNotificationPreferenceEnabled,
  clearNotificationPreference,
  setNotificationPreference,
  notificationManager,
  getPendingNotificationsCount,
  getNotificationState,
  onSettingsClick,
  onAboutMeClick,
  manualRetry,
  isDevelopment
}) => {
  const copyJoinCode = () => {
    const codeToCopy = team?.join_code || team?.id || teamId;
    if (codeToCopy) {
      if (team?.join_code) {
        const teamName = team?.name || 'Team';
        const copyText = `Use viewer code ${team.join_code} on TeamSplits.com to watch ${teamName} run the Hood to Coast!`;
        navigator.clipboard.writeText(copyText);
        toast.success('View code copied to clipboard!');
      } else {
        navigator.clipboard.writeText(codeToCopy);
        toast.success('Team ID copied to clipboard');
      }
    } else {
      toast.error('No team code available');
    }
  };

  const handleNotificationToggle = async () => {
    const permission = notificationPermission();
    
    if (permission === 'granted') {
      const isCurrentlyEnabled = isNotificationPreferenceEnabled();
      if (isCurrentlyEnabled) {
        clearNotificationPreference();
        toast.success('Notifications disabled');
      } else {
        setNotificationPreference(true);
        toast.success('Notifications enabled! You\'ll get alerts when runners start and finish.');
      }
    } else {
      try {
        const newPermission = await notificationManager.requestPermission();
        if (newPermission === 'granted') {
          toast.success('Notifications enabled! You\'ll get alerts when runners start and finish.');
        } else {
          toast.error('Notification permission denied');
        }
      } catch (error) {
        console.error('Notification permission request failed:', error);
        toast.error('Failed to request notification permission');
      }
    }
  };

  const handleInstall = async () => {
    try {
      const success = await install();
      if (success) {
        toast.success('App installed successfully!');
      }
    } catch (error) {
      console.error('Install failed:', error);
      toast.error('Installation failed');
    }
  };

  return (
    <footer className="left-0 right-0 backdrop-blur z-50 border-t border-border">
      <div className="container mx-auto px-3 py-4">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          {/* Left side - Settings, Sync, and Join Code */}
          <div className="flex items-center gap-2">
            {/* Settings button - hidden in view-only mode */}
            {canEdit && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onSettingsClick}
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            )}

            {/* Join Code Button */}
            {team?.join_code && (
              <Button
                variant="outline"
                size="sm"
                onClick={copyJoinCode}
                title={`Click to copy ${isViewOnly ? 'viewer code' : 'join code'}`}
              >
                <Eye className="h-4 w-4 mr-0.5" />
                {team.join_code}
              </Button>
            )}

            {/* View Only Button - Eye Icon */}
            {isViewOnly && (
              <Button
                variant="outline"
                size="sm"
                title="View Only Mode"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}

            {/* Invite Token Copy Button */}
            {team?.invite_token && canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const teamName = team?.name || 'Team';
                  const copyText = `Join ${teamName} on TeamSplits.com using this token!:\n${team.invite_token}`;
                  navigator.clipboard.writeText(copyText);
                  toast.success('Team invite copied to clipboard');
                }}
                title="Copy team invite"
              >
                <Users className="h-4 w-4 mr-1" />
                Invite
              </Button>
            )}
          </div>
          
          {/* Right side - Fallback share button and PWA install - hidden in view-only mode */}
          {canEdit && (
            <div className="flex items-center gap-2">
              {!team?.join_code && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyJoinCode}
                  className="h-9 px-4"
                  aria-label="Copy team join code"
                >
                  <Share2 className="h-4 w-4 mr-1" />
                  Share w/ Teammates
                </Button>
              )}
              
              {/* Notification Toggle Button */}
              {notificationsSupported && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNotificationToggle}
                  title={notificationPermission() === 'granted' 
                    ? (isNotificationPreferenceEnabled() ? 'Disable notifications' : 'Enable notifications')
                    : 'Enable push notifications for runner updates'
                  }
                >
                  {notificationPermission() === 'granted' && isNotificationPreferenceEnabled() ? (
                    <Bell className="h-4 w-4" />
                  ) : (
                    <BellOff className="h-4 w-4" />
                  )}
                </Button>
              )}

              {/* Development-only buttons */}
              {isDevelopment && (
                <>
                  {/* Test Notification Button */}
                  {notificationPermission() === 'granted' && isNotificationPreferenceEnabled() && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await notificationManager.showTestNotification();
                          toast.success('Test notification sent!');
                          
                          setTimeout(() => {
                            alert('Test notification should have appeared! Check your browser notifications.');
                          }, 1000);
                        } catch (error) {
                          console.error('Test notification failed:', error);
                          toast.error('Test notification failed');
                        }
                      }}
                      title="Send test notification"
                    >
                      <Bell className="h-4 w-4 mr-1" />
                      Test
                    </Button>
                  )}

                  {/* Background Test Notification Button */}
                  {notificationPermission() === 'granted' && isNotificationPreferenceEnabled() && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await notificationManager.showBackgroundTestNotification();
                          toast.success('Background test notification sent!');
                          
                          setTimeout(() => {
                            alert('Background test notification sent! Check your browser notifications.');
                          }, 1000);
                        } catch (error) {
                          console.error('Background test notification failed:', error);
                          toast.error('Background test notification failed');
                        }
                      }}
                      title="Send background test notification"
                    >
                      <Bell className="h-4 w-4 mr-1" />
                      Background Test
                    </Button>
                  )}

                  {/* Enhanced Sync System Test Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      import('@/utils/syncTest').then(({ testDecoupledSystem, testRealtimeSubscription, testSyncPerformance, testDataFetching, testStoreUpdates }) => {
                        testDecoupledSystem();
                        setTimeout(() => testRealtimeSubscription(), 500);
                        setTimeout(() => testSyncPerformance(), 1000);
                        setTimeout(() => testDataFetching(), 1500);
                        setTimeout(() => testStoreUpdates(), 2000);
                      });
                    }}
                    title="Test enhanced sync system"
                  >
                    <HelpCircle className="h-4 w-4 mr-1" />
                    Test Sync
                  </Button>

                  {/* Manual Sync Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      console.log('[Dashboard] Manual sync triggered');
                      manualRetry();
                    }}
                    title="Manually trigger sync"
                  >
                    <Cloud className="h-4 w-4 mr-1" />
                    Manual Sync
                  </Button>

                  {/* Notification Debug Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const queueStatus = notificationManager.getQueueStatus();
                      const pendingCount = getPendingNotificationsCount?.() || 0;
                      const notificationStateData = getNotificationState?.() || {};
                      
                      const debugInfo = {
                        permission: notificationPermission(),
                        preference: isNotificationPreferenceEnabled(),
                        queueStatus,
                        pendingCount,
                        notificationState: notificationStateData,
                        pageVisible: !document.hidden,
                        serviceWorker: !!navigator.serviceWorker?.controller,
                        timestamp: new Date().toISOString()
                      };
                      
                      console.log('Notification Debug Info:', debugInfo);
                      alert(`Notification Debug Info:\n${JSON.stringify(debugInfo, null, 2)}`);
                    }}
                    title="Debug notification system"
                  >
                    <HelpCircle className="h-4 w-4 mr-1" />
                    Debug
                  </Button>

                  {/* Clear Notification Queue Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      notificationManager.clearPendingNotifications();
                      toast.success('Notification queue cleared');
                    }}
                    title="Clear pending notifications"
                  >
                    <Undo className="h-4 w-4 mr-1" />
                    Clear Queue
                  </Button>

                  {/* Notification Diagnostics Link */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      window.open('/notifications-test', '_blank');
                    }}
                    title="Open notification diagnostics"
                  >
                    <HelpCircle className="h-4 w-4 mr-1" />
                    Diagnostics
                  </Button>
                </>
              )}

              {/* PWA Install Button */}
              {canInstall && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleInstall}
                  title="Install RelaySplits app"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Install App
                </Button>
              )}
            </div>
          )}

          {/* About Me Heart Button - Always visible */}
          <Button
            variant="outline"
            size="sm"
            onClick={onAboutMeClick}
            title="About the developer"
            className="relative group"
          >
            <span className="text-lg animate-pulse group-hover:animate-none">❤️</span>
          </Button>
        </div>
      </div>
    </footer>
  );
};

export default DashboardFooter;
