import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useRaceStore } from '@/store/raceStore';
import { useTeamSync } from '@/hooks/useTeamSync';
import { useSyncManager } from '@/hooks/useSyncManager';
import { useTeam } from '@/contexts/TeamContext';
import { useConflictResolution } from '@/contexts/ConflictResolutionContext';

import {
  getCurrentRunner,
  getNextRunner,
  formatTime,
  formatRaceTime,
  getLegStatus,
  getCountdownTime,
  formatCountdown,
  calculateCurrentDistance,
  calculateActualPace,
  getRunTime,
  formatDuration,
  formatPace,
  calculateTotalDistanceTraveled,
  getEffectiveStartTime
} from '@/utils/raceUtils';
import { getLegDirectionsUrl } from '@/utils/legData';
import { getRandomCelebrationMessage } from '@/utils/celebrationMessages';
import {
  Clock,
  Users,
  Play,
  ArrowRight,
  Edit,
  Settings,
  Trophy,
  MapPin,
  Timer,
  Activity,
  Target,
  Zap,
  CheckCircle,
  Grid3X3,
  List,
  Share2,
  Copy,
  Eye,
  Cloud,
  Clipboard,
  Copy as CopyIcon,
  Undo,
  Download,
  Loader2,
  AlertTriangle,
  HelpCircle
} from 'lucide-react';
import LegScheduleTable from './LegScheduleTable';
import MajorExchanges from './MajorExchanges';
import RaceTimer from './RaceTimer';
import TimePicker from './TimePicker';
import PaceInputModal from './PaceInputModal';
import RunnerAssignmentModal from './RunnerAssignmentModal';
import SyncStatusIndicator from './SyncStatusIndicator';
import { RunnerSyncIntegration } from './RunnerSyncIntegration';
import { toast } from 'sonner';
import TeamSettings from './TeamSettings';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import QuickHelpPopup from './QuickHelpPopup';
import { useQuickHelp } from '@/hooks/useQuickHelp';

import { triggerConfetti, getConfetti } from '@/utils/confetti';

interface DashboardProps {
  isViewOnly?: boolean;
  viewOnlyTeamName?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ isViewOnly = false, viewOnlyTeamName }) => {
  const {
    runners,
    legs,
    currentVan,
    setCurrentVan,
    updateRunner,
    updateLegDistance,
    updateLegActualTime,
    startTime,
    teamId,
    assignRunnerToLegs
  } = useRaceStore();
  const { onConflictDetected } = useConflictResolution();
  const { setupRealtimeSubscriptions, manualRetry } = useSyncManager(onConflictDetected);

  // Ensure realtime subscriptions are active when Dashboard is mounted (but not in view-only mode)
  useEffect(() => {
    if (!teamId || isViewOnly) return;
    const cleanup = setupRealtimeSubscriptions(teamId);
    return cleanup;
  }, [teamId, setupRealtimeSubscriptions, isViewOnly]);

  const { team, updateTeamStartTime } = useTeamSync();
  const { deviceInfo } = useTeam();

  // Determine if user can edit (not in view-only mode and has edit permissions)
  const canEdit = !isViewOnly && (deviceInfo?.role === 'admin' || deviceInfo?.role === 'member');

  // Quick help popup for new team members
  const { shouldShowHelp, dismissHelp } = useQuickHelp();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [editingDistance, setEditingDistance] = useState<number | null>(null);
  const [distanceValue, setDistanceValue] = useState('');
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [runnerEditModalOpen, setRunnerEditModalOpen] = useState(false);
  const [selectedRunner, setSelectedRunner] = useState<number | null>(null);
  const [initialLegId, setInitialLegId] = useState<number | null>(null);
  const [timePickerConfig, setTimePickerConfig] = useState<{
    legId: number;
    field: 'actualStart' | 'actualFinish';
    title: string;
    runnerName: string;
  } | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [isStartingRunner, setIsStartingRunner] = useState(false);

  // Test confetti function for debugging
  const testConfetti = () => {
    console.log('Testing confetti');
    triggerConfetti({ particleCount: 50, spread: 50 });
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Use the actual start of leg 1 if available; otherwise use official team start time or fall back to local start time
  const actualRaceStartTime = legs.length > 0 && legs[0].actualStart
    ? legs[0].actualStart
    : (team?.start_time ? new Date(team.start_time).getTime() : startTime);



  const currentRunner = getCurrentRunner(legs, currentTime);
  const nextRunner = getNextRunner(legs, currentTime);

  const currentRunnerInfo = currentRunner
    ? runners.find(r => r.id === currentRunner.runnerId)
    : null;

  const nextRunnerInfo = nextRunner
    ? runners.find(r => r.id === nextRunner.runnerId)
    : null;

  const getCountdownToNext = () => {
    if (!nextRunner) return null;
    const countdownMs = getCountdownTime(nextRunner, currentTime, legs, actualRaceStartTime);
    return formatCountdown(countdownMs);
  };

  const getNextRunnerPrefix = () => {
    if (!nextRunner || !legs.length) return "Starts in:";
    
    const nextLegIndex = legs.findIndex(leg => leg.id === nextRunner.id);
    if (nextLegIndex <= 0) return "Starts in:";
    
    const prevLeg = legs[nextLegIndex - 1];
    
    if (prevLeg.actualFinish) {
      return "Starts in:";
    } else {
      return "Expected:";
    }
  };

  const getRemainingDistance = () => {
    if (!currentRunner || !currentRunnerInfo) return 0;
    return calculateCurrentDistance(currentRunner, currentRunnerInfo, currentTime.getTime());
  };

  const getRaceProgress = () => {
    const totalLegs = legs.length;
    const completedLegs = legs.filter(leg => leg.actualFinish).length;
    
    let currentLegId;
    if (isRaceComplete()) {
      currentLegId = totalLegs;
    } else if (currentRunner) {
      currentLegId = currentRunner.id;
    } else {
      currentLegId = 0;
    }
    
    return {
      completed: completedLegs,
      total: totalLegs,
      current: currentLegId,
      percentage: totalLegs > 0 ? (completedLegs / totalLegs) * 100 : 0
    };
  };

  const handleStartRunner = async () => {
    if (!canEdit || !nextRunner || isStartingRunner) return;
    
    setIsStartingRunner(true);
    
    try {
      // Trigger confetti
      console.log('Triggering confetti for start runner');
      triggerConfetti({ particleCount: 100, spread: 70 });
      
      // First, finish the current runner if there is one running
      if (currentRunner && currentRunner.actualStart && !currentRunner.actualFinish) {
        updateLegActualTime(currentRunner.id, 'actualFinish', Date.now());
      }
      
      // Then start the next runner
      updateLegActualTime(nextRunner.id, 'actualStart', Date.now());
    } finally {
      // Add a small delay to prevent rapid clicking
      setTimeout(() => {
        setIsStartingRunner(false);
      }, 1000);
    }
  };

  const isRaceComplete = () => {
    if (legs.length === 0) return false;
    const lastLeg = legs[legs.length - 1];
    return lastLeg && lastLeg.actualFinish !== undefined;
  };

  const getFinalRaceTime = () => {
    if (!isRaceComplete()) return null;
    const lastLeg = legs[legs.length - 1];
    return lastLeg.actualFinish! - actualRaceStartTime;
  };

  const copyJoinCode = () => {
    const codeToCopy = team?.join_code || team?.id || teamId;
    if (codeToCopy) {
      if (team?.join_code) {
        // Format for view code: "Use viewer code XXXXXX to watch TEAM NAME run the Hood 2 Coast"
        const teamName = team?.name || 'Team';
        const copyText = `Use viewer code ${team.join_code} to watch ${teamName} run the Hood to Coast!`;
        navigator.clipboard.writeText(copyText);
        toast.success('View code copied to clipboard!');
      } else {
        // Fallback for team ID
        navigator.clipboard.writeText(codeToCopy);
        toast.success('Team ID copied to clipboard');
      }
    } else {
      toast.error('No team code available');
    }
  };

  const handleRunnerEdit = (runnerId: number) => {
    setSelectedRunner(runnerId);
    setRunnerEditModalOpen(true);
  };

  const handleRunnerAssignSave = (
    runnerId: number,
    name: string,
    paceSeconds: number,
    selectedLegIds: number[],
    totalMiles: number
  ) => {
    updateRunner(runnerId, { name, pace: paceSeconds });
    if (selectedLegIds && selectedLegIds.length > 0) {
      assignRunnerToLegs(runnerId, selectedLegIds);
    }
    toast.success(`Saved. ${selectedLegIds.length} leg(s) totalling ${totalMiles} mi assigned.`);
  };

  const handleDistanceEdit = (legId: number) => {
    if (!canEdit) return;
    const leg = legs.find(l => l.id === legId);
    if (leg) {
      setEditingDistance(legId);
      setDistanceValue(leg.distance.toString());
    }
  };

  const handleDistanceSave = () => {
    if (!canEdit || !editingDistance) return;
    const distance = parseFloat(distanceValue);
    if (!isNaN(distance) && distance > 0) {
      updateLegDistance(editingDistance, distance);
      setEditingDistance(null);
    }
  };

  const handleTimeEdit = (legId: number, field: 'actualStart' | 'actualFinish') => {
    if (!canEdit) return;
    const leg = legs.find(l => l.id === legId);
    const runner = leg ? runners.find(r => r.id === leg.runnerId) : null;

    if (leg && runner) {
      setTimePickerConfig({
        legId,
        field,
        title: field === 'actualStart' ? `Record Start Time - Leg ${legId}` : `Record Finish Time - Leg ${legId}`,
        runnerName: runner.name
      });
      setTimePickerOpen(true);
    }
  };

  const handleTimeSubmit = async (timestamp: number) => {
    if (!timePickerConfig) return;
    
    updateLegActualTime(timePickerConfig.legId, timePickerConfig.field, timestamp);
    setTimePickerOpen(false);
    setTimePickerConfig(null);
  };

  const progress = getRaceProgress();

  return (
    <>
      <div className="relative min-h-screen bg-background pb-4 overflow-hidden">
        {/* Site-wide pulsing gradient background (intensified) */}
        <div className="pointer-events-none fixed inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 via-blue-600/5 to-purple-700/10 animate-pulse" style={{ animationDuration: '10s' }} />
          <div className="absolute -top-24 -left-24 h-72 w-72 bg-indigo-600/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-80 w-80 bg-purple-500/5 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 container mx-auto px-2 sm:px-3 lg:px-4 lg:pb-4 space-y-4 lg:space-y-5">
          {/* Enhanced Header with Sync Status */}
          <div className="text-center space-y-3">
            <div className="mb-2">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                {isViewOnly && viewOnlyTeamName ? viewOnlyTeamName : (team?.name || 'Team Name')}
              </h1>
            </div>

            {/* Race Progress Bar */}
            <div className="max-w-xl mx-auto bg-card backdrop-blur-sm rounded-lg p-3 shadow-md border border-border">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-foreground">Progress</span>
                <span className="text-xs font-bold text-primary">
                  Leg {progress.current}/{progress.total}
                </span>
                <span className={`text-sm font-bold ${
                  isRaceComplete() ? 'text-green-600' : 'text-foreground'
                }`}>
                  {isRaceComplete() 
                    ? formatDuration(getFinalRaceTime()!)
                    : formatDuration(Math.max(0, currentTime.getTime() - actualRaceStartTime))
                  }
                  
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 progress-shimmer">
                <div
                  className="h-2 rounded-full transition-all duration-500 relative overflow-hidden bg-gradient-to-r from-green-500 to-blue-500"
                  style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
              </div>
              <div className="grid grid-cols-3 items-center mt-2">
                <div className="justify-self-start text-left">
                  <div className="text-sm font-bold text-foreground">
                    {formatRaceTime(actualRaceStartTime)}
                  </div>
                  <div className="flex items-center justify-start gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Start</span>
                  </div>
                </div>
                <div className="justify-self-center text-center">
                  <div className="flex items-center justify-center">
                    <SyncStatusIndicator />
                  </div>
                </div>
                <div className="justify-self-end text-right">
                  <div className="text-sm font-bold text-primary">
                    {calculateTotalDistanceTraveled(legs).toFixed(1)} mi
                  </div>
                  <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>Distance</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Current Status Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
            {/* Current Runner Card */}
            <Card className="group relative overflow-hidden border-border shadow-2xl bg-card">
              <div className="absolute inset-0 bg-green-500 h-1"></div>

              <div className="p-2 sm:p-3 md:p-4 bg-green-500/10 rounded-b-none rounded-lg">
                <div className="space-y-4">
                  {currentRunner && currentRunnerInfo ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-2xl font-bold text-foreground">
                          {currentRunnerInfo.name}
                        </h3>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <Users className="h-4 w-4" />
                          <span>Van {currentRunnerInfo.van}</span>
                        </div>
                      </div>
                      <div className="text-center">
                        <Badge className="bg-green-500 animate-pulse text-white text-sm px-3 py-1 font-semibold mb-2">
                          Leg {currentRunner.id}
                        </Badge>
                        <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                          <Target className="h-4 w-4" />
                          <span>{formatPace((currentRunner as any).paceOverride ?? currentRunnerInfo.pace)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-2xl font-bold text-muted-foreground">
                          No Active Runner
                        </h3>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <Clock className="h-4 w-4" />
                          <span>Waiting for next leg</span>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="w-12 h-8 rounded flex items-center justify-center mb-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                          <span>--</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <CardContent className="pt-4">
                <div className="space-y-4">
                  {currentRunner && currentRunnerInfo ? (
                    <>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-foreground mb-2">
                            {currentRunner.distance} mi
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                            <MapPin className="h-4 w-4" />
                            Distance
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-green-500 mb-2">
                            {(() => {
                              if (!currentRunner || !currentRunnerInfo) return '--';
                              const startTime = currentRunner.actualStart || currentRunner.projectedStart;
                              return formatDuration(currentTime.getTime() - startTime);
                            })()}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                            <Timer className="h-4 w-4" />
                            Running Time
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="w-full bg-muted rounded-full h-3 progress-shimmer">
                          <div
                            className="bg-green-500 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(0, ((currentRunner.distance - getRemainingDistance()) / currentRunner.distance) * 100)}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between items-baseline text-base font-bold text-foreground">
                          <span>
                            {formatRaceTime(currentRunner.actualStart || currentRunner.projectedStart)}
                          </span>
                          <span className="text-green-500">
                            ~{getRemainingDistance().toFixed(1)} miles left
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-muted-foreground mb-2">
                            --
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                            <MapPin className="h-4 w-4" />
                            Distance
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-muted-foreground mb-2">
                            --
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                            <Timer className="h-4 w-4" />
                            Running Time
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="w-full bg-muted rounded-full h-3">
                          <div className="bg-muted h-3 rounded-full"></div>
                        </div>
                        <div className="flex justify-between items-baseline text-base font-bold text-muted-foreground">
                          <span>--</span>
                          <span>--</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Next Runner Card - Restored blue styling */}
            <Card className="group relative overflow-hidden border-border shadow-2xl bg-card">
              <div className="absolute inset-0 bg-blue-500 h-1"></div>

              <div className="p-2 sm:p-3 md:p-4 bg-blue-500/10 rounded-b-none rounded-lg">
                {(() => {
                  // Check if race is completed (leg 36 has actual finish time)
                  const leg36 = legs.find(leg => leg.id === 36);
                  const isRaceCompleted = leg36?.actualFinish;
                  
                  // Show race completed content only if leg 36 is finished
                  if (isRaceCompleted) {
                    return false; // This will trigger the else block with race completed content
                  }
                  
                  // Show next runner content if there is a next runner OR if leg 36 is currently running
                  return (nextRunner && nextRunnerInfo) || (leg36?.actualStart && !leg36?.actualFinish);
                })() ? (
                  <div className="space-y-4">
                    {(() => {
                      const leg36 = legs.find(leg => leg.id === 36);
                      const isLeg36Running = leg36?.actualStart && !leg36?.actualFinish;
                      
                      // If leg 36 is running and there's no next runner, show special content
                      if (isLeg36Running && !nextRunner) {
                        const leg36Runner = runners.find(r => r.id === leg36.runnerId);
                        return (
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-2xl font-bold text-foreground">
                                {'Hood 2 Coast 2025!'}
                              </h3>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                <Users className="h-4 w-4" />
                                <span>PARTY BUS</span>
                              </div>
                            </div>
                            <div className="text-center">
                              <Badge className="bg-red-500 text-white text-sm px-3 py-1 font-semibold mb-2">
                                <Trophy className="h-4 w-4 mr-0.5" />
                                Finish
                              </Badge>
                              <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                                <Target className="h-4 w-4" />
                                <span>20:25</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      
                      // Otherwise show next runner content
                      return (
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-2xl font-bold text-foreground">
                              {nextRunnerInfo.name}
                            </h3>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                              <Users className="h-4 w-4" />
                              <span>Van {nextRunnerInfo.van}</span>
                            </div>
                          </div>
                          <div className="text-center">
                            <Badge 
                              onClick={() => {
                                const directionsUrl = getLegDirectionsUrl(nextRunner.id);
                                window.open(directionsUrl, '_blank');
                              }}
                              className="bg-blue-500 text-white text-sm px-3 py-1 font-semibold mb-2 cursor-pointer hover:bg-blue-600 transition-colors duration-200"
                            >
                              <MapPin className="h-4 w-4 mr-0.5" />
                              Leg {nextRunner.id}
                            </Badge>
                            <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                              <Target className="h-4 w-4" />
                              <span>{formatPace((nextRunner as any).paceOverride ?? nextRunnerInfo.pace)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="text-center py-8">

                    <p className="text-3xl font-bold text-green-500 mb-2">Happy Hood 2 Coast 2025!</p>
                    
                    {/* Race Stats */}
                    <div className="space-y-3 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <div className="text-lg font-bold text-foreground">
                            {(() => {
                              const completedLegs = legs.filter(leg => leg.actualFinish);
                              if (completedLegs.length === 0) return '--';
                              
                              const totalPace = completedLegs.reduce((sum, leg) => {
                                const runTime = leg.actualFinish! - leg.actualStart!;
                                const paceSeconds = runTime / (leg.distance * 1000); // Convert to seconds per mile
                                return sum + paceSeconds;
                              }, 0);
                              
                              const avgPaceSeconds = totalPace / completedLegs.length;
                              return formatPace(avgPaceSeconds);
                            })()}
                          </div>
                          <div className="text-xs text-muted-foreground">Team Avg Pace</div>
                        </div>
                        
                        <div className="text-center">
                          <div className="text-lg font-bold text-foreground">
                            {(() => {
                              const completedLegs = legs.filter(leg => leg.actualFinish);
                              if (completedLegs.length === 0) return '--';
                              
                              let fastestPace = Infinity;
                              let fastestLeg = null;
                              
                              completedLegs.forEach(leg => {
                                const runTime = leg.actualFinish! - leg.actualStart!;
                                const paceSeconds = runTime / (leg.distance * 1000);
                                if (paceSeconds < fastestPace) {
                                  fastestPace = paceSeconds;
                                  fastestLeg = leg;
                                }
                              });
                              
                              return fastestPace !== Infinity ? formatPace(fastestPace) : '--';
                            })()}
                          </div>
                          <div className="text-xs text-muted-foreground">Fastest Leg</div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-center gap-2 mt-4">
                        <Button
                          onClick={() => {
                            console.log('Triggering confetti for celebrate');
                            triggerConfetti({ particleCount: 150, spread: 80 });
                            toast(getRandomCelebrationMessage());
                          }}
                          size="sm"
                          className="bg-green-500 hover:bg-green-600 text-white"
                        >
                          🎉 Celebrate
                        </Button>
                        
                        <Button
                          onClick={() => {
                            // Export functionality would go here
                            toast.success('Export feature coming soon!');
                          }}
                          size="sm"
                          className="bg-blue-500 hover:bg-blue-600 text-white"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export Results
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <CardContent className="pt-4">
                {(() => {
                  // Check if race is completed (leg 36 has actual finish time)
                  const leg36 = legs.find(leg => leg.id === 36);
                  const isRaceCompleted = leg36?.actualFinish;
                  
                  // Show race completed content only if leg 36 is finished
                  if (isRaceCompleted) {
                    return false; // This will trigger the else block with race completed content
                  }
                  
                  // Show next runner content if there is a next runner OR if leg 36 is currently running
                  return (nextRunner && nextRunnerInfo) || (leg36?.actualStart && !leg36?.actualFinish);
                })() ? (
                  <div className="space-y-4">
                    {(() => {
                      const leg36 = legs.find(leg => leg.id === 36);
                      const isLeg36Running = leg36?.actualStart && !leg36?.actualFinish;
                      
                      // If leg 36 is running and there's no next runner, show special content
                      if (isLeg36Running && !nextRunner) {
                        return (
                        <div className="text-center">
                        <div className="text-4xl font-bold text-foreground">
                           See ya at the next one!
                        </div>
                        </div>
                        );
                      }
                      
                      // Otherwise show next runner content
                      return (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center">
                            <div className="text-3xl font-bold text-foreground mb-2">
                              {nextRunner.distance} mi
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                              <MapPin className="h-4 w-4" />
                              Distance
                            </div>
                          </div>

                          <div className="text-center">
                            <div className="text-3xl font-bold text-foreground mb-2">
                              {(() => {
                                const isBeforeRaceStart = currentTime.getTime() < actualRaceStartTime;
                                const isFirstLeg = nextRunner && nextRunner.id === 1;
                                
                                // Before race starts, show official start time for leg 1
                                if (isFirstLeg && isBeforeRaceStart) {
                                  return formatRaceTime(actualRaceStartTime);
                                }
                                
                                // For other legs or after race starts, use effective start time
                                return formatRaceTime(getEffectiveStartTime(nextRunner, legs, actualRaceStartTime));
                              })()}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                              <Target className="h-4 w-4" />
                              {(() => {
                                const isBeforeRaceStart = currentTime.getTime() < actualRaceStartTime;
                                const isFirstLeg = nextRunner && nextRunner.id === 1;
                                
                                if (isFirstLeg && isBeforeRaceStart) {
                                  return 'Official Start';
                                }
                                return 'Projected Start';
                              })()}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="space-y-2">
                      <div className="w-full h-3 flex items-center">
                        <div className="w-full h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>
                      </div>
                      <div className="flex justify-between items-baseline text-base font-bold text-foreground">
                        <span className="text-blue-500">
                          {(() => {
                            const leg36 = legs.find(leg => leg.id === 36);
                            const isLeg36Running = leg36?.actualStart && !leg36?.actualFinish;
                            
                            // If leg 36 is running and there's no next runner, show special message
                            if (isLeg36Running && !nextRunner) {
                              return 'Final leg in progress - almost there!';
                            }
                            
                            const isBeforeRaceStart = currentTime.getTime() < actualRaceStartTime;
                            const isFirstLeg = nextRunner && nextRunner.id === 1;
                            if (isFirstLeg && isBeforeRaceStart) {
                              return 'First runner will start automatically';
                            }
                            return `${getNextRunnerPrefix()} ${getCountdownToNext()}`;
                          })()}
                        </span>
                        {(() => {
                          const leg36 = legs.find(leg => leg.id === 36);
                          const isLeg36Running = leg36?.actualStart && !leg36?.actualFinish;
                          
                          // If leg 36 is running and there's no next runner, only show Finish Race button
                          if (isLeg36Running && !nextRunner) {
                            return (
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => {
                                    updateLegActualTime(36, 'actualFinish', Date.now());
                                    console.log('Triggering confetti for finish race');
                                    triggerConfetti({ particleCount: 200, spread: 100 });
                                  }}
                                  size="sm"
                                  className="font-semibold px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white"
                                >
                                  <Trophy className="h-4 w-4" />
                                  Finish Race
                                </Button>
                              </div>
                            );
                          }
                          
                          // Otherwise show next runner buttons
                          return nextRunner && (
                            <div className="flex gap-2">
                              <Button
                                onClick={handleStartRunner}
                                disabled={!canEdit || isStartingRunner}
                                size="sm"
                                className={`start-runner-button font-semibold px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2 ${
                                  canEdit && !isStartingRunner
                                    ? 'bg-green-500 hover:bg-green-600 text-white' 
                                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                }`}
                              >
                                {isStartingRunner ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                                {isStartingRunner ? 'Starting...' : 'Start Runner'}
                              </Button>
                              
                              {/* Finish Race Button - only show when leg 36 is currently running */}
                              {(() => {
                                const leg36 = legs.find(leg => leg.id === 36);
                                return leg36?.actualStart && !leg36?.actualFinish && canEdit;
                              })() && (
                                <Button
                                  onClick={() => {
                                    updateLegActualTime(36, 'actualFinish', Date.now());
                                    console.log('Triggering confetti for finish race');
                                    triggerConfetti({ particleCount: 200, spread: 100 });
                                  }}
                                  size="sm"
                                  className="font-semibold px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white"
                                >
                                  <Trophy className="h-4 w-4" />
                                  Finish Race
                                </Button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {/* Major Exchanges */}
          <div className="w-full">
            <MajorExchanges />
          </div>

          {/* Enhanced Van Toggle */}
          <div className="flex justify-center">
            <Card className="bg-card shadow-lg border-border p-2">
              <div className="relative overflow-hidden bg-muted/70 rounded-lg p-1 border border-border">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/15 via-blue-500/10 to-purple-500/15" />
                <div className="relative flex">
                  <Button
                    variant={currentVan === 1 ? "default" : "ghost"}
                    size="lg"
                    onClick={() => setCurrentVan(1)}
                    className={`relative px-6 py-2 font-semibold transition-all duration-200 ${
                      currentVan === 1
                        ? 'bg-primary text-primary-foreground shadow-lg transform scale-105'
                        : 'text-foreground hover:bg-secondary'
                    }`}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Van 1
                  </Button>
                  <Button
                    variant={currentVan === 2 ? "default" : "ghost"}
                    size="lg"
                    onClick={() => setCurrentVan(2)}
                    className={`relative px-6 py-2 font-semibold transition-all duration-200 ${
                      currentVan === 2
                        ? 'bg-primary text-primary-foreground shadow-lg transform scale-105'
                        : 'text-foreground hover:bg-secondary'
                    }`}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Van 2
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Leg Schedule Table */}
          <Card className="shadow-lg border-0 overflow-hidden bg-card">
            <CardHeader className="relative overflow-hidden bg-muted/70 text-foreground border-b border-border py-2 sm:py-3 md:py-4">
              <div className="absolute inset-0 bg-blue-500/20" />
              <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-3">
                  <CardTitle className="text-lg font-bold flex items-center gap-3">
                    <div className="p-2 bg-muted-foreground/10 backdrop-blur-sm rounded-lg">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Van {currentVan} Schedule & Progress</h2>
                      <p className="text-sm text-muted-foreground font-normal">Race Schedule</p>
                    </div>
                  </CardTitle>
                  
                  {/* Stats */}
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 bg-secondary text-secondary-foreground px-2.5 py-1.5 rounded-lg text-xs font-medium shadow-sm">
                      <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                      {legs.filter(leg => runners.find(r => r.id === leg.runnerId && r.van === currentVan) && leg.actualFinish).length} done
                    </div>
                    {legs.filter(leg => runners.find(r => r.id === leg.runnerId && r.van === currentVan) && leg.actualStart && !leg.actualFinish).length > 0 && (
                      <div className="flex items-center gap-1.5 bg-secondary text-secondary-foreground px-2.5 py-1.5 rounded-lg text-xs font-medium shadow-sm">
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                        {legs.filter(leg => runners.find(r => r.id === leg.runnerId && r.van === currentVan) && leg.actualStart && !leg.actualFinish).length} running
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 bg-secondary text-secondary-foreground px-2.5 py-1.5 rounded-lg text-xs font-medium shadow-sm">
                      <Activity className="h-3.5 w-3.5 text-blue-500" />
                      {legs.filter(leg => runners.find(r => r.id === leg.runnerId && r.van === currentVan)).length} total
                    </div>
                  </div>
                </div>
                
                {/* View Toggle - moved here */}
                <div className="flex bg-muted/60 backdrop-blur-sm rounded-lg p-1">
                  <Button
                    variant={viewMode === 'cards' ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode('cards')}
                    className={`px-3 text-xs h-8 transition-all duration-200 ${
                      viewMode === 'cards'
                        ? 'bg-primary text-primary-foreground shadow-md font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                    }`}
                  >
                    <Grid3X3 className="h-3 w-3 mr-1.5" />
                    Cards
                  </Button>
                  <Button
                    variant={viewMode === 'table' ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode('table')}
                    className={`px-3 text-xs h-8 transition-all duration-200 ${
                      viewMode === 'table'
                        ? 'bg-primary text-primary-foreground shadow-md font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                    }`}
                  >
                    <List className="h-3 w-3 mr-1.5" />
                    Table
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <LegScheduleTable 
                viewMode={viewMode}
                isViewOnly={isViewOnly}
                onRunnerClick={canEdit ? (runnerId, legId) => {
                  setSelectedRunner(runnerId);
                  setInitialLegId(legId);
                  setRunnerEditModalOpen(true);
                } : undefined}
              />
            </CardContent>
          </Card>
        </div>
        {/* Footer */}
        <footer className="left-0 right-0 backdrop-blur z-50 border-t border-border">
          <div className="container mx-auto px-3 py-4">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
              {/* Left side - Settings, Sync, and Join Code */}
              <div className="flex items-center gap-2">
                {/* Settings button - hidden in view-only mode */}
                {canEdit && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setSettingsModalOpen(true)}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                                  )}

                {/* Join Code Button */}
                {team?.join_code && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyJoinCode}
                    title={`Click to copy ${isViewOnly ? 'viewer code' : 'join code'}`}
                  >
                    <Eye className="h-4 w-4 mr-0.5" />
                    {team.join_code}
                  </Button>
                )}

                {/* View Only Button - Eye Icon */}
                {isViewOnly && (
                  <Button
                    variant="outline"
                    size="sm"
                    title="View Only Mode"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}

                {/* Invite Token Copy Button */}
                {team?.invite_token && canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const teamName = team?.name || 'Team';
                      const copyText = `Join ${teamName}\nJoin Token: ${team.invite_token}`;
                      navigator.clipboard.writeText(copyText);
                      toast.success('Team invite copied to clipboard');
                    }}
                    title="Copy team invite"
                  >
                    <Users className="h-4 w-4 mr-1" />
                    Invite
                  </Button>
                )}
              </div>
              
              {/* Right side - Fallback share button - hidden in view-only mode */}
              {canEdit && (
                <div className="flex items-center gap-2">
                  {!team?.join_code && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyJoinCode}
                      className="h-9 px-4"
                      aria-label="Copy team join code"
                    >
                      <Share2 className="h-4 w-4 mr-1" />
                      Share w/ Teammates
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </footer>
      </div>

      {/* Existing Leg Time Picker */}
      {timePickerConfig && (
        <TimePicker
          isOpen={timePickerOpen}
          onClose={() => {
            setTimePickerOpen(false);
            setTimePickerConfig(null);
          }}
          onTimeSelect={handleTimeSubmit}
          title={timePickerConfig.title}
          runnerName={timePickerConfig.runnerName}
          initialTime={Date.now()}
        />
      )}

      <RunnerAssignmentModal
        isOpen={runnerEditModalOpen}
        onClose={() => {
          setRunnerEditModalOpen(false);
          setSelectedRunner(null);
          setInitialLegId(null);
        }}
        runner={selectedRunner ? runners.find(r => r.id === selectedRunner) || null : null}
        initialLegId={initialLegId ?? undefined}
        onSave={handleRunnerAssignSave}
      />

      {/* Team Settings Modal */}
      <Dialog open={settingsModalOpen} onOpenChange={setSettingsModalOpen}>
        <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-2xl rounded-lg p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <div className="space-y-6">
            <TeamSettings onClose={() => setSettingsModalOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Real-time database sync integration */}
      <RunnerSyncIntegration />

      {/* Quick Help Popup for new team members */}
      <QuickHelpPopup 
        isOpen={shouldShowHelp && !isViewOnly} 
        onClose={dismissHelp} 
      />
    </>
  );
};

export default Dashboard;



