import React, { useState } from 'react';
import { Copy, Eye, EyeOff, CheckCircle2, Shield, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface AdminSecretDisplayProps {
  adminSecret: string;
  teamName: string;
  onClose?: () => void;
}

const AdminSecretDisplay: React.FC<AdminSecretDisplayProps> = ({ adminSecret, teamName, onClose }) => {
  const [showSecret, setShowSecret] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  // Component logging reduced for cleaner console

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(adminSecret);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard');
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  // Function to truncate the secret for display
  const getTruncatedSecret = (secret: string) => {
    if (secret.length <= 36) return secret;
    return `${secret.substring(0, 8)}...${secret.substring(secret.length - 8)}`;
  };

  return (
    <Dialog open={true} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm mx-auto border-0 shadow-2xl bg-white rounded-3xl p-0 overflow-hidden">
        {/* Background blur overlay for backdrop */}
        <div className="absolute inset-0 bg-white/95 backdrop-blur-xl" />
        
        {/* Content Container */}
        <div className="relative z-10">
          {/* Header Section with iOS-style spacing */}
          <div className="pt-8 pb-6 px-6 text-center">
            <p className="text-sm text-gray-600 leading-relaxed px-2">
              Save this secret to maintain admin access if your device is lost or storage is cleared.
            </p>
          </div>

          {/* Warning Card with Apple-style design */}
          <div className="mx-6 mb-6">
            <div className="bg-gradient-to-r from-amber-50/80 to-orange-50/80 backdrop-blur-sm border border-amber-200/50 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-relaxed flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600 flex-shrink-0" />
                    This secret will only be shown once!
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Secret Display Section */}
          <div className="px-6 mb-8">
            <div className="bg-gray-50/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-100">
              {/* Secret Text */}
              <div className="mb-4">
                <div className="bg-white/90 rounded-xl p-4 border border-gray-200/50 shadow-sm">
                  <div className="font-mono text-xs text-gray-900 leading-relaxed tracking-wide whitespace-nowrap overflow-hidden">
                    {showSecret ? getTruncatedSecret(adminSecret) : '•'.repeat(Math.min(adminSecret.length, 16))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  className="flex-1 flex items-center justify-center gap-2 h-11 bg-white/80 hover:bg-white/90 active:bg-gray-50 border border-gray-200/80 rounded-xl font-medium text-sm text-gray-700 transition-all duration-200 active:scale-[0.98]"
                >
                  {showSecret ? (
                    <>
                      <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                      <span>Hide</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" strokeWidth={1.5} />
                      <span>Show</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={copyToClipboard}
                  disabled={hasCopied}
                  className="flex-1 flex items-center justify-center gap-2 h-11 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-600 text-white font-medium text-sm rounded-xl transition-all duration-200 active:scale-[0.98] shadow-sm"
                >
                  {hasCopied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" strokeWidth={1.5} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-8">
            <button 
              onClick={handleClose}
              className="w-full h-12 bg-gray-900 hover:bg-gray-800 active:bg-black text-white font-medium rounded-2xl transition-all duration-200 active:scale-[0.98] shadow-lg"
            >
              I've Saved My Secret
            </button>
          </div>
        </div>

        {/* Close indicator */}
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-10 h-1 bg-gray-300 rounded-full" />
      </DialogContent>
    </Dialog>
  );
};

export default AdminSecretDisplay;