// Simple test to verify online sync issue
// Run this in the browser console

console.log('🔍 Testing Online Sync Issue...');

// Test 1: Check current online status and queue
function checkCurrentState() {
  console.log('\n📊 Test 1: Checking current state...');
  
  console.log('navigator.onLine:', navigator.onLine);
  
  const queue = localStorage.getItem('relay-splits-offline-queue');
  if (queue) {
    const parsed = JSON.parse(queue);
    console.log('Offline queue items:', parsed.length);
    console.log('Queue contents:', parsed);
  } else {
    console.log('No offline queue found');
  }
  
  const storeState = useRaceStore.getState();
  console.log('Team ID:', storeState.teamId);
  console.log('Legs count:', storeState.legs.length);
  console.log('Legs with remoteIds:', storeState.legs.filter(l => l.remoteId).length);
}

// Test 2: Simulate a leg update while online
function testOnlineUpdate() {
  console.log('\n🔄 Test 2: Testing online update...');
  
  const storeState = useRaceStore.getState();
  if (!storeState.teamId || storeState.legs.length === 0) {
    console.log('❌ No team or legs available');
    return;
  }
  
  // Find a leg with remoteId
  const legWithRemoteId = storeState.legs.find(l => l.remoteId);
  if (!legWithRemoteId) {
    console.log('❌ No legs with remoteId found');
    return;
  }
  
  console.log('Found leg with remoteId:', legWithRemoteId.remoteId);
  console.log('Current online status:', navigator.onLine);
  
  // Try to update the leg
  try {
    console.log('Attempting to update leg...');
    const result = useRaceStore.getState().updateLeg(legWithRemoteId.id, {
      actualStart: Date.now()
    });
    
    console.log('Update result:', result);
    
    // Check if anything was queued
    setTimeout(() => {
      const queue = localStorage.getItem('relay-splits-offline-queue');
      if (queue) {
        const parsed = JSON.parse(queue);
        console.log('Queue after update:', parsed.length, 'items');
        if (parsed.length > 0) {
          console.log('Latest queue item:', parsed[parsed.length - 1]);
        }
      } else {
        console.log('No queue after update');
      }
    }, 1000);
    
  } catch (error) {
    console.log('❌ Error updating leg:', error);
  }
}

// Test 3: Force queue processing
function forceQueueProcessing() {
  console.log('\n⚡ Test 3: Forcing queue processing...');
  
  const storeState = useRaceStore.getState();
  if (!storeState.teamId) {
    console.log('❌ No team ID available');
    return;
  }
  
  // Check if useOfflineQueue is available
  if (typeof window.useOfflineQueue === 'undefined') {
    console.log('❌ useOfflineQueue not available globally');
    return;
  }
  
  // Try to trigger queue processing manually
  console.log('Attempting to trigger queue processing...');
  
  // This is a workaround - we'll manually call the queue processing
  const queue = localStorage.getItem('relay-splits-offline-queue');
  if (queue) {
    const parsed = JSON.parse(queue);
    console.log('Found queue with', parsed.length, 'items');
    
    if (parsed.length > 0) {
      console.log('Processing queue manually...');
      
      // Process each item manually
      parsed.forEach((item, index) => {
        console.log(`Processing item ${index + 1}:`, item);
        
        // Call the Edge Function directly
        fetch('https://whwsnpzwxagmlkrzrqsa.supabase.co/functions/v1/legs-upsert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamId: storeState.teamId,
            deviceId: storeState.deviceInfo?.deviceId || 'test-device',
            legs: [{
              id: item.remoteId,
              number: item.payload.number,
              distance: item.payload.distance,
              ...item.payload
            }],
            action: 'upsert'
          })
        })
        .then(res => res.json())
        .then(data => {
          console.log(`Item ${index + 1} result:`, data);
        })
        .catch(error => {
          console.log(`Item ${index + 1} error:`, error);
        });
      });
    }
  } else {
    console.log('No queue to process');
  }
}

// Test 4: Create a test change and force it to be processed
function createAndProcessTestChange() {
  console.log('\n🧪 Test 4: Creating and processing test change...');
  
  const storeState = useRaceStore.getState();
  if (!storeState.teamId || storeState.legs.length === 0) {
    console.log('❌ No team or legs available');
    return;
  }
  
  // Find a leg with remoteId
  const legWithRemoteId = storeState.legs.find(l => l.remoteId);
  if (!legWithRemoteId) {
    console.log('❌ No legs with remoteId found');
    return;
  }
  
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
  
  console.log('✅ Added test change to queue');
  console.log('Queue length:', arr.length);
  
  // Now try to process it
  setTimeout(() => {
    forceQueueProcessing();
  }, 1000);
}

// Run all tests
function runOnlineSyncTest() {
  console.log('🚀 Running online sync test...');
  
  checkCurrentState();
  testOnlineUpdate();
  
  setTimeout(() => {
    forceQueueProcessing();
  }, 2000);
  
  setTimeout(() => {
    createAndProcessTestChange();
  }, 4000);
  
  console.log('\n✅ Online sync test started!');
  console.log('Check the console for results over the next few seconds...');
}

// Export for testing
window.onlineSyncTest = {
  runOnlineSyncTest,
  checkCurrentState,
  testOnlineUpdate,
  forceQueueProcessing,
  createAndProcessTestChange
};

console.log('📚 Online sync test functions available as window.onlineSyncTest');
console.log('Run window.onlineSyncTest.runOnlineSyncTest() to test online sync');
