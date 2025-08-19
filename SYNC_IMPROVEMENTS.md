# Sync System Improvements

## Overview

The RelaySplits application has been significantly enhanced with a robust real-time synchronization system that ensures team data stays in sync across all devices with minimal latency and maximum reliability.

## Key Improvements

### 1. Real-Time Subscriptions
- **Supabase Channels**: Added real-time subscriptions to receive immediate updates when other devices make changes
- **Broadcast Messages**: Server sends broadcast messages to all connected devices when data changes
- **Device Filtering**: Updates from the current device are filtered out to prevent feedback loops

### 2. Enhanced Event Bus System
- **Priority Queue**: High-priority events (data sync) are processed before low-priority events (notifications)
- **Batch Processing**: Multiple events are processed efficiently to reduce overhead
- **Real-time Events**: New event type for real-time server updates

### 3. Optimized Sync Strategy
- **Immediate Sync**: Critical updates (runner start/finish) are synced immediately when online
- **Offline Queue**: Changes made while offline are queued and synced when connection is restored
- **Smart Retry**: Failed sync attempts are retried with exponential backoff
- **Conflict Detection**: Timing conflicts are detected and resolved through UI

### 4. Performance Optimizations
- **Sync Batching**: Multiple changes are batched together to reduce API calls
- **Reduced Polling**: Periodic sync interval increased from 30s to 60s (real-time handles most updates)
- **Efficient Merging**: Server data is merged with local data using timestamp-based conflict resolution

## How It Works

### Real-Time Flow
1. **User Action**: User starts/finishes a runner or makes other changes
2. **Local Update**: Change is immediately reflected in the UI
3. **Event Published**: High-priority event is published to the event bus
4. **Immediate Sync**: If online, change is immediately sent to server
5. **Broadcast**: Server broadcasts the change to all connected devices
6. **Real-Time Update**: Other devices receive the update and refresh their data

### Offline Flow
1. **User Action**: User makes changes while offline
2. **Local Update**: Change is immediately reflected in the UI
3. **Queue Change**: Change is queued for later sync
4. **Connection Restored**: When online, queued changes are processed
5. **Conflict Resolution**: Any conflicts are resolved through the UI

### Conflict Resolution
- **Timing Conflicts**: If start/finish times differ by more than 1 minute, conflict resolution UI is shown
- **Server Wins**: For non-timing conflicts, server data takes precedence
- **Manual Resolution**: Users can manually resolve conflicts through the UI

## Technical Details

### Event Types
- `LEG_UPDATE`: High-priority event for leg timing changes
- `RUNNER_UPDATE`: High-priority event for runner data changes
- `REALTIME_UPDATE`: High-priority event for real-time server updates
- `NOTIFICATION_*`: Low-priority events for notifications

### Sync Components
- **useEnhancedSyncManager**: Main sync coordination hook
- **useOfflineQueue**: Handles offline change queuing
- **eventBus**: Decoupled event system
- **syncOptimizer**: Batches and optimizes sync operations

### Database Schema
- **team_devices**: Tracks device connections and roles
- **team_audit**: Logs all team actions for debugging
- **legs/runners**: Core data tables with team_id scoping

## Testing

### Development Tools
- **Test Sync Button**: Available in development mode to test sync functionality
- **Console Logging**: Comprehensive logging for debugging sync issues
- **Queue Status**: Real-time status of pending sync operations

### Test Functions
- `testDecoupledSystem()`: Tests the complete sync system
- `testRealtimeSubscription()`: Tests real-time subscription functionality
- `testSyncPerformance()`: Tests sync performance with rapid updates

## Monitoring

### Sync Status Indicators
- **Sync Status**: Visual indicator of sync health
- **Queue Status**: Shows pending offline changes
- **Real-time Updates**: Toast notifications for updates from other devices

### Debug Information
- **Console Logs**: Detailed logging of all sync operations
- **Network Status**: Real-time network connectivity status
- **Device ID**: Unique device identifier for tracking

## Best Practices

### For Users
1. **Stay Online**: Keep devices online for best sync performance
2. **Resolve Conflicts**: Promptly resolve any timing conflicts that appear
3. **Check Status**: Monitor sync status indicator for any issues

### For Developers
1. **Test Offline**: Always test offline functionality
2. **Monitor Logs**: Check console logs for sync issues
3. **Handle Conflicts**: Implement proper conflict resolution UI

## Troubleshooting

### Common Issues
1. **Sync Not Working**: Check network connectivity and device registration
2. **Conflicts Not Resolving**: Ensure conflict resolution UI is properly implemented
3. **Slow Updates**: Check for large offline queues or network issues

### Debug Steps
1. **Check Console**: Look for sync-related error messages
2. **Test Network**: Verify internet connectivity
3. **Check Device ID**: Ensure device is properly registered with team
4. **Clear Queue**: In development, clear offline queue if needed

## Future Enhancements

### Planned Improvements
1. **WebSocket Fallback**: Alternative real-time transport for better reliability
2. **Compression**: Compress sync data to reduce bandwidth usage
3. **Incremental Sync**: Only sync changed fields to improve performance
4. **Multi-Device Sync**: Better handling of multiple devices per user

### Performance Targets
- **Sync Latency**: < 1 second for real-time updates
- **Offline Recovery**: < 5 seconds to sync all offline changes
- **Conflict Resolution**: < 10 seconds to resolve conflicts
- **Uptime**: 99.9% sync availability
