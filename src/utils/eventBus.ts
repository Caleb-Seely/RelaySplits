// Event Bus for decoupling notifications from sync operations
export interface EventBusEvent {
  type: string;
  payload: any;
  timestamp: number;
  priority: 'high' | 'low';
  source: string;
}

export interface EventHandler {
  (event: EventBusEvent): void | Promise<void>;
}

class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();
  private highPriorityQueue: EventBusEvent[] = [];
  private lowPriorityQueue: EventBusEvent[] = [];
  private isProcessing = false;
  private processingDelay = 50; // ms between processing batches

  // Subscribe to events
  subscribe(eventType: string, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(eventType);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  // Publish event with priority
  publish(event: Omit<EventBusEvent, 'timestamp'>): void {
    const fullEvent: EventBusEvent = {
      ...event,
      timestamp: Date.now()
    };

    if (event.priority === 'high') {
      this.highPriorityQueue.push(fullEvent);
    } else {
      this.lowPriorityQueue.push(fullEvent);
    }

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processEvents();
    }
  }

  // Process events with priority
  private async processEvents(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // Process high priority events first
      while (this.highPriorityQueue.length > 0) {
        const event = this.highPriorityQueue.shift()!;
        await this.processEvent(event);
      }

      // Process low priority events with delay
      if (this.lowPriorityQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.processingDelay));
        
        // Process low priority events in batches
        const batchSize = 5;
        while (this.lowPriorityQueue.length > 0) {
          const batch = this.lowPriorityQueue.splice(0, batchSize);
          await Promise.all(batch.map(event => this.processEvent(event)));
          
          if (this.lowPriorityQueue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, this.processingDelay));
          }
        }
      }
    } finally {
      this.isProcessing = false;
      
      // If new events arrived while processing, continue
      if (this.highPriorityQueue.length > 0 || this.lowPriorityQueue.length > 0) {
        setTimeout(() => this.processEvents(), 10);
      }
    }
  }

  private async processEvent(event: EventBusEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) || [];
    
    try {
      await Promise.all(handlers.map(handler => handler(event)));
    } catch (error) {
      console.error(`[EventBus] Error processing event ${event.type}:`, error);
    }
  }

  // Get queue status for debugging
  getQueueStatus(): { highPriority: number; lowPriority: number; isProcessing: boolean } {
    return {
      highPriority: this.highPriorityQueue.length,
      lowPriority: this.lowPriorityQueue.length,
      isProcessing: this.isProcessing
    };
  }

  // Clear all queues
  clearQueues(): void {
    this.highPriorityQueue = [];
    this.lowPriorityQueue = [];
  }
}

// Singleton instance
export const eventBus = new EventBus();

// Event types
export const EVENT_TYPES = {
  // High priority events (data sync)
  DATA_SYNC_START: 'data_sync_start',
  DATA_SYNC_COMPLETE: 'data_sync_complete',
  LEG_UPDATE: 'leg_update',
  RUNNER_UPDATE: 'runner_update',
  
  // Low priority events (notifications)
  NOTIFICATION_LEG_START: 'notification_leg_start',
  NOTIFICATION_LEG_FINISH: 'notification_leg_finish',
  NOTIFICATION_HANDOFF: 'notification_handoff',
  NOTIFICATION_RACE_COMPLETE: 'notification_race_complete',
  
  // System events
  APP_VISIBILITY_CHANGE: 'app_visibility_change',
  NETWORK_STATUS_CHANGE: 'network_status_change'
} as const;
