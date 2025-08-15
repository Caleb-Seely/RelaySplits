
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Cloud, CloudOff, Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react';
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
    switch (syncStatus) {
      case 'synced':
        return {
          icon: Cloud,
          text: lastSyncTime
            ? lastSyncTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
            : 'Synced',
          variant: 'default' as const,
          className: 'bg-green-500/10 text-green-600 border-green-200'
        };
      case 'syncing':
        return {
          icon: Loader2,
          text: 'Syncing...',
          variant: 'secondary' as const,
          className: 'bg-blue-500/10 text-blue-600 border-blue-200 animate-pulse'
        };
      case 'offline':
        return {
          icon: CloudOff,
          text: 'Offline',
          variant: 'destructive' as const,
          className: 'bg-red-500/10 text-red-600 border-red-200'
        };
      case 'offline-changes':
        return {
          icon: Clock,
          text: `${offlineChangesCount} pending`,
          variant: 'destructive' as const,
          className: 'bg-orange-500/10 text-orange-600 border-orange-200'
        };
      case 'error':
        return {
          icon: AlertCircle,
          text: 'Sync Error',
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
