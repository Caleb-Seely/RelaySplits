// Concurrency control utilities for handling race conditions and concurrent updates

export interface OptimisticLock {
  version: number;
  timestamp: number;
  deviceId: string;
}

export interface ConcurrentUpdateError extends Error {
  type: 'CONCURRENT_UPDATE';
  localVersion: number;
  serverVersion: number;
  conflictingData?: any;
}

export class ConcurrencyManager {
  private locks = new Map<string, OptimisticLock>();
  private pendingUpdates = new Map<string, Promise<any>>();

  /**
   * Creates an optimistic lock for a resource
   */
  createLock(resourceId: string, deviceId: string): OptimisticLock {
    const lock: OptimisticLock = {
      version: Date.now(),
      timestamp: Date.now(),
      deviceId
    };
    this.locks.set(resourceId, lock);
    return lock;
  }

  /**
   * Updates the version of a lock (used after successful updates)
   */
  updateLock(resourceId: string, newVersion: number): void {
    const lock = this.locks.get(resourceId);
    if (lock) {
      lock.version = newVersion;
      lock.timestamp = Date.now();
    }
  }

  /**
   * Checks if a resource has been modified since the last known version
   */
  isStale(resourceId: string, knownVersion: number): boolean {
    const lock = this.locks.get(resourceId);
    return lock ? lock.version > knownVersion : false;
  }

  /**
   * Prevents concurrent updates to the same resource
   */
  async withExclusiveAccess<T>(
    resourceId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    // Check if there's already a pending update
    const existingUpdate = this.pendingUpdates.get(resourceId);
    if (existingUpdate) {
      // Wait for the existing update to complete
      await existingUpdate;
    }

    // Create a new promise for this update
    const updatePromise = operation();
    this.pendingUpdates.set(resourceId, updatePromise);

    try {
      const result = await updatePromise;
      return result;
    } finally {
      // Clean up the pending update
      this.pendingUpdates.delete(resourceId);
    }
  }

  /**
   * Merges conflicting data using a strategy
   */
  mergeConflictingData(
    localData: any,
    serverData: any,
    strategy: 'server-wins' | 'client-wins' | 'manual' | 'merge' = 'server-wins'
  ): any {
    switch (strategy) {
      case 'server-wins':
        return serverData;
      case 'client-wins':
        return localData;
      case 'manual':
        // Return both for manual resolution
        return { local: localData, server: serverData };
      case 'merge':
        return this.deepMerge(localData, serverData);
      default:
        return serverData;
    }
  }

  /**
   * Deep merge two objects, preferring non-null values
   */
  private deepMerge(target: any, source: any): any {
    if (source === null || source === undefined) {
      return target;
    }

    if (target === null || target === undefined) {
      return source;
    }

    if (typeof source !== 'object' || typeof target !== 'object') {
      return source;
    }

    if (Array.isArray(source) !== Array.isArray(target)) {
      return source;
    }

    if (Array.isArray(source)) {
      return source.map((item, index) => 
        this.deepMerge(target[index], item)
      );
    }

    const result = { ...target };
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        result[key] = this.deepMerge(target[key], source[key]);
      }
    }

    return result;
  }

  /**
   * Creates a concurrent update error
   */
  createConcurrentUpdateError(
    message: string,
    localVersion: number,
    serverVersion: number,
    conflictingData?: any
  ): ConcurrentUpdateError {
    const error = new Error(message) as ConcurrentUpdateError;
    error.type = 'CONCURRENT_UPDATE';
    error.localVersion = localVersion;
    error.serverVersion = serverVersion;
    error.conflictingData = conflictingData;
    return error;
  }
}

// Global concurrency manager instance
export const concurrencyManager = new ConcurrencyManager();

/**
 * Decorator for functions that need exclusive access to a resource
 */
export function withExclusiveAccess<T extends any[], R>(
  resourceId: string | ((...args: T) => string)
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: T): Promise<R> {
      const id = typeof resourceId === 'function' ? resourceId(...args) : resourceId;
      return concurrencyManager.withExclusiveAccess(id, () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

/**
 * Utility for handling optimistic updates with conflict resolution
 */
export class OptimisticUpdater<T> {
  constructor(
    private resourceId: string,
    private getVersion: (data: T) => number,
    private updateVersion: (data: T, version: number) => T
  ) {}

  async update(
    currentData: T,
    updateFn: (data: T) => T,
    conflictResolver?: (local: T, server: T) => T
  ): Promise<T> {
    const currentVersion = this.getVersion(currentData);
    
    // Apply the update locally
    const updatedData = updateFn(currentData);
    const newVersion = Date.now();
    const optimisticData = this.updateVersion(updatedData, newVersion);

    try {
      // Attempt to save to server
      const result = await this.saveToServer(optimisticData);
      
      // Update the lock with the new version
      concurrencyManager.updateLock(this.resourceId, newVersion);
      
      return result;
    } catch (error) {
      if (error instanceof Error && 'type' in error && error.type === 'CONCURRENT_UPDATE') {
        // Handle concurrent update
        const concurrentError = error as ConcurrentUpdateError;
        
        if (conflictResolver) {
          // Use custom conflict resolver
          const resolvedData = conflictResolver(optimisticData, concurrentError.conflictingData!);
          return await this.update(resolvedData, updateFn, conflictResolver);
        } else {
          // Use default strategy (server wins)
          return concurrentError.conflictingData!;
        }
      }
      
      throw error;
    }
  }

  private async saveToServer(data: T): Promise<T> {
    // This would be implemented based on your API
    // For now, we'll simulate a server call
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate random server errors
        if (Math.random() < 0.1) {
          reject(concurrencyManager.createConcurrentUpdateError(
            'Concurrent update detected',
            this.getVersion(data),
            this.getVersion(data) + 1,
            data
          ));
        } else {
          resolve(data);
        }
      }, 100);
    });
  }
}

/**
 * Utility for debouncing rapid updates
 */
export class UpdateDebouncer {
  private timers = new Map<string, NodeJS.Timeout>();
  private pendingUpdates = new Map<string, () => void>();

  debounce<T>(
    key: string,
    updateFn: () => Promise<T>,
    delay: number = 300
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      // Clear existing timer
      const existingTimer = this.timers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Store the update function
      this.pendingUpdates.set(key, () => {
        updateFn()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            this.pendingUpdates.delete(key);
            this.timers.delete(key);
          });
      });

      // Set new timer
      const timer = setTimeout(() => {
        const update = this.pendingUpdates.get(key);
        if (update) {
          update();
        }
      }, delay);

      this.timers.set(key, timer);
    });
  }

  cancel(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
    this.pendingUpdates.delete(key);
  }

  clear(): void {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    this.pendingUpdates.clear();
  }
}

// Global debouncer instance
export const updateDebouncer = new UpdateDebouncer();

/**
 * Utility for tracking update conflicts
 */
export class ConflictTracker {
  private conflicts = new Map<string, number>();
  private lastConflictTime = new Map<string, number>();

  recordConflict(resourceId: string): void {
    const count = this.conflicts.get(resourceId) || 0;
    this.conflicts.set(resourceId, count + 1);
    this.lastConflictTime.set(resourceId, Date.now());
  }

  getConflictCount(resourceId: string): number {
    return this.conflicts.get(resourceId) || 0;
  }

  getLastConflictTime(resourceId: string): number | undefined {
    return this.lastConflictTime.get(resourceId);
  }

  clearConflicts(resourceId: string): void {
    this.conflicts.delete(resourceId);
    this.lastConflictTime.delete(resourceId);
  }

  getAllConflicts(): Map<string, number> {
    return new Map(this.conflicts);
  }
}

// Global conflict tracker instance
export const conflictTracker = new ConflictTracker();
