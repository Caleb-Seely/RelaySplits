
import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import type { Runner } from '@/types/race';
import { formatPace, parsePace } from '@/utils/raceUtils';
import { useRaceStore } from '@/store/raceStore';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';

interface RunnerAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  runner: Runner | null;
  initialLegId?: number;
  onSave: (
    runnerId: number,
    name: string,
    paceSeconds: number,
    selectedLegIds: number[],
    totalMiles: number
  ) => void;
}

const VAN1_LEGS = [
  ...Array.from({ length: 6 }, (_, i) => i + 1),
  ...Array.from({ length: 6 }, (_, i) => i + 13),
  ...Array.from({ length: 6 }, (_, i) => i + 25)
];
const VAN2_LEGS = [
  ...Array.from({ length: 6 }, (_, i) => i + 7),
  ...Array.from({ length: 6 }, (_, i) => i + 19),
  ...Array.from({ length: 6 }, (_, i) => i + 31)
];

const RunnerAssignmentModal: React.FC<RunnerAssignmentModalProps> = ({ isOpen, onClose, runner, initialLegId, onSave }) => {
  const { legs, setLegPaceOverride, updateLegDistance } = useRaceStore();
  const [name, setName] = useState<string>(runner?.name || '');
  const [paceInput, setPaceInput] = useState<string>(runner ? formatPace(runner.pace) : '');
  const [legDistanceInput, setLegDistanceInput] = useState<string>('');
  const [activeVan, setActiveVan] = useState<1 | 2>((runner?.van || 1) as 1 | 2);
  const [selectedLegs, setSelectedLegs] = useState<Set<number>>(new Set());
  const [paceError, setPaceError] = useState<string>('');
  // Track last leg clicked to drive the per-leg override checkbox label/state
  const [lastClickedLegId, setLastClickedLegId] = useState<number | null>(null);
  // Track which legs should receive a per-leg pace override on save
  const [overrideLegs, setOverrideLegs] = useState<Set<number>>(new Set());
  // Track whether we've shown the unassign warning toast for this modal session
  const [unassignToastShown, setUnassignToastShown] = useState<boolean>(false);

  // Get current leg assignments for this runner
  const currentLegAssignments = useMemo(() => {
    if (!runner || !legs.length) return new Set<number>();
    return new Set(legs.filter(leg => leg.runnerId === runner.id).map(leg => leg.id));
  }, [runner, legs]);

  useEffect(() => {
    if (runner) {
      setName(runner.name);
      setPaceInput(formatPace(runner.pace));
      setActiveVan(runner.van);
      // Pre-populate with current leg assignments
      setSelectedLegs(new Set(currentLegAssignments));
      setPaceError('');
      setUnassignToastShown(false);
      // Default the per-leg override target: prefer initialLegId if provided, else the first assigned leg (if any)
      if (typeof initialLegId === 'number') {
        setLastClickedLegId(initialLegId);
        const leg = legs.find(l => l.id === initialLegId);
        if (leg) {
          setLegDistanceInput(leg.distance.toString());
        }
      } else {
        const firstAssigned = Array.from(currentLegAssignments).sort((a, b) => a - b)[0];
        setLastClickedLegId(firstAssigned ?? null);
        setLegDistanceInput('');
      }
    }
  }, [runner, isOpen, currentLegAssignments, initialLegId]);

  // Keep the pace input in sync with the currently targeted leg
  // If the targeted leg has an override, show that; otherwise show the runner's base pace
  useEffect(() => {
    if (!runner) return;
    const leg = lastClickedLegId ? legs.find(l => l.id === lastClickedLegId) : null;
    // Only show override pace if it belongs to this runner; otherwise show runner base pace
    const seconds = leg && leg.runnerId === runner.id && typeof leg.paceOverride === 'number' ? leg.paceOverride : runner.pace;
    setPaceInput(formatPace(seconds));
  }, [lastClickedLegId, runner, legs, isOpen]);

  const allLegDistances = useMemo(() => {
    if (legs && legs.length === 36) {
      const map = new Map<number, number>();
      for (const leg of legs) map.set(leg.id, leg.distance);
      return map;
    }
    return new Map<number, number>();
  }, [legs]);

  const selectedLegList = useMemo(() => Array.from(selectedLegs).sort((a, b) => a - b), [selectedLegs]);

  const totalMiles = useMemo(() => {
    let total = 0;
    for (const id of selectedLegs) {
      const d = allLegDistances.get(id);
      if (typeof d === 'number') total += d;
    }
    return parseFloat(total.toFixed(2));
  }, [selectedLegs, allLegDistances]);

  const toggleLeg = (id: number) => {
    const leg = legs?.find(l => l.id === id);

    // If the leg is already assigned to the current runner, show a toast and do nothing.
    if (leg && leg.runnerId === runner?.id) {
      if (!unassignToastShown) {
        toast({
          title: "Cannot unassign leg",
          description: "Assign this leg to someone else to remove it from this runner.",
          duration: 5000,
        });
        setUnassignToastShown(true);
      }
      // Still update last clicked for checkbox context
      setLastClickedLegId(id);
      return;
    }

    // Otherwise, toggle selection
    setSelectedLegs(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    // Update last clicked to drive the per-leg override checkbox label/state
    setLastClickedLegId(id);
  };

  const legsForActiveVan = activeVan === 1 ? VAN1_LEGS : VAN2_LEGS;

  const handleSave = () => {
    if (!runner) return;
    try {
      const paceSec = parsePace(paceInput);
      setPaceError('');
      // If specific legs are marked, apply per-leg overrides and do NOT change runner base pace.
      // Handle leg distance update if applicable
      if (initialLegId && legDistanceInput) {
        const newDistance = parseFloat(legDistanceInput);
        if (!isNaN(newDistance) && newDistance > 0) {
          updateLegDistance(initialLegId, newDistance);
        }
      }

      if (overrideLegs.size > 0) {
        setLegPaceOverride(Array.from(overrideLegs).sort((a, b) => a - b), paceSec);
        onSave(runner.id, name.trim(), runner.pace, selectedLegList, totalMiles);
      } else {
        // No per-leg override selected: update runner's base pace
        onSave(runner.id, name.trim(), paceSec, selectedLegList, totalMiles);
      }
      onClose();
    } catch (e) {
      setPaceError('Enter pace as MM:SS or minutes (e.g., 7:30 or 7.5)');
    }
  };

  if (!runner) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-lg font-bold truncate">Assign Legs</div>
              <div className="text-xs text-muted-foreground">Runner #{runner.id} • Van {runner.van}</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Name and Pace */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* A: Runner Name (always first) */}
            <div>
              <label className="text-sm font-medium block mb-1">Runner Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Sarah Johnson" />
              {/* Desktop-only: Selected legs + totals + van under Runner Name to fill left column */}
              <div className="hidden sm:block">
                {/* Selected legs inline (no checkbox here) */}
                <div className="mt-2 flex items-center justify-between gap-4">
                  <div className="text-sm">
                    <span className="font-medium">Selected legs:</span>{' '}
                    {selectedLegList.length > 0 ? (
                      <span>{selectedLegList.join(', ')}</span>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </div>
                </div>
                {/* Total Miles and Van Toggle (stacked) */}
                <div className="mt-3">
                  <div className="text-sm text-muted-foreground">{totalMiles} total miles</div>
                  <div className="mt-2">
                    <Tabs value={`van-${activeVan}`} onValueChange={(v) => setActiveVan(v === 'van-1' ? 1 : 2)}>
                      <TabsList>
                        <TabsTrigger value="van-1">Van 1</TabsTrigger>
                        <TabsTrigger value="van-2">Van 2</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>
              </div>
            </div>
            {/* B: Pace + checkbox + leg distance (second on mobile, right on desktop) */}
            <div>
              <label className="text-sm font-medium block mb-1">Pace (min/mile)</label>
              <Input value={paceInput} onChange={(e) => setPaceInput(e.target.value)} placeholder="7:30 or 7.5" />
              {paceError && (
                <div className="text-xs text-red-500 mt-1">{paceError}</div>
              )}
              {/* Override control under Pace input */}
              <div className="flex items-center gap-2 mt-2">
                <Checkbox
                  id="apply-pace-override"
                  checked={lastClickedLegId ? overrideLegs.has(lastClickedLegId) : false}
                  disabled={!lastClickedLegId}
                  onCheckedChange={(v) => {
                    if (!lastClickedLegId) return;
                    const checked = v === true || v === 'indeterminate';
                    setOverrideLegs(prev => {
                      const next = new Set(prev);
                      if (checked) next.add(lastClickedLegId); else next.delete(lastClickedLegId);
                      return next;
                    });
                  }}
                />
                <label htmlFor="apply-pace-override" className="text-sm select-none">
                  {lastClickedLegId ? `Apply this pace only to leg ${lastClickedLegId}` : 'Click a leg to enable per-leg pace override'}
                </label>
              </div>

              {/* Leg distance input below checkbox (full-width field) */}
              {initialLegId && (
                <div className="mt-3">
                  <label className="text-sm font-medium block mb-1">Leg {initialLegId} Distance (miles)</label>
                  <Input
                    value={legDistanceInput}
                    onChange={(e) => setLegDistanceInput(e.target.value)}
                    placeholder="e.g., 5.25"
                  />
                </div>
              )}
            </div>
            {/* C: Selected legs + total miles + van toggle (third on mobile, left under Runner Name on desktop) */}
            <div className="sm:hidden">
              {/* Selected legs inline (no checkbox here) */}
              <div className="mt-2 flex items-center justify-between gap-4">
                <div className="text-sm">
                  <span className="font-medium">Selected legs:</span>{' '}
                  {selectedLegList.length > 0 ? (
                    <span>{selectedLegList.join(', ')}</span>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </div>
              </div>

              {/* Total Miles and Van Toggle (stacked) */}
              <div className="mt-3">
                <div className="text-sm text-muted-foreground">{totalMiles} total miles</div>
                <div className="mt-2">
                  <Tabs value={`van-${activeVan}`} onValueChange={(v) => setActiveVan(v === 'van-1' ? 1 : 2)}>
                    <TabsList>
                      <TabsTrigger value="van-1">Van 1</TabsTrigger>
                      <TabsTrigger value="van-2">Van 2</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            </div>
          </div>

          

          {/* Leg Grid */}
          <div className="grid grid-cols-6 gap-2">
            {legsForActiveVan.map((id) => {
              const isSelected = selectedLegs.has(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleLeg(id)}
                  className={`h-10 rounded-md text-sm font-semibold border transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-muted text-foreground border-border hover:bg-muted/80'
                  }`}
                >
                  {id}
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button className="flex-1" onClick={handleSave}>Save Changes</Button>
            <Button className="flex-1" variant="outline" onClick={onClose}>Close</Button>
          </div>

          {/* Helper */}
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Badge variant="outline">Tip</Badge>
            Click legs to toggle selection. Van tabs filter the grid only; your selection is preserved across vans.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RunnerAssignmentModal;
