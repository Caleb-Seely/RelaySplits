// Test script to verify offline queue functionality
// Run this in the browser console to test the offline sync system

console.log('🧪 Testing offline sync functionality...');

// Test 1: Check if offline queue exists
function testOfflineQueueExists() {
  console.log('\n📋 Test 1: Checking offline queue existence');
  const queue = localStorage.getItem('relay-splits-offline-queue');
  if (queue) {
    const parsed = JSON.parse(queue);
    console.log('✅ Offline queue exists with', parsed.length, 'items');
    console.log('Queue contents:', parsed);
  } else {
    console.log('ℹ️ No offline queue found (this is normal if no offline changes were made)');
  }
}

// Test 2: Simulate offline change
function testOfflineChange() {
  console.log('\n📝 Test 2: Simulating offline change');
  const testChange = {
    table: 'legs',
    remoteId: 'test-leg-123',
    payload: { actualStart: Date.now() },
    timestamp: Date.now()
  };
  
  const key = 'relay-splits-offline-queue';
  const raw = localStorage.getItem(key);
  const arr = raw ? JSON.parse(raw) : [];
  arr.push(testChange);
  localStorage.setItem(key, JSON.stringify(arr));
  
  console.log('✅ Added test change to offline queue');
  console.log('New queue length:', arr.length);
}

// Test 3: Check queue processing
function testQueueProcessing() {
  console.log('\n🔄 Test 3: Checking queue processing');
  const queue = localStorage.getItem('relay-splits-offline-queue');
  if (queue) {
    const parsed = JSON.parse(queue);
    console.log('Queue has', parsed.length, 'items to process');
    
    // Check if any items have retry counts
    const failedItems = parsed.filter(item => item.retryCount > 0);
    if (failedItems.length > 0) {
      console.log('⚠️ Found', failedItems.length, 'items with retry attempts');
      console.log('Failed items:', failedItems);
    } else {
      console.log('✅ No failed items found');
    }
  }
}

// Test 4: Check network status
function testNetworkStatus() {
  console.log('\n🌐 Test 4: Checking network status');
  console.log('navigator.onLine:', navigator.onLine);
  console.log('Connection type:', navigator.connection ? navigator.connection.effectiveType : 'unknown');
}

// Test 5: Check sync manager state
function testSyncManagerState() {
  console.log('\n⚙️ Test 5: Checking sync manager state');
  
  // Check if useRaceStore is available
  if (window.useRaceStore) {
    const state = window.useRaceStore.getState();
    console.log('Team ID:', state.teamId);
    console.log('Setup complete:', state.isSetupComplete);
    console.log('Runners count:', state.runners.length);
    console.log('Legs count:', state.legs.length);
  } else {
    console.log('ℹ️ useRaceStore not available in global scope');
  }
}

// Run all tests
function runAllTests() {
  console.log('🚀 Starting offline sync tests...');
  testOfflineQueueExists();
  testOfflineChange();
  testQueueProcessing();
  testNetworkStatus();
  testSyncManagerState();
  console.log('\n✅ All tests completed!');
}

// Export functions for manual testing
window.testOfflineSync = {
  runAllTests,
  testOfflineQueueExists,
  testOfflineChange,
  testQueueProcessing,
  testNetworkStatus,
  testSyncManagerState
};

console.log('📚 Test functions available as window.testOfflineSync');
console.log('Run window.testOfflineSync.runAllTests() to execute all tests');
