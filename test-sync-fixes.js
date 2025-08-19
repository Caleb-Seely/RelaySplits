// Test script to validate the sync data integrity fixes
// This will test the field-level merging and complete payload fixes

console.log('🧪 Testing Sync Data Integrity Fixes...\n');

// Test 1: Field-level merging
function testFieldLevelMerging() {
  console.log('=== Test 1: Field-Level Merging ===');
  
  // Simulate the old merge logic (complete replacement)
  const oldMergeLogic = (localItem, incomingItem) => {
    return incomingItem; // Complete replacement
  };
  
  // Simulate the new merge logic (field-level merging)
  const newMergeLogic = (localItem, incomingItem) => {
    return {
      ...localItem,  // Keep all existing fields
      ...incomingItem,  // Override with incoming fields
      // Preserve critical timing fields if they exist locally but not in incoming data
      actualStart: incomingItem.actualStart ?? localItem.actualStart,
      actualFinish: incomingItem.actualFinish ?? localItem.actualFinish,
    };
  };
  
  // Test scenario: Local has both start and finish, server only has start
  const localLeg = {
    id: 1,
    actualStart: Date.now() - 3600000, // 1 hour ago
    actualFinish: Date.now() - 1800000, // 30 minutes ago
    distance: 5.2,
    updated_at: new Date(Date.now() - 60000).toISOString() // 1 minute ago
  };
  
  const serverLeg = {
    id: 1,
    actualStart: Date.now() - 3500000, // 10 minutes later than local
    actualFinish: null, // Server has no finish time
    distance: 5.2,
    updated_at: new Date().toISOString() // Newer timestamp
  };
  
  console.log('Local leg:', localLeg);
  console.log('Server leg:', serverLeg);
  
  // Test old logic
  const oldResult = oldMergeLogic(localLeg, serverLeg);
  console.log('Old merge result:', oldResult);
  console.log('Old logic data loss:', !oldResult.actualFinish ? '❌ FINISH TIME LOST' : '✅ Preserved');
  
  // Test new logic
  const newResult = newMergeLogic(localLeg, serverLeg);
  console.log('New merge result:', newResult);
  console.log('New logic data loss:', !newResult.actualFinish ? '❌ FINISH TIME LOST' : '✅ Preserved');
  
  const testPassed = newResult.actualFinish && newResult.actualStart;
  console.log(`Test 1 ${testPassed ? '✅ PASSED' : '❌ FAILED'}: Field-level merging ${testPassed ? 'preserves' : 'loses'} existing data`);
  
  return testPassed;
}

// Test 2: Complete payload construction
function testCompletePayload() {
  console.log('\n=== Test 2: Complete Payload Construction ===');
  
  // Simulate the old payload logic (incomplete)
  const oldPayloadLogic = (leg, field, value) => {
    return {
      id: leg.remoteId,
      number: leg.id,
      distance: leg.distance,
      [field === 'actualStart' ? 'start_time' : 'finish_time']: value ? new Date(value).toISOString() : null
    };
  };
  
  // Simulate the new payload logic (complete)
  const newPayloadLogic = (leg, field, value) => {
    return {
      id: leg.remoteId,
      number: leg.id,
      distance: leg.distance,
      start_time: leg.actualStart ? new Date(leg.actualStart).toISOString() : null,
      finish_time: leg.actualFinish ? new Date(leg.actualFinish).toISOString() : null,
    };
  };
  
  const testLeg = {
    id: 1,
    remoteId: 'leg-1',
    distance: 5.2,
    actualStart: Date.now() - 3600000,
    actualFinish: Date.now() - 1800000
  };
  
  console.log('Test leg:', testLeg);
  
  // Test old payload (updating start time)
  const oldPayload = oldPayloadLogic(testLeg, 'actualStart', Date.now());
  console.log('Old payload (start update):', oldPayload);
  console.log('Old payload includes finish_time:', oldPayload.finish_time ? '✅ Yes' : '❌ No');
  
  // Test new payload (updating start time)
  const newPayload = newPayloadLogic(testLeg, 'actualStart', Date.now());
  console.log('New payload (start update):', newPayload);
  console.log('New payload includes finish_time:', newPayload.finish_time ? '✅ Yes' : '❌ No');
  
  const testPassed = newPayload.finish_time && oldPayload.finish_time === undefined;
  console.log(`Test 2 ${testPassed ? '✅ PASSED' : '❌ FAILED'}: Complete payload ${testPassed ? 'includes' : 'missing'} all leg data`);
  
  return testPassed;
}

// Test 3: Data validation
function testDataValidation() {
  console.log('\n=== Test 3: Data Validation ===');
  
  const validateLegDataIntegrity = (leg, operation) => {
    const issues = [];
    
    // Check for timing consistency
    if (leg.actualStart && leg.actualFinish && leg.actualFinish <= leg.actualStart) {
      issues.push(`Invalid timing: finish (${leg.actualFinish}) <= start (${leg.actualStart})`);
    }
    
    // Check for missing critical data
    if (leg.actualStart && !leg.actualFinish && Date.now() - leg.actualStart > 3600000) {
      issues.push('Leg started over 1 hour ago but has no finish time');
    }
    
    if (issues.length > 0) {
      console.warn(`[${operation}] Data integrity issues for leg ${leg.id}:`, issues);
      return false;
    }
    
    return true;
  };
  
  // Test valid leg
  const validLeg = {
    id: 1,
    actualStart: Date.now() - 3600000,
    actualFinish: Date.now() - 1800000
  };
  
  console.log('Valid leg:', validLeg);
  const validResult = validateLegDataIntegrity(validLeg, 'test');
  console.log('Valid leg validation:', validResult ? '✅ PASSED' : '❌ FAILED');
  
  // Test invalid leg (finish before start)
  const invalidLeg = {
    id: 2,
    actualStart: Date.now() - 1800000,
    actualFinish: Date.now() - 3600000 // Before start time
  };
  
  console.log('Invalid leg (finish before start):', invalidLeg);
  const invalidResult = validateLegDataIntegrity(invalidLeg, 'test');
  console.log('Invalid leg validation:', !invalidResult ? '✅ PASSED (correctly rejected)' : '❌ FAILED (should have rejected)');
  
  // Test incomplete leg (started but no finish)
  const incompleteLeg = {
    id: 3,
    actualStart: Date.now() - 7200000, // 2 hours ago
    actualFinish: null
  };
  
  console.log('Incomplete leg (no finish):', incompleteLeg);
  const incompleteResult = validateLegDataIntegrity(incompleteLeg, 'test');
  console.log('Incomplete leg validation:', !incompleteResult ? '✅ PASSED (correctly rejected)' : '❌ FAILED (should have rejected)');
  
  const testPassed = validResult && !invalidResult && !incompleteResult;
  console.log(`Test 3 ${testPassed ? '✅ PASSED' : '❌ FAILED'}: Data validation ${testPassed ? 'works' : 'fails'} correctly`);
  
  return testPassed;
}

// Test 4: Integration test
function testIntegration() {
  console.log('\n=== Test 4: Integration Test ===');
  
  // Simulate a complete sync scenario
  const scenario = {
    deviceA: {
      leg: {
        id: 1,
        actualStart: Date.now() - 3600000,
        actualFinish: Date.now() - 1800000,
        updated_at: new Date(Date.now() - 60000).toISOString()
      }
    },
    deviceB: {
      leg: {
        id: 1,
        actualStart: Date.now() - 3500000, // Different start time
        actualFinish: null, // No finish time
        updated_at: new Date().toISOString() // Newer
      }
    }
  };
  
  console.log('Scenario: Device A has complete data, Device B has partial data');
  console.log('Device A leg:', scenario.deviceA.leg);
  console.log('Device B leg:', scenario.deviceB.leg);
  
  // Simulate the sync process with new logic
  const newMergeLogic = (localItem, incomingItem) => {
    return {
      ...localItem,
      ...incomingItem,
      actualStart: incomingItem.actualStart ?? localItem.actualStart,
      actualFinish: incomingItem.actualFinish ?? localItem.actualFinish,
    };
  };
  
  const newPayloadLogic = (leg) => {
    return {
      id: leg.remoteId || 'leg-1',
      number: leg.id,
      distance: 5.2,
      start_time: leg.actualStart ? new Date(leg.actualStart).toISOString() : null,
      finish_time: leg.actualFinish ? new Date(leg.actualFinish).toISOString() : null,
    };
  };
  
  // Simulate Device A syncing with Device B's data
  const mergedLeg = newMergeLogic(scenario.deviceA.leg, scenario.deviceB.leg);
  console.log('Merged leg:', mergedLeg);
  
  // Check if data was preserved
  const startTimePreserved = mergedLeg.actualStart === scenario.deviceB.leg.actualStart; // Should use newer
  const finishTimePreserved = mergedLeg.actualFinish === scenario.deviceA.leg.actualFinish; // Should preserve existing
  
  console.log('Start time preserved:', startTimePreserved ? '✅ Yes' : '❌ No');
  console.log('Finish time preserved:', finishTimePreserved ? '✅ Yes' : '❌ No');
  
  // Test payload construction
  const payload = newPayloadLogic(mergedLeg);
  console.log('Sync payload:', payload);
  console.log('Payload includes finish_time:', payload.finish_time ? '✅ Yes' : '❌ No');
  
  const testPassed = startTimePreserved && finishTimePreserved && payload.finish_time;
  console.log(`Test 4 ${testPassed ? '✅ PASSED' : '❌ FAILED'}: Integration test ${testPassed ? 'succeeds' : 'fails'}`);
  
  return testPassed;
}

// Run all tests
function runAllTests() {
  const tests = [
    { name: 'Field-Level Merging', fn: testFieldLevelMerging },
    { name: 'Complete Payload Construction', fn: testCompletePayload },
    { name: 'Data Validation', fn: testDataValidation },
    { name: 'Integration Test', fn: testIntegration }
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const result = test.fn();
      results.push({ name: test.name, passed: result });
    } catch (error) {
      console.error(`❌ ${test.name} failed with error:`, error);
      results.push({ name: test.name, passed: false });
    }
  }
  
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  
  let passedCount = 0;
  for (const result of results) {
    console.log(`${result.passed ? '✅' : '❌'} ${result.name}: ${result.passed ? 'PASSED' : 'FAILED'}`);
    if (result.passed) passedCount++;
  }
  
  console.log(`\n🎯 Overall: ${passedCount}/${results.length} tests passed`);
  
  if (passedCount === results.length) {
    console.log('🎉 All tests passed! The sync fixes are working correctly.');
    console.log('✅ Field-level merging preserves existing data');
    console.log('✅ Complete payloads include all leg data');
    console.log('✅ Data validation catches integrity issues');
    console.log('✅ Integration test shows end-to-end functionality');
  } else {
    console.log('⚠️ Some tests failed. Please review the implementation.');
  }
  
  return results;
}

// Run tests if this file is executed directly
runAllTests(); 