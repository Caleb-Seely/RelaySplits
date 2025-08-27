# Development Best Practices

## Overview
This document outlines the best practices for developing and maintaining the RelaySplits application. Following these guidelines ensures code quality, maintainability, and reduces the likelihood of critical errors.

## Error Handling

### 1. Use Centralized Error Handling
Always use the centralized error handling system:

```typescript
import { handleError, withErrorHandling, NetworkError } from '@/utils/errorHandling';

// For async functions
const fetchData = withErrorHandling(
  async () => {
    const response = await fetch('/api/data');
    if (!response.ok) {
      throw new NetworkError('Failed to fetch data');
    }
    return response.json();
  },
  { showToast: true },
  { component: 'DataFetcher', operation: 'fetchData' }
);

// For manual error handling
try {
  await someOperation();
} catch (error) {
  handleError(error, { showToast: true }, { component: 'ComponentName' });
}
```

### 2. Error Types
Use appropriate error types for different scenarios:

- `NetworkError`: For network/API failures
- `ValidationError`: For data validation failures
- `SyncError`: For synchronization issues
- `AppError`: For general application errors

### 3. Retry Logic
Use exponential backoff for retryable operations:

```typescript
import { retryWithBackoff } from '@/utils/errorHandling';

const result = await retryWithBackoff(
  () => apiCall(),
  3, // max retries
  1000 // base delay in ms
);
```

## Performance

### 1. Component Optimization
- Use `React.memo` for expensive components
- Implement `useCallback` and `useMemo` for expensive calculations
- Avoid inline object/function creation in render

```typescript
// ✅ Good
const MemoizedComponent = React.memo(({ data }) => {
  const processedData = useMemo(() => expensiveProcessing(data), [data]);
  const handleClick = useCallback(() => {
    // handle click
  }, []);
  
  return <div onClick={handleClick}>{processedData}</div>;
});

// ❌ Bad
const BadComponent = ({ data }) => {
  return (
    <div onClick={() => {}} style={{ color: 'red' }}>
      {expensiveProcessing(data)}
    </div>
  );
};
```

### 2. Performance Monitoring
Use the performance monitoring utilities:

```typescript
import { measureAsync, startTimer } from '@/utils/performance';

// For async operations
const result = await measureAsync('api-call', async () => {
  return await fetchData();
});

// For component rendering
const Component = () => {
  const endTimer = startTimer('component-render');
  
  useEffect(() => {
    endTimer();
  });
  
  return <div>Content</div>;
};
```

## State Management

### 1. Zustand Store Best Practices
- Keep stores focused and single-purpose
- Use TypeScript for all store interfaces
- Implement proper error handling in store actions

```typescript
interface RaceStore {
  // State
  runners: Runner[];
  legs: Leg[];
  
  // Actions
  updateRunner: (id: number, updates: Partial<Runner>) => void;
  addRunner: (runner: Runner) => void;
}

export const useRaceStore = create<RaceStore>((set, get) => ({
  runners: [],
  legs: [],
  
  updateRunner: (id, updates) => {
    try {
      set(state => ({
        runners: state.runners.map(runner =>
          runner.id === id ? { ...runner, ...updates } : runner
        )
      }));
    } catch (error) {
      handleError(error, { showToast: false }, { component: 'RaceStore' });
    }
  }
}));
```

### 2. Event-Driven Architecture
Use the event bus for cross-component communication:

```typescript
import { eventBus, EVENT_TYPES } from '@/utils/eventBus';

// Publishing events
eventBus.publish({
  type: EVENT_TYPES.LEG_UPDATE,
  payload: { legId: 1, field: 'actualStart', value: Date.now() }
});

// Subscribing to events
useEffect(() => {
  const unsubscribe = eventBus.subscribe(EVENT_TYPES.LEG_UPDATE, (event) => {
    // Handle leg update
  });
  
  return unsubscribe;
}, []);
```

## Data Validation

### 1. Input Validation
Always validate user inputs and API responses:

```typescript
import { validateRunner, validateLeg } from '@/utils/validation';

const addRunner = (runnerData: any) => {
  const validation = validateRunner(runnerData);
  if (!validation.isValid) {
    throw new ValidationError(validation.issues.join(', '));
  }
  
  // Proceed with valid data
};
```

### 2. Data Consistency Checks
Implement data consistency checks for critical operations:

```typescript
import { detectMissingTimeConflicts } from '@/utils/dataConsistency';

const checkDataConsistency = async () => {
  const conflicts = await detectMissingTimeConflicts(legs, runners, teamId);
  if (conflicts.length > 0) {
    // Handle conflicts
    conflicts.forEach(conflict => {
      console.warn('Data consistency issue:', conflict);
    });
  }
};
```

## Testing

### 1. Unit Tests
Write comprehensive unit tests for all utilities and hooks:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { parsePace, formatPace } from '@/utils/raceUtils';

describe('Race Utilities', () => {
  describe('parsePace', () => {
    it('should parse MM:SS format correctly', () => {
      expect(parsePace('7:30')).toBe(450);
    });
    
    it('should throw error for invalid format', () => {
      expect(() => parsePace('invalid')).toThrow('Invalid pace format');
    });
  });
});
```

### 2. Integration Tests
Test critical user flows and data synchronization:

```typescript
describe('Team Synchronization', () => {
  it('should sync data between devices', async () => {
    // Test setup
    const device1 = createTestDevice();
    const device2 = createTestDevice();
    
    // Perform actions
    await device1.updateLeg(1, { actualStart: Date.now() });
    
    // Verify synchronization
    await waitForSync();
    const device2Data = await device2.getLeg(1);
    expect(device2Data.actualStart).toBeDefined();
  });
});
```

## Code Organization

### 1. File Structure
Follow the established file structure:

```
src/
├── components/          # React components
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
├── services/           # External service integrations
├── store/              # State management
├── types/              # TypeScript type definitions
├── contexts/           # React contexts
└── __tests__/          # Test files
```

### 2. Naming Conventions
- Components: PascalCase (e.g., `Dashboard.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useTeamSync.ts`)
- Utilities: camelCase (e.g., `raceUtils.ts`)
- Types: PascalCase (e.g., `RaceData.ts`)
- Constants: UPPER_SNAKE_CASE (e.g., `EVENT_TYPES`)

### 3. Import Organization
Organize imports in the following order:

```typescript
// 1. React and external libraries
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

// 2. Internal utilities and services
import { handleError } from '@/utils/errorHandling';
import { useRaceStore } from '@/store/raceStore';

// 3. Types
import type { Runner, Leg } from '@/types/race';

// 4. Components
import { Button } from '@/components/ui/button';
```

## Security

### 1. Input Sanitization
Always sanitize user inputs:

```typescript
import DOMPurify from 'dompurify';

const sanitizeInput = (input: string): string => {
  return DOMPurify.sanitize(input.trim());
};
```

### 2. API Security
- Validate all API responses
- Handle authentication errors gracefully
- Implement proper CORS policies
- Use HTTPS for all external communications

## Monitoring and Logging

### 1. Structured Logging
Use the logger utility for consistent logging:

```typescript
import { createLogger } from '@/utils/logger';

const logger = createLogger('ComponentName');

logger.info('Operation completed', { userId, teamId });
logger.error('Operation failed', { error: error.message });
```

### 2. Analytics Tracking
Track important user actions and errors:

```typescript
import { analytics } from '@/services/analytics';

analytics.trackEvent('leg_completed', {
  legId: 1,
  runnerId: 2,
  duration: 1800000
});
```

## Offline Support

### 1. Offline Queue
Use the offline queue for network operations:

```typescript
import { useOfflineQueue } from '@/hooks/useOfflineQueue';

const { queueChange } = useOfflineQueue();

const updateLeg = async (legId: number, updates: Partial<Leg>) => {
  try {
    await api.updateLeg(legId, updates);
  } catch (error) {
    // Queue for later if offline
    queueChange('legs', legId, updates);
  }
};
```

### 2. Data Persistence
Implement proper data persistence strategies:

```typescript
// Save critical data to localStorage
const saveToLocalStorage = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    handleError(error, { showToast: false }, { component: 'Storage' });
  }
};
```

## Code Review Checklist

Before submitting code for review, ensure:

- [ ] All error scenarios are handled
- [ ] Performance implications are considered
- [ ] Tests are written for new functionality
- [ ] Code follows established patterns
- [ ] No console.log statements in production code
- [ ] TypeScript types are properly defined
- [ ] Accessibility requirements are met
- [ ] Security considerations are addressed
- [ ] Documentation is updated if needed

## Common Pitfalls to Avoid

### 1. Memory Leaks
- Always clean up event listeners and subscriptions
- Use `useEffect` cleanup functions
- Avoid storing large objects in component state

### 2. Race Conditions
- Use proper async/await patterns
- Implement request cancellation for concurrent operations
- Handle component unmounting during async operations

### 3. Type Safety
- Avoid `any` types unless absolutely necessary
- Use proper TypeScript interfaces
- Validate external data before use

### 4. Performance Issues
- Avoid unnecessary re-renders
- Implement proper memoization
- Monitor bundle size and loading performance

## Emergency Procedures

### 1. Critical Error Response
If a critical error occurs:

1. Log the error with full context
2. Show user-friendly error message
3. Attempt automatic recovery if possible
4. Provide manual recovery options
5. Report to monitoring systems

### 2. Data Recovery
If data corruption is detected:

1. Stop all write operations
2. Attempt automatic repair
3. Fall back to last known good state
4. Notify user of data loss
5. Provide data export options

### 3. Service Degradation
If external services are unavailable:

1. Switch to offline mode
2. Queue operations for later
3. Show appropriate status indicators
4. Provide estimated recovery time
5. Allow manual retry options

## Conclusion

Following these best practices ensures:
- **Reliability**: Robust error handling and recovery
- **Performance**: Optimized code and monitoring
- **Maintainability**: Clean, well-documented code
- **Security**: Proper input validation and sanitization
- **User Experience**: Graceful degradation and offline support

Regular code reviews and adherence to these guidelines will help maintain high code quality and reduce the likelihood of critical errors in production.
