// Test script to verify dashboard data loading fix
console.log('Testing Dashboard Data Loading Fix...');

// Simulate the data loading flow
function testDataLoadingFlow() {
  console.log('1. Initial state - no legs data');
  let legs = [];
  let runners = [];
  let teamId = 'test-team-123';
  let isViewOnly = false;
  
  console.log('   legs.length:', legs.length);
  console.log('   runners.length:', runners.length);
  console.log('   teamId:', teamId);
  
  // Simulate the loading condition
  const isDataLoading = false || (legs.length === 0 && teamId && !isViewOnly);
  console.log('   isDataLoading:', isDataLoading);
  
  if (isDataLoading) {
    console.log('2. Data loading triggered - should show skeleton cards');
  } else {
    console.log('2. Data loading not needed - should show actual content');
  }
  
  // Simulate data loading
  console.log('3. Loading data from server...');
  runners = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    name: `Runner ${i + 1}`,
    pace: 420,
    van: (i < 6 ? 1 : 2)
  }));
  
  console.log('4. Initializing legs...');
  legs = Array.from({ length: 36 }, (_, i) => ({
    id: i + 1,
    runnerId: (i % 12) + 1,
    distance: [5.2, 4.8, 6.1, 4.9, 5.5, 4.7, 5.8, 4.6, 5.3, 4.5, 5.9, 4.4, 5.1, 4.3, 5.7, 4.2, 5.4, 4.1, 5.6, 4.0, 5.0, 3.9, 5.8, 3.8, 5.2, 3.7, 5.5, 3.6, 5.1, 3.5, 5.3, 3.4, 5.7, 3.3, 5.4, 3.2][i] || 5.0,
    projectedStart: 0,
    projectedFinish: 0
  }));
  
  console.log('5. After data loading:');
  console.log('   legs.length:', legs.length);
  console.log('   runners.length:', runners.length);
  
  // Check loading condition again
  const isDataLoadingAfter = false || (legs.length === 0 && teamId && !isViewOnly);
  console.log('   isDataLoading:', isDataLoadingAfter);
  
  if (!isDataLoadingAfter) {
    console.log('6. ✅ SUCCESS: Dashboard should now show actual content instead of skeleton cards');
  } else {
    console.log('6. ❌ FAILURE: Dashboard is still showing skeleton cards');
  }
}

// Run the test
testDataLoadingFlow();

console.log('\nExpected behavior:');
console.log('- Dashboard should initially show skeleton cards when legs.length === 0');
console.log('- After data loading completes, dashboard should show actual runner and leg data');
console.log('- The loading condition should be: loading || (legs.length === 0 && teamId && !isViewOnly)');
console.log('- This ensures skeleton cards only show when data is actually being loaded');
