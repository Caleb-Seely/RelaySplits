# Long-term Sync Solution for RelaySplits

## Current Problems

1. **Inconsistent Sync Patterns**: Different update methods handle sync differently
2. **Race Conditions**: Multiple rapid updates cause validation conflicts
3. **Complex Event Flow**: Event bus → sync manager → validation → database creates multiple failure points
4. **State Inconsistencies**: Local state and database can get out of sync

## Recommended Architecture

### 1. Unified State Management

```typescript
// Single source of truth for all state changes
interface StateOperation {
  type: 'LEG_UPDATE' | 'RUNNER_UPDATE' | 'BATCH_UPDATE';
  changes: Array<{
    entityType: 'leg' | 'runner';
    entityId: number;
    field: string;
    value: any;
    previousValue: any;
  }>;
  metadata: {
    source: 'user' | 'sync' | 'undo' | 'autoRepair';
    timestamp: number;
    deviceId: string;
  };
}

// Atomic operation handler
const executeStateOperation = async (operation: StateOperation) => {
  // 1. Validate operation
  // 2. Apply changes atomically
  // 3. Trigger sync
  // 4. Update UI
};
```

### 2. Simplified Sync Flow

```
User Action → State Operation → Atomic Update → Sync → Database
```

Instead of:
```
User Action → Event Bus → Sync Manager → Validation → Database
```

### 3. Batch Operations Support

```typescript
// Support for complex operations like undo
const undoOperation: StateOperation = {
  type: 'BATCH_UPDATE',
  changes: [
    { entityType: 'leg', entityId: 32, field: 'actualStart', value: null, previousValue: 1234567890 },
    { entityType: 'leg', entityId: 32, field: 'actualFinish', value: null, previousValue: 1234567890 },
    { entityType: 'leg', entityId: 31, field: 'actualFinish', value: null, previousValue: 1234567890 }
  ],
  metadata: { source: 'undo', timestamp: Date.now(), deviceId: 'device-123' }
};
```

### 4. Conflict Resolution Strategy

```typescript
// Optimistic updates with conflict detection
const handleConflict = (localChange: StateOperation, remoteChange: StateOperation) => {
  // 1. Detect conflicts based on timestamps and device IDs
  // 2. Apply conflict resolution rules
  // 3. Notify user if manual resolution needed
  // 4. Sync resolved state
};
```

## Implementation Plan

### Phase 1: Refactor State Store (Week 1-2)
- Create unified `StateOperation` interface
- Implement atomic operation handler
- Add batch operation support
- Remove complex event bus logic

### Phase 2: Simplify Sync Manager (Week 3)
- Replace event-based sync with operation-based sync
- Implement optimistic updates
- Add conflict detection and resolution

### Phase 3: Update UI Components (Week 4)
- Replace direct state mutations with operation calls
- Update undo functionality to use batch operations
- Add loading states for sync operations

### Phase 4: Testing & Optimization (Week 5-6)
- Add comprehensive tests for sync scenarios
- Performance optimization
- Error handling improvements

## Benefits

1. **Consistency**: All state changes go through the same path
2. **Reliability**: Atomic operations prevent partial updates
3. **Simplicity**: Easier to debug and maintain
4. **Performance**: Fewer event listeners and validation calls
5. **Scalability**: Easy to add new operation types

## Migration Strategy

1. **Gradual Migration**: Keep existing system while building new one
2. **Feature Flags**: Use feature flags to switch between old and new systems
3. **Backward Compatibility**: Ensure existing functionality continues to work
4. **Testing**: Comprehensive testing before full migration

## Immediate Fix for Current Issue

For the immediate undo sync issue, the fix I implemented should work:

1. ✅ Capture previous values before making changes
2. ✅ Use atomic batch updates
3. ✅ Proper sync event publishing

This provides a temporary solution while the long-term architecture is implemented.

