import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Shield, Copy, Eye, EyeOff, AlertTriangle } from 'lucide-react';

interface AdminSecretDisplayProps {
  adminSecret: string;
  teamName: string;
  onClose?: () => void;
}

const AdminSecretDisplay: React.FC<AdminSecretDisplayProps> = ({ adminSecret, teamName, onClose }) => {
  const [showSecret, setShowSecret] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(adminSecret);
      setHasCopied(true);
      toast.success('Admin secret copied to clipboard!');
      setTimeout(() => setHasCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose?.()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            Admin Secret Generated
          </DialogTitle>
          <DialogDescription>
            Your team "{teamName}" has been created successfully! 
            Please save your admin secret - you'll need it to recover admin access if you lose your device.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <strong>Important:</strong> Save this admin secret in a secure location. 
              You won't be able to see it again after closing this dialog.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm font-medium">Admin Secret</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 p-3 bg-gray-100 rounded-md font-mono text-sm">
                {showSecret ? adminSecret : '••••••••••••••••••••••••••••••••'}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                disabled={hasCopied}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {hasCopied ? 'Copied!' : 'Click the copy button to copy to clipboard'}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <h4 className="font-medium text-blue-900 mb-2">What is this for?</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Recover admin access if you lose your device</li>
              <li>• Regain control of your team settings</li>
              <li>• Manage team members and permissions</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onClose?.()}>
            I've Saved My Admin Secret
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminSecretDisplay;
