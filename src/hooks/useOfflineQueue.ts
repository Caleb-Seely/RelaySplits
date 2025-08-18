import { useState, useEffect, useCallback, useRef } from 'react';
import { useSyncManager } from './useSyncManager';
import { useRaceStore } from '@/store/raceStore';
import { validateDataIntegrity, validateRunner, validateLeg } from '@/utils/validation';

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
  const { safeUpdate } = useSyncManager();
  const [isProcessing, setIsProcessing] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const processingRef = useRef(false);
  const deviceId = useRef(`device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

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
      
      // Filter out invalid entries
      return queue.filter((item: any) => 
        item && 
        typeof item === 'object' && 
        item.table && 
        item.remoteId && 
        item.payload &&
        item.timestamp
      );
    } catch (error) {
      console.error('Error reading from offline queue:', error);
      return [];
    }
  };

  const saveQueue = (queue: QueuedChange[]) => {
    try {
      // Validate data integrity before saving
      const integrityCheck = validateDataIntegrity(queue);
      if (!integrityCheck.valid) {
        console.error('Data integrity check failed:', integrityCheck.errors);
        return;
      }

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
      // Simple conflict resolution: server wins for now
      // In a more sophisticated implementation, you might merge the data
      console.log('Conflict detected, using server data');
      return { resolved: true, mergedData: serverData };
    } catch (error) {
      return { resolved: false, error: 'Failed to resolve conflict' };
    }
  };

  const validateChange = (change: QueuedChange): boolean => {
    try {
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
    
    // Validate the change before queuing
    if (!validateChange(change as QueuedChange)) {
      console.error('Invalid change data, not queuing');
      return false;
    }

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
      console.log('Queue processing already in progress');
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);

    try {
      let queue = getQueue();
      if (queue.length === 0) {
        console.log('No changes to process');
        return;
      }

      console.log(`Processing ${queue.length} queued changes`);

      // Sort by timestamp to process in order
      queue.sort((a, b) => a.timestamp - b.timestamp);

      const failedChanges: QueuedChange[] = [];
      const successfulChanges: string[] = [];

      for (const change of queue) {
        try {
          // Skip if max retries reached
          if (change.retryCount >= MAX_RETRY_ATTEMPTS) {
            console.error(`Max retries reached for change ${change.id}`);
            failedChanges.push(change);
            continue;
          }

          // Skip if recently attempted
          if (change.lastAttempt && Date.now() - change.lastAttempt < RETRY_DELAY_MS) {
            console.log(`Skipping change ${change.id}, too recent`);
            continue;
          }

          // Update attempt timestamp
          change.lastAttempt = Date.now();

          // Attempt to sync the change
          const result = await safeUpdate(change.table, teamId, change.remoteId, change.payload);
          
          if (result.error) {
            console.error(`Failed to sync change ${change.id}:`, result.error);
            change.retryCount++;
            failedChanges.push(change);
          } else {
            console.log(`Successfully synced change ${change.id}`);
            successfulChanges.push(change.id);
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

      console.log(`Queue processing complete. Success: ${successfulChanges.length}, Failed: ${failedChanges.length}`);

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
    const retryCount = queue.reduce((sum, change) => sum + change.retryCount, 0);
    
    return {
      pendingCount,
      retryCount,
      isProcessing,
      lastSyncTime,
      hasFailures: queue.some(change => change.retryCount > 0)
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
        console.log('Back online, processing queue...');
        processQueue(teamId);
      }
    };

    const handleOffline = () => {
      console.log('Going offline, changes will be queued');
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
  }, [processQueue]);

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
