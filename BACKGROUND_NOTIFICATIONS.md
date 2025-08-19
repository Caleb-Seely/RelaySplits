# Background Notifications

This document explains how RelaySplits handles notifications when the app is completely closed.

## How It Works

### 1. Service Worker Background Sync
When the app is closed, the service worker continues to run in the background and periodically checks for race updates every 30 seconds.

### 2. State Comparison
The service worker:
- Fetches the current race data from the API
- Compares it with the last known state (stored in localStorage)
- Sends notifications for any changes detected

### 3. Notification Types
The system sends notifications for:
- **First Leg Start**: When the race begins
- **Handoff Complete**: When a runner finishes and hands off to the next runner
- **Race Complete**: When the final runner finishes

## Technical Implementation

### Service Worker (`public/sw.js`)
- Registers periodic background sync (every 30 seconds)
- Fetches race data from `/functions/v1/legs-list` and `/functions/v1/runners-list`
- Compares current state with last known state
- Sends notifications for detected changes

### State Storage
The app saves the current race state to localStorage whenever it changes:
```javascript
localStorage.setItem('relay_last_known_state', JSON.stringify(currentState));
```

### Background Sync Flow
1. Service worker activates and starts background sync
2. Every 30 seconds, it checks for race updates
3. If changes are detected, notifications are sent
4. The new state is saved for the next comparison

## Testing

Use the test file `test-background-notifications.html` to:
1. Check service worker status
2. Simulate race data
3. Test background sync functionality
4. Verify storage state

## Requirements

### Browser Support
- Service Workers
- Background Sync API (or fallback to setTimeout)
- Notifications API

### Permissions
- `notifications` - For showing notifications
- `background-sync` - For periodic background checks

## Troubleshooting

### Notifications Not Working When App is Closed
1. Check if service worker is registered
2. Verify notification permissions are granted
3. Ensure the app is installed as a PWA
4. Check browser console for service worker errors

### Background Sync Not Working
1. Verify `background-sync` permission is granted
2. Check if periodic sync is supported by the browser
3. Look for fallback setTimeout logs in console

## Limitations

- Background sync may be limited by browser policies
- Some browsers may throttle background activity
- Notifications may be delayed on mobile devices due to battery optimization
- The 30-second interval is a compromise between responsiveness and battery life

## Future Improvements

- Implement push notifications for real-time updates
- Add more granular notification preferences
- Optimize background sync frequency based on race status
- Add notification history and management
