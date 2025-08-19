// Fix for the race completion logic issue in Dashboard.tsx

// The problem is in the condition that determines whether to show next runner content vs race completion content
// Current problematic condition:
// return (nextRunner && nextRunnerInfo) || (leg36?.actualStart && !leg36?.actualFinish);

// This condition fails when:
// 1. legs.length > 0 (legs are initialized)
// 2. nextRunner exists (first leg)
// 3. But nextRunnerInfo is null (runner not found)
// 4. leg36 doesn't have actualStart time (race hasn't started)

// The fix is to add an additional condition:
// return (nextRunner && nextRunnerInfo) || 
//        (leg36?.actualStart && !leg36?.actualFinish) ||
//        (legs.length > 0 && !nextRunner);

// This ensures that:
// 1. If we have a next runner with valid runner info, show next runner content
// 2. If leg 36 is currently running, show next runner content
// 3. If we have legs but no next runner (race hasn't started), show next runner content
// 4. Only show race completion content if leg 36 is actually finished

// The issue is that the current logic falls through to race completion content
// when legs are initialized but no actual times are set, which is incorrect.
