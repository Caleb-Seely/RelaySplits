// Comprehensive test script to verify SetupWizard and offline-online syncing
// Run this in the browser console to test the complete flow

console.log('🧪 Testing SetupWizard and Offline-Online Syncing...');

// Test 1: Check current application state
function checkCurrentState() {
  console.log('\n📋 Test 1: Checking current application state...');
  
  try {
    const storeState = useRaceStore.getState();
    console.log('✅ Store state accessible');
    console.log('Runners count:', storeState.runners.length);
    console.log('Legs count:', storeState.legs.length);
    console.log('Team ID:', storeState.teamId);
    console.log('Is setup complete:', storeState.isSetupComplete);
    
    if (storeState.legs.length > 0) {
      console.log('Sample leg:', storeState.legs[0]);
      console.log('Leg with remoteId:', storeState.legs.find(l => l.remoteId));
    }
    
    return storeState;
  } catch (error) {
    console.log('❌ Error accessing store:', error.message);
    return null;
  }
}

// Test 2: Check database state
function checkDatabaseState() {
  console.log('\n🏪 Test 2: Checking database state...');
  
  const storeState = useRaceStore.getState();
  if (!storeState.teamId) {
    console.log('❌ No team ID available');
    return;
  }
  
  // Check runners in DB
  fetch('https://whwsnpzwxagmlkrzrqsa.supabase.co/functions/v1/runners-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teamId: storeState.teamId,
      deviceId: storeState.deviceInfo?.deviceId || 'test-device'
    })
  })
  .then(res => res.json())
  .then(data => {
    console.log('✅ Runners in database:', data.runners?.length || 0);
    if (data.runners?.length > 0) {
      console.log('Sample runner:', data.runners[0]);
    }
  })
  .catch(error => {
    console.log('❌ Error fetching runners:', error);
  });
  
  // Check legs in DB
  fetch('https://whwsnpzwxagmlkrzrqsa.supabase.co/functions/v1/legs-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teamId: storeState.teamId,
      deviceId: storeState.deviceInfo?.deviceId || 'test-device'
    })
  })
  .then(res => res.json())
  .then(data => {
    console.log('✅ Legs in database:', data.legs?.length || 0);
    if (data.legs?.length > 0) {
      console.log('Sample leg:', data.legs[0]);
    }
  })
  .catch(error => {
    console.log('❌ Error fetching legs:', error);
  });
}

// Test 3: Check offline queue
function checkOfflineQueue() {
  console.log('\n📝 Test 3: Checking offline queue...');
  
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

// Test 4: Simulate offline change
function simulateOfflineChange() {
  console.log('\n📱 Test 4: Simulating offline change...');
  
  const storeState = useRaceStore.getState();
  if (!storeState.teamId || storeState.legs.length === 0) {
    console.log('❌ No team or legs available for testing');
    return;
  }
  
  // Find a leg with a remoteId
  const legWithRemoteId = storeState.legs.find(l => l.remoteId);
  if (!legWithRemoteId) {
    console.log('❌ No legs with remoteId found');
    return;
  }
  
  console.log('✅ Found leg with remoteId:', legWithRemoteId.remoteId);
  
  // Simulate going offline
  console.log('📴 Simulating offline mode...');
  
  // Create a test change
  const testChange = {
    table: 'legs',
    remoteId: legWithRemoteId.remoteId,
    payload: {
      actualStart: Date.now(),
      number: legWithRemoteId.id,
      distance: legWithRemoteId.distance
    },
    timestamp: Date.now()
  };
  
  // Add to queue
  const key = 'relay-splits-offline-queue';
  const raw = localStorage.getItem(key);
  const arr = raw ? JSON.parse(raw) : [];
  arr.push(testChange);
  localStorage.setItem(key, JSON.stringify(arr));
  
  console.log('✅ Added test change to offline queue');
  console.log('Queue length:', arr.length);
  console.log('Test change:', testChange);
  
  return testChange;
}

// Test 5: Test queue processing
function testQueueProcessing() {
  console.log('\n🔄 Test 5: Testing queue processing...');
  
  const queue = checkOfflineQueue();
  if (queue.length === 0) {
    console.log('ℹ️ No queue to process');
    return;
  }
  
  console.log('✅ Found queue with', queue.length, 'items');
  
  // Check if useOfflineQueue is available
  if (typeof window.testOfflineSync !== 'undefined') {
    console.log('✅ useOfflineSync test functions available');
    console.log('Run window.testOfflineSync() to test offline sync');
  } else {
    console.log('ℹ️ useOfflineSync test functions not available');
  }
  
  // Check if conflict resolution test is available
  if (typeof window.conflictResolutionTest !== 'undefined') {
    console.log('✅ Conflict resolution test functions available');
    console.log('Run window.conflictResolutionTest.runConflictResolutionTest() to test conflict resolution');
  } else {
    console.log('ℹ️ Conflict resolution test functions not available');
  }
}

// Test 6: Check network status and simulate online/offline
function testNetworkSimulation() {
  console.log('\n🌐 Test 6: Testing network simulation...');
  
  console.log('Current navigator.onLine:', navigator.onLine);
  
  // Simulate offline
  console.log('📴 Simulating offline...');
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    value: false
  });
  
  // Trigger offline event
  window.dispatchEvent(new Event('offline'));
  console.log('✅ Offline event dispatched');
  
  // Simulate online
  setTimeout(() => {
    console.log('🌐 Simulating online...');
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
    
    // Trigger online event
    window.dispatchEvent(new Event('online'));
    console.log('✅ Online event dispatched');
  }, 2000);
}

// Test 7: Verify SetupWizard functionality
function testSetupWizard() {
  console.log('\n⚙️ Test 7: Testing SetupWizard functionality...');
  
  const storeState = useRaceStore.getState();
  
  if (storeState.isSetupComplete) {
    console.log('✅ Setup is complete');
    console.log('Team ID:', storeState.teamId);
    console.log('Runners:', storeState.runners.length);
    console.log('Legs:', storeState.legs.length);
    
    // Check if legs have remoteIds
    const legsWithRemoteIds = storeState.legs.filter(l => l.remoteId);
    console.log('Legs with remoteIds:', legsWithRemoteIds.length);
    
    if (legsWithRemoteIds.length > 0) {
      console.log('✅ SetupWizard successfully created legs with remoteIds');
    } else {
      console.log('⚠️ SetupWizard created legs but no remoteIds found');
    }
  } else {
    console.log('ℹ️ Setup is not complete');
    console.log('Current state:', {
      teamId: storeState.teamId,
      isSetupComplete: storeState.isSetupComplete,
      isSetupLocked: storeState.isSetupLocked
    });
  }
}

// Run all tests
function runCompleteTest() {
  console.log('🚀 Running complete SetupWizard and sync test...');
  
  checkCurrentState();
  checkDatabaseState();
  checkOfflineQueue();
  simulateOfflineChange();
  testQueueProcessing();
  testNetworkSimulation();
  testSetupWizard();
  
  console.log('\n✅ Complete test finished!');
  console.log('\n📋 Next steps:');
  console.log('1. Check the console for any ❌ errors');
  console.log('2. If SetupWizard is working, test offline-online syncing');
  console.log('3. Run window.testOfflineSync() if available');
  console.log('4. Check database state after offline changes');
}

// Export for manual testing
window.setupAndSyncTest = {
  runCompleteTest,
  checkCurrentState,
  checkDatabaseState,
  checkOfflineQueue,
  simulateOfflineChange,
  testQueueProcessing,
  testNetworkSimulation,
  testSetupWizard
};

console.log('📚 Setup and sync test functions available as window.setupAndSyncTest');
console.log('Run window.setupAndSyncTest.runCompleteTest() to execute all tests');
