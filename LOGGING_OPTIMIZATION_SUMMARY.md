# Logging Optimization Summary

## Problem Identified

The application was generating excessive console logs, particularly:

1. **`getNextRunner` function logs**: Running every second due to frequent `currentTime` updates
2. **Service Worker logs**: Background sync checks logging every 30 seconds
3. **Redundant information**: Same race state being logged repeatedly when race hasn't started

## Root Causes

1. **Frequent Updates**: `DemoLanding` component updates `currentTime` every second with `setInterval`
2. **Unconditional Logging**: Development logs running on every function call regardless of state changes
3. **Service Worker Noise**: Background sync logging every check instead of on significant events

## Solutions Implemented

### 1. Optimized `getNextRunner` Logging (`src/utils/raceUtils.ts`)

**Before**: Logged every call in development mode
```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('[getNextRunner] Checking', sortedLegs.length, 'legs for next runner');
  // ... more logs
}
```

**After**: Only log when there's significant change or race hasn't started
```typescript
const shouldLog = process.env.NODE_ENV === 'development' && 
  (sortedLegs.length === 0 || !raceStartTime || currentTime < raceStartTime - 60000);
```

### 2. Reduced Service Worker Logging (`public/sw.js`)

**Before**: Logged every background sync check
```javascript
console.log('[SW] Checking for race updates...');
```

**After**: Only log every 10th check to reduce noise
```javascript
const checkCount = await getCheckCount();
const shouldLog = checkCount % 10 === 0;
if (shouldLog) {
  console.log('[SW] Checking for race updates... (check #' + checkCount + ')');
}
```

### 3. Memoized Expensive Calculations (`src/components/DemoLanding.tsx`)

**Before**: Recalculating on every render
```typescript
const currentRunner = getCurrentRunner(demoLegs, currentTime);
const nextRunner = getNextRunner(demoLegs, currentTime);
```

**After**: Memoized to prevent unnecessary recalculations
```typescript
const { currentRunner, nextRunner, currentRunnerInfo, nextRunnerInfo } = useMemo(() => {
  // ... calculations
}, [demoLegs, currentTime]);
```

## Benefits

1. **Reduced Console Noise**: Significantly fewer logs in development
2. **Better Performance**: Memoized calculations prevent unnecessary re-computations
3. **Maintained Debugging**: Important logs still available when needed
4. **Cleaner Development Experience**: Easier to spot actual issues vs. noise

## Logging Strategy

- **Development Mode**: Reduced frequency but maintained important debugging info
- **Production Mode**: No change (already minimal logging)
- **Error Conditions**: All error logs preserved
- **State Changes**: Logs still appear when race state actually changes

## Testing

The optimizations maintain all functionality while reducing log frequency:
- Race timing calculations still work correctly
- Service worker background sync continues normally
- Debugging capabilities preserved for actual issues
