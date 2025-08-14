import { useState, useEffect, useCallback } from 'react';
import { useSyncManager } from './useSyncManager';
import { useRaceStore } from '@/store/raceStore';

// Define the shape of a queued change
interface QueuedChange {
  table: 'runners' | 'legs';
  remoteId: string;
  payload: any;
  timestamp: number;
}

const OFFLINE_QUEUE_KEY = 'relay-splits-offline-queue';

export const useOfflineQueue = () => {
  const { safeUpdate } = useSyncManager();
  const [isProcessing, setIsProcessing] = useState(false);

  const getQueue = (): QueuedChange[] => {
    try {
      const storedQueue = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return storedQueue ? JSON.parse(storedQueue) : [];
    } catch (error) {
      console.error('Error reading from offline queue:', error);
      return [];
    }
  };

  const saveQueue = (queue: QueuedChange[]) => {
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Error saving to offline queue:', error);
    }
  };

  const queueChange = useCallback((change: Omit<QueuedChange, 'timestamp'>) => {
    const queue = getQueue();
    const newChange: QueuedChange = { ...change, timestamp: Date.now() };
    // Simple queue: just add the new change. More advanced logic could merge changes for the same item.
    queue.push(newChange);
    saveQueue(queue);
  }, []);

  const processQueue = useCallback(async (teamId: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    let queue = getQueue();
    if (queue.length === 0) {
      setIsProcessing(false);
      return;
    }

    // Sort by timestamp to process in order
    queue.sort((a, b) => a.timestamp - b.timestamp);

    for (const change of queue) {
      // The teamId needs to be available to safeUpdate
      await safeUpdate(change.table, teamId, change.remoteId, change.payload);
    }

    // Clear the queue after processing
    saveQueue([]);
    setIsProcessing(false);
  }, [safeUpdate, isProcessing]);

  useEffect(() => {
    const handleOnline = () => {
      const teamId = useRaceStore.getState().teamId;
      if (teamId) {
        console.log('Back online, processing queue...');
        processQueue(teamId);
      } else {
        console.warn('Online event fired, but no teamId found to process queue.');
      }
    };

    window.addEventListener('online', handleOnline);

    // Also try to process the queue on initial load, in case the app was closed while offline.
    handleOnline();

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [processQueue]);

  return { queueChange, processQueue, isProcessing };
};
