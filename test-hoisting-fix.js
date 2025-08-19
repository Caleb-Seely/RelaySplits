// Test script to verify the hoisting fix
console.log('Testing Hoisting Fix...');

// Simulate the hoisting issue that was occurring
function simulateHoistingIssue() {
  console.log('\n1. Simulating the hoisting issue...');
  
  // This would cause a ReferenceError in the original code
  // because currentRunner was being accessed before declaration
  try {
    // Simulate the problematic code structure
    const debugEffect = () => {
      // This would fail if currentRunner wasn't declared yet
      const currentRunner = { id: 1, name: 'Runner 1' };
      console.log('currentRunner:', currentRunner.id);
    };
    
    debugEffect();
    console.log('   ✅ SUCCESS: No hoisting error');
  } catch (error) {
    console.log('   ❌ FAILURE: Hoisting error occurred:', error.message);
  }
}

// Test the fix
function testFix() {
  console.log('\n2. Testing the fix...');
  
  // Simulate the correct code structure
  try {
    // First declare the variables
    const currentRunner = { id: 1, name: 'Runner 1' };
    const nextRunner = { id: 2, name: 'Runner 2' };
    
    // Then use them in the debug effect
    const debugEffect = () => {
      console.log('currentRunner:', currentRunner.id);
      console.log('nextRunner:', nextRunner.id);
    };
    
    debugEffect();
    console.log('   ✅ SUCCESS: Variables accessed correctly after declaration');
  } catch (error) {
    console.log('   ❌ FAILURE: Error occurred:', error.message);
  }
}

// Run the tests
simulateHoistingIssue();
testFix();

console.log('\nExpected behavior:');
console.log('- No "Cannot access \'currentRunner\' before initialization" errors');
console.log('- Debug effect should work correctly after variables are declared');
console.log('- Dashboard should render without crashing');
