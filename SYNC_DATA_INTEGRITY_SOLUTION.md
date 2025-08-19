# Sync Data Integrity Issue: Root Cause Analysis & Solution

## Problem Statement

Start and finish times for runners are being randomly erased during sync operations between devices. This appears to be a data consistency issue where timing data is lost during the synchronization process.

## Root Cause Analysis

After comprehensive code analysis, I've identified **two primary root causes** for the data erasure issue:

### 1. **Complete Item Replacement in Merge Function** (HIGH SEVERITY)

**Location**: `src/hooks/useEnhancedSyncManager.ts:650`

**Issue**: The `mergeWithConflictDetection` function completely replaces local items with server items when the server data is newer, regardless of which fields actually changed.

```typescript
// PROBLEMATIC CODE:
if (!localItem || !localItem.updated_at || new Date(incomingItem.updated_at!) > new Date(localItem.updated_at)) {
  const existingIndex = mergedItems.findIndex(item => item.id === incomingItem.id);
  if (existingIndex !== -1) {
    mergedItems[existingIndex] = incomingItem; // ⚠️ Complete replacement
  }
}
```

**Scenario**: 
- Device A has a leg with both `actualStart` and `actualFinish` times
- Device B updates only the `actualStart` time (finish time is null)
- Server receives Device B's update first and stores it
- When Device A syncs, the server data (missing finish time) overwrites the local data (with finish time)

### 2. **Incomplete Sync Payloads** (HIGH SEVERITY)

**Location**: `src/hooks/useEnhancedSyncManager.ts:80-100`

**Issue**: Sync payloads only include the specific field being updated, not the complete leg data.

```typescript
// PROBLEMATIC CODE:
const payload = {
  id: leg.remoteId,
  number: leg.id,
  distance: leg.distance,
  [field === 'actualStart' ? 'start_time' : 'finish_time']: value ? new Date(value).toISOString() : null
};
```

**Scenario**:
- When syncing a start time, the payload doesn't include the finish time
- If the server processes this as a complete replacement, the finish time could be lost
- The database upsert function should handle partial updates correctly, but the incomplete payload increases risk

## Secondary Contributing Factors

### 3. **Race Conditions** (MEDIUM SEVERITY)
Multiple devices updating the same leg simultaneously could cause data overwrites if sync timing is not properly coordinated.

### 4. **Event Processing Order** (MEDIUM SEVERITY)
Network delays could cause events to be processed out of order, leading to inconsistent state.

## Validation Plan

To confirm this analysis, I've created two test scripts:

1. **`test-sync-data-integrity.js`** - Comprehensive validation tests
2. **`analyze-sync-issue.js`** - Focused code path analysis

### Test Scenarios to Validate:

1. **Database Upsert Integrity**: Verify partial updates preserve existing fields
2. **Sync Manager Merge Logic**: Test the complete replacement behavior
3. **Projection Recalculation**: Ensure actual times aren't overwritten
4. **Event Bus Processing**: Verify event order consistency
5. **Conflict Detection**: Test timing conflict resolution

## Proposed Solutions

### Solution 1: Implement Field-Level Merging (CRITICAL)

**File**: `src/hooks/useEnhancedSyncManager.ts`

Replace the complete item replacement with field-level merging:

```typescript
// NEW IMPLEMENTATION:
const mergeWithConflictDetection = useCallback((
  incomingItems: any[],
  localItems: any[],
  updateAction: (items: any[]) => void,
  table: 'runners' | 'legs'
) => {
  const localItemsMap = new Map(localItems.map((item) => [item.id, item]));
  const mergedItems = [...localItems];

  for (const incomingItem of incomingItems) {
    const localItem = localItemsMap.get(incomingItem.id);

    if (!localItem || !localItem.updated_at || new Date(incomingItem.updated_at!) > new Date(localItem.updated_at)) {
      const existingIndex = mergedItems.findIndex(item => item.id === incomingItem.id);
      
      if (existingIndex !== -1) {
        // FIELD-LEVEL MERGING: Preserve existing fields that aren't in incoming data
        const existingItem = mergedItems[existingIndex];
        const mergedItem = {
          ...existingItem,  // Keep all existing fields
          ...incomingItem,  // Override with incoming fields
          // Preserve critical timing fields if they exist locally but not in incoming data
          ...(table === 'legs' && {
            actualStart: incomingItem.actualStart ?? existingItem.actualStart,
            actualFinish: incomingItem.actualFinish ?? existingItem.actualFinish,
          })
        };
        mergedItems[existingIndex] = mergedItem;
      } else {
        mergedItems.push(incomingItem);
      }
    }
  }
  
  // ... rest of function
}, [onConflictDetected]);
```

### Solution 2: Complete Sync Payloads (CRITICAL)

**File**: `src/hooks/useEnhancedSyncManager.ts`

Modify sync payloads to include all leg data:

```typescript
// NEW IMPLEMENTATION:
const handleLegSync = useCallback(async (
  legId: number,
  field: 'actualStart' | 'actualFinish',
  value: number | null,
  previousValue: number | null,
  runnerId: number
) => {
  // ... existing validation ...

  // Get the complete leg data for the payload
  const leg = storeRef.current.legs.find(l => l.id === legId);
  if (!leg?.remoteId) return;

  // COMPLETE PAYLOAD: Include all leg data, not just the changed field
  const payload = {
    id: leg.remoteId,
    number: leg.id,
    distance: leg.distance,
    start_time: leg.actualStart ? new Date(leg.actualStart).toISOString() : null,
    finish_time: leg.actualFinish ? new Date(leg.actualFinish).toISOString() : null,
    // Include any other fields that should be preserved
  };

  // ... rest of function
}, [queueChange]);
```

### Solution 3: Add Data Validation (IMPORTANT)

**File**: `src/hooks/useEnhancedSyncManager.ts`

Add validation before and after sync operations:

```typescript
// NEW VALIDATION FUNCTION:
const validateLegDataIntegrity = (leg: any, operation: string) => {
  const issues = [];
  
  // Check for timing consistency
  if (leg.actualStart && leg.actualFinish && leg.actualFinish <= leg.actualStart) {
    issues.push(`Invalid timing: finish (${leg.actualFinish}) <= start (${leg.actualStart})`);
  }
  
  // Check for missing critical data
  if (leg.actualStart && !leg.actualFinish && Date.now() - leg.actualStart > 3600000) {
    issues.push('Leg started over 1 hour ago but has no finish time');
  }
  
  if (issues.length > 0) {
    console.warn(`[${operation}] Data integrity issues for leg ${leg.id}:`, issues);
    return false;
  }
  
  return true;
};

// Use in sync functions:
const handleLegSync = useCallback(async (...) => {
  // ... existing code ...
  
  // Validate before sync
  if (!validateLegDataIntegrity(leg, 'pre-sync')) {
    console.error('Pre-sync validation failed, aborting sync');
    return;
  }
  
  // ... sync operation ...
  
  // Validate after sync
  if (!validateLegDataIntegrity(updatedLeg, 'post-sync')) {
    console.error('Post-sync validation failed, data may be corrupted');
    // Trigger recovery mechanism
  }
}, [queueChange]);
```

### Solution 4: Implement Optimistic Locking (IMPORTANT)

**File**: `src/hooks/useEnhancedSyncManager.ts`

Add version-based conflict detection:

```typescript
// NEW VERSION TRACKING:
const handleLegSync = useCallback(async (...) => {
  // ... existing code ...
  
  // Add version to payload
  const payload = {
    ...completePayload,
    version: (leg.version || 0) + 1,
    last_modified_by: getDeviceId()
  };
  
  // Check for conflicts on server side
  const result = await invokeEdge('legs-upsert', {
    teamId: storeRef.current.teamId,
    deviceId,
    legs: [payload],
    action: 'upsert',
    checkVersion: true // New parameter for version checking
  });
  
  if ((result as any).conflict) {
    console.warn('Version conflict detected, triggering conflict resolution');
    // Handle conflict resolution
    return;
  }
  
  // ... rest of function
}, [queueChange]);
```

### Solution 5: Enhanced Logging and Monitoring (IMPORTANT)

**File**: `src/utils/logger.ts`

Add comprehensive sync logging:

```typescript
// NEW LOGGING:
export const syncLogger = {
  // ... existing methods ...
  
  dataIntegrity: (operation: string, legId: number, before: any, after: any) => {
    console.log(`[DATA_INTEGRITY] ${operation} for leg ${legId}:`, {
      before: {
        actualStart: before.actualStart,
        actualFinish: before.actualFinish,
        version: before.version
      },
      after: {
        actualStart: after.actualStart,
        actualFinish: after.actualFinish,
        version: after.version
      },
      changes: {
        startTimeChanged: before.actualStart !== after.actualStart,
        finishTimeChanged: before.actualFinish !== after.actualFinish,
        dataLost: (before.actualStart && !after.actualStart) || 
                 (before.actualFinish && !after.actualFinish)
      }
    });
  }
};
```

## Implementation Priority

1. **IMMEDIATE** (Critical): Implement field-level merging (Solution 1)
2. **IMMEDIATE** (Critical): Complete sync payloads (Solution 2)
3. **HIGH** (Important): Add data validation (Solution 3)
4. **MEDIUM** (Important): Enhanced logging (Solution 5)
5. **LOW** (Future): Optimistic locking (Solution 4)

## Testing Strategy

1. **Unit Tests**: Test the new merge logic with various scenarios
2. **Integration Tests**: Test sync operations between multiple devices
3. **Stress Tests**: Test concurrent updates to the same leg
4. **Data Integrity Tests**: Verify no data loss during sync operations

## Monitoring and Alerting

1. **Data Loss Alerts**: Monitor for legs that lose timing data
2. **Sync Conflict Alerts**: Monitor for version conflicts
3. **Performance Monitoring**: Track sync operation performance
4. **Error Rate Monitoring**: Track sync failure rates

## Rollback Plan

If the solution causes issues:

1. **Feature Flag**: Implement a feature flag to toggle between old and new merge logic
2. **Gradual Rollout**: Deploy to a subset of users first
3. **Monitoring**: Closely monitor data integrity metrics
4. **Quick Rollback**: Ability to revert to previous implementation within minutes

## Conclusion

The primary issue is the complete item replacement in the merge function combined with incomplete sync payloads. The proposed solutions address both the root cause and add additional safeguards to prevent future data loss.

The field-level merging approach is the most critical fix as it ensures that existing data is preserved even when server data is newer, while the complete payload approach reduces the risk of data loss during sync operations.
