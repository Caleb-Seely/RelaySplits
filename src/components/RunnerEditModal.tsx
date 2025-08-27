
import React, { useState } from 'react';
import { Users } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { formatPace } from '@/utils/raceUtils';
import type { Runner } from '@/types/race';

interface RunnerEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  runner: Runner | null;
  onSave: (runnerId: number, name: string, paceSeconds: number) => void;
}

const RunnerEditModal = ({ isOpen, onClose, runner, onSave }: RunnerEditModalProps) => {
  const [name, setName] = useState(runner?.name || '');
  const [paceInput, setPaceInput] = useState(runner ? formatPace(runner.pace) : '');

  React.useEffect(() => {
    if (runner) {
      setName(runner.name);
      setPaceInput(formatPace(runner.pace));
    }
  }, [runner]);

  const handleSave = () => {
    if (!runner) return;
    
    try {
      const paceSeconds = paceInput.includes(':') ?
        parseInt(paceInput.split(':')[0]) * 60 + parseInt(paceInput.split(':')[1]) :
        parseInt(paceInput) * 60;

      if (isNaN(paceSeconds) || paceSeconds <= 0) {
        alert('Please enter a valid pace (e.g., "7:30" or "450")');
        return;
      }

      onSave(runner.id, name.trim(), paceSeconds);
      onClose();
    } catch (error) {
      alert('Please enter a valid pace');
    }
  };

  if (!runner) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="mx-2 sm:mx-0 max-w-[100vw] sm:max-w-md rounded-md sm:rounded-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-lg font-bold">Edit Runner {runner.id}</div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground font-normal">
                <Badge variant="outline" className="text-xs">
                  Van {runner.van}
                </Badge>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label htmlFor="runner-name" className="text-sm font-medium">
              Runner Name
            </Label>
            <Input
              id="runner-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter runner name"
              className="text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="runner-pace" className="text-sm font-medium">
              Pace (per mile)
            </Label>
            <Input
              id="runner-pace"
              value={paceInput}
              onChange={(e) => setPaceInput(e.target.value)}
              placeholder="e.g., 7:30 or 450"
              className="text-base"
            />
            <p className="text-xs text-muted-foreground">
              Enter as MM:SS (e.g., 7:30) or total seconds (e.g., 450)
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={handleSave} className="flex-1">
              Save Changes
            </Button>
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RunnerEditModal;
