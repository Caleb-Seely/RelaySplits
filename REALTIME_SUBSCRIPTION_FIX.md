# Real-Time Subscription Fix

## Problem Description

When clicking "Start runner", the real-time subscription was being closed and then re-subscribed, causing unnecessary network overhead and potential data loss. This was happening because:

1. The `useEffect` in Dashboard had `getQueueStatus` in its dependency array
2. `getQueueStatus` was being recreated on every render due to its dependencies on state variables
3. This caused the `useEffect` to re-run, cleaning up and recreating the subscription
4. The `setupRealtimeSubscriptions` function also had unstable dependencies

## Root Cause Analysis

The issue was in the dependency arrays of several functions:

1. **Dashboard useEffect**: Included `getQueueStatus` which changes frequently
2. **setupRealtimeSubscriptions**: Had dependencies on `store.legs.length` and `store.lastSyncedAt` which change frequently
3. **performSmartSync** and **fetchLatestData**: Had dependencies on store state that changes frequently

## Solution Implemented

### 1. Removed Unnecessary Dependencies

- Removed `getQueueStatus` from Dashboard's `useEffect` dependency array since it's only used inside the `setInterval` callback
- The `setInterval` doesn't need to be recreated when `getQueueStatus` changes

### 2. Used Refs for Stable Access

- Added `storeRef` to provide stable access to the store without causing function recreation
- Updated all functions to use `storeRef.current` instead of direct store access
- This prevents the functions from being recreated when store state changes

### 3. Optimized Function Dependencies

- `setupRealtimeSubscriptions`: Now only depends on `[performSmartSync, fetchLatestData]`
- `performSmartSync`: Now only depends on `[processQueue]`
- `fetchLatestData`: Now has no dependencies (uses refs for all store access)
- `handleLegSync` and `handleRunnerSync`: Now only depend on `[queueChange]`

### 4. Fixed API Calls

- Replaced `safeUpdate` calls with direct `invokeEdge` calls
- Fixed `queueChange` calls to use the correct object parameter format

## Benefits

1. **Stable Subscriptions**: Real-time subscriptions are no longer recreated unnecessarily
2. **Better Performance**: Reduced network overhead and API calls
3. **Improved Reliability**: Less chance of missing real-time updates during subscription recreation
4. **Cleaner Code**: More predictable function dependencies and behavior

## Testing

To verify the fix:

1. Open the application and navigate to a team dashboard
2. Click "Start runner" multiple times
3. Check the browser console - you should no longer see:
   - "Cleaning up real-time subscription"
   - "Real-time subscription was closed unexpectedly"
   - "Setting up real-time subscriptions for team" (repeatedly)

The subscription should remain stable and only be set up once when the component mounts.

## Files Modified

- `src/components/Dashboard.tsx`: Removed `getQueueStatus` from dependency array
- `src/hooks/useEnhancedSyncManager.ts`: 
  - Added `storeRef` for stable store access
  - Updated all functions to use refs instead of direct store access
  - Optimized dependency arrays
  - Fixed API call patterns
