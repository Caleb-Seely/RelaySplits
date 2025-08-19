# Production Solutions: Timing System Architecture

## 1. Clock Synchronization Solution

### Architecture Overview
Implement a hybrid approach combining server time synchronization with local clock drift detection and compensation.

### Implementation

#### A. Server Time Endpoint
```typescript
// supabase/functions/server-time/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const serverTime = Date.now()
    const serverTimeISO = new Date(serverTime).toISOString()
    
    return new Response(
      JSON.stringify({
        serverTime,
        serverTimeISO,
        timestamp: serverTime,
        timezone: 'UTC'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
```

#### B. Offline-Capable Clock Synchronization Service
```typescript
// src/services/clockSync.ts
export class ClockSyncService {
  private static instance: ClockSyncService
  private timeOffset: number = 0
  private lastSyncTime: number = 0
  private syncInterval: number = 300000 // 5 minutes
  private driftHistory: number[] = []
  private maxDriftHistory: number = 10
  private isOnline: boolean = navigator.onLine
  private syncAttempts: number = 0
  private maxSyncAttempts: number = 3

  static getInstance(): ClockSyncService {
    if (!ClockSyncService.instance) {
      ClockSyncService.instance = new ClockSyncService()
    }
    return ClockSyncService.instance
  }

  async initialize(): Promise<void> {
    // Load stored offset first (works offline)
    this.loadStoredOffset()
    
    // Try to sync with server if online
    if (this.isOnline) {
      await this.syncWithServer()
    }
    
    this.startPeriodicSync()
    this.setupOnlineOfflineListeners()
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
    if (!this.isOnline || this.syncAttempts >= this.maxSyncAttempts) {
      return
    }

    try {
      this.syncAttempts++
      const startTime = Date.now()
      const response = await fetch('/api/server-time', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })
      const endTime = Date.now()
      
      if (!response.ok) throw new Error('Server time request failed')
      
      const { serverTime } = await response.json()
      const roundTripTime = endTime - startTime
      const estimatedServerTime = serverTime + (roundTripTime / 2)
      
      const newOffset = estimatedServerTime - endTime
      this.updateTimeOffset(newOffset)
      this.lastSyncTime = endTime
      this.syncAttempts = 0 // Reset on success
      
      console.log(`[ClockSync] Synced with server. Offset: ${newOffset}ms, RTT: ${roundTripTime}ms`)
    } catch (error) {
      console.warn(`[ClockSync] Failed to sync with server (attempt ${this.syncAttempts}):`, error)
      // Don't throw - we'll use stored offset
    }
  }

  private updateTimeOffset(newOffset: number): void {
    // Calculate drift rate
    if (this.lastSyncTime > 0) {
      const timeSinceLastSync = Date.now() - this.lastSyncTime
      const driftRate = (newOffset - this.timeOffset) / timeSinceLastSync
      this.driftHistory.push(driftRate)
      
      if (this.driftHistory.length > this.maxDriftHistory) {
        this.driftHistory.shift()
      }
    }
    
    this.timeOffset = newOffset
    this.storeOffset()
  }

  getSynchronizedTime(): number {
    const currentTime = Date.now()
    
    // If we've never synced, just return current time
    if (this.lastSyncTime === 0) {
      return currentTime
    }
    
    const averageDriftRate = this.driftHistory.length > 0 
      ? this.driftHistory.reduce((a, b) => a + b, 0) / this.driftHistory.length 
      : 0
    
    const timeSinceLastSync = currentTime - this.lastSyncTime
    const driftCompensation = averageDriftRate * timeSinceLastSync
    
    return currentTime + this.timeOffset + driftCompensation
  }

  // Get time with confidence level
  getSynchronizedTimeWithConfidence(): { time: number; confidence: 'high' | 'medium' | 'low' } {
    const time = this.getSynchronizedTime()
    
    if (this.lastSyncTime === 0) {
      return { time, confidence: 'low' }
    }
    
    const timeSinceLastSync = Date.now() - this.lastSyncTime
    const maxDrift = Math.abs(this.timeOffset) + (this.driftHistory.length > 0 ? 
      Math.max(...this.driftHistory.map(Math.abs)) * timeSinceLastSync : 0)
    
    // High confidence: synced within last 5 minutes and low drift
    if (timeSinceLastSync < 300000 && maxDrift < 1000) {
      return { time, confidence: 'high' }
    }
    
    // Medium confidence: synced within last 30 minutes
    if (timeSinceLastSync < 1800000) {
      return { time, confidence: 'medium' }
    }
    
    // Low confidence: old sync or high drift
    return { time, confidence: 'low' }
  }

  private startPeriodicSync(): void {
    setInterval(() => {
      if (this.isOnline) {
        this.syncWithServer()
      }
    }, this.syncInterval)
  }

  private storeOffset(): void {
    try {
      localStorage.setItem('clock_sync_offset', this.timeOffset.toString())
      localStorage.setItem('clock_sync_timestamp', Date.now().toString())
      localStorage.setItem('clock_sync_drift_history', JSON.stringify(this.driftHistory))
    } catch (error) {
      console.warn('[ClockSync] Failed to store offset:', error)
    }
  }

  private loadStoredOffset(): void {
    try {
      const storedOffset = localStorage.getItem('clock_sync_offset')
      const storedTimestamp = localStorage.getItem('clock_sync_timestamp')
      const storedDriftHistory = localStorage.getItem('clock_sync_drift_history')
      
      if (storedOffset && storedTimestamp) {
        this.timeOffset = parseInt(storedOffset)
        this.lastSyncTime = parseInt(storedTimestamp)
        
        if (storedDriftHistory) {
          this.driftHistory = JSON.parse(storedDriftHistory)
        }
        
        console.log(`[ClockSync] Loaded stored offset: ${this.timeOffset}ms, last sync: ${new Date(this.lastSyncTime).toISOString()}`)
      }
    } catch (error) {
      console.warn('[ClockSync] Failed to load stored offset:', error)
    }
  }

  getSyncStatus(): { 
    isSynced: boolean; 
    lastSync: number; 
    offset: number; 
    isOnline: boolean;
    confidence: 'high' | 'medium' | 'low';
    timeSinceLastSync: number;
  } {
    const timeSinceLastSync = this.lastSyncTime > 0 ? Date.now() - this.lastSyncTime : 0
    const { confidence } = this.getSynchronizedTimeWithConfidence()
    
    return {
      isSynced: this.lastSyncTime > 0,
      lastSync: this.lastSyncTime,
      offset: this.timeOffset,
      isOnline: this.isOnline,
      confidence,
      timeSinceLastSync
    }
  }

  // Force a sync attempt (useful for manual refresh)
  async forceSync(): Promise<boolean> {
    if (!this.isOnline) {
      console.log('[ClockSync] Cannot force sync while offline')
      return false
    }
    
    this.syncAttempts = 0 // Reset attempts for force sync
    await this.syncWithServer()
    return this.syncAttempts === 0 // Success if attempts reset to 0
  }
}

// Usage in timing operations
export const getSynchronizedTime = (): number => {
  return ClockSyncService.getInstance().getSynchronizedTime()
}

export const getSynchronizedTimeWithConfidence = () => {
  return ClockSyncService.getInstance().getSynchronizedTimeWithConfidence()
}
```

#### C. Integration with Existing Timing System
```typescript
// Update useEnhancedSyncManager.ts to use synchronized time
import { getSynchronizedTime, getSynchronizedTimeWithConfidence } from '@/services/clockSync'

// Replace all Date.now() calls with getSynchronizedTime()
const handleLegSync = useCallback(async (...) => {
  // ... existing code ...
  
  // Get synchronized time with confidence level
  const { time: syncTime, confidence } = getSynchronizedTimeWithConfidence()
  
  const payload = {
    id: leg.remoteId,
    number: leg.id,
    distance: leg.distance,
    start_time: leg.actualStart ? new Date(leg.actualStart).toISOString() : null,
    finish_time: leg.actualFinish ? new Date(leg.actualFinish).toISOString() : null,
    synchronized_timestamp: syncTime,
    time_confidence: confidence, // Track confidence level
  }
  
  // Log confidence level for debugging
  if (confidence === 'low') {
    console.warn(`[LegSync] Using low-confidence time for leg ${leg.id}. Consider manual sync.`)
  }
  
  // ... rest of function
}, [queueChange])

// Add offline-aware timing for critical operations
const startNextRunner = useCallback(async (currentLegId: number, nextLegId: number) => {
  const { time: syncTime, confidence } = getSynchronizedTimeWithConfidence()
  
  // For critical timing operations, warn if confidence is low
  if (confidence === 'low') {
    console.warn('[StartNextRunner] Low time confidence - consider syncing with server')
    // Optionally show user notification
    // toast.warning('Time may not be accurate. Consider syncing with server.')
  }
  
  const finishTime = syncTime
  const startTime = syncTime
  
  // ... rest of function using finishTime and startTime
}, [])
```

## 2. Data Recovery & Backup Solution

### Architecture Overview
Implement a multi-layered backup system with local storage, cloud backup, and recovery mechanisms.

### Implementation

#### A. Backup Service
```typescript
// src/services/backupService.ts
import { invokeEdge } from '@/integrations/supabase/edge'
import { getSynchronizedTime } from './clockSync'

export interface BackupEntry {
  id: string
  legId: number
  timestamp: number
  data: {
    actualStart?: number
    actualFinish?: number
    version: number
    checksum: string
  }
  deviceId: string
  operation: 'create' | 'update' | 'delete'
}

export class BackupService {
  private static instance: BackupService
  private readonly maxLocalBackups = 50
  private readonly maxCloudBackups = 100
  private readonly backupInterval = 30000 // 30 seconds

  static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService()
    }
    return BackupService.instance
  }

  async createBackup(leg: any, operation: 'create' | 'update' | 'delete'): Promise<void> {
    const backupEntry: BackupEntry = {
      id: crypto.randomUUID(),
      legId: leg.id,
      timestamp: getSynchronizedTime(),
      data: {
        actualStart: leg.actualStart,
        actualFinish: leg.actualFinish,
        version: leg.version || 0,
        checksum: this.calculateChecksum(leg)
      },
      deviceId: this.getDeviceId(),
      operation
    }

    // Store locally
    this.storeLocalBackup(backupEntry)
    
    // Queue for cloud backup
    await this.queueCloudBackup(backupEntry)
  }

  private storeLocalBackup(backup: BackupEntry): void {
    const backups = this.getLocalBackups()
    backups.push(backup)
    
    // Keep only recent backups per leg
    const legBackups = backups.filter(b => b.legId === backup.legId).slice(-10)
    const otherBackups = backups.filter(b => b.legId !== backup.legId)
    
    const allBackups = [...otherBackups, ...legBackups].slice(-this.maxLocalBackups)
    localStorage.setItem('timing_backups', JSON.stringify(allBackups))
  }

  async recoverFromBackup(legId: number, targetTimestamp?: number): Promise<any | null> {
    // Try local backup first
    const localBackup = this.getLocalBackup(legId, targetTimestamp)
    if (localBackup && this.verifyBackup(localBackup)) {
      console.log(`[BackupService] Recovered from local backup for leg ${legId}`)
      return localBackup.data
    }

    // Try cloud backup
    const cloudBackup = await this.getCloudBackup(legId, targetTimestamp)
    if (cloudBackup && this.verifyBackup(cloudBackup)) {
      console.log(`[BackupService] Recovered from cloud backup for leg ${legId}`)
      return cloudBackup.data
    }

    return null
  }

  private getLocalBackup(legId: number, targetTimestamp?: number): BackupEntry | null {
    const backups = this.getLocalBackups()
    const legBackups = backups.filter(b => b.legId === legId)
    
    if (legBackups.length === 0) return null
    
    if (targetTimestamp) {
      // Find backup closest to target timestamp
      return legBackups.reduce((closest, current) => {
        return Math.abs(current.timestamp - targetTimestamp) < Math.abs(closest.timestamp - targetTimestamp)
          ? current : closest
      })
    }
    
    // Return most recent backup
    return legBackups[legBackups.length - 1]
  }

  private async getCloudBackup(legId: number, targetTimestamp?: number): Promise<BackupEntry | null> {
    try {
      const response = await invokeEdge('backups-list', {
        teamId: this.getTeamId(),
        legId,
        targetTimestamp
      })
      
      if ((response as any).error) return null
      
      return (response as any).data?.backup || null
    } catch (error) {
      console.error('[BackupService] Failed to get cloud backup:', error)
      return null
    }
  }

  private verifyBackup(backup: BackupEntry): boolean {
    const calculatedChecksum = this.calculateChecksum(backup.data)
    return calculatedChecksum === backup.data.checksum
  }

  private calculateChecksum(data: any): string {
    const dataString = JSON.stringify(data)
    return btoa(dataString).slice(0, 16) // 16-character checksum
  }

  private async queueCloudBackup(backup: BackupEntry): Promise<void> {
    const cloudBackupQueue = this.getCloudBackupQueue()
    cloudBackupQueue.push(backup)
    localStorage.setItem('cloud_backup_queue', JSON.stringify(cloudBackupQueue))
    
    // Process queue if online
    if (navigator.onLine) {
      this.processCloudBackupQueue()
    }
  }

  private async processCloudBackupQueue(): Promise<void> {
    const queue = this.getCloudBackupQueue()
    if (queue.length === 0) return

    const batchSize = 10
    const batch = queue.splice(0, batchSize)
    
    try {
      await invokeEdge('backups-upsert', {
        teamId: this.getTeamId(),
        backups: batch
      })
      
      localStorage.setItem('cloud_backup_queue', JSON.stringify(queue))
      console.log(`[BackupService] Uploaded ${batch.length} backups to cloud`)
    } catch (error) {
      console.error('[BackupService] Failed to upload backups:', error)
      // Re-add to queue for retry
      queue.unshift(...batch)
      localStorage.setItem('cloud_backup_queue', JSON.stringify(queue))
    }
  }

  private getLocalBackups(): BackupEntry[] {
    return JSON.parse(localStorage.getItem('timing_backups') || '[]')
  }

  private getCloudBackupQueue(): BackupEntry[] {
    return JSON.parse(localStorage.getItem('cloud_backup_queue') || '[]')
  }

  private getDeviceId(): string {
    return localStorage.getItem('relay_device_id') || 'unknown'
  }

  private getTeamId(): string {
    // Get from store or localStorage
    return localStorage.getItem('relay_team_id') || 'unknown'
  }
}

// Cloud backup edge function
// supabase/functions/backups-upsert/index.ts
```

#### B. Integration with Sync Manager
```typescript
// Update useEnhancedSyncManager.ts
import { BackupService } from '@/services/backupService'

const handleLegSync = useCallback(async (...) => {
  // ... existing validation ...
  
  // Create backup before sync
  await BackupService.getInstance().createBackup(leg, 'update')
  
  // ... existing sync logic ...
  
  // Create backup after successful sync
  if (!(result as any).error) {
    await BackupService.getInstance().createBackup(updatedLeg, 'update')
  }
}, [queueChange])
```

## 3. Network Resilience Solution

### Architecture Overview
Implement intelligent retry logic with exponential backoff, connection quality monitoring, and adaptive sync strategies.

### Implementation

#### A. Network Quality Monitor
```typescript
// src/services/networkMonitor.ts
export interface NetworkMetrics {
  latency: number
  bandwidth: number
  reliability: number
  lastCheck: number
}

export class NetworkMonitor {
  private static instance: NetworkMonitor
  private metrics: NetworkMetrics = {
    latency: 0,
    bandwidth: 0,
    reliability: 1,
    lastCheck: 0
  }
  private checkInterval = 60000 // 1 minute
  private history: NetworkMetrics[] = []

  static getInstance(): NetworkMonitor {
    if (!NetworkMonitor.instance) {
      NetworkMonitor.instance = new NetworkMonitor()
    }
    return NetworkMonitor.instance
  }

  async startMonitoring(): Promise<void> {
    await this.checkNetworkQuality()
    setInterval(() => this.checkNetworkQuality(), this.checkInterval)
  }

  private async checkNetworkQuality(): Promise<void> {
    const startTime = Date.now()
    
    try {
      // Measure latency
      const latency = await this.measureLatency()
      
      // Measure bandwidth (simplified)
      const bandwidth = await this.measureBandwidth()
      
      // Calculate reliability based on recent failures
      const reliability = this.calculateReliability()
      
      this.metrics = {
        latency,
        bandwidth,
        reliability,
        lastCheck: startTime
      }
      
      this.history.push({ ...this.metrics })
      if (this.history.length > 10) {
        this.history.shift()
      }
      
      console.log(`[NetworkMonitor] Quality: ${JSON.stringify(this.metrics)}`)
    } catch (error) {
      console.error('[NetworkMonitor] Failed to check network quality:', error)
    }
  }

  private async measureLatency(): Promise<number> {
    const startTime = Date.now()
    await fetch('/api/ping', { method: 'HEAD' })
    return Date.now() - startTime
  }

  private async measureBandwidth(): Promise<number> {
    // Simplified bandwidth measurement
    const startTime = Date.now()
    const response = await fetch('/api/ping')
    const endTime = Date.now()
    
    if (response.headers.get('content-length')) {
      const size = parseInt(response.headers.get('content-length')!)
      const duration = endTime - startTime
      return size / duration // bytes per millisecond
    }
    
    return 1000 // Default bandwidth
  }

  private calculateReliability(): number {
    // Calculate based on recent sync success/failure rates
    const recentSyncs = JSON.parse(localStorage.getItem('sync_history') || '[]')
    const recentCount = recentSyncs.slice(-20).length
    const successCount = recentSyncs.slice(-20).filter((s: any) => s.success).length
    
    return recentCount > 0 ? successCount / recentCount : 1
  }

  getNetworkQuality(): NetworkMetrics {
    return { ...this.metrics }
  }

  shouldRetry(attempt: number): boolean {
    const { reliability, latency } = this.metrics
    
    // Don't retry if network is very poor
    if (reliability < 0.3) return false
    
    // Adjust retry strategy based on latency
    const maxRetries = latency > 5000 ? 3 : 5
    
    return attempt < maxRetries
  }

  getRetryDelay(attempt: number): number {
    const { latency, reliability } = this.metrics
    
    // Base delay with exponential backoff
    let baseDelay = Math.min(1000 * Math.pow(2, attempt - 1), 30000)
    
    // Adjust based on network quality
    if (latency > 2000) baseDelay *= 1.5
    if (reliability < 0.7) baseDelay *= 1.2
    
    return Math.min(baseDelay, 60000) // Max 60 seconds
  }
}
```

#### B. Enhanced Retry Logic
```typescript
// src/services/retryService.ts
import { NetworkMonitor } from './networkMonitor'

export class RetryService {
  private static instance: RetryService
  private networkMonitor = NetworkMonitor.getInstance()

  static getInstance(): RetryService {
    if (!RetryService.instance) {
      RetryService.instance = new RetryService()
    }
    return RetryService.instance
  }

  async withRetry<T>(
    operation: () => Promise<T>,
    context: string,
    maxRetries?: number
  ): Promise<T> {
    let lastError: Error
    
    for (let attempt = 1; attempt <= (maxRetries || 5); attempt++) {
      try {
        const result = await operation()
        
        // Log success
        this.logSyncAttempt(context, true, attempt)
        return result
        
      } catch (error) {
        lastError = error as Error
        
        // Log failure
        this.logSyncAttempt(context, false, attempt, error)
        
        // Check if we should retry
        if (!this.networkMonitor.shouldRetry(attempt)) {
          console.log(`[RetryService] Giving up after ${attempt} attempts for ${context}`)
          break
        }
        
        // Wait before retry
        const delay = this.networkMonitor.getRetryDelay(attempt)
        console.log(`[RetryService] Retrying ${context} in ${delay}ms (attempt ${attempt})`)
        await this.delay(delay)
      }
    }
    
    throw lastError!
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private logSyncAttempt(context: string, success: boolean, attempt: number, error?: any): void {
    const syncHistory = JSON.parse(localStorage.getItem('sync_history') || '[]')
    syncHistory.push({
      context,
      success,
      attempt,
      timestamp: Date.now(),
      error: error?.message
    })
    
    // Keep only last 100 entries
    if (syncHistory.length > 100) {
      syncHistory.splice(0, syncHistory.length - 100)
    }
    
    localStorage.setItem('sync_history', JSON.stringify(syncHistory))
  }
}
```

#### C. Integration with Sync Manager
```typescript
// Update useEnhancedSyncManager.ts
import { RetryService } from '@/services/retryService'
import { NetworkMonitor } from '@/services/networkMonitor'

const handleLegSync = useCallback(async (...) => {
  // ... existing validation ...
  
  const retryService = RetryService.getInstance()
  
  try {
    const result = await retryService.withRetry(
      async () => {
        return await invokeEdge('legs-upsert', {
          teamId: storeRef.current.teamId,
          deviceId,
          legs: [payload],
          action: 'upsert'
        })
      },
      `leg-sync-${legId}-${field}`
    )
    
    // ... handle success
  } catch (error) {
    // ... handle final failure
  }
}, [queueChange])
```

## 4. Performance & Scalability Solution

### Architecture Overview
Implement intelligent caching, pagination, and optimistic updates to handle large datasets and many concurrent users.

### Implementation

#### A. Intelligent Caching Service
```typescript
// src/services/cacheService.ts
export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  version: number
}

export class CacheService {
  private static instance: CacheService
  private cache = new Map<string, CacheEntry<any>>()
  private readonly maxCacheSize = 100
  private readonly defaultTTL = 300000 // 5 minutes

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService()
    }
    return CacheService.instance
  }

  set<T>(key: string, data: T, ttl: number = this.defaultTTL, version?: number): void {
    // Evict if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldest()
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      version: version || 0
    })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) return null
    
    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }
    
    return entry.data
  }

  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }

  private evictOldest(): void {
    let oldestKey: string | null = null
    let oldestTime = Date.now()
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }
}
```

#### B. Optimistic Updates
```typescript
// src/services/optimisticUpdates.ts
export class OptimisticUpdateService {
  private static instance: OptimisticUpdateService
  private pendingUpdates = new Map<string, any>()
  private cacheService = CacheService.getInstance()

  static getInstance(): OptimisticUpdateService {
    if (!OptimisticUpdateService.instance) {
      OptimisticUpdateService.instance = new OptimisticUpdateService()
    }
    return OptimisticUpdateService.instance
  }

  async updateLegOptimistically(
    legId: number,
    updates: any,
    syncOperation: () => Promise<any>
  ): Promise<void> {
    const updateId = `leg-${legId}-${Date.now()}`
    
    // Apply optimistic update immediately
    this.applyOptimisticUpdate(legId, updates)
    
    // Store pending update
    this.pendingUpdates.set(updateId, {
      legId,
      updates,
      timestamp: Date.now()
    })
    
    try {
      // Perform actual sync
      await syncOperation()
      
      // Remove from pending updates
      this.pendingUpdates.delete(updateId)
      
      // Invalidate cache
      this.cacheService.invalidate(`leg-${legId}`)
      
    } catch (error) {
      // Revert optimistic update on failure
      this.revertOptimisticUpdate(legId, updates)
      this.pendingUpdates.delete(updateId)
      throw error
    }
  }

  private applyOptimisticUpdate(legId: number, updates: any): void {
    // Update store immediately for better UX
    // This would integrate with your existing store
    console.log(`[OptimisticUpdate] Applied optimistic update for leg ${legId}`)
  }

  private revertOptimisticUpdate(legId: number, updates: any): void {
    // Revert the optimistic update
    console.log(`[OptimisticUpdate] Reverted optimistic update for leg ${legId}`)
  }

  getPendingUpdates(): Map<string, any> {
    return new Map(this.pendingUpdates)
  }
}
```

#### C. Pagination for Large Datasets
```typescript
// Update legs-list edge function to support pagination
// supabase/functions/legs-list/index.ts

serve(async (req) => {
  // ... existing code ...
  
  const { teamId, deviceId, page = 1, limit = 50 } = await req.json()
  
  const offset = (page - 1) * limit
  
  const { data: legs, error } = await supabase
    .from('legs')
    .select('*')
    .eq('team_id', teamId)
    .order('number', { ascending: true })
    .range(offset, offset + limit - 1)
  
  // Get total count for pagination info
  const { count } = await supabase
    .from('legs')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', teamId)
  
  return new Response(
    JSON.stringify({
      legs: legs || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
```

#### D. Integration with Sync Manager
```typescript
// Update useEnhancedSyncManager.ts
import { CacheService } from '@/services/cacheService'
import { OptimisticUpdateService } from '@/services/optimisticUpdates'

const fetchLatestData = useCallback(async () => {
  // ... existing code ...
  
  const cacheService = CacheService.getInstance()
  const cacheKey = `legs-${storeRef.current.teamId}`
  
  // Try cache first
  const cachedLegs = cacheService.get(cacheKey)
  if (cachedLegs) {
    console.log('[useEnhancedSyncManager] Using cached legs data')
    // Apply cached data with conflict detection
    mergeWithConflictDetection(cachedLegs, storeRef.current.legs, updateAction, 'legs')
  }
  
  // Fetch fresh data in background
  const legsResult = await invokeEdge<{ legs: Tables<'legs'>[] }>('legs-list', { 
    teamId: storeRef.current.teamId, 
    deviceId,
    page: 1,
    limit: 100 // Adjust based on race size
  })
  
  if (!(legsResult as any).error) {
    const remoteLegs = (legsResult as any).data?.legs ?? []
    
    // Cache the fresh data
    cacheService.set(cacheKey, remoteLegs, 60000) // 1 minute TTL
    
    // ... rest of processing
  }
}, [])

// Use optimistic updates for better UX
const handleLegSync = useCallback(async (...) => {
  const optimisticService = OptimisticUpdateService.getInstance()
  
  await optimisticService.updateLegOptimistically(
    legId,
    { [field]: value },
    async () => {
      // Actual sync operation
      return await invokeEdge('legs-upsert', {
        teamId: storeRef.current.teamId,
        deviceId,
        legs: [payload],
        action: 'upsert'
      })
    }
  )
}, [queueChange])
```

## Integration Summary

These solutions provide:

1. **Clock Synchronization**: Accurate timing across devices with drift compensation
2. **Data Recovery**: Multi-layered backup with local and cloud storage
3. **Network Resilience**: Intelligent retry logic with quality-based adaptation
4. **Performance**: Caching, optimistic updates, and pagination for scalability

All solutions integrate seamlessly with your existing Supabase infrastructure and Zustand state management, providing significant improvements in user experience and system reliability while maintaining the current architecture patterns.
