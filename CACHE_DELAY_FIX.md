# Cache Delay Fix for Start Runner UI

## Problem
After clicking "Start Runner", the current runner card would disappear immediately but take several seconds to show the new information. This was caused by aggressive caching in the `getCurrentRunner` function.

## Root Cause Analysis

### Caching Issue
The `getCurrentRunner` function had a **5-second cache window** that was preventing immediate UI updates:

```typescript
// Before (problematic)
if (currentRunnerCache.legsHash === legsHash && timeDiff < 5000) {
  return currentRunnerCache.result; // Returns cached result for up to 5 seconds
}
```

### What Was Happening
1. User clicks "Start Runner"
2. Local state updates immediately
3. `getCurrentRunner` is called to determine current runner
4. Function returns cached result for up to 5 seconds
5. UI shows old data until cache expires
6. After 5 seconds, fresh calculation happens and UI updates

## Solution

### 1. Reduced Cache Window
**File**: `src/utils/raceUtils.ts`

```typescript
// After (optimized)
if (currentRunnerCache.legsHash === legsHash && timeDiff < 1000) {
  return currentRunnerCache.result; // Reduced from 5 seconds to 1 second
}
```

### 2. Added Cache Clearing Function
**File**: `src/utils/raceUtils.ts`

```typescript
// Function to clear cache when legs data changes
export function clearRunnerCache() {
  currentRunnerCache = {
    legsHash: null,
    currentTime: null,
    result: null
  };
  nextRunnerCache = {
    legsHash: null,
    currentTime: null,
    raceStartTime: null,
    result: null
  };
}
```

### 3. Cache Clearing in State Updates
**File**: `src/store/raceStore.ts`

#### In `startNextRunner`:
```typescript
const finalLegs = recalculateProjections(updatedLegs, nextLegIndex, state.runners, state.startTime);

// Clear runner cache to ensure immediate UI updates
clearRunnerCache();

// Publish event for sync
eventBus.publish({...});
```

#### In `updateLegActualTime`:
```typescript
const finalLegs = recalculateProjections(updatedLegs, legIndex, state.runners, state.startTime);

// Clear runner cache to ensure immediate UI updates
clearRunnerCache();

// Publish high-priority data event for sync
eventBus.publish({...});
```

#### In `setRaceData`:
```typescript
setRaceData: (data) => {
  // Clear runner cache if legs data is being updated
  if (data.legs) {
    clearRunnerCache();
  }
  set((state) => ({ ...state, ...data }));
}
```

## Results

### Before Fix
```
User clicks "Start Runner"
↓
Local state updates (immediate)
↓
getCurrentRunner called
↓
Returns cached result (up to 5 seconds)
↓
UI shows old data
↓
After 5 seconds, fresh calculation
↓
UI finally updates
```

### After Fix
```
User clicks "Start Runner"
↓
Local state updates (immediate)
↓
clearRunnerCache() called
↓
getCurrentRunner called
↓
Cache is empty, fresh calculation
↓
UI shows new data immediately
```

## Impact

- **User Experience**: Immediate visual feedback when starting runners
- **Performance**: Faster UI updates without sacrificing caching benefits
- **Reliability**: Consistent behavior across all state changes
- **Maintainability**: Clear separation between caching and state management

## Files Modified

1. `src/utils/raceUtils.ts` - Reduced cache window and added cache clearing function
2. `src/store/raceStore.ts` - Added cache clearing to state update functions
3. `CACHE_DELAY_FIX.md` - This documentation

## Testing

Created and ran test scenarios that confirmed:
- ✅ Cache window reduced from 5 seconds to 1 second
- ✅ Cache clearing forces immediate fresh calculations
- ✅ UI updates immediately when starting runners
- ✅ No performance impact on normal operations

The fix ensures that users get immediate visual feedback when starting runners while maintaining the performance benefits of caching for other operations.
