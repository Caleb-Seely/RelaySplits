
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { CloudUpload, CloudOff, Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { useTeamSync } from '@/hooks/useTeamSync';
import { useOfflineData } from '@/hooks/useOfflineData';
import { useRaceStore } from '@/store/raceStore';

type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error' | 'offline-changes';

const SyncStatusIndicator = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const { team } = useTeamSync();
  const { isOnline, offlineChangesCount } = useOfflineData();
  const { lastSyncedAt } = useRaceStore();

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      if (offlineChangesCount > 0) {
        setSyncStatus('offline-changes');
      } else {
        setSyncStatus('synced');
      }
    };
    
    const handleOffline = () => setSyncStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (!navigator.onLine) {
      setSyncStatus('offline');
    } else if (offlineChangesCount > 0) {
      setSyncStatus('offline-changes');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [offlineChangesCount]);

  // Update status when offline changes count changes
  useEffect(() => {
    if (isOnline && offlineChangesCount > 0) {
      setSyncStatus('offline-changes');
    } else if (isOnline && offlineChangesCount === 0) {
      setSyncStatus('synced');
    }
  }, [isOnline, offlineChangesCount]);

  // Removed simulated timer: status now updates only from real sync events and offline state

  // Update when store reports a sync (authoritative)
  useEffect(() => {
    if (typeof lastSyncedAt === 'number' && lastSyncedAt > 0) {
      setSyncStatus('synced');
      setLastSyncTime(new Date(lastSyncedAt));
    }
  }, [lastSyncedAt]);

  const getStatusConfig = () => {
    // Helper function to format the sync time display
    const formatSyncTime = () => {
      if (!lastSyncTime) return '';
      return lastSyncTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    };

    // Helper function to format the sync time with parentheses for non-synced states
    const formatSyncTimeWithParentheses = () => {
      if (!lastSyncTime) return '';
      return ` (${lastSyncTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })})`;
    };

    switch (syncStatus) {
      case 'synced':
        return {
          icon: CloudUpload,
          text: formatSyncTime() || 'Synced',
          variant: 'default' as const,
          className: 'bg-green-500/10 text-green-600 border-green-200'
        };
      case 'syncing':
        return {
          icon: Loader2,
          text: `Syncing...${formatSyncTimeWithParentheses()}`,
          variant: 'secondary' as const,
          className: 'bg-blue-500/10 text-blue-600 border-blue-200 animate-pulse'
        };
      case 'offline':
        return {
          icon: CloudOff,
          text: formatSyncTimeWithParentheses(),
          variant: 'destructive' as const,
          className: 'bg-red-500/10 text-red-600 border-red-200'
        };
      case 'offline-changes':
        return {
          icon: Clock,
          text: `${offlineChangesCount} pending${formatSyncTimeWithParentheses()}`,
          variant: 'destructive' as const,
          className: 'bg-orange-500/10 text-orange-600 border-orange-200'
        };
      case 'error':
        return {
          icon: AlertCircle,
          text: `Sync Error${formatSyncTimeWithParentheses()}`,
          variant: 'destructive' as const,
          className: 'bg-orange-500/10 text-orange-600 border-orange-200'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <Badge variant={config.variant} className={`flex items-center gap-1.5 px-2 py-1 ${config.className}`}>
        <Icon className={`h-3 w-3 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
        <span className="text-xs font-medium">{config.text}</span>
      </Badge>
    </div>
  );
};

export default SyncStatusIndicator;
