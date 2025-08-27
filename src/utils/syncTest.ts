// Test utility for the new decoupled sync system
import { eventBus, EVENT_TYPES } from './eventBus';
import { syncOptimizer } from './syncOptimizer';

import { useRaceStore } from '@/store/raceStore';
import { invokeEdge, getDeviceId } from '@/integrations/supabase/edge';

export const testDecoupledSystem = () => {
  console.log('🧪 Testing Enhanced Sync System...');
  
  // Test 1: Event Bus
  console.log('📡 Testing Event Bus...');
  let eventReceived = false;
  
  const unsubscribe = eventBus.subscribe(EVENT_TYPES.LEG_UPDATE, (event) => {
    console.log('✅ Event received:', event);
    eventReceived = true;
  });
  
  // Publish a test event
  eventBus.publish({
    type: EVENT_TYPES.LEG_UPDATE,
    payload: {
      legId: 1,
      field: 'actualStart',
      value: Date.now(),
      previousValue: null,
      runnerId: 1,
      timestamp: Date.now()
    },
    priority: 'high',
    source: 'test'
  });
  
  // Clean up
  setTimeout(() => {
    unsubscribe();
    console.log('✅ Event Bus Test:', eventReceived ? 'PASSED' : 'FAILED');
  }, 100);
  
  // Test 2: Queue Status
  console.log('📊 Testing Queue Status...');
  const queueStatus = eventBus.getQueueStatus();
  console.log('✅ Queue Status:', queueStatus);
  
  // Test 3: Sync Optimizer
  console.log('⚡ Testing Sync Optimizer...');
  const batchStatus = syncOptimizer.getBatchStatus();
  console.log('✅ Batch Status:', batchStatus);
  
  // Test 4: Real-time Update Event
  console.log('🔄 Testing Real-time Update Event...');
  let realtimeEventReceived = false;
  
  const unsubscribeRealtime = eventBus.subscribe(EVENT_TYPES.REALTIME_UPDATE, (event) => {
    console.log('✅ Real-time event received:', event);
    realtimeEventReceived = true;
  });
  
  // Simulate a real-time update
  eventBus.publish({
    type: EVENT_TYPES.REALTIME_UPDATE,
    payload: {
      table: 'legs',
      action: 'upsert',
      count: 1,
      device_id: 'test-device',
      timestamp: new Date().toISOString()
    },
    priority: 'high',
    source: 'test'
  });
  
  setTimeout(() => {
    unsubscribeRealtime();
    console.log('✅ Real-time Update Test:', realtimeEventReceived ? 'PASSED' : 'FAILED');
  }, 100);
  
  // Test 5: Race Store Integration
  console.log('🏃 Testing Race Store Integration...');
  const store = useRaceStore.getState();
  console.log('✅ Current Store State:', {
    teamId: store.teamId,
    runnersCount: store.runners.length,
    legsCount: store.legs.length,
    lastSyncedAt: store.lastSyncedAt
  });
  
  // Test 6: Network Status
  console.log('🌐 Testing Network Status...');
  console.log('✅ Online Status:', navigator.onLine);
  console.log('✅ Device ID:', getDeviceId());
  
  // Test 7: Manual Sync Test
  console.log('🔄 Testing Manual Sync...');
  if (store.teamId) {
    console.log('✅ Team ID available, testing sync...');
    // This will be handled by the sync manager
  } else {
    console.log('⚠️ No team ID available for sync test');
  }
  
  console.log('🧪 Enhanced Sync System Test Complete!');
};

// Test real-time subscription
export const testRealtimeSubscription = async () => {
  console.log('🔄 Testing Real-time Subscription...');
  
  const store = useRaceStore.getState();
  if (!store.teamId) {
    console.log('⚠️ No team ID available for real-time test');
    return;
  }
  
  try {
    // Test sending a broadcast message
    const deviceId = getDeviceId();
    console.log('✅ Testing broadcast with device ID:', deviceId);
    
    // This would normally be sent by the server, but we can test the client-side handling
    eventBus.publish({
      type: EVENT_TYPES.REALTIME_UPDATE,
      payload: {
        table: 'legs',
        action: 'upsert',
        count: 1,
        device_id: 'other-device',
        timestamp: new Date().toISOString()
      },
      priority: 'high',
      source: 'test'
    });
    
    console.log('✅ Real-time subscription test completed');
  } catch (error) {
    console.error('❌ Real-time subscription test failed:', error);
  }
};

// Test sync performance
export const testSyncPerformance = () => {
  console.log('⚡ Testing Sync Performance...');
  
  const startTime = Date.now();
  
  // Simulate multiple rapid updates
  for (let i = 0; i < 5; i++) {
    eventBus.publish({
      type: EVENT_TYPES.LEG_UPDATE,
      payload: {
        legId: i + 1,
        field: 'actualStart',
        value: Date.now() + i * 1000,
        previousValue: null,
        runnerId: 1,
        timestamp: Date.now()
      },
      priority: 'high',
      source: 'performance-test'
    });
  }
  
  const endTime = Date.now();
  console.log(`✅ Performance test completed in ${endTime - startTime}ms`);
  
  // Check batch status
  setTimeout(() => {
    const batchStatus = syncOptimizer.getBatchStatus();
    console.log('✅ Batch status after performance test:', batchStatus);
  }, 2000);
};

// Test data fetching specifically
export const testDataFetching = async () => {
  console.log('📥 Testing Data Fetching...');
  
  const store = useRaceStore.getState();
  if (!store.teamId) {
    console.log('⚠️ No team ID available for data fetching test');
    return;
  }
  
  try {
    const deviceId = getDeviceId();
    console.log('✅ Testing data fetch with device ID:', deviceId);
    
    // Test fetching runners
    const runnersResult = await invokeEdge('runners-list', { 
      teamId: store.teamId, 
      deviceId 
    });
    
    if (!(runnersResult as any).error) {
      const runners = (runnersResult as any).data?.runners ?? [];
      console.log('✅ Runners fetched successfully:', runners.length);
    } else {
      console.error('❌ Failed to fetch runners:', (runnersResult as any).error);
    }
    
    // Test fetching legs
    const legsResult = await invokeEdge('legs-list', { 
      teamId: store.teamId, 
      deviceId 
    });
    
    if (!(legsResult as any).error) {
      const legs = (legsResult as any).data?.legs ?? [];
      console.log('✅ Legs fetched successfully:', legs.length);
      
      // Show some leg details
      legs.forEach((leg: any) => {
        if (leg.start_time || leg.finish_time) {
          console.log(`  Leg ${leg.number}: start=${leg.start_time}, finish=${leg.finish_time}`);
        }
      });
    } else {
      console.error('❌ Failed to fetch legs:', (legsResult as any).error);
    }
    
    console.log('✅ Data fetching test completed');
  } catch (error) {
    console.error('❌ Data fetching test failed:', error);
  }
};

// Test store updates
export const testStoreUpdates = () => {
  console.log('🔄 Testing Store Updates...');
  
  const store = useRaceStore.getState();
  console.log('✅ Current store state before update:');
  console.log('  - Runners:', store.runners.length);
  console.log('  - Legs:', store.legs.length);
  console.log('  - Last synced:', store.lastSyncedAt);
  
  // Test updating a leg
  if (store.legs.length > 0) {
    const testLeg = store.legs[0];
    console.log(`✅ Testing update for leg ${testLeg.id}`);
    
    // This should trigger the sync system
    store.updateLegActualTime(testLeg.id, 'actualStart', Date.now());
    
    setTimeout(() => {
      const updatedStore = useRaceStore.getState();
      console.log('✅ Store state after update:');
      console.log('  - Last synced:', updatedStore.lastSyncedAt);
      console.log('  - Test leg actualStart:', updatedStore.legs[0]?.actualStart);
    }, 1000);
  } else {
    console.log('⚠️ No legs available for store update test');
  }
};

// Export for use in development
if (typeof window !== 'undefined') {
  (window as any).testDecoupledSystem = testDecoupledSystem;
  (window as any).testRealtimeSubscription = testRealtimeSubscription;
  (window as any).testSyncPerformance = testSyncPerformance;
  (window as any).testDataFetching = testDataFetching;
  (window as any).testStoreUpdates = testStoreUpdates;
}
