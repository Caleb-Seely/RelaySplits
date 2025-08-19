// Test script to verify race logic fix
console.log('Testing Race Logic Fix...');

// Simulate the race state logic
function testRaceLogic() {
  console.log('\n1. Testing race completion logic...');
  
  // Scenario 1: Legs initialized but no actual times (race hasn't started)
  console.log('\nScenario 1: Legs initialized, race hasn\'t started');
  let legs = Array.from({ length: 36 }, (_, i) => ({
    id: i + 1,
    runnerId: (i % 12) + 1,
    distance: 5.0,
    projectedStart: 0,
    projectedFinish: 0,
    actualStart: undefined,
    actualFinish: undefined
  }));
  
  let runners = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    name: `Runner ${i + 1}`,
    pace: 420,
    van: (i < 6 ? 1 : 2)
  }));
  
  let currentRunner = null; // No current runner
  let nextRunner = legs[0]; // First leg
  let nextRunnerInfo = runners.find(r => r.id === nextRunner.runnerId);
  let leg36 = legs.find(leg => leg.id === 36);
  
  // Test the condition
  const shouldShowNextRunner = (nextRunner && nextRunnerInfo) || 
                              (leg36?.actualStart && !leg36?.actualFinish) ||
                              (legs.length > 0 && !nextRunner) ||
                              (legs.length > 0 && nextRunner && !nextRunnerInfo);
  
  console.log('   legs.length:', legs.length);
  console.log('   nextRunner:', nextRunner?.id);
  console.log('   nextRunnerInfo:', nextRunnerInfo?.name);
  console.log('   leg36.actualFinish:', leg36?.actualFinish);
  console.log('   shouldShowNextRunner:', shouldShowNextRunner);
  
  if (shouldShowNextRunner) {
    console.log('   ✅ SUCCESS: Should show next runner content');
  } else {
    console.log('   ❌ FAILURE: Will show race completion content incorrectly');
  }
  
  // Scenario 2: Race completed (leg 36 has actual finish time)
  console.log('\nScenario 2: Race completed');
  legs[35].actualFinish = Date.now(); // Leg 36 finished
  
  const shouldShowNextRunnerCompleted = (nextRunner && nextRunnerInfo) || 
                                       (leg36?.actualStart && !leg36?.actualFinish) ||
                                       (legs.length > 0 && !nextRunner) ||
                                       (legs.length > 0 && nextRunner && !nextRunnerInfo);
  
  console.log('   leg36.actualFinish:', leg36?.actualFinish);
  console.log('   shouldShowNextRunner:', shouldShowNextRunnerCompleted);
  
  if (!shouldShowNextRunnerCompleted) {
    console.log('   ✅ SUCCESS: Should show race completion content');
  } else {
    console.log('   ❌ FAILURE: Will show next runner content incorrectly');
  }
  
  // Test progress calculation
  console.log('\n2. Testing progress calculation...');
  
  function getRaceProgress(legs, currentRunner, nextRunner) {
    const totalLegs = legs.length;
    const completedLegs = legs.filter(leg => leg.actualFinish).length;
    
    let currentLegId;
    if (legs[35]?.actualFinish) { // Race complete
      currentLegId = totalLegs;
    } else if (currentRunner) {
      currentLegId = currentRunner.id;
    } else if (nextRunner) {
      currentLegId = nextRunner.id;
    } else if (totalLegs > 0) {
      currentLegId = 1;
    } else {
      currentLegId = 0;
    }
    
    return {
      completed: completedLegs,
      total: totalLegs,
      current: currentLegId,
      percentage: totalLegs > 0 ? (completedLegs / totalLegs) * 100 : 0
    };
  }
  
  // Reset legs for progress test
  legs = Array.from({ length: 36 }, (_, i) => ({
    id: i + 1,
    runnerId: (i % 12) + 1,
    distance: 5.0,
    projectedStart: 0,
    projectedFinish: 0,
    actualStart: undefined,
    actualFinish: undefined
  }));
  
  const progress = getRaceProgress(legs, currentRunner, nextRunner);
  console.log('   Progress:', `Leg ${progress.current}/${progress.total}`);
  console.log('   Completed:', progress.completed);
  console.log('   Percentage:', progress.percentage.toFixed(1) + '%');
  
  if (progress.current > 0 && progress.total > 0) {
    console.log('   ✅ SUCCESS: Progress shows correct leg numbers');
  } else {
    console.log('   ❌ FAILURE: Progress shows 0/0');
  }
}

// Run the test
testRaceLogic();

console.log('\nExpected behavior:');
console.log('- Dashboard should show next runner content when legs are initialized but race hasn\'t started');
console.log('- Dashboard should show race completion content only when leg 36 is actually finished');
console.log('- Progress bar should show "Leg 1/36" instead of "Leg 0/0" when legs are initialized');
console.log('- The race completion logic should not trigger prematurely');
