/**
 * Production Clock Synchronization Service
 * 
 * Provides reliable server time synchronization for relay race timing.
 * Designed for production safety with minimal complexity.
 */

export interface ClockSyncStatus {
  isSynced: boolean
  lastSyncTime: number
  timeOffset: number
  syncAge: number
  isOnline: boolean
  confidence: 'high' | 'medium' | 'low'
}

export class ClockSyncService {
  private static instance: ClockSyncService
  private timeOffset: number = 0
  private lastSyncTime: number = 0
  private isOnline: boolean = navigator.onLine
  private syncInProgress: boolean = false
  private syncInterval: number = 300000 // 5 minutes
  private syncIntervalId: number | null = null
  private syncAttempts: number = 0
  private maxSyncAttempts: number = 3

  static getInstance(): ClockSyncService {
    if (!ClockSyncService.instance) {
      ClockSyncService.instance = new ClockSyncService()
    }
    return ClockSyncService.instance
  }

  async initialize(): Promise<void> {
    console.log('[ClockSync] Initializing...')
    
    // Load stored offset first (works offline)
    this.loadStoredOffset()
    
    // Setup online/offline listeners
    this.setupOnlineOfflineListeners()
    
    // Try initial sync if online
    if (this.isOnline) {
      await this.syncWithServer()
    }
    
    // Start periodic sync
    this.startPeriodicSync()
    
    console.log('[ClockSync] Initialized with offset:', this.timeOffset)
  }

  private setupOnlineOfflineListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true
      this.syncAttempts = 0 // Reset attempts when back online
      console.log('[ClockSync] Back online, attempting sync...')
      this.syncWithServer()
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
      console.log('[ClockSync] Went offline, using stored offset')
    })
  }

  private async syncWithServer(): Promise<void> {
    if (this.syncInProgress || !this.isOnline || this.syncAttempts >= this.maxSyncAttempts) {
      return
    }

    this.syncInProgress = true
    this.syncAttempts++
    
    try {
      const startTime = Date.now()
      const response = await fetch('/api/server-time', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })
      const endTime = Date.now()
      
      if (!response.ok) {
        throw new Error(`Server time request failed: ${response.status}`)
      }
      
      const { serverTime } = await response.json()
      const roundTripTime = endTime - startTime
      const estimatedServerTime = serverTime + (roundTripTime / 2)
      
      const newOffset = estimatedServerTime - endTime
      this.updateTimeOffset(newOffset)
      this.lastSyncTime = endTime
      this.syncAttempts = 0 // Reset on success
      
      console.log(`[ClockSync] Synced successfully. Offset: ${newOffset}ms, RTT: ${roundTripTime}ms`)
      
    } catch (error) {
      console.warn(`[ClockSync] Failed to sync with server (attempt ${this.syncAttempts}):`, error)
      // Don't throw - we'll use stored offset
    } finally {
      this.syncInProgress = false
    }
  }

  private updateTimeOffset(newOffset: number): void {
    this.timeOffset = newOffset
    this.storeOffset()
  }

  getSynchronizedTime(): number {
    // If we've never synced, return local time
    if (this.lastSyncTime === 0) {
      return Date.now()
    }
    
    return Date.now() + this.timeOffset
  }

  getSyncAge(): number {
    return this.lastSyncTime > 0 ? Date.now() - this.lastSyncTime : Infinity
  }

  getSyncStatus(): ClockSyncStatus {
    const syncAge = this.getSyncAge()
    let confidence: 'high' | 'medium' | 'low' = 'low'
    
    if (this.lastSyncTime > 0) {
      if (syncAge < 300000) { // 5 minutes
        confidence = 'high'
      } else if (syncAge < 1800000) { // 30 minutes
        confidence = 'medium'
      }
    }
    
    return {
      isSynced: this.lastSyncTime > 0,
      lastSyncTime: this.lastSyncTime,
      timeOffset: this.timeOffset,
      syncAge,
      isOnline: this.isOnline,
      confidence
    }
  }

  private startPeriodicSync(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId)
    }
    
    this.syncIntervalId = window.setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        this.syncWithServer()
      }
    }, this.syncInterval)
  }

  private storeOffset(): void {
    try {
      localStorage.setItem('clock_sync_offset', this.timeOffset.toString())
      localStorage.setItem('clock_sync_timestamp', this.lastSyncTime.toString())
    } catch (error) {
      console.warn('[ClockSync] Failed to store offset:', error)
    }
  }

  private loadStoredOffset(): void {
    try {
      const storedOffset = localStorage.getItem('clock_sync_offset')
      const storedTimestamp = localStorage.getItem('clock_sync_timestamp')
      
      if (storedOffset && storedTimestamp) {
        this.timeOffset = parseInt(storedOffset)
        this.lastSyncTime = parseInt(storedTimestamp)
        console.log(`[ClockSync] Loaded stored offset: ${this.timeOffset}ms`)
      }
    } catch (error) {
      console.warn('[ClockSync] Failed to load stored offset:', error)
    }
  }

  // Force a sync attempt (useful for manual refresh)
  async forceSync(): Promise<boolean> {
    if (!this.isOnline) {
      console.log('[ClockSync] Cannot force sync while offline')
      return false
    }
    
    this.syncAttempts = 0 // Reset attempts for manual sync
    await this.syncWithServer()
    return this.lastSyncTime > 0
  }

  // Cleanup
  destroy(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId)
      this.syncIntervalId = null
    }
  }
}

// Convenience functions
export const getSynchronizedTime = (): number => {
  return ClockSyncService.getInstance().getSynchronizedTime()
}

export const getSyncStatus = (): ClockSyncStatus => {
  return ClockSyncService.getInstance().getSyncStatus()
}

export const forceSync = (): Promise<boolean> => {
  return ClockSyncService.getInstance().forceSync()
}
