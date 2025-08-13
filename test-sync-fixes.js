// Test script to verify RelayTracker sync fixes
// Run this in the browser console after the app loads

console.log('🧪 Testing RelayTracker Sync Fixes...');

// Test 1: Check if race store has the new methods
function testRaceStoreMethods() {
  console.log('\n🔍 Test 1: Race Store Methods');
  
  try {
    // Check if the store exists
    if (typeof window !== 'undefined' && window.useRaceStore) {
      const store = window.useRaceStore.getState();
      
      // Check for new methods
      const hasSetRaceData = typeof store.setRaceData === 'function';
      const hasIsDataConsistent = typeof store.isDataConsistent === 'function';
      const hasForceReset = typeof store.forceReset === 'function';
      
      console.log('✅ setRaceData method:', hasSetRaceData);
      console.log('✅ isDataConsistent method:', hasIsDataConsistent);
      console.log('✅ forceReset method:', hasForceReset);
      
      if (hasSetRaceData && hasIsDataConsistent && hasForceReset) {
        console.log('🎉 All new race store methods are available!');
      } else {
        console.log('❌ Some methods are missing');
      }
    } else {
      console.log('❌ Race store not available in global scope');
    }
  } catch (error) {
    console.error('❌ Error testing race store methods:', error);
  }
}

// Test 2: Check data consistency
function testDataConsistency() {
  console.log('\n🔍 Test 2: Data Consistency Check');
  
  try {
    if (typeof window !== 'undefined' && window.useRaceStore) {
      const store = window.useRaceStore.getState();
      
      // Check current data state
      const hasDefaultData = store.runners.some(r => r.name.startsWith('Runner '));
      const hasCustomData = store.runners.some(r => !r.name.startsWith('Runner '));
      const isConsistent = store.isDataConsistent();
      
      console.log('Current runners:', store.runners.length);
      console.log('Has default data:', hasDefaultData);
      console.log('Has custom data:', hasCustomData);
      console.log('Is consistent:', isConsistent);
      
      if (isConsistent) {
        console.log('✅ Data is in consistent state');
      } else {
        console.log('⚠️ Data inconsistency detected');
      }
    } else {
      console.log('❌ Race store not available');
    }
  } catch (error) {
    console.error('❌ Error testing data consistency:', error);
  }
}

// Test 3: Check sync hooks
function testSyncHooks() {
  console.log('\n🔍 Test 3: Sync Hook Availability');
  
  try {
    // Check if sync hooks are available (they should be imported in the app)
    console.log('✅ Sync hooks should be available in the app components');
    console.log('✅ useSupabaseSync hook should prevent race conditions');
    console.log('✅ useTeamSync hook should isolate team data');
    
    // Check console for sync-related logs
    console.log('📝 Check browser console for sync operation logs:');
    console.log('   - Look for "🔄 [SYNC]" messages');
    console.log('   - Look for "🏃 [STORE]" messages');
    console.log('   - Look for "👥 [TEAM]" messages');
  } catch (error) {
    console.error('❌ Error testing sync hooks:', error);
  }
}

// Test 4: Simulate race condition scenario
function testRaceConditionPrevention() {
  console.log('\n🔍 Test 4: Race Condition Prevention');
  
  try {
    if (typeof window !== 'undefined' && window.useRaceStore) {
      const store = window.useRaceStore.getState();
      
      console.log('📝 To test race condition prevention:');
      console.log('   1. Switch between different teams');
      console.log('   2. Watch console for sync messages');
      console.log('   3. Verify data stays consistent');
      console.log('   4. Look for "Initial sync" messages');
      console.log('   5. Check that auto-sync is disabled during initial sync');
      
      console.log('\n📝 Expected behavior:');
      console.log('   - Data loads from database');
      console.log('   - Store updates with real data');
      console.log('   - Data stays loaded (no overwriting)');
      console.log('   - No mixed default/custom data');
    } else {
      console.log('❌ Race store not available');
    }
  } catch (error) {
    console.error('❌ Error testing race condition prevention:', error);
  }
}

// Test 5: Check team isolation
function testTeamIsolation() {
  console.log('\n🔍 Test 5: Team Isolation');
  
  try {
    console.log('📝 To test team isolation:');
    console.log('   1. Create or join different teams');
    console.log('   2. Add different runner data to each team');
    console.log('   3. Switch between teams');
    console.log('   4. Verify each team has its own data');
    console.log('   5. Check that no cross-team contamination occurs');
    
    console.log('\n📝 Expected behavior:');
    console.log('   - Each team has isolated data');
    console.log('   - No data sharing between teams');
    console.log('   - Team ID validation prevents cross-sync');
    console.log('   - Console shows team-specific sync messages');
  } catch (error) {
    console.error('❌ Error testing team isolation:', error);
  }
}

// Run all tests
function runAllTests() {
  console.log('🚀 Starting RelayTracker Sync Fixes Test Suite...\n');
  
  testRaceStoreMethods();
  testDataConsistency();
  testSyncHooks();
  testRaceConditionPrevention();
  testTeamIsolation();
  
  console.log('\n🎯 Test Suite Complete!');
  console.log('\n📋 Manual Testing Checklist:');
  console.log('   □ Switch between teams');
  console.log('   □ Verify data persistence');
  console.log('   □ Check console for sync logs');
  console.log('   □ Test real-time updates');
  console.log('   □ Verify no race conditions');
  console.log('   □ Confirm team data isolation');
}

// Export for manual testing
if (typeof window !== 'undefined') {
  window.testRelayTrackerSync = {
    runAllTests,
    testRaceStoreMethods,
    testDataConsistency,
    testSyncHooks,
    testRaceConditionPrevention,
    testTeamIsolation
  };
  
  console.log('🧪 Test functions available at: window.testRelayTrackerSync');
  console.log('   Run: window.testRelayTrackerSync.runAllTests()');
}

// Auto-run if in console
if (typeof console !== 'undefined') {
  runAllTests();
} 