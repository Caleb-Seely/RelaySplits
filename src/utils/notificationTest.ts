// Test utility for notification deduplication system
import { notificationManager } from './notifications';

export const testNotificationDeduplication = () => {
  console.log('🧪 Testing notification deduplication system...');
  
  // Test 1: Basic notification
  const testNotification1 = {
    title: "Test Notification",
    body: "This is a test notification",
    data: { type: 'test', timestamp: Date.now() }
  };
  
  // Test 2: Race event notification
  const testNotification2 = {
    title: "Runner Started! 🏃‍♂️",
    body: "John is running Leg 1",
    data: { 
      type: 'runner_start', 
      legNumber: 1, 
      runnerName: 'John',
      timestamp: Date.now() 
    }
  };
  
  // Test 3: Duplicate of test 2 (should be deduplicated)
  const testNotification3 = {
    title: "Runner Started! 🏃‍♂️",
    body: "John is running Leg 1",
    data: { 
      type: 'runner_start', 
      legNumber: 1, 
      runnerName: 'John',
      timestamp: Date.now() 
    }
  };
  
  console.log('Sending test notification 1...');
  notificationManager.showNotification(testNotification1);
  
  setTimeout(() => {
    console.log('Sending test notification 2...');
    notificationManager.showNotification(testNotification2);
  }, 1000);
  
  setTimeout(() => {
    console.log('Sending test notification 3 (duplicate of 2)...');
    notificationManager.showNotification(testNotification3);
  }, 2000);
  
  setTimeout(() => {
    console.log('✅ Notification deduplication test complete!');
    console.log('Check if notification 3 was deduplicated (should not appear if working correctly)');
  }, 3000);
};

export const testNotificationHistory = () => {
  console.log('🧪 Testing notification history system...');
  
  const teamId = 'test-team-123';
  const historyKey = `relay_notifications_${teamId}`;
  
  // Simulate some notification history
  const testHistory = [
    {
      type: 'start' as const,
      legId: 1,
      runnerName: 'John',
      timestamp: Date.now() - 5000,
      sentAt: Date.now() - 4000
    },
    {
      type: 'handoff' as const,
      legId: 2,
      runnerName: 'Jane',
      nextRunnerName: 'Bob',
      timestamp: Date.now() - 3000,
      sentAt: Date.now() - 2000
    }
  ];
  
  // Save test history
  localStorage.setItem(historyKey, JSON.stringify(testHistory));
  console.log('✅ Test notification history saved');
  
  // Load and display history
  const loaded = localStorage.getItem(historyKey);
  if (loaded) {
    const history = JSON.parse(loaded);
    console.log('📋 Current notification history:', history);
  }
  
  // Clean up
  setTimeout(() => {
    localStorage.removeItem(historyKey);
    console.log('🧹 Test notification history cleaned up');
  }, 5000);
};

export const testNotificationPreference = () => {
  console.log('🧪 Testing notification preference persistence...');
  
  // Test 1: Check current state
  const initialValue = notificationManager.getNotificationPreferenceValue();
  const initialEnabled = notificationManager.isNotificationPreferenceEnabled();
  console.log('Initial state:', { value: initialValue, enabled: initialEnabled });
  
  // Test 2: Disable notifications
  console.log('Disabling notifications...');
  notificationManager.clearNotificationPreference();
  
  // Test 3: Check disabled state
  const disabledValue = notificationManager.getNotificationPreferenceValue();
  const disabledEnabled = notificationManager.isNotificationPreferenceEnabled();
  console.log('Disabled state:', { value: disabledValue, enabled: disabledEnabled });
  
  // Test 4: Enable notifications
  console.log('Enabling notifications...');
  notificationManager.setNotificationPreference(true);
  
  // Test 5: Check enabled state
  const enabledValue = notificationManager.getNotificationPreferenceValue();
  const enabledEnabled = notificationManager.isNotificationPreferenceEnabled();
  console.log('Enabled state:', { value: enabledValue, enabled: enabledEnabled });
  
  // Test 6: Reset to default
  console.log('Resetting to default...');
  notificationManager.resetNotificationPreference();
  
  // Test 7: Check reset state
  const resetValue = notificationManager.getNotificationPreferenceValue();
  const resetEnabled = notificationManager.isNotificationPreferenceEnabled();
  console.log('Reset state:', { value: resetValue, enabled: resetEnabled });
  
  console.log('✅ Notification preference test complete!');
  console.log('Check that the preference persists correctly across these operations');
};
