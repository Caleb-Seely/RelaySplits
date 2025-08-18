// Focused test to identify the leg sync issue
// Run this in the browser console to test the specific problem

console.log('🔍 Testing Leg Sync Issue...');

// Test 1: Check if legs are actually in the database
function checkLegsInDatabase() {
  console.log('\n📊 Test 1: Checking legs in database...');
  
  const storeState = useRaceStore.getState();
  if (!storeState.teamId) {
    console.log('❌ No team ID available');
    return;
  }
  
  console.log('Team ID:', storeState.teamId);
  console.log('Local legs count:', storeState.legs.length);
  
  // Check database directly
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
    console.log('✅ Database legs count:', data.legs?.length || 0);
    
    if (data.legs && data.legs.length > 0) {
      console.log('✅ Legs ARE in the database');
      console.log('Sample database leg:', data.legs[0]);
      
      // Compare with local state
      const localLegsWithRemoteIds = storeState.legs.filter(l => l.remoteId);
      console.log('Local legs with remoteIds:', localLegsWithRemoteIds.length);
      
      if (localLegsWithRemoteIds.length > 0) {
        console.log('✅ Local legs have remoteIds - sync should work');
      } else {
        console.log('❌ Local legs missing remoteIds - this is the problem!');
      }
    } else {
      console.log('❌ No legs found in database');
    }
  })
  .catch(error => {
    console.log('❌ Error checking database:', error);
  });
}

// Test 2: Check offline queue processing
function checkOfflineQueueProcessing() {
  console.log('\n📝 Test 2: Checking offline queue processing...');
  
  const queue = localStorage.getItem('relay-splits-offline-queue');
  if (queue) {
    const parsed = JSON.parse(queue);
    console.log('Offline queue items:', parsed.length);
    
    if (parsed.length > 0) {
      console.log('Queue items:', parsed);
      
      // Check if any are legs
      const legChanges = parsed.filter(item => item.table === 'legs');
      console.log('Leg changes in queue:', legChanges.length);
      
      if (legChanges.length > 0) {
        console.log('Leg change details:', legChanges[0]);
      }
    }
  } else {
    console.log('No offline queue found');
  }
}

// Test 3: Simulate a leg update and check if it gets queued
function testLegUpdateQueuing() {
  console.log('\n🔄 Test 3: Testing leg update queuing...');
  
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
  
  // Simulate offline mode
  const originalOnline = navigator.onLine;
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    value: false
  });
  
  console.log('📴 Simulated offline mode');
  
  // Try to update the leg
  try {
    // This should trigger the offline queue
    const result = useRaceStore.getState().updateLeg(legWithRemoteId.id, {
      actualStart: Date.now()
    });
    
    console.log('Update result:', result);
    
    // Check if it was queued
    setTimeout(() => {
      const queue = localStorage.getItem('relay-splits-offline-queue');
      if (queue) {
        const parsed = JSON.parse(queue);
        const newLegChanges = parsed.filter(item => 
          item.table === 'legs' && 
          item.remoteId === legWithRemoteId.remoteId
        );
        console.log('New leg changes in queue:', newLegChanges.length);
        if (newLegChanges.length > 0) {
          console.log('✅ Leg update was queued successfully');
        } else {
          console.log('❌ Leg update was NOT queued');
        }
      }
      
      // Restore online status
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: originalOnline
      });
    }, 1000);
    
  } catch (error) {
    console.log('❌ Error updating leg:', error);
    
    // Restore online status
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: originalOnline
    });
  }
}

// Test 4: Check if the issue is with the SetupWizard or the sync process
function diagnoseRootCause() {
  console.log('\n🔍 Test 4: Diagnosing root cause...');
  
  const storeState = useRaceStore.getState();
  
  console.log('Setup state:', {
    isSetupComplete: storeState.isSetupComplete,
    isSetupLocked: storeState.isSetupLocked,
    isNewTeam: storeState.isNewTeam
  });
  
  console.log('Data state:', {
    runnersCount: storeState.runners.length,
    legsCount: storeState.legs.length,
    legsWithRemoteIds: storeState.legs.filter(l => l.remoteId).length
  });
  
  // Check if this is a new team setup
  const isNewTeam = localStorage.getItem('relay_is_new_team');
  console.log('New team flag:', isNewTeam);
  
  if (isNewTeam === '1') {
    console.log('✅ This appears to be a new team setup');
    console.log('The SetupWizard should have created legs with remoteIds');
  } else {
    console.log('ℹ️ This appears to be an existing team');
  }
  
  // Check if legs have the right structure
  if (storeState.legs.length > 0) {
    const sampleLeg = storeState.legs[0];
    console.log('Sample leg structure:', {
      id: sampleLeg.id,
      remoteId: sampleLeg.remoteId,
      distance: sampleLeg.distance,
      runnerId: sampleLeg.runnerId
    });
  }
}

// Run the diagnosis
function runDiagnosis() {
  console.log('🚀 Running leg sync diagnosis...');
  
  checkLegsInDatabase();
  checkOfflineQueueProcessing();
  testLegUpdateQueuing();
  diagnoseRootCause();
  
  console.log('\n✅ Diagnosis complete!');
  console.log('\n📋 Summary:');
  console.log('- If legs are in DB but local legs lack remoteIds: SetupWizard issue');
  console.log('- If legs are not in DB: SetupWizard failed to save');
  console.log('- If offline queue not working: Sync process issue');
}

// Export for testing
window.legSyncDiagnosis = {
  runDiagnosis,
  checkLegsInDatabase,
  checkOfflineQueueProcessing,
  testLegUpdateQueuing,
  diagnoseRootCause
};

console.log('📚 Leg sync diagnosis functions available as window.legSyncDiagnosis');
console.log('Run window.legSyncDiagnosis.runDiagnosis() to diagnose the issue');
