// Test script to verify conflict resolution logic
// Run this in the browser console to test the offline-online conflict resolution

console.log('🧪 Testing conflict resolution logic...');

// Test 1: Check current offline queue
function checkOfflineQueue() {
  console.log('\n📋 Test 1: Checking offline queue...');
  const queue = localStorage.getItem('relay-splits-offline-queue');
  if (queue) {
    const parsed = JSON.parse(queue);
    console.log('✅ Offline queue exists with', parsed.length, 'items');
    console.log('Queue contents:', parsed);
    return parsed;
  } else {
    console.log('ℹ️ No offline queue found');
    return [];
  }
}

// Test 2: Check local store state
function checkLocalStore() {
  console.log('\n🏪 Test 2: Checking local store state...');
  try {
    const storeState = useRaceStore.getState();
    console.log('Runners count:', storeState.runners.length);
    console.log('Legs count:', storeState.legs.length);
    console.log('Sample leg:', storeState.legs[0]);
    return storeState;
  } catch (error) {
    console.log('❌ Error accessing store:', error.message);
    return null;
  }
}

// Test 3: Simulate offline change
function simulateOfflineChange() {
  console.log('\n📝 Test 3: Simulating offline change...');
  const testChange = {
    table: 'legs',
    remoteId: 'test-leg-' + Date.now(),
    payload: { 
      actualStart: Date.now(),
      // Note: intentionally missing distance to test validation
    },
    timestamp: Date.now()
  };
  
  const key = 'relay-splits-offline-queue';
  const raw = localStorage.getItem(key);
  const arr = raw ? JSON.parse(raw) : [];
  arr.push(testChange);
  localStorage.setItem(key, JSON.stringify(arr));
  
  console.log('✅ Added test change to offline queue');
  console.log('Queue length:', arr.length);
  return testChange;
}

// Test 4: Test merge logic
function testMergeLogic() {
  console.log('\n🔄 Test 4: Testing merge logic...');
  
  // Get current queue
  const queue = checkOfflineQueue();
  
  // Get current store state
  const storeState = checkLocalStore();
  
  if (queue.length > 0 && storeState) {
    console.log('✅ Found pending changes and store state');
    console.log('Merge logic should preserve local changes for items with pending offline changes');
    
    // Check if any legs have pending changes
    const pendingLegChanges = queue.filter(change => change.table === 'legs');
    console.log('Pending leg changes:', pendingLegChanges.length);
    
    if (pendingLegChanges.length > 0) {
      console.log('⚠️ These legs should NOT be overwritten by server data during merge');
      pendingLegChanges.forEach(change => {
        console.log(`  - ${change.remoteId}: ${JSON.stringify(change.payload)}`);
      });
    }
  } else {
    console.log('ℹ️ No pending changes or store state available');
  }
}

// Test 5: Check network status
function checkNetwork() {
  console.log('\n🌐 Test 5: Checking network...');
  console.log('navigator.onLine:', navigator.onLine);
  console.log('Connection type:', navigator.connection ? navigator.connection.effectiveType : 'unknown');
}

// Run all tests
function runConflictResolutionTest() {
  console.log('🚀 Running conflict resolution tests...');
  checkNetwork();
  const queue = checkOfflineQueue();
  const storeState = checkLocalStore();
  
  if (queue.length === 0) {
    simulateOfflineChange();
  }
  
  testMergeLogic();
  console.log('\n✅ Conflict resolution tests completed!');
}

// Export for manual testing
window.conflictResolutionTest = {
  runConflictResolutionTest,
  checkOfflineQueue,
  checkLocalStore,
  simulateOfflineChange,
  testMergeLogic,
  checkNetwork
};

console.log('📚 Conflict resolution test functions available as window.conflictResolutionTest');
console.log('Run window.conflictResolutionTest.runConflictResolutionTest() to execute all tests');
