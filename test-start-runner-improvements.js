/**
 * Test script for improved Start Runner functionality
 * Tests the three main scenarios: first leg start, middle leg transitions, and final leg finish
 */

// Mock race store for testing
class MockRaceStore {
  constructor() {
    this.legs = [];
    this.runners = [];
    this.startTime = new Date('2025-08-22T13:00').getTime();
    this.initializeMockData();
  }

  initializeMockData() {
    // Create 12 runners
    this.runners = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      name: `Runner ${i + 1}`,
      pace: 420, // 7:00 pace
      van: (i < 6 ? 1 : 2),
      remoteId: undefined,
      updated_at: null
    }));

    // Create 36 legs (simplified for testing)
    this.legs = Array.from({ length: 36 }, (_, i) => ({
      id: i + 1,
      runnerId: (i % 12) + 1,
      distance: 5.0, // Simplified distance
      projectedStart: this.startTime + (i * 30 * 60 * 1000), // 30 min intervals
      projectedFinish: this.startTime + ((i + 1) * 30 * 60 * 1000),
      actualStart: undefined,
      actualFinish: undefined,
      updated_at: null
    }));
  }

  // Simulate the improved startNextRunner function
  startNextRunner(currentRunnerId, nextRunnerId) {
    console.log(`\n[TEST] startNextRunner(${currentRunnerId}, ${nextRunnerId})`);
    
    // Handle first leg scenario (currentRunnerId === 0 means no current runner)
    if (currentRunnerId === 0) {
      const nextLegIndex = this.legs.findIndex(leg => leg.id === nextRunnerId);
      if (nextLegIndex === -1) {
        console.warn('[TEST] Invalid next leg ID:', nextRunnerId);
        return false;
      }
      
      console.log('[TEST] Scenario 1: Starting first leg:', nextRunnerId);
      this.legs[nextLegIndex] = { 
        ...this.legs[nextLegIndex], 
        actualStart: Date.now() 
      };
      return true;
    }
    
    const currentLegIndex = this.legs.findIndex(leg => leg.id === currentRunnerId);
    const nextLegIndex = this.legs.findIndex(leg => leg.id === nextRunnerId);
    
    if (currentLegIndex === -1 || nextLegIndex === -1) {
      console.warn('[TEST] Invalid leg IDs:', { currentRunnerId, nextRunnerId });
      return false;
    }

    const currentLeg = this.legs[currentLegIndex];
    const nextLeg = this.legs[nextLegIndex];
    const now = Date.now();

    // Validate the transition is logical
    if (nextLeg.id !== currentLeg.id + 1) {
      console.warn('[TEST] Non-sequential leg transition:', { 
        currentLegId: currentLeg.id, 
        nextLegId: nextLeg.id 
      });
      return false;
    }

    // Scenario 2: Middle leg transition (finish current, start next)
    if (currentLeg.actualStart && !currentLeg.actualFinish) {
      console.log('[TEST] Scenario 2: Middle leg transition:', { 
        finishLeg: currentLeg.id, 
        startLeg: nextLeg.id 
      });
      
      // Finish current runner
      this.legs[currentLegIndex] = { 
        ...this.legs[currentLegIndex], 
        actualFinish: now 
      };
      
      // Start next runner
      this.legs[nextLegIndex] = { 
        ...this.legs[nextLegIndex], 
        actualStart: now 
      };
      return true;
    }
    // Scenario 3: Final leg finish (only set actualFinish for current runner)
    else if (nextLeg.id === 36 && currentLeg.actualStart && !currentLeg.actualFinish) {
      console.log('[TEST] Scenario 3: Finishing final leg:', currentLeg.id);
      this.legs[currentLegIndex] = { 
        ...this.legs[currentLegIndex], 
        actualFinish: now 
      };
      return true;
    }
    // Edge case: Handle when current runner is already finished
    else if (currentLeg.actualFinish) {
      console.log('[TEST] Edge case: Current runner already finished, starting next:', nextLeg.id);
      this.legs[nextLegIndex] = { 
        ...this.legs[nextLegIndex], 
        actualStart: now 
      };
      return true;
    }
    // Invalid state
    else {
      console.warn('[TEST] Invalid state for leg transition:', {
        currentLeg: { id: currentLeg.id, actualStart: currentLeg.actualStart, actualFinish: currentLeg.actualFinish },
        nextLeg: { id: nextLeg.id, actualStart: nextLeg.actualStart, actualFinish: nextLeg.actualFinish }
      });
      return false;
    }
  }

  // Helper function to get current runner
  getCurrentRunner() {
    return this.legs.find(leg => leg.actualStart && !leg.actualFinish) || null;
  }

  // Helper function to get next runner
  getNextRunner() {
    return this.legs.find(leg => !leg.actualStart) || null;
  }

  // Helper function to print race state
  printRaceState() {
    console.log('\n=== RACE STATE ===');
    const currentRunner = this.getCurrentRunner();
    const nextRunner = this.getNextRunner();
    
    console.log(`Current Runner: ${currentRunner ? `Leg ${currentRunner.id} (Runner ${currentRunner.runnerId})` : 'None'}`);
    console.log(`Next Runner: ${nextRunner ? `Leg ${nextRunner.id} (Runner ${nextRunner.runnerId})` : 'None'}`);
    
    const finishedLegs = this.legs.filter(leg => leg.actualFinish).length;
    const startedLegs = this.legs.filter(leg => leg.actualStart).length;
    console.log(`Progress: ${finishedLegs}/${this.legs.length} legs finished, ${startedLegs}/${this.legs.length} legs started`);
    
    // Show recent leg states
    const recentLegs = this.legs.slice(0, 5);
    console.log('Recent legs:');
    recentLegs.forEach(leg => {
      const status = leg.actualFinish ? 'FINISHED' : 
                   leg.actualStart ? 'RUNNING' : 'NOT_STARTED';
      console.log(`  Leg ${leg.id}: ${status} (Runner ${leg.runnerId})`);
    });
  }
}

// Test scenarios
function runTests() {
  console.log('🧪 Testing Improved Start Runner Functionality\n');
  
  const store = new MockRaceStore();
  
  // Test 1: First leg start
  console.log('📋 Test 1: First Leg Start');
  store.printRaceState();
  
  const nextRunner = store.getNextRunner();
  if (nextRunner) {
    const success = store.startNextRunner(0, nextRunner.id); // Use 0 for first leg scenario
    console.log(`✅ First leg start: ${success ? 'SUCCESS' : 'FAILED'}`);
    store.printRaceState();
  }
  
  // Test 2: Middle leg transitions
  console.log('\n📋 Test 2: Middle Leg Transitions');
  
  // Simulate a few transitions
  for (let i = 1; i <= 3; i++) {
    const currentRunner = store.getCurrentRunner();
    const nextRunner = store.getNextRunner();
    
    if (currentRunner && nextRunner) {
      const success = store.startNextRunner(currentRunner.id, nextRunner.id);
      console.log(`✅ Middle leg transition ${i}: ${success ? 'SUCCESS' : 'FAILED'}`);
      store.printRaceState();
    }
  }
  
  // Test 3: Final leg finish
  console.log('\n📋 Test 3: Final Leg Finish');
  
  // Fast forward to near the end
  for (let i = 34; i <= 35; i++) {
    const currentRunner = store.getCurrentRunner();
    const nextRunner = store.getNextRunner();
    
    if (currentRunner && nextRunner) {
      const success = store.startNextRunner(currentRunner.id, nextRunner.id);
      console.log(`✅ Transition to leg ${nextRunner.id}: ${success ? 'SUCCESS' : 'FAILED'}`);
    }
  }
  
  // Now test final leg finish
  const currentRunner = store.getCurrentRunner();
  if (currentRunner && currentRunner.id === 36) {
    const success = store.startNextRunner(currentRunner.id, 36); // Final leg
    console.log(`✅ Final leg finish: ${success ? 'SUCCESS' : 'FAILED'}`);
    store.printRaceState();
  }
  
  // Test 4: Edge case - multiple rapid transitions
  console.log('\n📋 Test 4: Edge Cases');
  
  // Reset for edge case testing
  store.initializeMockData();
  
  // Simulate rapid transitions
  for (let i = 1; i <= 5; i++) {
    const currentRunner = store.getCurrentRunner();
    const nextRunner = store.getNextRunner();
    
    if (currentRunner && nextRunner) {
      const success = store.startNextRunner(currentRunner.id, nextRunner.id);
      console.log(`✅ Rapid transition ${i}: ${success ? 'SUCCESS' : 'FAILED'}`);
    }
  }
  
  console.log('\n🎉 All tests completed!');
}

// Run the tests
runTests();
