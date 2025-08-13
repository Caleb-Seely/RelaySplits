import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useRaceStore } from '@/store/raceStore';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamSync } from '@/hooks/useTeamSync';
import {
  getCurrentRunner,
  getNextRunner,
  formatTime,
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
  Copy,
  LogOut,
  Share2
} from 'lucide-react';
import LegScheduleTable from './LegScheduleTable';
import MajorExchanges from './MajorExchanges';
import RaceTimer from './RaceTimer';
import TimePicker from './TimePicker';
import PaceInputModal from './PaceInputModal';
import RunnerAssignmentModal from './RunnerAssignmentModal';
import SyncStatusIndicator from './SyncStatusIndicator';
import { toast } from 'sonner';

const Dashboard = () => {
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

  const { signOut } = useAuth();
  const { team, updateTeamStartTime } = useTeamSync();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [editingDistance, setEditingDistance] = useState<number | null>(null);
  const [distanceValue, setDistanceValue] = useState('');
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [startTimePickerOpen, setStartTimePickerOpen] = useState(false);
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

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Use the actual start of leg 1 if available; otherwise fall back to scheduled race start
  const actualRaceStartTime = legs.length > 0 && legs[0].actualStart
    ? legs[0].actualStart
    : startTime;

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
    const countdownMs = getCountdownTime(nextRunner, currentTime, legs);
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
      currentLegId = completedLegs + 1;
    }
    
    return { completed: completedLegs, total: totalLegs, current: currentLegId };
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

  const copyTeamId = () => {
    const idToCopy = team?.id || teamId;
    if (idToCopy) {
      navigator.clipboard.writeText(idToCopy);
      toast.success('Team ID copied to clipboard');
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
    const leg = legs.find(l => l.id === legId);
    if (leg) {
      setEditingDistance(legId);
      setDistanceValue(leg.distance.toString());
    }
  };

  const handleDistanceSave = () => {
    if (!editingDistance) return;
    const distance = parseFloat(distanceValue);
    if (!isNaN(distance) && distance > 0) {
      updateLegDistance(editingDistance, distance);
      setEditingDistance(null);
    }
  };

  const handleTimeEdit = (legId: number, field: 'actualStart' | 'actualFinish') => {
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

  const handleTimeSubmit = (timestamp: number) => {
    if (timePickerConfig) {
      updateLegActualTime(timePickerConfig.legId, timePickerConfig.field, timestamp);
    }
    setTimePickerOpen(false);
    setTimePickerConfig(null);
  };

  const handleStartTimeSubmit = async (timestamp: number) => {
    // Update local projections/store first
    useRaceStore.getState().setStartTime(timestamp);
    // Persist to team if available
    if (updateTeamStartTime) {
      await updateTeamStartTime(new Date(timestamp));
    }
    toast.success('Official team start time updated');
    setStartTimePickerOpen(false);
  };

  const progress = getRaceProgress();

  return (
    <>
      <div className="min-h-screen bg-background pb-4">
        <div className="container mx-auto px-3 lg:px-4 lg:pb-4 space-y-4 lg:space-y-5">
          {/* Enhanced Header with Sync Status */}
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2 mb-2">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                {team?.name || 'Team Name'}
              </h1>
              <Button
                variant="outline"
                size="sm"
                onClick={copyTeamId}
                className="h-8 px-3"
                aria-label="Share Team ID"
              >
                <Share2 className="h-4 w-4 mr-1" />
                Share
              </Button>
            </div>

            {/* Race Progress Bar */}
            <div className="max-w-xl mx-auto bg-card backdrop-blur-sm rounded-lg p-3 shadow-md border border-border">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-foreground">Progress</span>
                <span className="text-xs font-bold text-primary">
                  Leg {progress.current}/{progress.total}
                </span>
                <span className={`text-sm font-bold ${
                  isRaceComplete() ? 'text-green-400' : 'text-foreground'
                }`}>
                  {isRaceComplete() 
                    ? formatDuration(getFinalRaceTime()!)
                    : formatDuration(Math.max(0, currentTime.getTime() - actualRaceStartTime))
                  }
                  {isRaceComplete() && (
                    <span className="ml-1 text-xs text-green-400">FINAL</span>
                  )}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-500 relative overflow-hidden"
                  style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                >
                  <div className="absolute inset-0 bg-primary-foreground/30 animate-pulse" />
                </div>
              </div>
              <div className="grid grid-cols-3 items-center mt-2">
                <button
                  type="button"
                  onClick={() => setStartTimePickerOpen(true)}
                  className="justify-self-start text-left group focus:outline-none"
                  aria-label="Edit official team start time"
                >
                  <div className="text-sm font-bold text-foreground underline decoration-dotted underline-offset-2 group-hover:text-primary">
                    {formatTime(actualRaceStartTime)}
                  </div>
                  <div className="flex items-center justify-start gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Start</span>
                  </div>
                </button>
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
                    <MapPin className="h-3 w-3" />
                    <span>Distance</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Current Status Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Current Runner Card */}
            <Card className="group relative overflow-hidden border-border shadow-2xl bg-card">
              <div className="absolute inset-0 bg-green-500 h-1"></div>

              <div className="p-4 bg-green-500/10 rounded-b-none rounded-lg">
                {currentRunner && currentRunnerInfo ? (
                  <div className="space-y-4">
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
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                      <Clock className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground font-medium">No runner currently active</p>
                    <p className="text-sm text-muted-foreground mt-1">Waiting for next leg to begin</p>
                  </div>
                )}
              </div>

              <CardContent className="pt-4">
                {
                  currentRunner && currentRunnerInfo ? (
                  <div className="space-y-4">
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
                      <div className="w-full bg-muted rounded-full h-3">
                        <div
                          className="bg-green-500 h-3 rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(0, ((currentRunner.distance - getRemainingDistance()) / currentRunner.distance) * 100)}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between items-baseline text-base font-bold text-foreground">
                        <span>
                          Started: {formatTime(currentRunner.actualStart || currentRunner.projectedStart)}
                        </span>
                        <span className="text-green-500">
                          {getRemainingDistance().toFixed(1)} miles remaining
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null
                }
              </CardContent>
            </Card>

            {/* Next Runner Card - Restored blue styling */}
            <Card className="group relative overflow-hidden border-border shadow-2xl bg-card">
              <div className="absolute inset-0 bg-blue-500 h-1"></div>

              <div className="p-4 bg-blue-500/10 rounded-b-none rounded-lg">
                {nextRunner && nextRunnerInfo ? (
                  <div className="space-y-4">
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
                        <Badge className="bg-blue-500 text-white text-sm px-3 py-1 font-semibold mb-2">
                          Leg {nextRunner.id}
                        </Badge>
                        <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                          <Target className="h-4 w-4" />
                          <span>{formatPace((nextRunner as any).paceOverride ?? nextRunnerInfo.pace)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
                      <Trophy className="h-8 w-8 text-green-500" />
                    </div>
                    <p className="text-xl font-bold text-green-500 mb-2">Race Completed!</p>
                    <p className="text-sm text-muted-foreground">Congratulations on finishing</p>
                  </div>
                )}
              </div>

              <CardContent className="pt-4">
                {nextRunner && nextRunnerInfo ? (
                  <div className="space-y-4">
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
                          {formatTime(nextRunner.projectedStart)}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                          <Target className="h-4 w-4" />
                          Projected Start
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="w-full h-3 flex items-center">
                        <div className="w-full h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>
                      </div>
                      <div className="flex justify-between items-baseline text-base font-bold text-foreground">
                        <span className="text-blue-500">
                          {(() => {
                            const isBeforeRaceStart = currentTime.getTime() < actualRaceStartTime;
                            const isFirstLeg = nextRunner && nextRunner.id === 1;
                            if (isFirstLeg && isBeforeRaceStart) {
                              return 'First runner will start automatically';
                            }
                            return `${getNextRunnerPrefix()} ${getCountdownToNext()}`;
                          })()}
                        </span>
                        {nextRunner && (
                          <Button
                            onClick={() => {
                              const now = Date.now();
                              // If there is a current runner active, end them first
                              if (currentRunner && currentRunner.actualStart && !currentRunner.actualFinish) {
                                updateLegActualTime(currentRunner.id, 'actualFinish', now);
                              }
                              // Start the next runner
                              updateLegActualTime(nextRunner.id, 'actualStart', now);
                            }}
                            size="sm"
                            className="bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
                          >
                            <Play className="h-4 w-4" />
                            Start Runner
                          </Button>
                        )}
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
              <div className="flex bg-muted rounded-lg p-1">
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
            </Card>
          </div>

          {/* Compact Leg Schedule Table */}
          <Card className="shadow-lg border-0 overflow-hidden bg-card">
            <CardHeader className="bg-primary text-primary-foreground py-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-3">
                  <CardTitle className="text-lg font-bold flex items-center gap-3">
                    <div className="p-2 bg-primary-foreground/20 backdrop-blur-sm rounded-lg">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Van {currentVan} Schedule & Progress</h2>
                      <p className="text-sm text-primary-foreground/80 font-normal">Race Schedule</p>
                    </div>
                  </CardTitle>
                  
                  {/* Compact Stats */}
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
                <div className="flex bg-primary-foreground/20 backdrop-blur-sm rounded-lg p-1">
                  <Button
                    variant={viewMode === 'cards' ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode('cards')}
                    className={`px-3 text-xs h-8 transition-all duration-200 ${
                      viewMode === 'cards'
                        ? 'bg-primary-foreground/30 text-primary-foreground shadow-md'
                        : 'text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/20'
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
                        ? 'bg-primary-foreground/30 text-primary-foreground shadow-md'
                        : 'text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/20'
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
                onRunnerClick={(runnerId, legId) => {
                  setSelectedRunner(runnerId);
                  setInitialLegId(legId);
                  setRunnerEditModalOpen(true);
                }}
              />
            </CardContent>
          </Card>
        </div>
        {/* Footer */}
        <footer className="left-0 right-0 border-t bg-background/80 backdrop-blur z-50">
          <div className="container mx-auto px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={signOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
              <div className="flex-1" />
            </div>
          </div>
        </footer>
      </div>

      {/* Team Start Time Picker */}
      <TimePicker
        isOpen={startTimePickerOpen}
        onClose={() => setStartTimePickerOpen(false)}
        onTimeSelect={handleStartTimeSubmit}
        title="Set Official Team Start Time"
        initialTime={startTime}
      />

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
    </>
  );
};

export default Dashboard;
