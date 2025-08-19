import React from 'react';

const NotificationDiagnostics: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Mobile Notification Diagnostics</h1>
      <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
        <strong>Note:</strong> This diagnostic tool is for testing notification functionality. 
        Make sure you have notification permissions enabled in your browser.
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Quick Access</h3>
          <p className="text-sm text-gray-600 mb-3">
            Open the full diagnostic tool in a new tab for comprehensive testing.
          </p>
          <a 
            href="/test-mobile-notifications.html" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
          >
            Open Diagnostic Tool
          </a>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Current Status</h3>
          <div className="space-y-2 text-sm">
            <div>
              <strong>Notifications Supported:</strong> 
              <span className={`ml-2 ${'Notification' in window ? 'text-green-600' : 'text-red-600'}`}>
                {'Notification' in window ? 'Yes' : 'No'}
              </span>
            </div>
            <div>
              <strong>Service Worker Supported:</strong> 
              <span className={`ml-2 ${'serviceWorker' in navigator ? 'text-green-600' : 'text-red-600'}`}>
                {'serviceWorker' in navigator ? 'Yes' : 'No'}
              </span>
            </div>
            <div>
              <strong>Permission:</strong> 
              <span className={`ml-2 ${
                Notification.permission === 'granted' ? 'text-green-600' : 
                Notification.permission === 'denied' ? 'text-red-600' : 'text-yellow-600'
              }`}>
                {Notification.permission}
              </span>
            </div>
            <div>
              <strong>Page Visible:</strong> 
              <span className={`ml-2 ${!document.hidden ? 'text-green-600' : 'text-yellow-600'}`}>
                {!document.hidden ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-6 bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-2">Testing Instructions</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
          <li>Click "Open Diagnostic Tool" to open the full testing interface</li>
          <li>Grant notification permissions when prompted</li>
          <li>Run the basic tests first (Permission, Service Worker, Basic Notification)</li>
          <li>Test mobile-specific scenarios (Page Visibility, Background, Deduplication)</li>
          <li>Check the test log for detailed results and any errors</li>
        </ol>
      </div>
    </div>
  );
};

export default NotificationDiagnostics;
