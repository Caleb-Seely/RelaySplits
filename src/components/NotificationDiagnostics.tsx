import React from 'react';
import NotificationDebugger from './NotificationDebugger';

const NotificationDiagnostics: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Notification Diagnostics</h1>
      <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
        <strong>Note:</strong> This diagnostic tool will help identify why notifications aren't working. 
        Run the comprehensive test to see detailed information about your browser and notification setup.
      </div>
      
      <NotificationDebugger />
    </div>
  );
};

export default NotificationDiagnostics;
