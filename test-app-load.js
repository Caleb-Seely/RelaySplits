// Test script to verify application loads properly
// Run this in the browser console after the app loads

console.log('🧪 Testing application load...');

// Test 1: Check if React is loaded
function testReactLoad() {
  console.log('\n📦 Test 1: Checking React load...');
  if (window.React) {
    console.log('✅ React is loaded');
    return true;
  } else {
    console.log('❌ React not found');
    return false;
  }
}

// Test 2: Check if validation schemas are available
function testValidationSchemas() {
  console.log('\n🔍 Test 2: Checking validation schemas...');
  try {
    // Try to access the validation module
    const validationModule = require('@/utils/validation');
    console.log('✅ Validation module accessible');
    return true;
  } catch (error) {
    console.log('❌ Validation module error:', error.message);
    return false;
  }
}

// Test 3: Check if offline queue is working
function testOfflineQueue() {
  console.log('\n📋 Test 3: Checking offline queue...');
  try {
    const queue = localStorage.getItem('relay-splits-offline-queue');
    if (queue) {
      const parsed = JSON.parse(queue);
      console.log('✅ Offline queue accessible with', parsed.length, 'items');
    } else {
      console.log('✅ Offline queue accessible (empty)');
    }
    return true;
  } catch (error) {
    console.log('❌ Offline queue error:', error.message);
    return false;
  }
}

// Test 4: Check if store is accessible
function testStore() {
  console.log('\n🏪 Test 4: Checking store...');
  try {
    // Try to access the race store
    const storeModule = require('@/store/raceStore');
    console.log('✅ Store module accessible');
    return true;
  } catch (error) {
    console.log('❌ Store module error:', error.message);
    return false;
  }
}

// Test 5: Check network status
function testNetwork() {
  console.log('\n🌐 Test 5: Checking network...');
  console.log('navigator.onLine:', navigator.onLine);
  console.log('Connection type:', navigator.connection ? navigator.connection.effectiveType : 'unknown');
  return true;
}

// Run all tests
function runAppLoadTest() {
  console.log('🚀 Running application load tests...');
  
  const tests = [
    testReactLoad,
    testValidationSchemas,
    testOfflineQueue,
    testStore,
    testNetwork
  ];
  
  const results = tests.map(test => test());
  const passed = results.filter(result => result === true).length;
  
  console.log(`\n📊 Test Results: ${passed}/${tests.length} tests passed`);
  
  if (passed === tests.length) {
    console.log('✅ All tests passed! Application should be working properly.');
  } else {
    console.log('⚠️ Some tests failed. Check the console for details.');
  }
}

// Export for manual testing
window.appLoadTest = {
  runAppLoadTest,
  testReactLoad,
  testValidationSchemas,
  testOfflineQueue,
  testStore,
  testNetwork
};

console.log('📚 App load test functions available as window.appLoadTest');
console.log('Run window.appLoadTest.runAppLoadTest() to execute all tests');
