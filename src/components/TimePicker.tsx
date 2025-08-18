
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { Clock, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onTimeSelect: (timestamp: number) => void;
  title: string;
  runnerName?: string;
  initialTime?: number;
}

const TimePicker: React.FC<TimePickerProps> = ({
  isOpen,
  onClose,
  onTimeSelect,
  title,
  runnerName,
  initialTime
}) => {
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    const now = new Date(initialTime || Date.now());
    setSelectedTime(format(now, 'HH:mm'));
    setSelectedDate(now);
  }, [initialTime, isOpen]);

  const handleUseNow = () => {
    const now = new Date();
    setSelectedTime(format(now, 'HH:mm'));
    setSelectedDate(now);
  };

  const handleSubmit = () => {
    try {
      if (!selectedDate) {
        alert('Please select a date');
        return;
      }

      const [hours, minutes] = selectedTime.split(':').map(Number);
      const combinedDateTime = new Date(selectedDate);
      combinedDateTime.setHours(hours, minutes, 0); // Set seconds to 0
      
      const timestamp = combinedDateTime.getTime();
      
      if (isNaN(timestamp)) {
        alert('Please enter a valid date and time');
        return;
      }
      
      onTimeSelect(timestamp);
      onClose();
    } catch (error) {
      alert('Please enter a valid date and time');
    }
  };

  const handleTimeChange = (value: string) => {
    setSelectedTime(value);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-blue-900 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {title}
            {runnerName && (
              <div className="text-sm text-blue-600 font-normal">Runner: {runnerName}</div>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 p-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal border-blue-200 focus:border-blue-400",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                      setCalendarOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                step="60"
                value={selectedTime}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="border-blue-200 focus:border-blue-400"
              />
            </div>
          </div>
          
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-sm text-blue-600 mb-2">Selected Time:</div>
            <div className="text-lg font-bold text-blue-900">
              {selectedDate && selectedTime ? (() => {
                const [hours, minutes] = selectedTime.split(':').map(Number);
                const combinedDateTime = new Date(selectedDate);
                combinedDateTime.setHours(hours, minutes, 0);
                return format(combinedDateTime, 'MMM d, yyyy h:mm a');
              })() : 'Please select date and time'}
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleUseNow} 
              variant="outline"
              className="border-orange-200 text-orange-600 hover:bg-orange-50 flex-1"
            >
              Use Current Time
            </Button>
            <Button 
              onClick={handleSubmit}
              className="bg-blue-500 hover:bg-blue-600 flex-1"
            >
              Save Time
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TimePicker;
