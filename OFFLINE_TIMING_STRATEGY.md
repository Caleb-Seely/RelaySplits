# Offline Timing Strategy

## Overview

The clock synchronization system is designed to work seamlessly both online and offline, ensuring accurate timing even when network connectivity is unavailable.

## How It Works

### 1. **Online Operation**
When the device is online:
- Syncs with server time every 5 minutes
- Calculates and stores time offset from server
- Tracks clock drift patterns
- Provides high-confidence timing

### 2. **Offline Operation**
When the device goes offline:
- Uses stored time offset and drift history
- Applies drift compensation based on historical patterns
- Continues to provide timing with confidence levels
- Gracefully degrades accuracy over time

### 3. **Transition Handling**
- Automatically detects online/offline status
- Resumes syncing when back online
- Preserves timing accuracy during transitions

## Confidence Levels

### **High Confidence** (Green)
- Synced with server within last 5 minutes
- Low clock drift (< 1 second)
- Best for critical timing operations

### **Medium Confidence** (Yellow)
- Synced within last 30 minutes
- Moderate drift acceptable
- Suitable for most race operations

### **Low Confidence** (Red)
- No recent sync or high drift
- Uses local time with stored offset
- Should prompt user to sync when possible

## Implementation Details

### **Stored Data**
```typescript
// localStorage keys
'clock_sync_offset'        // Time offset from server
'clock_sync_timestamp'     // Last sync timestamp
'clock_sync_drift_history' // Historical drift rates
```

### **Drift Compensation**
```typescript
// Calculate compensated time
const timeSinceLastSync = currentTime - lastSyncTime
const driftCompensation = averageDriftRate * timeSinceLastSync
const synchronizedTime = currentTime + offset + driftCompensation
```

### **Fallback Strategy**
1. **Primary**: Use synchronized time with drift compensation
2. **Secondary**: Use stored offset without drift compensation
3. **Tertiary**: Use local device time

## User Experience

### **Automatic Operation**
- Works transparently in background
- No user intervention required for normal operation
- Graceful degradation when offline

### **User Notifications**
- Low confidence warnings for critical operations
- Sync status indicators
- Manual sync options when online

### **Recovery**
- Automatic sync when back online
- Manual force sync option
- Clear status reporting

## Edge Cases Handled

### **Never Synced**
- Returns local time with low confidence
- Prompts for initial sync when online

### **Long Offline Periods**
- Uses stored offset with increasing uncertainty
- Warns user about potential inaccuracy

### **Network Issues**
- Timeout handling (5 seconds)
- Retry logic with exponential backoff
- Graceful failure without breaking functionality

### **Storage Issues**
- Handles localStorage failures
- Falls back to local time if storage unavailable

## Performance Considerations

### **Memory Usage**
- Limited drift history (10 entries)
- Efficient storage format
- Automatic cleanup of old data

### **CPU Usage**
- Minimal calculations per timing request
- Efficient drift rate calculations
- Background sync doesn't block UI

### **Network Usage**
- Single small request every 5 minutes
- Timeout prevents hanging requests
- Respects offline status

## Testing Scenarios

### **Online Testing**
```typescript
// Test normal online operation
const clockSync = ClockSyncService.getInstance()
await clockSync.initialize()
const status = clockSync.getSyncStatus()
console.log('Sync status:', status)
```

### **Offline Testing**
```typescript
// Simulate offline mode
navigator.onLine = false
window.dispatchEvent(new Event('offline'))

// Test offline timing
const { time, confidence } = getSynchronizedTimeWithConfidence()
console.log('Offline time:', { time, confidence })
```

### **Transition Testing**
```typescript
// Test online/offline transitions
navigator.onLine = true
window.dispatchEvent(new Event('online'))

// Should automatically attempt sync
setTimeout(() => {
  const status = clockSync.getSyncStatus()
  console.log('After online transition:', status)
}, 1000)
```

## Production Considerations

### **Monitoring**
- Track confidence levels in analytics
- Monitor sync success rates
- Alert on persistent low confidence

### **User Education**
- Explain confidence levels to users
- Provide sync status indicators
- Offer manual sync options

### **Fallback Plans**
- Clear procedures for timing disputes
- Manual time entry options
- Backup timing devices for critical races

## Integration with Race Logic

### **Critical Operations**
- Start/finish timing uses confidence-aware timing
- Warns users of low confidence situations
- Provides manual override options

### **Non-Critical Operations**
- General timing uses best available time
- Graceful degradation acceptable
- No user intervention required

### **Data Integrity**
- All timing data includes confidence levels
- Sync status tracked with each operation
- Audit trail for timing accuracy

## Conclusion

This offline-capable timing system ensures that RelaySplits can function reliably in any network condition while maintaining the highest possible timing accuracy. The confidence-based approach provides transparency to users about timing reliability and allows for appropriate decision-making in critical race situations.
