# Quick Start Guide: Critical Improvements

## Immediate Actions (Next 48 Hours)

This guide provides step-by-step instructions for implementing the most critical improvements to prevent failures and improve reliability.

## 1. Set Up Global Error Handling (30 minutes)

### Step 1: Initialize Global Error Handling
Add this to your `src/main.tsx` file:

```typescript
import { setupGlobalErrorHandling } from '@/utils/errorHandling';

// Add this BEFORE ReactDOM.createRoot
setupGlobalErrorHandling();
```

### Step 2: Test Global Error Handling
Add this temporary test to verify it's working:

```typescript
// Temporary test - remove after verification
setTimeout(() => {
  console.log('Testing global error handling...');
  throw new Error('Test error for global handler');
}, 5000);
```

## 2. Fix Critical Error Handling Issues (2 hours)

### Step 1: Update useEnhancedSyncManager.ts
Replace the inconsistent error handling in `src/hooks/useEnhancedSyncManager.ts`:

```typescript
// Replace existing error handling patterns
import { withErrorHandling, NetworkError } from '@/utils/errorHandling';

// Replace this:
const res = await invokeEdge(edgeName, body);
if ((res as any).error) {
  console.error(`[useEnhancedSyncManager] Edge ${edgeName} error:`, (res as any).error);
  return { error: (res as any).error };
}

// With this:
const safeInvokeEdge = withErrorHandling(
  async () => {
    const res = await invokeEdge(edgeName, body);
    if (res && typeof res === 'object' && 'error' in res) {
      throw new NetworkError(`Edge ${edgeName} failed: ${(res as any).error}`);
    }
    return res;
  },
  { showToast: true },
  { component: 'EnhancedSyncManager', operation: edgeName }
);

try {
  const res = await safeInvokeEdge();
  return { data: res };
} catch (error) {
  return { error };
}
```

### Step 2: Update useOfflineQueue.ts
Apply similar fixes to `src/hooks/useOfflineQueue.ts`:

```typescript
import { withErrorHandling, NetworkError } from '@/utils/errorHandling';

// Wrap the safeUpdate function
const safeUpdate = withErrorHandling(
  async (table: 'runners' | 'legs', teamId: string, remoteId: string, payload: any) => {
    if (!navigator.onLine) {
      throw new NetworkError('App is offline');
    }

    const deviceIdValue = getDeviceId();
    let edgeName: 'runners-upsert' | 'legs-upsert';
    let body: any;
    
    // ... existing logic ...
    
    const res = await invokeEdge(edgeName, body);
    if (res && typeof res === 'object' && 'error' in res) {
      throw new NetworkError(`Edge ${edgeName} failed: ${(res as any).error}`);
    }
    
    return { data: payload };
  },
  { showToast: false },
  { component: 'OfflineQueue', operation: 'safeUpdate' }
);
```

## 3. Add Performance Monitoring (1 hour)

### Step 1: Monitor Dashboard Component
Update `src/components/Dashboard.tsx`:

```typescript
import { usePerformanceTracking } from '@/utils/performance';

const Dashboard: React.FC<DashboardProps> = ({ isViewOnly = false, viewOnlyTeamName }) => {
  usePerformanceTracking('Dashboard');
  
  // ... existing code ...
};
```

### Step 2: Monitor Critical API Calls
Wrap critical API calls with performance monitoring:

```typescript
import { measureAsync } from '@/utils/performance';

// Replace direct API calls with monitored versions
const fetchLatestData = async () => {
  return measureAsync('fetch-latest-data', async () => {
    // ... existing fetch logic ...
  });
};
```

## 4. Fix Type Safety Issues (1 hour)

### Step 1: Replace Unsafe Type Assertions
In `src/utils/dataConsistency.ts`, replace:

```typescript
// Replace this:
const typedData = data as any;
return typedData[field] !== null;

// With this:
interface DatabaseRecord {
  [key: string]: any;
}

const isDatabaseRecord = (data: unknown): data is DatabaseRecord => {
  return typeof data === 'object' && data !== null;
};

if (!isDatabaseRecord(data)) {
  return false;
}

return data[field] !== null;
```

### Step 2: Add Type Guards
Create a new file `src/utils/typeGuards.ts`:

```typescript
export const isApiResponse = <T>(response: unknown): response is { data: T; error?: string } => {
  return typeof response === 'object' && response !== null && 'data' in response;
};

export const isErrorResponse = (response: unknown): response is { error: string } => {
  return typeof response === 'object' && response !== null && 'error' in response;
};
```

## 5. Install and Configure ESLint (30 minutes)

### Step 1: Install Dependencies
```bash
npm install --save-dev @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y eslint-plugin-import eslint-config-prettier eslint-plugin-prettier
```

### Step 2: Add Lint Script
Add to `package.json`:

```json
{
  "scripts": {
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix"
  }
}
```

### Step 3: Run Initial Lint
```bash
npm run lint
```

## 6. Create Emergency Rollback Plan (15 minutes)

### Step 1: Create Feature Flags
Add to `src/config/featureFlags.ts`:

```typescript
export const FEATURE_FLAGS = {
  NEW_ERROR_HANDLING: process.env.NODE_ENV === 'development' || process.env.REACT_APP_ENABLE_NEW_ERROR_HANDLING === 'true',
  PERFORMANCE_MONITORING: process.env.NODE_ENV === 'development' || process.env.REACT_APP_ENABLE_PERFORMANCE_MONITORING === 'true',
};
```

### Step 2: Add Conditional Logic
Wrap new features with feature flags:

```typescript
import { FEATURE_FLAGS } from '@/config/featureFlags';

if (FEATURE_FLAGS.NEW_ERROR_HANDLING) {
  setupGlobalErrorHandling();
}

if (FEATURE_FLAGS.PERFORMANCE_MONITORING) {
  usePerformanceTracking('Dashboard');
}
```

## 7. Test Critical Paths (1 hour)

### Step 1: Test Error Handling
Create a simple test in `src/__tests__/critical.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { handleError, NetworkError } from '@/utils/errorHandling';

describe('Critical Error Handling', () => {
  it('should handle network errors', () => {
    const error = new NetworkError('Network failed');
    expect(error.retryable).toBe(true);
    expect(error.code).toBe('NETWORK_ERROR');
  });
});
```

### Step 2: Test Performance Monitoring
```typescript
import { describe, it, expect } from 'vitest';
import { measureAsync } from '@/utils/performance';

describe('Performance Monitoring', () => {
  it('should measure async operations', async () => {
    const result = await measureAsync('test', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return 'success';
    });
    
    expect(result).toBe('success');
  });
});
```

## 8. Monitor and Validate (Ongoing)

### Step 1: Check Console for Errors
Monitor the browser console for:
- Global error handler messages
- Performance monitoring logs
- ESLint warnings/errors

### Step 2: Verify Error Reporting
Check that errors are being reported to your analytics system.

### Step 3: Monitor Performance
Watch for performance degradation or improvements.

## Success Criteria (48 Hours)

After completing these steps, you should have:

- [ ] Global error handling catching unhandled errors
- [ ] Consistent error handling in sync operations
- [ ] Performance monitoring active on critical components
- [ ] Type safety improvements reducing `any` usage
- [ ] ESLint configuration preventing code quality issues
- [ ] Feature flags allowing easy rollback
- [ ] Basic tests validating critical functionality

## Next Steps

After completing the quick start guide:

1. **Week 1**: Complete Phase 1 of the full implementation plan
2. **Week 2**: Begin Phase 2 (Code quality improvements)
3. **Ongoing**: Monitor and iterate based on real-world usage

## Emergency Contacts

If issues arise during implementation:

1. **Immediate Rollback**: Use feature flags to disable new features
2. **Code Review**: Have another developer review changes before deployment
3. **Monitoring**: Watch error rates and performance metrics closely

This quick start guide addresses the most critical issues that could cause failures while setting up the foundation for the full implementation plan.
