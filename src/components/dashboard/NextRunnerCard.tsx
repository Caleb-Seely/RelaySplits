import React from 'react';
import { Users, Target, MapPin, Trophy, Play, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPace, formatRaceTime } from '@/utils/raceUtils';
import { getLegDirectionsUrl } from '@/utils/legData';
import { getRandomCelebrationMessage } from '@/utils/celebrationMessages';
import { triggerConfetti } from '@/utils/confetti';

interface NextRunnerCardProps {
  nextRunner: any;
  nextRunnerInfo: any;
  currentTime: Date;
  actualRaceStartTime: number | null;
  legs: any[];
  isNextRunnerLoading: boolean;
  isDataLoading: boolean;
  isRaceComplete: () => boolean;
  canEdit: boolean;
  isStartingRunner: boolean;
  onStartRunner: () => void;
  onFinishRace: () => void;
  onCelebrate: () => void;
  getCountdownToNext: () => string | null;
  getNextRunnerPrefix: () => string;
  getEffectiveStartTime: (runner: any, legs: any[], startTime: number) => number;
  teamId: string;
}

const NextRunnerCard: React.FC<NextRunnerCardProps> = ({
  nextRunner,
  nextRunnerInfo,
  currentTime,
  actualRaceStartTime,
  legs,
  isNextRunnerLoading,
  isDataLoading,
  isRaceComplete,
  canEdit,
  isStartingRunner,
  onStartRunner,
  onFinishRace,
  onCelebrate,
  getCountdownToNext,
  getNextRunnerPrefix,
  getEffectiveStartTime,
  teamId
}) => {
  const shouldShowNextRunnerContent = () => {
    if (isDataLoading) return false;
    
    const leg36 = legs.find(leg => leg.id === 36);
    const isRaceCompleted = leg36?.actualFinish && leg36?.actualStart;
    
    const isValidCompletion = isRaceCompleted && 
      leg36 && leg36.actualFinish && leg36.actualStart &&
      leg36.actualFinish > leg36.actualStart && 
      leg36.actualFinish <= Date.now();
    
    if (isValidCompletion) return false;
    
    return (nextRunner && nextRunnerInfo) || 
           (leg36?.actualStart && !leg36?.actualFinish) ||
           (legs.length > 0 && !nextRunner) ||
           (legs.length > 0 && nextRunner && !nextRunnerInfo);
  };

  const shouldShowRaceCompletionContent = () => {
    if (isDataLoading) return false;
    
    const leg36 = legs.find(leg => leg.id === 36);
    const isRaceCompleted = leg36?.actualFinish && leg36?.actualStart;
    
    return isRaceCompleted && 
      leg36 && leg36.actualFinish && leg36.actualStart &&
      leg36.actualFinish > leg36.actualStart && 
      leg36.actualFinish <= Date.now();
  };

  const getTeamStats = () => {
    const completedLegs = legs.filter(leg => leg.actualFinish);
    if (completedLegs.length === 0) return { avgPace: '--', fastestPace: '--' };
    
    // Calculate average pace
    const totalPace = completedLegs.reduce((sum, leg) => {
      const runTime = leg.actualFinish! - leg.actualStart!;
      const paceSeconds = runTime / (leg.distance * 1000);
      return sum + paceSeconds;
    }, 0);
    const avgPaceSeconds = totalPace / completedLegs.length;
    
    // Calculate fastest pace
    let fastestPace = Infinity;
    completedLegs.forEach(leg => {
      const runTime = leg.actualFinish! - leg.actualStart!;
      const paceSeconds = runTime / (leg.distance * 1000);
      if (paceSeconds < fastestPace) {
        fastestPace = paceSeconds;
      }
    });
    
    return {
      avgPace: formatPace(avgPaceSeconds),
      fastestPace: fastestPace !== Infinity ? formatPace(fastestPace) : '--'
    };
  };

  return (
    <Card className="group relative overflow-hidden border-border shadow-2xl bg-card">
      <div className="absolute inset-0 bg-blue-500 h-1"></div>

      <div className="p-2 sm:p-3 md:p-4 bg-blue-500/10 rounded-b-none rounded-lg">
        {isNextRunnerLoading ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-8 w-32 mb-2" />
                <div className="flex items-center gap-1">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
              <div className="text-center">
                <Skeleton className="h-6 w-20 mb-2" />
                <div className="flex items-center justify-center gap-1">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-12" />
                </div>
              </div>
            </div>
          </div>
        ) : shouldShowNextRunnerContent() ? (
          <div className="space-y-4">
            {(() => {
              const leg36 = legs.find(leg => leg.id === 36);
              const isLeg36Running = leg36?.actualStart && !leg36?.actualFinish;
              
              if (isLeg36Running && !nextRunner) {
                const leg36Runner = legs.find(r => r.id === leg36.runnerId);
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
                      <Badge className="bg-blue-500 text-white text-sm px-3 py-1 font-semibold mb-2">
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
              
              return (
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-foreground">
                      {nextRunnerInfo?.name || 'Unknown Runner'}
                    </h3>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <Users className="h-4 w-4" />
                      <span>Van {nextRunnerInfo?.van || '?'}</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <Badge 
                      onClick={() => {
                        if (nextRunner) {
                          const directionsUrl = getLegDirectionsUrl(nextRunner.id);
                          window.open(directionsUrl, '_blank');
                        }
                      }}
                      className="bg-blue-500 text-white text-sm px-3 py-1 font-semibold mb-2 cursor-pointer hover:bg-blue-600 transition-colors duration-200"
                    >
                      <MapPin className="h-4 w-4 mr-0.5" />
                      Leg {nextRunner?.id}
                    </Badge>
                    <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                      <Target className="h-4 w-4" />
                      <span>{formatPace((nextRunner as any)?.paceOverride ?? nextRunnerInfo?.pace ?? 420)}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : shouldShowRaceCompletionContent() ? (
          <div className="text-center py-8">
            <p className="text-3xl font-bold text-green-500 mb-2">Happy Hood 2 Coast 2025!</p>
            
            {/* Race Stats */}
            <div className="space-y-3 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-foreground">
                    {getTeamStats().avgPace}
                  </div>
                  <div className="text-xs text-muted-foreground">Team Avg Pace</div>
                </div>
                
                <div className="text-center">
                  <div className="text-lg font-bold text-foreground">
                    {getTeamStats().fastestPace}
                  </div>
                  <div className="text-xs text-muted-foreground">Fastest Leg</div>
                </div>
              </div>
              
              <div className="flex flex-col items-center gap-2">
                <Button
                  onClick={onCelebrate}
                  size="lg"
                  className="bg-green-500 hover:bg-green-600 text-white mt-8 px-6 py-3"
                >
                  🎉 Celebrate
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <CardContent className="pt-4">
        {isDataLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <Skeleton className="h-10 w-16 mb-2" />
                <div className="flex items-center justify-center gap-1">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
              <div className="text-center">
                <Skeleton className="h-10 w-20 mb-2" />
                <div className="flex items-center justify-center gap-1">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="w-full h-3 flex items-center">
                <div className="w-full h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>
              </div>
              <div className="flex justify-between items-baseline">
                <Skeleton className="h-5 w-48" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-24" />
                </div>
              </div>
            </div>
          </div>
        ) : shouldShowNextRunnerContent() ? (
          <div className="space-y-4">
            {(() => {
              const leg36 = legs.find(leg => leg.id === 36);
              const isLeg36Running = leg36?.actualStart && !leg36?.actualFinish;
              
              if (isLeg36Running && !nextRunner) {
                return (
                  <div className="text-center">
                    <div className="text-4xl font-bold text-foreground">
                       See ya at the next one!
                    </div>
                  </div>
                );
              }
              
              return (
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-foreground mb-2">
                      {nextRunner?.distance ?? 0} mi
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                      <MapPin className="h-4 w-4" />
                      Distance
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-3xl font-bold text-foreground mb-2">
                      {(() => {
                        if (!actualRaceStartTime) return '--';
                        const isBeforeRaceStart = currentTime.getTime() < actualRaceStartTime;
                        const isFirstLeg = nextRunner && nextRunner.id === 1;
                        
                        if (isFirstLeg && isBeforeRaceStart) {
                          return formatRaceTime(actualRaceStartTime);
                        }
                        
                        return nextRunner ? formatRaceTime(getEffectiveStartTime(nextRunner, legs, actualRaceStartTime)) : '--';
                      })()}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                      <Target className="h-4 w-4" />
                      {(() => {
                        if (!actualRaceStartTime) return 'Loading...';
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
                    
                    if (isLeg36Running && !nextRunner) {
                      return 'Final leg in progress - almost there!';
                    }
                    
                    if (!actualRaceStartTime) return 'Loading...';
                    const isBeforeRaceStart = currentTime.getTime() < actualRaceStartTime!;
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
                  
                  if (isLeg36Running && !nextRunner) {
                    return (
                      <div className="flex gap-2">
                        <Button
                          onClick={onFinishRace}
                          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                        >
                          Finish Race
                        </Button>
                      </div>
                    );
                  }
                  
                  return nextRunner && (
                    <div className="flex gap-2">
                      <Button
                        onClick={onStartRunner}
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
                      
                      {(() => {
                        const leg36 = legs.find(leg => leg.id === 36);
                        return leg36?.actualStart && !leg36?.actualFinish && canEdit;
                      })() && (
                        <div className="flex gap-2">
                          <Button
                            onClick={onFinishRace}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                          >
                            Finish Race
                          </Button>
                        </div>
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
  );
};

export default NextRunnerCard;
