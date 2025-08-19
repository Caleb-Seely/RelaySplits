# Current Runner Card Sync Issue - Analysis and Fix

## Problem Description

Users were experiencing an issue where:
1. Notifications indicated that new data was synced successfully
2. But the current runner card in the UI did not update properly
3. The issue occurred specifically when clicking "Start Runner"

## Root Cause Analysis

### The Issue
When clicking "Start Runner", the system performs two separate operations:
1. **Finish current runner** - Sets `actualFinish` time for the current leg
2. **Start next runner** - Sets `actualStart` time for the next leg

### The Problem
These operations were being processed as **separate sync events**, which could lead to:
- **Timing gaps**: Brief moments where no runner is "current"
- **Race conditions**: Server receiving updates out of order
- **UI inconsistencies**: UI refreshing before both updates are processed

### Current Runner Detection Logic
The `getCurrentRunner` function determines the current runner based on:
```typescript
if (leg.actualStart && leg.actualStart <= currentTime && !leg.actualFinish) {
  return leg;
}
```

This means a runner is "current" only if they have started but not finished.

## The Fix

### 1. Atomic Start Runner Function
Added a new `startNextRunner` function in `raceStore.ts` that:
- Updates both finish and start times in a single atomic operation
- Prevents timing gaps between runner transitions
- Ensures consistent state

### 2. New Event Type
Added `START_RUNNER` event type to handle atomic start/finish operations:
```typescript
START_RUNNER: 'start_runner', // Atomic start runner action
```

### 3. Enhanced Sync Manager
Updated `useEnhancedSyncManager.ts` to:
- Handle the new `START_RUNNER` event
- Sync both leg updates together in a single API call
- Prevent race conditions between separate updates

### 4. Updated Dashboard
Modified the "Start Runner" button to use the new atomic function:
```typescript
// Before: Two separate calls
updateLegActualTime(currentRunner.id, 'actualFinish', Date.now());
updateLegActualTime(nextRunner.id, 'actualStart', Date.now());

// After: Single atomic call
startNextRunner(currentRunner.id, nextRunner.id);
```

## Technical Implementation

### Race Store Changes
- Added `startNextRunner` function to interface and implementation
- Function updates both legs atomically in local state
- Publishes single `START_RUNNER` event instead of two separate `LEG_UPDATE` events

### Sync Manager Changes
- Added `handleStartRunnerSync` function
- Sends both leg updates in single API call to `legs-upsert`
- Maintains offline queue support for both updates

### Event Bus Changes
- Added `START_RUNNER` event type
- Maintains high priority for immediate sync

## Benefits

1. **Eliminates Timing Gaps**: No more brief moments where no runner is current
2. **Prevents Race Conditions**: Both updates are sent together
3. **Improves UI Consistency**: Current runner card updates immediately and correctly
4. **Maintains Offline Support**: Both updates are queued together for offline scenarios
5. **Better Error Handling**: If one update fails, both are retried together

## Testing

To verify the fix:
1. Click "Start Runner" button
2. Verify current runner card updates immediately
3. Check that no timing gaps occur between runner transitions
4. Verify sync notifications still work correctly
5. Test offline scenarios to ensure both updates are queued

## Files Modified

- `src/store/raceStore.ts` - Added atomic startNextRunner function
- `src/utils/eventBus.ts` - Added START_RUNNER event type
- `src/hooks/useEnhancedSyncManager.ts` - Added handleStartRunnerSync function
- `src/components/Dashboard.tsx` - Updated to use atomic function
- `src/utils/raceUtils.ts` - Improved getCurrentRunner sorting

This fix ensures that the current runner card updates properly and consistently when starting new runners, eliminating the sync notification issue while maintaining data integrity.
