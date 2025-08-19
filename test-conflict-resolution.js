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

// Test 6: Test conflict resolution sync
function testConflictResolutionSync() {
  console.log('\n🔧 Test 6: Testing conflict resolution sync...');
  
  try {
    // Check if eventBus is available
    if (typeof eventBus !== 'undefined') {
      console.log('✅ EventBus is available');
      
      // Check if LEG_UPDATE event type is defined
      if (typeof EVENT_TYPES !== 'undefined' && EVENT_TYPES.LEG_UPDATE) {
        console.log('✅ LEG_UPDATE event type is available');
        
        // Simulate a conflict resolution event
        const testEvent = {
          type: EVENT_TYPES.LEG_UPDATE,
          payload: {
            legId: 1,
            field: 'start',
            value: Date.now(),
            previousValue: Date.now() - 60000,
            runnerId: 1,
            timestamp: Date.now(),
            source: 'conflict-resolution'
          },
          priority: 'high',
          source: 'test'
        };
        
        console.log('📤 Publishing test LEG_UPDATE event...');
        eventBus.publish(testEvent);
        console.log('✅ Test event published successfully');
        
        // Check if useEnhancedSyncManager is listening
        console.log('ℹ️ The useEnhancedSyncManager should now process this event and sync to database');
        
      } else {
        console.log('❌ EVENT_TYPES not available');
      }
    } else {
      console.log('❌ EventBus not available');
    }
  } catch (error) {
    console.log('❌ Error testing conflict resolution sync:', error.message);
  }
}

// Test 7: Check button alignment in conflict modal
function checkConflictModalAlignment() {
  console.log('\n🎯 Test 7: Checking conflict modal button alignment...');
  
  try {
    // Look for the conflict resolution modal in the DOM
    const modal = document.querySelector('[role="dialog"]');
    if (modal) {
      console.log('✅ Conflict modal found');
      
      // Check for buttons
      const buttons = modal.querySelectorAll('button');
      console.log(`Found ${buttons.length} buttons in modal`);
      
      if (buttons.length >= 2) {
        // Check if buttons are in a flex container
        const buttonContainer = buttons[0].parentElement;
        if (buttonContainer) {
          const styles = window.getComputedStyle(buttonContainer);
          console.log('Button container display:', styles.display);
          console.log('Button container justify-content:', styles.justifyContent);
          console.log('Button container align-items:', styles.alignItems);
          
          if (styles.display === 'flex' && styles.justifyContent === 'center') {
            console.log('✅ Buttons should be properly centered');
          } else {
            console.log('⚠️ Button container may not be properly centered');
          }
        }
      }
    } else {
      console.log('ℹ️ No conflict modal currently visible');
      console.log('💡 To test button alignment, trigger a conflict first');
    }
  } catch (error) {
    console.log('❌ Error checking modal alignment:', error.message);
  }
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
  testConflictResolutionSync();
  checkConflictModalAlignment();
  console.log('\n✅ Conflict resolution tests completed!');
}

// Export for manual testing
window.conflictResolutionTest = {
  runConflictResolutionTest,
  checkOfflineQueue,
  checkLocalStore,
  simulateOfflineChange,
  testMergeLogic,
  checkNetwork,
  testConflictResolutionSync,
  checkConflictModalAlignment
};

console.log('📚 Conflict resolution test functions available as window.conflictResolutionTest');
console.log('Run window.conflictResolutionTest.runConflictResolutionTest() to execute all tests');
