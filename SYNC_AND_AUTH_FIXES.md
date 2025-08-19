# Database Sync and Authentication Fixes

## Issues Identified

You correctly identified two main problems:

1. **Database sync not triggered**: The `startNextRunner` function was working locally but not syncing to the database
2. **Service Worker authentication failures**: HTTP 401 errors indicated authentication issues with background sync

## Root Cause Analysis

### Issue 1: Database Sync Not Triggered

**Problem**: The event handler in `useEnhancedSyncManager.ts` was expecting `currentRunnerId` and `nextRunnerId` in the payload, but the `startNextRunner` function was sending `currentLegId` and `nextLegId`.

**Root Cause**: Parameter naming mismatch between the event publisher and subscriber.

### Issue 2: Service Worker Authentication Failures

**Problem**: The service worker was making unauthenticated requests to Supabase Edge Functions, resulting in HTTP 401 errors.

**Root Cause**: Service workers don't have access to environment variables or the main application's authentication state.

## Solutions Implemented

### Fix 1: Database Sync Parameter Mismatch

#### Updated Event Handler (`src/hooks/useEnhancedSyncManager.ts`)

**Before:**
```typescript
const unsubscribeStartRunner = eventBus.subscribe(EVENT_TYPES.START_RUNNER, async (event) => {
  const { currentRunnerId, nextRunnerId, finishTime, startTime, timestamp } = event.payload;
  await handleStartRunnerSync(currentRunnerId, nextRunnerId, finishTime, startTime);
});
```

**After:**
```typescript
const unsubscribeStartRunner = eventBus.subscribe(EVENT_TYPES.START_RUNNER, async (event) => {
  const { currentLegId, nextLegId, finishTime, startTime, timestamp } = event.payload;
  await handleStartRunnerSync(currentLegId, nextLegId, finishTime, startTime);
});
```

#### Enhanced Function Signature

**Before:**
```typescript
const handleStartRunnerSync = useCallback(async (
  currentRunnerId: number,
  nextRunnerId: number,
  finishTime: number,
  startTime: number
) => {
```

**After:**
```typescript
const handleStartRunnerSync = useCallback(async (
  currentLegId: number | null,
  nextLegId: number,
  finishTime: number | undefined,
  startTime: number
) => {
```

#### Added First Leg Scenario Handling

```typescript
// Handle first leg scenario (currentLegId = null)
if (currentLegId === null) {
  console.log(`[useEnhancedSyncManager] Syncing first leg start: leg ${nextLegId}`);
  
  // Only sync the next leg start
  const syncKey = `start-runner-first-${nextLegId}`;
  
  // ... comprehensive first leg sync logic
  return;
}
```

### Fix 2: Service Worker Authentication

#### Updated Service Worker Configuration (`src/hooks/useTeamSync.ts`)

**Before:**
```typescript
const sendSupabaseUrlToServiceWorker = () => {
  navigator.serviceWorker.controller.postMessage({
    type: 'UPDATE_SUPABASE_URL',
    supabaseUrl: supabaseUrl
  });
};
```

**After:**
```typescript
const sendSupabaseUrlToServiceWorker = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseAnonKey) {
    navigator.serviceWorker.controller.postMessage({
      type: 'UPDATE_SUPABASE_CONFIG',
      supabaseUrl: supabaseUrl,
      supabaseAnonKey: supabaseAnonKey
    });
  }
};
```

#### Updated Service Worker Message Handler (`public/sw.js`)

**Before:**
```javascript
if (event.data && event.data.type === 'UPDATE_SUPABASE_URL') {
  supabaseUrl = event.data.supabaseUrl;
}
```

**After:**
```javascript
if (event.data && event.data.type === 'UPDATE_SUPABASE_CONFIG') {
  supabaseUrl = event.data.supabaseUrl;
  supabaseAnonKey = event.data.supabaseAnonKey;
}
```

#### Fixed API Calls in Service Worker

**Before:**
```javascript
const response = await fetch(`${supabaseUrl}/functions/v1/legs-list?teamId=${teamId}`);
```

**After:**
```javascript
const legsResponse = await fetch(`${supabaseUrl}/functions/v1/legs-list`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAnonKey}`
  },
  body: JSON.stringify({ teamId })
});
```

## Key Improvements

### 1. **Parameter Consistency**
- Aligned parameter names between event publisher and subscriber
- Used semantic naming (`currentLegId` vs `currentRunnerId`)
- Added proper TypeScript types for null handling

### 2. **First Leg Scenario Support**
- Proper handling of `currentLegId = null` for first leg starts
- Separate sync logic for first leg vs regular transitions
- Comprehensive error handling and retry logic

### 3. **Service Worker Authentication**
- Proper authentication headers for all API calls
- Secure transmission of credentials from main app to service worker
- Consistent API call format (POST with JSON body)

### 4. **Enhanced Error Handling**
- Type-safe handling of optional parameters
- Comprehensive retry logic for failed syncs
- Proper cleanup of pending sync operations

## Testing Results

- ✅ Build completes successfully
- ✅ TypeScript compilation passes
- ✅ Parameter validation works correctly
- ✅ First leg scenario handled properly
- ✅ Service worker authentication implemented
- ✅ Database sync events properly triggered

## Expected Behavior After Fixes

### Database Sync
1. **First Leg Start**: `startNextRunner(null, 1)` → Syncs leg 1 start time to database
2. **Regular Transitions**: `startNextRunner(5, 6)` → Syncs leg 5 finish and leg 6 start
3. **Final Leg**: `startNextRunner(35, 36)` → Syncs leg 35 finish and leg 36 start

### Service Worker
1. **Authentication**: All API calls include proper Bearer token
2. **Background Sync**: Periodic checks for race updates work correctly
3. **Notifications**: Real-time notifications for race events

## Future Considerations

1. **Token Refresh**: Implement automatic token refresh for long-running service workers
2. **Offline Support**: Enhanced offline queue management
3. **Conflict Resolution**: Better handling of concurrent updates
4. **Performance**: Optimize sync frequency and payload size

These fixes ensure that race events are properly synchronized across all devices and that the service worker can reliably check for updates in the background.
