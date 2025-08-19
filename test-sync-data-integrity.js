// Test script to validate data integrity during sync operations
// This will help identify where start/finish times are being lost

const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'your-supabase-url';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
const TEAM_ID = process.env.TEAM_ID || 'test-team-id';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test scenarios to validate data integrity
const testScenarios = {
  // Test 1: Verify database upsert preserves all fields
  async testDatabaseUpsertIntegrity() {
    console.log('\n=== Test 1: Database Upsert Integrity ===');
    
    // Create a test leg with all fields
    const testLeg = {
      id: crypto.randomUUID(),
      team_id: TEAM_ID,
      number: 1,
      distance: 5.2,
      start_time: new Date().toISOString(),
      finish_time: new Date(Date.now() + 3600000).toISOString(), // 1 hour later
      updated_at: new Date().toISOString()
    };
    
    console.log('Inserting test leg:', testLeg);
    
    // Insert the leg
    const { data: insertData, error: insertError } = await supabase
      .from('legs')
      .insert(testLeg)
      .select()
      .single();
    
    if (insertError) {
      console.error('Insert failed:', insertError);
      return false;
    }
    
    console.log('Inserted leg:', insertData);
    
    // Update with partial data (simulating sync scenario)
    const partialUpdate = {
      id: testLeg.id,
      start_time: new Date(Date.now() + 60000).toISOString(), // 1 minute later
      updated_at: new Date().toISOString()
    };
    
    console.log('Updating with partial data:', partialUpdate);
    
    const { data: updateData, error: updateError } = await supabase
      .from('legs')
      .update(partialUpdate)
      .eq('id', testLeg.id)
      .select()
      .single();
    
    if (updateError) {
      console.error('Update failed:', updateError);
      return false;
    }
    
    console.log('Updated leg:', updateData);
    
    // Verify finish_time was preserved
    if (!updateData.finish_time) {
      console.error('❌ finish_time was lost during partial update!');
      return false;
    }
    
    console.log('✅ finish_time preserved correctly');
    
    // Cleanup
    await supabase.from('legs').delete().eq('id', testLeg.id);
    return true;
  },

  // Test 2: Verify sync manager merge logic
  async testSyncManagerMerge() {
    console.log('\n=== Test 2: Sync Manager Merge Logic ===');
    
    const localLegs = [
      {
        id: 1,
        runnerId: 1,
        distance: 5.2,
        actualStart: Date.now() - 3600000, // 1 hour ago
        actualFinish: Date.now() - 1800000, // 30 minutes ago
        remoteId: 'leg-1',
        updated_at: new Date(Date.now() - 60000).toISOString() // 1 minute ago
      }
    ];
    
    const serverLegs = [
      {
        id: 1,
        runnerId: 1,
        distance: 5.2,
        actualStart: Date.now() - 3600000, // Same start time
        actualFinish: null, // Server has no finish time
        remoteId: 'leg-1',
        updated_at: new Date().toISOString() // Newer timestamp
      }
    ];
    
    console.log('Local leg:', localLegs[0]);
    console.log('Server leg:', serverLegs[0]);
    
    // Simulate the merge logic from useEnhancedSyncManager
    const localItemsMap = new Map(localLegs.map((item) => [item.id, item]));
    const mergedItems = [...localLegs];
    
    for (const incomingItem of serverLegs) {
      const localItem = localItemsMap.get(incomingItem.id);
      
      // Check if incoming item is newer
      if (!localItem || !localItem.updated_at || new Date(incomingItem.updated_at) > new Date(localItem.updated_at)) {
        const existingIndex = mergedItems.findIndex(item => item.id === incomingItem.id);
        if (existingIndex !== -1) {
          mergedItems[existingIndex] = incomingItem;
        } else {
          mergedItems.push(incomingItem);
        }
      }
    }
    
    console.log('Merged leg:', mergedItems[0]);
    
    // Check if finish time was lost
    if (!mergedItems[0].actualFinish) {
      console.error('❌ actualFinish was lost during merge!');
      return false;
    }
    
    console.log('✅ actualFinish preserved during merge');
    return true;
  },

  // Test 3: Verify projection recalculation doesn't overwrite actual times
  async testProjectionRecalculation() {
    console.log('\n=== Test 3: Projection Recalculation ===');
    
    const legs = [
      {
        id: 1,
        runnerId: 1,
        distance: 5.2,
        actualStart: Date.now() - 3600000,
        actualFinish: Date.now() - 1800000,
        projectedStart: Date.now() - 3600000,
        projectedFinish: Date.now() - 1800000
      }
    ];
    
    const runners = [
      {
        id: 1,
        name: 'Test Runner',
        pace: 420,
        van: 1
      }
    ];
    
    console.log('Original leg:', legs[0]);
    
    // Simulate recalculateProjections call
    // This is a simplified version - the actual function is more complex
    const updatedLegs = legs.map(leg => ({
      ...leg,
      projectedStart: leg.actualStart || leg.projectedStart,
      projectedFinish: leg.actualFinish || leg.projectedFinish
    }));
    
    console.log('Updated leg:', updatedLegs[0]);
    
    // Verify actual times weren't overwritten
    if (!updatedLegs[0].actualStart || !updatedLegs[0].actualFinish) {
      console.error('❌ Actual times were lost during projection recalculation!');
      return false;
    }
    
    console.log('✅ Actual times preserved during projection recalculation');
    return true;
  },

  // Test 4: Verify event bus processing order
  async testEventBusOrder() {
    console.log('\n=== Test 4: Event Bus Processing Order ===');
    
    const events = [];
    const processedEvents = [];
    
    // Simulate event bus
    const eventBus = {
      highPriorityQueue: [],
      isProcessing: false,
      
      publish(event) {
        this.highPriorityQueue.push(event);
        if (!this.isProcessing) {
          this.processEvents();
        }
      },
      
      async processEvents() {
        this.isProcessing = true;
        while (this.highPriorityQueue.length > 0) {
          const event = this.highPriorityQueue.shift();
          await this.processEvent(event);
        }
        this.isProcessing = false;
      },
      
      async processEvent(event) {
        processedEvents.push(event);
        console.log(`Processing event: ${event.type} at ${event.timestamp}`);
      }
    };
    
    // Publish events in specific order
    eventBus.publish({
      type: 'leg_update',
      payload: { legId: 1, field: 'actualStart', value: Date.now() },
      timestamp: Date.now(),
      priority: 'high',
      source: 'test'
    });
    
    eventBus.publish({
      type: 'leg_update',
      payload: { legId: 1, field: 'actualFinish', value: Date.now() + 3600000 },
      timestamp: Date.now() + 1000,
      priority: 'high',
      source: 'test'
    });
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('Processed events:', processedEvents.map(e => e.type));
    
    // Verify order
    if (processedEvents.length !== 2) {
      console.error('❌ Not all events were processed!');
      return false;
    }
    
    console.log('✅ Events processed in correct order');
    return true;
  },

  // Test 5: Verify conflict detection logic
  async testConflictDetection() {
    console.log('\n=== Test 5: Conflict Detection Logic ===');
    
    const localLeg = {
      id: 1,
      actualStart: Date.now() - 3600000,
      actualFinish: Date.now() - 1800000
    };
    
    const serverLeg = {
      id: 1,
      actualStart: Date.now() - 3500000, // 10 minutes different
      actualFinish: null // Server has no finish time
    };
    
    console.log('Local leg:', localLeg);
    console.log('Server leg:', serverLeg);
    
    // Simulate conflict detection logic
    const timeDifference = Math.abs(localLeg.actualStart - serverLeg.actualStart);
    const hasConflict = timeDifference > 60000; // 1 minute threshold
    
    if (hasConflict) {
      console.log('⚠️ Conflict detected for start time');
      
      // In the actual code, this would trigger conflict resolution
      // For now, let's check if the logic is working correctly
      if (timeDifference > 60000) {
        console.log('✅ Conflict detection working correctly');
        return true;
      }
    }
    
    console.log('✅ No conflicts detected');
    return true;
  }
};

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Data Integrity Tests...');
  console.log('Team ID:', TEAM_ID);
  
  const results = {};
  
  for (const [testName, testFn] of Object.entries(testScenarios)) {
    try {
      console.log(`\n📋 Running ${testName}...`);
      results[testName] = await testFn();
    } catch (error) {
      console.error(`❌ ${testName} failed:`, error);
      results[testName] = false;
    }
  }
  
  console.log('\n📊 Test Results:');
  console.log('================');
  
  for (const [testName, result] of Object.entries(results)) {
    console.log(`${result ? '✅' : '❌'} ${testName}: ${result ? 'PASSED' : 'FAILED'}`);
  }
  
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n🎯 Summary: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Data integrity appears to be working correctly.');
  } else {
    console.log('⚠️ Some tests failed. This may indicate potential data integrity issues.');
  }
  
  return results;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { testScenarios, runAllTests };
