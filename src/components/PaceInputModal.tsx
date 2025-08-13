import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatPace } from '@/utils/raceUtils';
import { Clock, AlertCircle, Check } from 'lucide-react';

interface PaceInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (paceSeconds: number) => void;
  initialPace?: number; // in seconds per mile
  runnerName?: string;
  title?: string;
}

const PaceInputModal: React.FC<PaceInputModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialPace = 420, // 7:00 default
  runnerName,
  title = "Set Runner Pace"
}) => {
  const [paceInput, setPaceInput] = useState('');
  const [paceSeconds, setPaceSeconds] = useState(initialPace);
  const [error, setError] = useState('');
  const [isValid, setIsValid] = useState(false);

  // Preset pace options (in seconds per mile)
  const pacePresets = [
    { label: '5:00', seconds: 300, type: 'fast' },
    { label: '6:00', seconds: 360, type: 'fast' },
    { label: '6:30', seconds: 390, type: 'moderate' },
    { label: '7:00', seconds: 420, type: 'moderate' },
    { label: '7:30', seconds: 450, type: 'moderate' },
    { label: '8:00', seconds: 480, type: 'moderate' },
    { label: '8:30', seconds: 510, type: 'relaxed' },
    { label: '9:00', seconds: 540, type: 'relaxed' },
    { label: '10:00', seconds: 600, type: 'relaxed' },
  ];

  useEffect(() => {
    if (isOpen) {
      const formattedPace = formatPace(initialPace);
      setPaceInput(formattedPace);
      setPaceSeconds(initialPace);
      setError('');
      setIsValid(true);
    }
  }, [isOpen, initialPace]);

  const validateAndParsePace = (input: string): { valid: boolean; seconds: number; error: string } => {
    if (!input.trim()) {
      return { valid: false, seconds: 0, error: 'Please enter a pace' };
    }

    // Handle MM:SS format
    if (input.includes(':')) {
      const parts = input.split(':');
      if (parts.length !== 2) {
        return { valid: false, seconds: 0, error: 'Use MM:SS format (e.g., 7:30)' };
      }

      const minutes = parseInt(parts[0]);
      const seconds = parseInt(parts[1]);

      if (isNaN(minutes) || isNaN(seconds)) {
        return { valid: false, seconds: 0, error: 'Invalid time format' };
      }

      if (seconds >= 60) {
        return { valid: false, seconds: 0, error: 'Seconds must be less than 60' };
      }

      const totalSeconds = minutes * 60 + seconds;

      if (totalSeconds < 180) { // Less than 3:00 per mile
        return { valid: false, seconds: 0, error: 'Pace too fast (minimum 3:00/mile)' };
      }

      if (totalSeconds > 900) { // More than 15:00 per mile
        return { valid: false, seconds: 0, error: 'Pace too slow (maximum 15:00/mile)' };
      }

      return { valid: true, seconds: totalSeconds, error: '' };
    }

    // Handle decimal minutes format (e.g., 7.5 for 7:30)
    const decimalMinutes = parseFloat(input);
    if (isNaN(decimalMinutes)) {
      return { valid: false, seconds: 0, error: 'Invalid pace format' };
    }

    const totalSeconds = Math.round(decimalMinutes * 60);

    if (totalSeconds < 180) {
      return { valid: false, seconds: 0, error: 'Pace too fast (minimum 3:00/mile)' };
    }

    if (totalSeconds > 900) {
      return { valid: false, seconds: 0, error: 'Pace too slow (maximum 15:00/mile)' };
    }

    return { valid: true, seconds: totalSeconds, error: '' };
  };

  const handlePaceInputChange = (value: string) => {
    setPaceInput(value);
    const result = validateAndParsePace(value);
    setIsValid(result.valid);
    setError(result.error);
    if (result.valid) {
      setPaceSeconds(result.seconds);
    }
  };

  const handlePresetClick = (seconds: number) => {
    const formattedPace = formatPace(seconds);
    setPaceInput(formattedPace);
    setPaceSeconds(seconds);
    setIsValid(true);
    setError('');
  };

  const handleSubmit = () => {
    if (isValid && paceSeconds > 0) {
      onSubmit(paceSeconds);
      onClose();
    }
  };

  const getPaceCategory = (seconds: number) => {
    if (seconds <= 360) return 'Elite';
    if (seconds <= 420) return 'Fast';
    if (seconds <= 480) return 'Moderate';
    if (seconds <= 540) return 'Relaxed';
    return 'Walking';
  };

  const getPaceCategoryColor = (seconds: number) => {
    if (seconds <= 360) return 'bg-purple-100 text-purple-800';
    if (seconds <= 420) return 'bg-blue-100 text-blue-800';
    if (seconds <= 480) return 'bg-emerald-100 text-emerald-800';
    if (seconds <= 540) return 'bg-blue-100 text-blue-800';
    return 'bg-slate-100 text-slate-800';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-blue-600" />
            {title}
          </DialogTitle>
          {runnerName && (
            <p className="text-sm text-gray-600">Setting pace for {runnerName}</p>
          )}
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Manual Input */}
          <div className="space-y-3">
            <Label htmlFor="pace-input" className="text-sm font-medium">
              Enter Pace (minutes per mile)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="pace-input"
                value={paceInput}
                onChange={(e) => handlePaceInputChange(e.target.value)}
                placeholder="7:30 or 7.5"
                className={`text-lg font-mono ${error ? 'border-red-300 focus:border-red-500' : isValid ? 'border-green-300 focus:border-green-500' : ''}`}
              />
              {isValid && (
                <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
              )}
            </div>
            
            {error && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">{error}</AlertDescription>
              </Alert>
            )}

            {isValid && paceSeconds > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600">Category:</span>
                <Badge className={getPaceCategoryColor(paceSeconds)}>
                  {getPaceCategory(paceSeconds)}
                </Badge>
                <span className="text-gray-600">•</span>
                <span className="font-mono font-semibold">{formatPace(paceSeconds)}/mile</span>
              </div>
            )}
          </div>

          {/* Preset Options */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Quick Presets</Label>
            <div className="grid grid-cols-3 gap-2">
              {pacePresets.map((preset) => (
                <Button
                  key={preset.seconds}
                  variant={paceSeconds === preset.seconds ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePresetClick(preset.seconds)}
                  className={`h-10 font-mono ${
                    paceSeconds === preset.seconds 
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : 'hover:bg-blue-50'
                  }`}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isValid}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              Set Pace
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaceInputModal;
