
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useRaceStore } from '@/store/raceStore';
import { useSyncManager } from '@/hooks/useSyncManager';
import { useTeamSync } from '@/hooks/useTeamSync';
import { Clock, Users, Play } from 'lucide-react';
import { formatTime, formatDate } from '@/utils/raceUtils';
import SpreadsheetImport from './SpreadsheetImport';
import { z } from 'zod';
import { toast } from 'sonner';

interface SetupWizardProps {
  isNewTeam?: boolean;
}

const SetupWizard: React.FC<SetupWizardProps> = ({ isNewTeam = false }) => {
  const {
    startTime,
    runners,
    didInitFromTeam,
    // isSetupComplete, // no longer used in single-step wizard
    setStartTime,
    updateRunner,
    setSetupStep,
    setDidInitFromTeam,
    // prevSetupStep, // removed navigation
    completeSetup,
    initializeLegs
  } = useRaceStore();

  const { saveInitialRows } = useSyncManager();
  const { team } = useTeamSync();

  const [isSaving, setIsSaving] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  // Local ref no longer used for init; we persist via store
  // Local UI state for pace text inputs to avoid auto-formatting on each keystroke
  const [paceInputs, setPaceInputs] = useState<Record<number, string>>({});

  // Validation schema: require names and reasonable pace (3:00–15:00 min/mi)
  const runnerSchema = z.object({
    id: z.number(),
    name: z.string().trim().min(1, 'Name is required'),
    pace: z.number().int().min(180, 'Pace too fast (<3:00)').max(3540, 'Pace too slow (>59:00)')
  });

  // Initialize start time from team data when component loads (guarded via store to survive StrictMode remount)
  useEffect(() => {
    if (team && team.start_time && !didInitFromTeam) {
      const initialStartTime = new Date(team.start_time);
      setStartTime(initialStartTime.getTime());
      // Go directly to runner configuration (single-step wizard)
      setSetupStep(2);
      setDidInitFromTeam(true);
    }
  }, [team, didInitFromTeam, setStartTime, setSetupStep, setDidInitFromTeam, isNewTeam]);

  // Use setupStep directly; initial step is set to 2 from team start time once.



  const handleRunnerUpdate = (id: number, field: 'name' | 'pace', value: string | number) => {
    updateRunner(id, { [field]: value });
  };

  const formatPace = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Strict-ish parser: accepts "MM", or "M:SS"/"MM:SS" (SS < 60). Returns null if incomplete/invalid.
  const parsePaceInput = (value: string): number | null => {
    const v = value.trim();
    if (v === '') return null;
    if (/^\d+$/.test(v)) {
      // Minutes only
      return parseInt(v, 10) * 60;
    }
    const m = v.match(/^(\d+):(\d{1,2})$/);
    if (m) {
      const minutes = parseInt(m[1], 10);
      const seconds = parseInt(m[2], 10);
      if (seconds < 60) return minutes * 60 + seconds;
    }
    return null;
  };

  // Initialize local paceInputs from store runners once on mount or when runners change
  useEffect(() => {
    setPaceInputs(prev => {
      const next: Record<number, string> = { ...prev };
      for (const r of runners) {
        if (next[r.id] === undefined) {
          next[r.id] = formatPace(r.pace);
        }
      }
      return next;
    });
  }, [runners]);

  const handleFinishSetup = async () => {
    // Validate runner inputs
    const invalids = runners
      .map(r => ({ r, res: runnerSchema.safeParse(r) }))
      .filter(x => !x.res.success);

    if (invalids.length > 0) {
      const first = invalids[0];
      const message = (first.res as any).error?.issues?.[0]?.message || 'Please fix runner inputs';
      toast.error(`${message} (Runner ${first.r.id})`);
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading('Saving your team...');
    console.log('[SetupWizard] Starting finish flow. isNewTeam:', isNewTeam, 'team:', team?.id);

    try {
      // Ensure legs exist before any save
      console.log('[SetupWizard] Ensuring legs are initialized');
      initializeLegs();

      // For new teams, insert initial rows for the team created in TeamSetup
      if (isNewTeam && team?.id) {
        console.log('[SetupWizard] Calling saveInitialRows for team', team.id);
        const { error } = await saveInitialRows(team.id);
        if (error) {
          console.error('[SetupWizard] saveInitialRows failed:', error);
          toast.error(`Failed to save initial data: ${error.message}`, { id: toastId });
          return;
        }
      }

      // Complete local setup
      completeSetup();
      console.log('[SetupWizard] Finish flow complete');
      toast.success('Your team is ready!', { id: toastId });
    } catch (e: any) {
      console.error('[SetupWizard] Unexpected error during finish flow:', e);
      toast.error(e?.message || 'Failed to complete setup', { id: toastId });
    } finally {
      setIsSaving(false);
      console.log('[SetupWizard] Dismissing toast id', toastId);
      toast.dismiss(toastId);
    }
  };



  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center">
        {/* Team name input removed; TeamSetup handles team creation */}
        <p className="text-gray-600">Set names and estimated paces for all 12 runners</p>
        <p className="text-gray-500 text-sm mt-1">You can edit this later from the Dashboard after setup.</p>
        <div className="mt-4">
          <div className="flex items-center justify-center gap-2 text-blue-700">
            <Clock className="h-4 w-4" />
            <span className="font-medium">Race starts at {formatTime(startTime)}</span>
          </div>
          <div className="text-center text-gray-500 text-sm mt-1">
            {formatDate(startTime)}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-4">
          <Button
            variant="outline"
            onClick={() => setImportModalOpen(true)}
            className="mb-4"
          >
            Import from Spreadsheet
          </Button>
        </div>
        
        <div className="mt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Van 1 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Van 1 Runners
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {runners.slice(0, 6).map((runner) => (
                  <div key={runner.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="w-8 h-6 justify-center">
                        {runner.id}
                      </Badge>
                      <Label className="text-sm">Runner {runner.id}</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Runner name"
                        value={runner.name}
                        onChange={(e) => handleRunnerUpdate(runner.id, 'name', e.target.value)}
                        className="text-sm"
                      />
                      <Input
                        placeholder="7:30"
                        value={paceInputs[runner.id] ?? ''}
                        onChange={(e) => {
                          const text = e.target.value;
                          setPaceInputs((s) => ({ ...s, [runner.id]: text }));
                          // If the input is a fully valid pace, update the store immediately
                          const seconds = parsePaceInput(text);
                          if (seconds !== null) {
                            handleRunnerUpdate(runner.id, 'pace', seconds);
                          }
                        }}
                        onBlur={(e) => {
                          const seconds = parsePaceInput(e.target.value);
                          if (seconds !== null) {
                            handleRunnerUpdate(runner.id, 'pace', seconds);
                            setPaceInputs((s) => ({ ...s, [runner.id]: formatPace(seconds) }));
                          } else {
                            // Keep whatever the user typed; do not force-format
                          }
                        }}
                        className="text-sm font-mono"
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Van 2 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Van 2 Runners
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {runners.slice(6, 12).map((runner) => (
                  <div key={runner.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="w-8 h-6 justify-center">
                        {runner.id}
                      </Badge>
                      <Label className="text-sm">Runner {runner.id}</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Runner name"
                        value={runner.name}
                        onChange={(e) => handleRunnerUpdate(runner.id, 'name', e.target.value)}
                        className="text-sm"
                      />
                      <Input
                        placeholder="7:30"
                        value={paceInputs[runner.id] ?? ''}
                        onChange={(e) => {
                          const text = e.target.value;
                          setPaceInputs((s) => ({ ...s, [runner.id]: text }));
                          const seconds = parsePaceInput(text);
                          if (seconds !== null) {
                            handleRunnerUpdate(runner.id, 'pace', seconds);
                          }
                        }}
                        onBlur={(e) => {
                          const seconds = parsePaceInput(e.target.value);
                          if (seconds !== null) {
                            handleRunnerUpdate(runner.id, 'pace', seconds);
                            setPaceInputs((s) => ({ ...s, [runner.id]: formatPace(seconds) }));
                          }
                        }}
                        className="text-sm font-mono"
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Spreadsheet Import Modal */}
        <SpreadsheetImport
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onImported={(imported) => {
            // Rebuild local paceInputs from imported runner paces
            setPaceInputs(() => {
              const next: Record<number, string> = {};
              for (const r of imported) {
                next[r.id] = formatPace(r.pace);
              }
              return next;
            });
          }}
        />
      </div>
    </div>
  );

  // Review step removed; single-step wizard only

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Configure Your Runners</h1>
          {/* Stepper removed for single-step flow */}
        </div>

        {/* Step Content */}
        {renderStep1()}

        {/* Navigation */}
        <div className="flex justify-center items-center mt-12 max-w-2xl mx-auto">
          <Button
            onClick={handleFinishSetup}
            className="px-6 bg-green-600 hover:bg-green-700"
          >
            <Play className="h-4 w-4 mr-2" />
            Start Race Tracking
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SetupWizard;
