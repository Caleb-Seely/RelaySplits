// Sync optimization utilities for better performance and reliability
import { eventBus, EVENT_TYPES } from './eventBus';

interface SyncBatch {
  id: string;
  type: 'legs' | 'runners';
  changes: Array<{
    id: string;
    payload: any;
    timestamp: number;
  }>;
  createdAt: number;
  lastAttempt: number;
  retryCount: number;
}

class SyncOptimizer {
  private batches: Map<string, SyncBatch> = new Map();
  private batchTimeout: number = 1000; // 1 second batching window
  private maxBatchSize: number = 10;
  private maxRetries: number = 3;
  private retryDelay: number = 5000; // 5 seconds

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Listen for leg updates
    eventBus.subscribe(EVENT_TYPES.LEG_UPDATE, (event) => {
      this.addToBatch('legs', event.payload);
    });

    // Listen for runner updates
    eventBus.subscribe(EVENT_TYPES.RUNNER_UPDATE, (event) => {
      this.addToBatch('runners', event.payload);
    });
  }

  private addToBatch(type: 'legs' | 'runners', payload: any) {
    const batchId = `${type}_${Date.now()}`;
    const existingBatch = this.getOrCreateBatch(type);

    // Add change to batch
    existingBatch.changes.push({
      id: payload.legId || payload.runnerId,
      payload: this.normalizePayload(type, payload),
      timestamp: Date.now()
    });

    // If batch is full, process immediately
    if (existingBatch.changes.length >= this.maxBatchSize) {
      this.processBatch(existingBatch);
    } else {
      // Schedule processing after timeout
      setTimeout(() => {
        this.processBatch(existingBatch);
      }, this.batchTimeout);
    }
  }

  private getOrCreateBatch(type: 'legs' | 'runners'): SyncBatch {
    const batchId = `${type}_batch`;
    let batch = this.batches.get(batchId);

    if (!batch) {
      batch = {
        id: batchId,
        type,
        changes: [],
        createdAt: Date.now(),
        lastAttempt: 0,
        retryCount: 0
      };
      this.batches.set(batchId, batch);
    }

    return batch;
  }

  private normalizePayload(type: 'legs' | 'runners', payload: any) {
    if (type === 'legs') {
      return {
        legId: payload.legId,
        field: payload.field,
        value: payload.value,
        previousValue: payload.previousValue,
        runnerId: payload.runnerId
      };
    } else {
      return {
        runnerId: payload.runnerId,
        updates: payload.updates,
        previousValues: payload.previousValues
      };
    }
  }

  private async processBatch(batch: SyncBatch) {
    if (batch.changes.length === 0) return;

    // Check if we should retry
    const now = Date.now();
    if (batch.lastAttempt > 0 && (now - batch.lastAttempt) < this.retryDelay) {
      return;
    }

    batch.lastAttempt = now;

    try {
      // Publish batch processing event
      eventBus.publish({
        type: EVENT_TYPES.DATA_SYNC_START,
        payload: {
          batchId: batch.id,
          type: batch.type,
          count: batch.changes.length
        },
        priority: 'high',
        source: 'syncOptimizer'
      });

      // Process the batch (this will be handled by the sync manager)
      console.log(`[SyncOptimizer] Processing ${batch.type} batch with ${batch.changes.length} changes`);

      // Clear the batch after processing
      batch.changes = [];
      batch.retryCount = 0;

      // Publish completion event
      eventBus.publish({
        type: EVENT_TYPES.DATA_SYNC_COMPLETE,
        payload: {
          batchId: batch.id,
          type: batch.type,
          success: true
        },
        priority: 'high',
        source: 'syncOptimizer'
      });

    } catch (error) {
      console.error(`[SyncOptimizer] Error processing batch:`, error);
      batch.retryCount++;

      if (batch.retryCount < this.maxRetries) {
        // Schedule retry
        setTimeout(() => {
          this.processBatch(batch);
        }, this.retryDelay * batch.retryCount);
      } else {
        console.error(`[SyncOptimizer] Max retries reached for batch ${batch.id}`);
        // Clear the batch to prevent memory leaks
        batch.changes = [];
      }
    }
  }

  // Public method to force process all pending batches
  public forceProcessAll() {
    for (const batch of this.batches.values()) {
      if (batch.changes.length > 0) {
        this.processBatch(batch);
      }
    }
  }

  // Get batch status for debugging
  public getBatchStatus() {
    const status: Record<string, any> = {};
    for (const [id, batch] of this.batches.entries()) {
      status[id] = {
        type: batch.type,
        pendingChanges: batch.changes.length,
        retryCount: batch.retryCount,
        lastAttempt: batch.lastAttempt,
        age: Date.now() - batch.createdAt
      };
    }
    return status;
  }

  // Clear all batches (useful for testing)
  public clearAllBatches() {
    this.batches.clear();
  }
}

// Singleton instance
export const syncOptimizer = new SyncOptimizer();

// Export for use in development
if (typeof window !== 'undefined') {
  (window as any).syncOptimizer = syncOptimizer;
}
