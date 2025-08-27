import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, AlertTriangle, CheckCircle, XCircle, Info, Lightbulb } from 'lucide-react';
import { notificationManager } from '@/utils/notifications';
import { useDecoupledNotifications } from '@/hooks/useDecoupledNotifications';
import { notificationTester, NotificationTestResult } from '@/utils/notificationTest';

const NotificationDebugger: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [testResults, setTestResults] = useState<string[]>([]);
  const [comprehensiveResults, setComprehensiveResults] = useState<NotificationTestResult[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const { isSupported, getPermission, requestPermission, isNotificationPreferenceEnabled } = useDecoupledNotifications();

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const runComprehensiveTest = async () => {
    setIsRunningTests(true);
    setTestResults([]);
    setComprehensiveResults([]);
    setRecommendations([]);
    
    addTestResult('Starting comprehensive notification test...');

    try {
      // Run the comprehensive test suite
      const results = await notificationTester.runAllTests();
      setComprehensiveResults(results);
      
      // Add results to test log
      results.forEach(result => {
        addTestResult(`${result.test}: ${result.passed ? 'PASSED' : 'FAILED'} - ${result.details}`);
        if (result.error) {
          addTestResult(`  Error: ${result.error}`);
        }
      });
      
      // Get recommendations
      const recs = notificationTester.getRecommendations();
      setRecommendations(recs);
      
      // Add summary
      const summary = notificationTester.getSummary();
      addTestResult(`Test Summary: ${summary.passed}/${summary.total} tests passed`);
      
    } catch (error) {
      addTestResult(`Test suite failed: ${error}`);
    } finally {
      setIsRunningTests(false);
    }
  };

  const testBackgroundNotification = async () => {
    addTestResult('Testing background notification...');
    try {
      await notificationManager.showBackgroundTestNotification();
      addTestResult('Background test notification sent');
    } catch (error) {
      addTestResult(`Background test failed: ${error}`);
    }
  };

  const resetNotificationPreference = () => {
    notificationManager.resetNotificationPreference();
    addTestResult('Notification preference reset to default (enabled)');
  };

  const clearNotificationPreference = () => {
    notificationManager.clearNotificationPreference();
    addTestResult('Notification preference cleared (disabled)');
  };

  const getStatusIcon = (status: boolean) => {
    return status ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getStatusBadge = (status: boolean) => {
    return status ? 
      <Badge variant="default" className="bg-green-500">Working</Badge> : 
      <Badge variant="destructive">Not Working</Badge>;
  };

  useEffect(() => {
    // Update debug info when component mounts
    const updateDebugInfo = () => {
      setDebugInfo({
        isSupported: isSupported,
        permission: getPermission(),
        preferenceEnabled: isNotificationPreferenceEnabled(),
        preferenceValue: notificationManager.getNotificationPreferenceValue(),
        queueStatus: notificationManager.getQueueStatus(),
        userAgent: navigator.userAgent,
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        pageVisible: !document.hidden,
        serviceWorkerSupported: 'serviceWorker' in navigator,
        notificationSupported: 'Notification' in window
      });
    };

    updateDebugInfo();
    const interval = setInterval(updateDebugInfo, 2000);
    return () => clearInterval(interval);
  }, [isSupported, getPermission, isNotificationPreferenceEnabled]);

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Debugger
          </CardTitle>
          <CardDescription>
            Comprehensive debugging tool for notification issues
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Overview */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 border rounded">
              <span>API Support</span>
              <div className="flex items-center gap-2">
                {getStatusIcon(debugInfo.notificationSupported)}
                {getStatusBadge(debugInfo.notificationSupported)}
              </div>
            </div>
            <div className="flex items-center justify-between p-3 border rounded">
              <span>Service Worker</span>
              <div className="flex items-center gap-2">
                {getStatusIcon(debugInfo.serviceWorkerSupported)}
                {getStatusBadge(debugInfo.serviceWorkerSupported)}
              </div>
            </div>
            <div className="flex items-center justify-between p-3 border rounded">
              <span>Permission</span>
              <Badge variant={debugInfo.permission === 'granted' ? 'default' : 'secondary'}>
                {debugInfo.permission}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded">
              <span>Preference</span>
              <Badge variant={debugInfo.preferenceEnabled ? 'default' : 'secondary'}>
                {debugInfo.preferenceEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={runComprehensiveTest} variant="default" disabled={isRunningTests}>
              <Info className="h-4 w-4 mr-2" />
              {isRunningTests ? 'Running Tests...' : 'Run Full Test'}
            </Button>
            <Button onClick={testBackgroundNotification} variant="outline">
              <Bell className="h-4 w-4 mr-2" />
              Test Background
            </Button>
            <Button onClick={resetNotificationPreference} variant="outline">
              Reset Preference
            </Button>
            <Button onClick={clearNotificationPreference} variant="outline">
              Clear Preference
            </Button>
          </div>

          {/* Comprehensive Test Results */}
          {comprehensiveResults.length > 0 && (
            <div className="border rounded p-3 bg-gray-50">
              <h4 className="font-semibold mb-2">Test Results:</h4>
              <div className="space-y-2">
                {comprehensiveResults.map((result, index) => (
                  <div key={index} className={`p-2 rounded ${result.passed ? 'bg-green-100' : 'bg-red-100'}`}>
                    <div className="flex items-center gap-2">
                      {result.passed ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                      <span className="font-medium">{result.test}</span>
                    </div>
                    <div className="text-sm text-gray-700 ml-6">{result.details}</div>
                    {result.error && (
                      <div className="text-sm text-red-600 ml-6">{result.error}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="border rounded p-3 bg-blue-50">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-blue-600" />
                Recommendations
              </h4>
              <ul className="space-y-1">
                {recommendations.map((rec, index) => (
                  <li key={index} className="text-sm text-blue-800">• {rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Test Results */}
          {testResults.length > 0 && (
            <div className="border rounded p-3 bg-gray-50">
              <h4 className="font-semibold mb-2">Test Results:</h4>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {testResults.map((result, index) => (
                  <div key={index} className="text-sm font-mono">
                    {result}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Debug Info */}
          <details className="border rounded p-3">
            <summary className="cursor-pointer font-semibold">Debug Information</summary>
            <pre className="text-xs mt-2 overflow-auto">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </details>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationDebugger;
