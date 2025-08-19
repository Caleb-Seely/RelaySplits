
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useRaceStore } from '@/store/raceStore';
import { useEnhancedSyncManager } from '@/hooks/useEnhancedSyncManager';
import { useTeamSync } from '@/hooks/useTeamSync';
import { useConflictResolution } from '@/contexts/ConflictResolutionContext';
import { invokeEdge, getDeviceId } from '@/integrations/supabase/edge';
import { Clock, Users, Play, Waves } from 'lucide-react';
import { formatTime, formatDate, formatRaceTime } from '@/utils/raceUtils';
import SpreadsheetImport from './SpreadsheetImport';
import { z } from 'zod';
import { toast } from 'sonner';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs, { Dayjs } from 'dayjs';

interface SetupWizardProps {
  isNewTeam?: boolean;
}

const SetupWizard: React.FC<SetupWizardProps> = ({ isNewTeam = false }) => {
  console.log('[SetupWizard] Rendering with isNewTeam:', isNewTeam);
  const {
    startTime,
    runners,
    didInitFromTeam,
    setStartTime,
    updateRunner,
    setSetupStep,
    setDidInitFromTeam,
    completeSetup,
    initializeLegs
  } = useRaceStore();

  const { onConflictDetected } = useConflictResolution();
  const { fetchLatestData, saveInitialRows } = useEnhancedSyncManager();
  const { team, refreshTeamData } = useTeamSync();

  const [isSaving, setIsSaving] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  // Local ref no longer used for init; we persist via store
  // Local UI state for pace text inputs to avoid auto-formatting on each keystroke
  const [paceInputs, setPaceInputs] = useState<Record<number, string>>({});
  const [selectedDateTime, setSelectedDateTime] = useState<Dayjs | null>(null);

  // Validation schema: require names and reasonable pace (3:00–15:00 min/mi)
  const runnerSchema = z.object({
    id: z.number(),
    name: z.string().trim().min(1, 'Name is required'),
    pace: z.number().int().min(180, 'Pace too fast (<3:00)').max(3540, 'Pace too slow (>59:00)')
  });

  // Sync selectedDateTime with startTime when component loads
  useEffect(() => {
    if (startTime && !selectedDateTime) {
      setSelectedDateTime(dayjs(startTime));
    }
  }, [startTime, selectedDateTime]);

  // Initialize start time from team data when component loads (guarded via store to survive StrictMode remount)
  useEffect(() => {
    if (team && team.start_time && !didInitFromTeam && !isNewTeam) {
      const initialStartTime = new Date(team.start_time);
      setStartTime(initialStartTime.getTime());
      setSelectedDateTime(dayjs(initialStartTime));
      // Go directly to runner configuration (single-step wizard)
      setSetupStep(2);
      setDidInitFromTeam(true);
    }
  }, [team, didInitFromTeam, setStartTime, setSetupStep, setDidInitFromTeam, isNewTeam]);

  // Sync selectedDateTime with startTime (only if not already set)
  useEffect(() => {
    if (startTime && !selectedDateTime && !isNewTeam) {
      setSelectedDateTime(dayjs(startTime));
    }
  }, [startTime, selectedDateTime, isNewTeam]);

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

  const handleDateTimeChange = (newValue: Dayjs | null) => {
    setSelectedDateTime(newValue);
    if (newValue) {
      const newStartTime = newValue.valueOf();
      setStartTime(newStartTime);
    }
  };

  const handleFinishSetup = async () => {
    // Validate runner inputs
    const invalids = runners
      .map(r => ({ r, res: runnerSchema.safeParse(r) }))
      .filter(x => !x.res.success);

    if (invalids.length > 0) {
      const first = invalids[0];
      const message = (first.res as { error?: { issues?: Array<{ message: string }> } }).error?.issues?.[0]?.message || 'Please fix runner inputs';
      toast.error(`${message} (Runner ${first.r.id})`);
      return;
    }

    if (!startTime) {
      toast.error('Please set a race start time');
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading('Saving your team...');
    console.log('[SetupWizard] Starting finish flow. isNewTeam:', isNewTeam, 'team:', team?.id);

    try {
      // Save start time to team if this is a new team
      if (isNewTeam && team?.id) {
        const deviceId = getDeviceId();
        const teamUpdateISO = new Date(startTime).toISOString();
        
        const result = await invokeEdge('teams-update', {
          teamId: team.id,
          deviceId,
          start_time: teamUpdateISO
        });
        
        // Update local storage with the new start time
        if (result && !('error' in result)) {
          const updatedTeam = (result as any).data?.team;
          if (updatedTeam?.start_time) {
            localStorage.setItem('relay_team_start_time', updatedTeam.start_time);
            
            // Also update the race store's start time to match
            const race = useRaceStore.getState();
            const raceStoreTime = new Date(updatedTeam.start_time).getTime();
            race.setStartTime(raceStoreTime);
            
            // Refresh team data to update the team context
            await refreshTeamData();
          } else {
            console.error('[SetupWizard] No start_time in updated team data:', updatedTeam);
          }
        } else {
          console.error('[SetupWizard] teams-update failed:', result);
        }
      }

      // Ensure legs exist before any save
      console.log('[SetupWizard] Ensuring legs are initialized');
      initializeLegs();
      
      // Verify legs were created
      const storeStateAfterInit = useRaceStore.getState();
      console.log('[SetupWizard] After initializeLegs - runners:', storeStateAfterInit.runners.length, 'legs:', storeStateAfterInit.legs.length);
      if (storeStateAfterInit.legs.length === 0) {
        console.error('[SetupWizard] Legs were not initialized properly!');
        toast.error('Failed to initialize race legs', { id: toastId });
        return;
      }

      // For new teams, insert initial rows for the team created in DemoLanding
      if (isNewTeam && team?.id) {
        console.log('[SetupWizard] About to call saveInitialRows for team', team.id);
        const storeState = useRaceStore.getState();
        console.log('[SetupWizard] Current store state - runners:', storeState.runners.length, 'legs:', storeState.legs.length);
        console.log('[SetupWizard] Start time:', storeState.startTime, 'ISO:', new Date(storeState.startTime).toISOString());
        console.log('[SetupWizard] Sample runner:', storeState.runners[0]);
        console.log('[SetupWizard] Sample leg:', storeState.legs[0]);
        
        try {
          // Small delay to ensure device info is properly set
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const { error } = await saveInitialRows(team.id);
          console.log('[SetupWizard] saveInitialRows completed, error:', error);
          if (error) {
            console.error('[SetupWizard] saveInitialRows failed:', error);
            toast.error(`Failed to save initial data: ${error.message}`, { id: toastId });
            return;
          }
          
          // Data is already saved and store is updated, no need to fetch again
          console.log('[SetupWizard] Initial data saved and store updated successfully');
        } catch (e) {
          console.error('[SetupWizard] Exception in saveInitialRows:', e);
          toast.error(`Failed to save initial data: ${(e as Error)?.message || 'Unknown error'}`, { id: toastId });
          return;
        }
      }

             // Complete local setup
       completeSetup();
       
       // Log the final store state after setup completion
       const finalStoreState = useRaceStore.getState();
       console.log('[SetupWizard] Final store state after setup completion:', {
         runners: finalStoreState.runners.length,
         legs: finalStoreState.legs.length,
         isSetupComplete: finalStoreState.isSetupComplete,
         teamId: finalStoreState.teamId,
         startTime: finalStoreState.startTime
       });
       
       console.log('[SetupWizard] Finish flow complete');
       toast.success('Your team is ready!', { id: toastId });
    } catch (e: unknown) {
      console.error('[SetupWizard] Unexpected error during finish flow:', e);
      toast.error((e as Error)?.message || 'Failed to complete setup', { id: toastId });
    } finally {
      setIsSaving(false);
      console.log('[SetupWizard] Dismissing toast id', toastId);
      toast.dismiss(toastId);
    }
  };



  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-gray-600">Set your race start time and configure your runners</p>
        <p className="text-gray-500 text-sm mt-1">You can edit this later from the Dashboard</p>
      </div>

      {/* Race Start Time Section */}
      <div className="max-w-sm mx-auto">
        <Card>
          <CardContent className="px-4 py-6">
            <div className="space-y-3">
              <div className="text-center space-y-3">
                <Label>When does your wave start?</Label>
                <div className="flex justify-center">
                  <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DateTimePicker
                      value={selectedDateTime}
                      onChange={handleDateTimeChange}
                      slotProps={{
                        textField: {
                          fullWidth: false,
                          size: 'small',
                          placeholder: 'Select race start date and time',
                          sx: { width: '280px' }
                        }
                      }}
                    />
                  </LocalizationProvider>
                </div>
                {startTime && (
                  <div className="flex items-center justify-center gap-2 text-blue-700 text-sm">
                    <Waves className="h-4 w-4" />
                    <span className="font-medium">Fun starts at {formatRaceTime(startTime)}</span>
                  </div>
                )}
                {startTime && (
                  <div className="text-gray-500 text-xs">
                    {formatDate(startTime)}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Runner Configuration Section */}
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {team?.name ? ` ${team.name}` : 'Welcome'}
          </h1>
        </div>

        {/* Content */}
        {renderStep1()}

        {/* Navigation */}
        <div className="flex justify-center items-center mt-12 max-w-2xl mx-auto">
          <Button
            onClick={handleFinishSetup}
            className="px-6 bg-green-600 hover:bg-green-700"
            disabled={isSaving}
          >
            <Play className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Start Race Tracking'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SetupWizard;
