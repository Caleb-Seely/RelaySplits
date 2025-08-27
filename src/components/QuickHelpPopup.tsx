import React, { useEffect, useState } from 'react';
import { 
  MapPin, 
  Play, 
  Cloud, 
  CloudOff,
  CheckCircle,
  Users,
  Eye,
  Smartphone
} from 'lucide-react';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFeatureUsageTracking } from '@/hooks/useAnalytics';

interface QuickHelpPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const QuickHelpPopup: React.FC<QuickHelpPopupProps> = ({ isOpen, onClose }) => {
  const [animateItems, setAnimateItems] = useState(false);
  const { trackQuickHelpUsed } = useFeatureUsageTracking();

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setAnimateItems(true), 200);
      return () => clearTimeout(timer);
    } else {
      setAnimateItems(false);
    }
  }, [isOpen]);

  const handleGotIt = () => {
    console.log('[QuickHelpPopup] Got it clicked');
    trackQuickHelpUsed();
    onClose();
  };

  const tips = [
    {
      id: 'directions',
      icon: <MapPin className="h-3 w-3 text-white" />,
      badge: { text: 'Leg 5', variant: 'blue' },
      description: 'Tap for instant Google Maps directions',
      delay: 0
    },
    {
      id: 'runner',
      icon: <Play className="h-5 w-5 text-white" />,
      badge: { text: 'Start Runner', variant: 'green', hasIcon: true },
      description: 'Auto-completes previous leg & updates projections',
      delay: 100
    },
    {
      id: 'codes',
      icon: (
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-md border border-blue-200">
            <Users className="h-3 w-3 text-blue-600 flex-shrink-0" />
            <span className="text-xs font-mono font-semibold text-blue-800">ABC123</span>
          </div>
          <div className="text-xs text-gray-600 text-center mt-1">Team token to participate</div>
          <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 rounded-md border border-gray-200">
            <Eye className="h-3 w-3 text-gray-600 flex-shrink-0" />
            <span className="text-xs font-mono font-semibold text-gray-700">XYZ789</span>
          </div>
          <div className="text-xs text-gray-600 text-center mt-1">Viewer code to spectate</div>
        </div>
      ),
      description: '',
      delay: 200
    },
    {
      id: 'sync',
      icon: (
        <div className="flex items-center gap-2">
          <div className="relative">
            <Cloud className="h-4 w-4 text-emerald-600" />
            <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-px bg-gradient-to-r from-emerald-500 to-gray-300"></div>
            <div className="w-1 h-1 bg-gray-300 rounded-full mx-1"></div>
            <div className="w-4 h-px bg-gradient-to-r from-gray-300 to-gray-400"></div>
          </div>
          <CloudOff className="h-4 w-4 text-gray-400" />
        </div>
      ),
      description: 'Works offline and syncs automatically',
      delay: 300
    },
    {
      id: 'devices',
      icon: (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 rounded-md border border-purple-200">
            <Smartphone className="h-3 w-3 text-purple-600 flex-shrink-0" />
            <span className="text-xs font-semibold text-purple-800">Phone</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-px bg-gradient-to-r from-purple-500 to-gray-300"></div>
            <div className="w-1 h-1 bg-gray-300 rounded-full mx-1"></div>
            <div className="w-3 h-px bg-gradient-to-r from-gray-300 to-purple-500"></div>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 rounded-md border border-purple-200">
            <Smartphone className="h-3 w-3 text-purple-600 flex-shrink-0" />
            <span className="text-xs font-semibold text-purple-800">Tablet</span>
          </div>
        </div>
      ),
      description: 'No account needed - data stays on your device. Use a new device? Just rejoin with your team token.',
      delay: 400
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md border-0 shadow-2xl bg-white/95 backdrop-blur-xl p-0 overflow-hidden rounded-xl max-h-[90vh] sm:max-h-[80vh] flex flex-col">
        {/* Header with gradient */}
        <div className="relative px-4 sm:px-6 pt-6 sm:pt-8 flex-shrink-0">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-t-xl"></div>
          <div className="relative text-center">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900">Quick Start</h3>
          </div>
        </div>

        {/* Tips section - scrollable */}
        <div className="px-4 sm:px-6 pb-4 flex-1 overflow-y-auto">
          <div className="space-y-3 sm:space-y-4">
            {tips.map((tip, index) => (
              <div 
                key={tip.id}
                className={`flex flex-col gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-300 ${
                  animateItems ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                }`}
                style={{
                  transitionDelay: animateItems ? `${tip.delay}ms` : '0ms'
                }}
              >
                <div className="flex justify-center">
                  {tip.badge ? (
                    <div className={`inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg font-medium text-xs sm:text-sm ${
                      tip.badge.variant === 'blue' 
                        ? 'bg-blue-500 text-white shadow-sm'
                        : tip.badge.variant === 'green'
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                        : 'bg-gray-50 text-gray-700 border border-gray-200'
                    }`}>
                      {tip.badge.hasIcon && tip.icon}
                      {!tip.badge.hasIcon && tip.icon}
                      <span>{tip.badge.text}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      {tip.icon}
                    </div>
                  )}
                </div>
                
                {tip.description && (
                  <div className="text-center">
                    <p className="text-xs sm:text-sm font-medium text-gray-800 leading-relaxed">
                      {tip.description}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action button */}
        <div className="px-4 sm:px-6 pb-4 sm:pb-6 flex-shrink-0">
          <Button 
            onClick={handleGotIt} 
            className="w-full h-10 sm:h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg sm:rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] text-sm sm:text-base"
          >
            Got it, let's party!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuickHelpPopup;