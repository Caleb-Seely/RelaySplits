import { useState, useEffect, useCallback, useRef } from 'react';

import { useRaceStore } from '@/store/raceStore';
import { validateDataIntegrity, validateRunner, validateLeg } from '@/utils/validation';
import { invokeEdge, getDeviceId } from '@/integrations/supabase/edge';
import { eventBus, EVENT_TYPES } from '@/utils/eventBus';
import { withErrorHandling, NetworkError } from '@/utils/errorHandling';

// Define the shape of a queued change
interface QueuedChange {
  id: string; // Unique identifier for each change
  table: 'runners' | 'legs';
  remoteId: string;
  payload: any;
  timestamp: number;
  version?: number; // For conflict resolution
  deviceId: string; // Track which device made the change
  retryCount: number;
  lastAttempt?: number;
}

interface ConflictResolution {
  resolved: boolean;
  mergedData?: any;
  error?: string;
}

const OFFLINE_QUEUE_KEY = 'relay-splits-offline-queue';
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000; // 5 seconds

export const useOfflineQueue = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const processingRef = useRef(false);
  const deviceId = useRef(`device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  // Direct implementation of safeUpdate to avoid circular dependency
  const safeUpdate = useCallback(async (
    table: 'runners' | 'legs',
    teamId: string,
    remoteId: string,
    payload: any
  ) => {
    if (!navigator.onLine) {
      console.log(`[useOfflineQueue] App is offline during queue processing. Re-queuing update for ${table}:${remoteId}`);
      return { error: new Error('App is offline') };
    }

    try {
      // Build Edge Function payload
      const deviceIdValue = getDeviceId();
      let edgeName: 'runners-upsert' | 'legs-upsert';
      let body: any;
      
      if (table === 'runners') {
        edgeName = 'runners-upsert';
        const runner = {
          id: remoteId,
          name: payload.name,
          pace: payload.pace,
          van: typeof payload.van === 'number' ? String(payload.van) : payload.van,
        };
        body = { teamId, deviceId: deviceIdValue, runners: [runner], action: 'upsert' };
      } else {
        edgeName = 'legs-upsert';
        
        // The payload should already contain number and distance from the queuing process
        const leg = { 
          ...payload, // Spread payload first (includes number and distance)
          id: remoteId, 
        };
        
        console.log(`[useOfflineQueue] Original payload:`, payload);
        console.log(`[useOfflineQueue] Syncing leg ${remoteId} with number: ${payload.number}, distance: ${payload.distance}`);
        console.log(`[useOfflineQueue] Full leg payload:`, leg);
        
        body = { teamId, deviceId: deviceIdValue, legs: [leg], action: 'upsert' };
      }

      const safeInvokeEdge = withErrorHandling(
        async () => {
          const res = await invokeEdge(edgeName, body);
          if (res && typeof res === 'object' && 'error' in res) {
            throw new NetworkError(`Edge ${edgeName} failed: ${(res as any).error}`);
          }
          return res;
        },
        { showToast: false },
        { component: 'OfflineQueue', operation: 'safeUpdate' }
      );

      try {
        const res = await safeInvokeEdge();
        return { data: payload };
      } catch (error) {
        console.error(`[useOfflineQueue] Edge ${edgeName} error:`, error);
        return { error };
      }

      return { data: payload };
    } catch (error) {
      console.error(`[useOfflineQueue] Error in safeUpdate:`, error);
      return { error: error as Error };
    }
  }, []);

  const getQueue = (): QueuedChange[] => {
    try {
      const storedQueue = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!storedQueue) return [];
      
      const queue = JSON.parse(storedQueue);
      
      // Validate queue structure
      if (!Array.isArray(queue)) {
        console.error('Invalid queue structure, resetting');
        return [];
      }
      
      // Filter out invalid entries - support both simple and complex queue formats
      const filteredQueue = queue.filter((item: any) => 
        item && 
        typeof item === 'object' && 
        item.table && 
        item.remoteId && 
        item.payload &&
        item.timestamp
      );
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[useOfflineQueue] Queue filtering - original:', queue.length, 'filtered:', filteredQueue.length);
      }
      if (queue.length !== filteredQueue.length) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[useOfflineQueue] Filtered out items:', queue.filter((item: any) => 
            !(item && 
              typeof item === 'object' && 
              item.table && 
              item.remoteId && 
              item.payload &&
              item.timestamp)
          ));
        }
      }
      
      return filteredQueue;
    } catch (error) {
      console.error('Error reading from offline queue:', error);
      return [];
    }
  };

  const saveQueue = (queue: QueuedChange[]) => {
    try {
      // Skip data integrity check for now
      // TODO: Add back once we confirm the queue is working
      
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
      setQueueSize(queue.length);
    } catch (error) {
      console.error('Error saving to offline queue:', error);
    }
  };

  const generateChangeId = (): string => {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const resolveConflict = (localChange: QueuedChange, serverData: any): ConflictResolution => {
    try {
      // For timing conflicts, we'll let the UI handle it
      if (localChange.table === 'legs' && 
          (localChange.payload.actualStart || localChange.payload.actualFinish)) {
        console.log('Timing conflict detected, will show UI resolution');
        return { resolved: false, error: 'TIMING_CONFLICT' };
      }
      
      // For other conflicts, server wins
      console.log('Conflict detected, using server data');
      return { resolved: true, mergedData: serverData };
    } catch (error) {
      return { resolved: false, error: 'Failed to resolve conflict' };
    }
  };

  const validateChange = (change: QueuedChange): boolean => {
    try {
      // For simple queue format, just check basic structure
      if (!change.table || !change.remoteId || !change.payload) {
        return false;
      }
      
      // For complex format, do full validation
      if (change.table === 'runners') {
        const result = validateRunner(change.payload);
        return result.success;
      } else if (change.table === 'legs') {
        const result = validateLeg(change.payload);
        return result.success;
      }
      return false;
    } catch (error) {
      console.error('Validation error:', error);
      return false;
    }
  };

  const queueChange = useCallback((change: Omit<QueuedChange, 'id' | 'timestamp' | 'deviceId' | 'retryCount'>) => {
    const queue = getQueue();
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[useOfflineQueue] Attempting to queue change:', change);
    }
    
    // Skip validation for now - just queue the change
    // TODO: Add proper validation back once we confirm the queue is working

    const newChange: QueuedChange = {
      ...change,
      id: generateChangeId(),
      timestamp: Date.now(),
      deviceId: deviceId.current,
      retryCount: 0,
    };

    // Check for duplicate changes (same table, remoteId, and recent timestamp)
    const isDuplicate = queue.some(existing => 
      existing.table === newChange.table &&
      existing.remoteId === newChange.remoteId &&
      Math.abs(existing.timestamp - newChange.timestamp) < 1000 // Within 1 second
    );

    if (isDuplicate) {
      console.log('Duplicate change detected, skipping');
      return false;
    }

    queue.push(newChange);
    saveQueue(queue);
    console.log('Change queued successfully:', newChange.id);
    return true;
  }, []);

  const processQueue = useCallback(async (teamId: string) => {
    if (processingRef.current) {
      console.log('[useOfflineQueue] Queue processing already in progress');
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);

    try {
      const queue = getQueue();
      console.log('[useOfflineQueue] Raw queue from storage:', queue);
      
      if (queue.length === 0) {
        console.log('[useOfflineQueue] No changes to process');
        return;
      }

      console.log(`[useOfflineQueue] Processing ${queue.length} queued changes`);

      // Sort by timestamp to process in order
      queue.sort((a, b) => a.timestamp - b.timestamp);

      const failedChanges: QueuedChange[] = [];
      const successfulChanges: string[] = [];

      for (const change of queue) {
        try {
          // Handle both simple and complex queue formats
          const changeId = change.id || `${change.table}-${change.remoteId}-${change.timestamp}`;
          const retryCount = change.retryCount || 0;
          const lastAttempt = change.lastAttempt || 0;
          
          // Skip if max retries reached
          if (retryCount >= MAX_RETRY_ATTEMPTS) {
            if (process.env.NODE_ENV === 'development') {
              console.warn(`Max retries reached for change ${changeId}`);
            }
            failedChanges.push({ ...change, id: changeId, retryCount: retryCount + 1 });
            continue;
          }

          // Skip if recently attempted
          if (lastAttempt && Date.now() - lastAttempt < RETRY_DELAY_MS) {
            continue;
          }

          // Update attempt timestamp
          change.lastAttempt = Date.now();

          // Attempt to sync the change
          const result = await safeUpdate(change.table, teamId, change.remoteId, change.payload);
          
          if (result.error) {
            if (process.env.NODE_ENV === 'development') {
              console.warn(`[useOfflineQueue] Failed to sync change ${changeId}:`, result.error);
            }
            failedChanges.push({ ...change, id: changeId, retryCount: retryCount + 1 });
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.log(`[useOfflineQueue] Successfully synced change ${changeId}`);
            }
            successfulChanges.push(changeId);
          }

        } catch (error) {
          console.error(`Error processing change ${change.id}:`, error);
          change.retryCount++;
          failedChanges.push(change);
        }
      }

      // Update queue with failed changes
      saveQueue(failedChanges);
      setLastSyncTime(Date.now());

      if (process.env.NODE_ENV === 'development') {
        console.log(`[useOfflineQueue] Queue processing complete. Success: ${successfulChanges.length}, Failed: ${failedChanges.length}`);
      }
      
      // If all changes were successful, we can now allow fresh data to overwrite local changes
      if (successfulChanges.length > 0 && failedChanges.length === 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[useOfflineQueue] All changes synced successfully, local data can now be updated from server');
        }
      }

    } catch (error) {
      console.error('Error processing queue:', error);
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [safeUpdate]);

  const clearQueue = useCallback(() => {
    try {
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
      setQueueSize(0);
      console.log('Offline queue cleared');
    } catch (error) {
      console.error('Error clearing queue:', error);
    }
  }, []);

  const getQueueStatus = useCallback(() => {
    const queue = getQueue();
    const pendingCount = queue.length;
    const retryCount = queue.reduce((sum, change) => sum + (change.retryCount || 0), 0);
    
    return {
      pendingCount,
      retryCount,
      isProcessing,
      lastSyncTime,
      hasFailures: queue.some(change => (change.retryCount || 0) > 0)
    };
  }, [isProcessing, lastSyncTime]);

  // Initialize queue size
  useEffect(() => {
    const queue = getQueue();
    setQueueSize(queue.length);
  }, []);

  // Auto-process queue when coming online
  useEffect(() => {
    const handleOnline = () => {
      const teamId = useRaceStore.getState().teamId;
      if (teamId && navigator.onLine) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[useOfflineQueue] Back online, processing queue...');
        }
        const queueStatus = getQueueStatus();
        if (process.env.NODE_ENV === 'development') {
          console.log('[useOfflineQueue] Queue status:', queueStatus);
        }
        if (queueStatus.pendingCount > 0) {
          processQueue(teamId);
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.log('[useOfflineQueue] No pending changes to process');
          }
        }
      }
    };

    const handleOffline = () => {
      console.log('[useOfflineQueue] Going offline, changes will be queued');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Process queue on initial load if online
    if (navigator.onLine) {
      handleOnline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [processQueue, getQueueStatus, safeUpdate]);

  // Subscribe to real-time updates to trigger queue processing
  useEffect(() => {
    const unsubscribe = eventBus.subscribe(EVENT_TYPES.REALTIME_UPDATE, (event: any) => {
      // If we receive a real-time update and have pending changes, try to process them
      const queueStatus = getQueueStatus();
      if (queueStatus.pendingCount > 0 && navigator.onLine) {
        const teamId = useRaceStore.getState().teamId;
        if (teamId) {
          console.log('[useOfflineQueue] Real-time update received, processing pending queue...');
          processQueue(teamId);
        }
      }
    });

    return unsubscribe;
  }, [processQueue, getQueueStatus]);

  return { 
    queueChange, 
    processQueue, 
    clearQueue,
    getQueueStatus,
    isProcessing,
    queueSize,
    lastSyncTime
  };
};
