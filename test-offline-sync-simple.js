// Simple test script to verify offline queue functionality
// Run this in the browser console to test the offline sync system

console.log('🧪 Simple offline sync test...');

// Test 1: Check if offline queue exists
function checkOfflineQueue() {
  console.log('\n📋 Checking offline queue...');
  const queue = localStorage.getItem('relay-splits-offline-queue');
  if (queue) {
    const parsed = JSON.parse(queue);
    console.log('✅ Offline queue exists with', parsed.length, 'items');
    return parsed;
  } else {
    console.log('ℹ️ No offline queue found');
    return [];
  }
}

// Test 2: Add a test change
function addTestChange() {
  console.log('\n📝 Adding test change...');
  const testChange = {
    table: 'legs',
    remoteId: 'test-leg-' + Date.now(),
    payload: { actualStart: Date.now() },
    timestamp: Date.now()
  };
  
  const key = 'relay-splits-offline-queue';
  const raw = localStorage.getItem(key);
  const arr = raw ? JSON.parse(raw) : [];
  arr.push(testChange);
  localStorage.setItem(key, JSON.stringify(arr));
  
  console.log('✅ Added test change');
  console.log('Queue length:', arr.length);
  return testChange;
}

// Test 3: Check network status
function checkNetwork() {
  console.log('\n🌐 Network status:');
  console.log('navigator.onLine:', navigator.onLine);
  console.log('Connection type:', navigator.connection ? navigator.connection.effectiveType : 'unknown');
}

// Run all tests
function runSimpleTest() {
  console.log('🚀 Running simple offline sync test...');
  checkNetwork();
  const queue = checkOfflineQueue();
  if (queue.length === 0) {
    addTestChange();
  }
  console.log('\n✅ Simple test completed!');
}

// Export for manual testing
window.simpleOfflineTest = {
  runSimpleTest,
  checkOfflineQueue,
  addTestChange,
  checkNetwork
};

console.log('📚 Simple test functions available as window.simpleOfflineTest');
console.log('Run window.simpleOfflineTest.runSimpleTest() to execute test');
