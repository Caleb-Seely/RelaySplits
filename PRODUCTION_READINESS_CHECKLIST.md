# Production Readiness Checklist - Save Issue Resolution

## Issue Summary
The relay team start time and runner/leg data is not being backed up to the database when clicking "Start Race Tracking".

## Root Cause Analysis
Based on comprehensive testing, the data preparation and validation is working correctly. The issue is likely in one of these areas:

### 1. RLS (Row Level Security) Policy Violations ⚠️ **MOST LIKELY**
The database has strict RLS policies that require:
- User must be authenticated
- User must be a team member  
- User must have edit permissions (active subscription or free trial)
- Device must be registered with the team

### 2. Device Authentication Issues
- Device might not be properly registered in `team_devices` table
- Device role might not be 'admin' for the team

### 3. User Subscription Status
- User might not have active subscription or be within free trial period
- `user_can_edit()` function might be failing

### 4. Network/Edge Function Issues
- Edge Functions might not be deployed correctly
- Network connectivity issues to Supabase

## Verification Steps

### Step 1: Check Browser Console Logs
1. Open browser developer tools
2. Go to Console tab
3. Click "Start Race Tracking" 
4. Look for error messages, especially:
   - Edge Function errors
   - RLS policy violations
   - Network errors

### Step 2: Verify Device Registration
Check if device is properly registered in `team_devices` table:
```sql
SELECT * FROM team_devices 
WHERE team_id = 'your-team-id' 
AND device_id = 'your-device-id';
```

### Step 3: Check User Subscription Status
Verify user has proper subscription status:
```sql
SELECT * FROM profiles 
WHERE id = 'your-user-id';
```

### Step 4: Test Edge Functions Directly
Test Edge Functions with curl or Postman:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/runners-upsert \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "teamId": "your-team-id",
    "deviceId": "your-device-id", 
    "runners": [{"name": "Test Runner", "pace": 420, "van": "1"}],
    "action": "upsert"
  }'
```

## Immediate Fixes

### Fix 1: Add Better Error Handling
Add more detailed error logging to identify the exact failure point:

```typescript
// In saveInitialRows function
try {
  const result = await invokeEdge('runners-upsert', payload);
  if (result.error) {
    console.error('Detailed error:', result.error);
    // Log additional context
    console.error('Payload that failed:', payload);
    console.error('Device ID:', deviceId);
    console.error('Team ID:', teamId);
  }
} catch (e) {
  console.error('Network error:', e);
}
```

### Fix 2: Verify Device Registration
Ensure device is properly registered before saving:

```typescript
// Add device verification before save
const verifyDevice = async (teamId: string, deviceId: string) => {
  const result = await invokeEdge('devices-list', { teamId, deviceId });
  if (result.error || !result.data?.devices?.length) {
    throw new Error('Device not registered with team');
  }
  return result.data.devices[0];
};
```

### Fix 3: Add Subscription Status Check
Verify user can edit before attempting save:

```typescript
// Add subscription check
const checkEditPermissions = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  // Check subscription status via RPC
  const { data, error } = await supabase.rpc('get_user_subscription_status', {
    user_uuid: user.id
  });
  
  if (error || !['active', 'free_trial'].includes(data)) {
    throw new Error('User does not have edit permissions');
  }
};
```

## Long-term Solutions

### Solution 1: Improve Error Messages
Provide user-friendly error messages for common issues:
- "Please log in to save your team data"
- "Your free trial has expired. Please upgrade to continue."
- "Device not registered. Please refresh the page and try again."

### Solution 2: Add Retry Logic
Implement retry logic for transient failures:
```typescript
const saveWithRetry = async (saveFunction: () => Promise<any>, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await saveFunction();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};
```

### Solution 3: Add Offline Support
Implement offline queue for when network is unavailable:
```typescript
// Queue changes when offline
if (!navigator.onLine) {
  enqueueOfflineChange({ type: 'save_initial_data', payload });
  return { success: true, offline: true };
}
```

## Testing Checklist

- [ ] Test with valid user subscription
- [ ] Test with expired subscription  
- [ ] Test with unregistered device
- [ ] Test with network offline
- [ ] Test with invalid team ID
- [ ] Test with malformed data
- [ ] Test Edge Function deployment
- [ ] Test RLS policies

## Monitoring

Add monitoring for:
- Save success/failure rates
- Common error types
- Device registration issues
- Subscription status problems
- Edge Function response times

## Next Steps

1. **Immediate**: Check browser console for specific error messages
2. **Short-term**: Implement better error handling and logging
3. **Medium-term**: Add retry logic and offline support
4. **Long-term**: Improve user experience with better error messages
