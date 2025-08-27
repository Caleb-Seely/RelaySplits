import React, { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { serviceWorkerManager } from '@/utils/serviceWorker';

const UpdateNotification: React.FC = () => {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    const handleUpdateAvailable = () => {
      console.log('[UpdateNotification] Update available');
      setShowUpdate(true);
    };

    // Listen for service worker update events
    window.addEventListener('sw-update-available', handleUpdateAvailable);

    // Check if update is already available
    if (serviceWorkerManager.isUpdateAvailable()) {
      setShowUpdate(true);
    }

    return () => {
      window.removeEventListener('sw-update-available', handleUpdateAvailable);
    };
  }, []);

  const handleUpdate = async () => {
    try {
      await serviceWorkerManager.update();
      // The service worker will automatically reload the page when the update is applied
    } catch (error) {
      console.error('[UpdateNotification] Failed to update:', error);
      // Fallback: force reload
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  if (!showUpdate) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-background border border-border rounded-lg shadow-lg p-4 max-w-sm">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h4 className="font-semibold text-sm">App Update Available</h4>
          <p className="text-sm text-muted-foreground mt-1">
            A new version of the app is ready. Refresh to get the latest features.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="h-6 w-6 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex gap-2 mt-3">
        <Button
          size="sm"
          onClick={handleUpdate}
          className="flex-1"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Update Now
        </Button>
      </div>
    </div>
  );
};

export default UpdateNotification;

