import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';

interface PWADebugInfoProps {
  isVisible: boolean;
  onClose: () => void;
}

export const PWADebugInfo: React.FC<PWADebugInfoProps> = ({ isVisible, onClose }) => {
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    if (isVisible) {
      const info = {
        userAgent: navigator.userAgent,
        isStandalone: window.matchMedia('(display-mode: standalone)').matches,
        isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
        isAndroid: /Android/.test(navigator.userAgent),
        isChrome: /Chrome/.test(navigator.userAgent),
        isSafari: /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent),
        isFirefox: /Firefox/.test(navigator.userAgent),
        isEdge: /Edg/.test(navigator.userAgent),
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        hasServiceWorker: 'serviceWorker' in navigator,
        hasBeforeInstallPrompt: false,
        hasDeferredPrompt: false,
        manifestCheck: false,
        iconsCheck: false,
      };

      // Check if manifest is accessible
      fetch('/manifest.json')
        .then(response => {
          info.manifestCheck = response.ok;
          return response.json();
        })
        .then(manifest => {
          info.iconsCheck = manifest.icons && manifest.icons.length > 0;
          setDebugInfo(info);
        })
        .catch(() => {
          info.manifestCheck = false;
          setDebugInfo(info);
        });

      // Check for beforeinstallprompt event
      const checkBeforeInstallPrompt = () => {
        info.hasBeforeInstallPrompt = true;
        setDebugInfo({ ...info });
      };

      window.addEventListener('beforeinstallprompt', checkBeforeInstallPrompt);

      return () => {
        window.removeEventListener('beforeinstallprompt', checkBeforeInstallPrompt);
      };
    }
  }, [isVisible]);

  if (!isVisible) return null;

  const getStatusIcon = (condition: boolean) => {
    return condition ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getStatusBadge = (condition: boolean, trueText: string, falseText: string) => {
    return (
      <Badge variant={condition ? "default" : "destructive"} className="text-xs">
        {condition ? trueText : falseText}
      </Badge>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            PWA Installation Debug Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Browser & Platform</h3>
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span>Platform:</span>
                  {getStatusBadge(debugInfo.isAndroid, 'Android', 'Not Android')}
                </div>
                <div className="flex items-center justify-between">
                  <span>Browser:</span>
                  {getStatusBadge(debugInfo.isChrome, 'Chrome', 'Not Chrome')}
                </div>
                <div className="flex items-center justify-between">
                  <span>Protocol:</span>
                  {getStatusBadge(debugInfo.protocol === 'https:', 'HTTPS', 'Not HTTPS')}
                </div>
                <div className="flex items-center justify-between">
                  <span>Standalone:</span>
                  {getStatusBadge(debugInfo.isStandalone, 'Installed', 'Not Installed')}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-sm">PWA Requirements</h3>
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span>Service Worker:</span>
                  {getStatusIcon(debugInfo.hasServiceWorker)}
                </div>
                <div className="flex items-center justify-between">
                  <span>Manifest:</span>
                  {getStatusIcon(debugInfo.manifestCheck)}
                </div>
                <div className="flex items-center justify-between">
                  <span>Icons:</span>
                  {getStatusIcon(debugInfo.iconsCheck)}
                </div>
                <div className="flex items-center justify-between">
                  <span>Install Prompt:</span>
                  {getStatusIcon(debugInfo.hasBeforeInstallPrompt)}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-sm">User Agent</h3>
            <div className="bg-gray-100 p-2 rounded text-xs font-mono break-all">
              {debugInfo.userAgent}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Android Chrome Installation Guide</h3>
            <div className="bg-blue-50 p-3 rounded-lg text-sm space-y-2">
              <p className="font-medium">To install on Android Chrome:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Tap the menu button (⋮) in the top-right corner</li>
                <li>Look for "Add to Home Screen" or "Install App"</li>
                <li>Tap to install</li>
                <li>Alternatively, look for the install icon (📱) in the address bar</li>
              </ol>
              <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                <AlertCircle className="h-4 w-4 text-yellow-600 inline mr-1" />
                <span className="text-yellow-800 text-xs">
                  Note: The install prompt may not appear immediately. Try interacting with the app for a few minutes first.
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
