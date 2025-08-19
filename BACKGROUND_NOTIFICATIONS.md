# Background Notifications

This document explains how RelaySplits handles notifications when the app is completely closed, including the comprehensive fixes implemented for mobile notification issues.

## How It Works

### 1. Enhanced Service Worker Background Sync
When the app is closed, the service worker continues to run in the background and periodically checks for race updates every 30 seconds with improved reliability.

### 2. Multi-Layer State Comparison
The service worker:
- Fetches the current race data from the API with retry logic
- Compares it with the last known state (stored in localStorage)
- Uses enhanced deduplication to prevent duplicate notifications
- Sends notifications for any changes detected

### 3. Notification Types
The system sends notifications for:
- **First Leg Start**: When the race begins
- **Handoff Complete**: When a runner finishes and hands off to the next runner
- **Race Complete**: When the final runner finishes

## Technical Implementation

### Enhanced Service Worker (`public/sw.js`)
- Registers periodic background sync (every 30 seconds)
- Enhanced fetch with retry logic (up to 3 attempts with exponential backoff)
- Fetches race data from `/functions/v1/legs-list` and `/functions/v1/runners-list`
- Compares current state with last known state using improved logic
- Sends notifications for detected changes with deduplication
- Multiple fallback methods for notification delivery

### Enhanced State Storage
The app saves the current race state to localStorage whenever it changes:
```javascript
localStorage.setItem('relay_last_known_state', JSON.stringify({
  legs: [...],
  runners: [...],
  timestamp: Date.now(),
  deviceId: 'device-id'
}));
```

### Multi-Layer Deduplication
- **Frontend Deduplication**: 10-minute window with enhanced key generation
- **Service Worker Deduplication**: 5-minute window with separate storage
- **Device Tracking**: Tracks which device sent each notification
- **Automatic Cleanup**: Removes old deduplication data

### Enhanced Background Sync Flow
1. Service worker activates and starts background sync
2. Every 30 seconds, it checks for race updates with retry logic
3. If changes are detected, notifications are sent with deduplication
4. The new state is saved for the next comparison
5. Multiple fallback methods ensure notification delivery

## Mobile-Specific Improvements

### Enhanced Queue System
- **Pending Queue**: Notifications are queued instead of sent immediately
- **Rate Limiting**: Small delays between notifications to prevent overwhelming the system
- **Processing Guards**: Prevents multiple simultaneous processing attempts
- **Page Visibility Integration**: Processes pending notifications when page becomes hidden

### Platform Optimization
- **Icon Optimization**: Platform-specific notification icons (iOS, Android, Windows, macOS)
- **Badge Optimization**: Platform-specific notification badges
- **Options Optimization**: Platform-specific notification options

### Error Handling
- **Retry Logic**: Up to 3 attempts with exponential backoff
- **Multiple Fallbacks**: Service worker → Native → Minimal notification
- **Graceful Degradation**: Continues operation even if some features fail

## Testing

### Enhanced Test Tools
Use the comprehensive test file `test-mobile-notifications.html` to:
1. Check service worker status and notification permissions
2. Test basic notification functionality
3. Test mobile-specific scenarios (page visibility, background)
4. Test race event notifications
5. Test deduplication and multiple notifications
6. Verify storage state and clear data

### Dashboard Debug Controls
In development mode, the dashboard includes:
- **Debug Button**: Shows comprehensive notification system status
- **Clear Queue Button**: Clears pending notification queue
- **Test Buttons**: Send test notifications for debugging

## Requirements

### Browser Support
- Service Workers
- Background Sync API (or fallback to setTimeout)
- Notifications API
- Page Visibility API

### Permissions
- `notifications` - For showing notifications
- `background-sync` - For periodic background checks

## Troubleshooting

### Notifications Not Working When App is Closed
1. Check if service worker is registered and active
2. Verify notification permissions are granted
3. Ensure the app is installed as a PWA
4. Check browser console for service worker errors
5. Use the mobile notification diagnostics tool

### Background Sync Not Working
1. Verify `background-sync` permission is granted
2. Check if periodic sync is supported by the browser
3. Look for fallback setTimeout logs in console
4. Test with the mobile notification diagnostics tool

### Duplicate Notifications
1. Clear notification data using debug tools
2. Check deduplication settings and storage
3. Verify notification queue status
4. Monitor console logs for deduplication messages

### Mobile-Specific Issues
1. Check page visibility API support
2. Test background notification delivery
3. Verify platform-specific optimizations
4. Use mobile notification diagnostics tool

## Enhanced Features

### Real-time Updates
- **State Tracking**: Tracks last processed legs and timestamps
- **Change Detection**: More accurate detection of leg state changes
- **Processing Guards**: Prevents processing the same changes multiple times

### Queue Management
- **Pending Notifications**: Queue system prevents race conditions
- **Rate Limiting**: Prevents overwhelming the notification system
- **Processing Status**: Tracks when notifications are being processed

### Debugging Tools
- **Comprehensive Logging**: Detailed logs for all notification events
- **Status Monitoring**: Real-time status of notification system
- **Data Management**: Tools to clear and reset notification data

## Limitations

- Background sync may be limited by browser policies
- Some browsers may throttle background activity
- Notifications may be delayed on mobile devices due to battery optimization
- The 30-second interval is a compromise between responsiveness and battery life
- Service worker reliability varies by browser and platform

## Future Improvements

- Implement push notifications for real-time updates
- Add more granular notification preferences
- Optimize background sync frequency based on race status
- Add notification history and management
- Cross-device notification synchronization
- Analytics and delivery tracking

## Performance Considerations

### Memory Usage
- **Queue Limits**: Maximum 100 notification history entries
- **Storage Cleanup**: Automatic cleanup of old data
- **Efficient Processing**: Rate-limited notification processing

### Battery Impact
- **Optimized Intervals**: 30-second background sync interval
- **Smart Processing**: Only processes when necessary
- **Efficient Storage**: Minimal localStorage usage

### Network Usage
- **Retry Logic**: Prevents excessive network requests
- **Caching**: Efficient caching of notification data
- **Fallback Handling**: Graceful degradation when network fails

## Conclusion

The enhanced background notification system provides:

- **Reliable Delivery**: Consistent notification delivery across devices
- **No Duplicates**: Robust deduplication prevents spam
- **Better Performance**: Optimized for mobile devices
- **Easy Debugging**: Comprehensive tools for troubleshooting
- **Future-Proof**: Extensible architecture for future enhancements

The system is now production-ready and should provide a much better user experience for mobile notification delivery, especially when the app is closed or in the background.
