import React, { useState } from 'react';
import { Clock, AlertTriangle, User, Play, Square, List } from 'lucide-react';

import TimePicker from './TimePicker';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useConflictResolution } from '@/contexts/ConflictResolutionContext';
import { useTechnicalTracking } from '@/hooks/useAnalytics';


const MissingTimeConflictModal: React.FC = () => {
  const { 
    currentMissingTimeConflict, 
    isMissingTimeModalOpen, 
    closeMissingTimeConflict, 
    resolveMissingTimeConflict,
    pendingMissingTimeConflicts
  } = useConflictResolution();
  const { trackConflictResolved } = useTechnicalTracking();
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getFieldDisplayName = (field: 'actualStart' | 'actualFinish') => {
    return field === 'actualStart' ? 'start' : 'finish';
  };

  const getFieldIcon = (field: 'actualStart' | 'actualFinish') => {
    return field === 'actualStart' ? Play : Square;
  };

  const handleUseSuggestedTime = () => {
    if (currentMissingTimeConflict?.suggestedTime) {
      resolveMissingTimeConflict(currentMissingTimeConflict.suggestedTime);
      trackConflictResolved({
        conflict_type: 'missing_time_suggested',
        leg_number: currentMissingTimeConflict?.legId
      });
    }
  };

  const handleSetManualTime = () => {
    setShowTimePicker(true);
  };

  const handleSkip = () => {
    resolveMissingTimeConflict(null);
    trackConflictResolved({
      conflict_type: 'missing_time_skipped',
      leg_number: currentMissingTimeConflict?.legId
    });
  };

  const handleTimePickerSubmit = (timestamp: number) => {
    resolveMissingTimeConflict(timestamp);
    setShowTimePicker(false);
    trackConflictResolved({
      conflict_type: 'missing_time_manual',
      leg_number: currentMissingTimeConflict?.legId
    });
  };

  if (!currentMissingTimeConflict) return null;

  const totalConflicts = pendingMissingTimeConflicts.length + 1; // +1 for current conflict
  const isFirstConflict = pendingMissingTimeConflicts.length === 0;

  const FieldIcon = getFieldIcon(currentMissingTimeConflict.field);
  const fieldDisplayName = getFieldDisplayName(currentMissingTimeConflict.field);

  return (
    <>
      <Dialog open={isMissingTimeModalOpen} onOpenChange={closeMissingTimeConflict}>
        <DialogContent className="sm:max-w-lg p-0 bg-white/95 backdrop-blur-xl border-0 rounded-3xl shadow-2xl">
          <div className="p-8">
            <DialogHeader className="text-center space-y-3 mb-8">
              <div className="flex items-center justify-center mb-4">
                <AlertTriangle className="h-8 w-8 text-amber-500" />
              </div>
              <DialogTitle className="text-2xl font-semibold text-gray-900 leading-tight text-center">
                Missing {fieldDisplayName} time
                {totalConflicts > 1 && (
                  <div className="text-sm text-gray-500 mt-1">
                    ({totalConflicts} total conflicts to resolve)
                  </div>
                )}
              </DialogTitle>
              <p className="text-base text-gray-600 font-normal leading-relaxed max-w-sm mx-auto">
                <span className="font-medium text-gray-900">{currentMissingTimeConflict.runnerName}</span> doesn't have a {fieldDisplayName} time for <span className="font-medium text-gray-900">Leg {currentMissingTimeConflict.legId}</span>
              </p>
            </DialogHeader>

            <div className="space-y-6">
              {currentMissingTimeConflict.suggestedTime && (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-3">
                      {currentMissingTimeConflict.field === 'actualStart' 
                        ? 'Previous runner finished at:'
                        : 'Next runner started at:'
                      }
                    </p>
                    <div className="text-2xl font-semibold text-gray-900 tabular-nums">
                      {formatTime(currentMissingTimeConflict.suggestedTime)}
                    </div>
                  </div>

                  <Button
                    className="w-full h-16 flex items-center justify-center space-x-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-2xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
                    onClick={handleUseSuggestedTime}
                  >
                    <Clock className="h-5 w-5" />
                    <span className="text-lg font-semibold">
                      Use this time
                    </span>
                  </Button>
                </div>
              )}

              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full h-14 flex items-center justify-center space-x-3 border-2 border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 rounded-2xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                  onClick={handleSetManualTime}
                >
                  <FieldIcon className="h-5 w-5 text-gray-600" />
                  <span className="text-base font-medium text-gray-700">
                    Set time manually
                  </span>
                </Button>

                <Button
                  variant="outline"
                  className="w-full h-12 flex items-center justify-center space-x-3 border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 rounded-2xl transition-all duration-300"
                  onClick={handleSkip}
                >
                  <span className="text-sm font-medium text-gray-600">
                    Skip for now
                  </span>
                </Button>
              </div>

              <div className="text-center pt-2">
                <p className="text-xs text-gray-400 font-medium">
                  This helps ensure accurate race timing
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showTimePicker && (
        <TimePicker
          isOpen={showTimePicker}
          onClose={() => setShowTimePicker(false)}
          onConfirm={handleTimePickerSubmit}
          title={`Set ${fieldDisplayName} time for ${currentMissingTimeConflict.runnerName}`}
          subtitle={`Leg ${currentMissingTimeConflict.legId}`}
        />
      )}
    </>
  );
};

export default MissingTimeConflictModal;
