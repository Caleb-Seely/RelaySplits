import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
// import { format } from 'date-fns';
import { useConflictResolution } from '@/contexts/ConflictResolutionContext';
import { useTechnicalTracking } from '@/hooks/useAnalytics';

const ConflictResolutionModal: React.FC = () => {
  const { currentConflict, isConflictModalOpen, closeConflict, resolveConflict } = useConflictResolution();
  const { trackConflictResolved } = useTechnicalTracking();
  
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getTimeDifference = () => {
    if (!currentConflict) return 0;
    const diffMs = Math.abs(currentConflict.serverTime - currentConflict.localTime);
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    return diffMinutes;
  };

  const handleResolve = (selectedTime: number) => {
    resolveConflict(selectedTime);
    trackConflictResolved({
      conflict_type: 'time_sync',
      leg_number: currentConflict?.legNumber,
      runner_id: currentConflict?.runnerId
    });
  };

  if (!currentConflict) return null;

  return (
    <Dialog open={isConflictModalOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg p-0 bg-white/95 backdrop-blur-xl border-0 rounded-3xl shadow-2xl">
        <div className="p-8">
                     <DialogHeader className="text-center space-y-3 mb-8">

             <DialogTitle className="text-2xl font-semibold text-gray-900 leading-tight text-center">
               Time sync needed
             </DialogTitle>
            <p className="text-base text-gray-600 font-normal leading-relaxed max-w-sm mx-auto">
              Did <span className="font-medium text-gray-900"> {currentConflict.runnerName}</span> {currentConflict.field} <span className="font-medium text-gray-900">Leg {currentConflict.legNumber}</span> at:
            </p>
          </DialogHeader>

          <div className="space-y-6">
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                className="flex-1 h-24 flex flex-col items-center justify-center space-y-3 border-0 bg-gradient-to-br from-blue-50 to-blue-25 hover:from-blue-100 hover:to-blue-50 rounded-2xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-lg"
                onClick={() => handleResolve(currentConflict.localTime)}
              >
                <div className="text-center">
                  <div className="text-2xl font-semibold text-gray-900 tabular-nums">
                    {formatTime(currentConflict.localTime)}
                  </div>
                  <div className="text-sm text-gray-600 font-medium">Your time</div>
                </div>
              </Button>

              <div className="text-gray-300 text-sm font-medium px-3 flex-shrink-0">or</div>

              <Button
                variant="outline"
                className="flex-1 h-24 flex flex-col items-center justify-center space-y-3 border-0 bg-gradient-to-br from-emerald-50 to-emerald-25 hover:from-emerald-100 hover:to-emerald-50 rounded-2xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-lg"
                onClick={() => handleResolve(currentConflict.serverTime)}
              >
                <div className="text-center">
                  <div className="text-2xl font-semibold text-gray-900 tabular-nums">
                    {formatTime(currentConflict.serverTime)}
                  </div>
                  <div className="text-sm text-gray-600 font-medium">Team time</div>
                </div>
              </Button>
            </div>

                         <div className="text-center pt-2 space-y-2">
               <p className="text-sm text-gray-500 leading-relaxed">
                 Your selection will sync this time across all devices
               </p>
               <p className="text-xs text-gray-400 font-medium">
                 Difference of {getTimeDifference()} minute{getTimeDifference() !== 1 ? 's' : ''}
               </p>
             </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConflictResolutionModal;