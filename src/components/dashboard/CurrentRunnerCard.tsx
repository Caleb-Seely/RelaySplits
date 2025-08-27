import React from 'react';
import { Users, Target, MapPin, Timer, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPace, formatRaceTime, formatDuration } from '@/utils/raceUtils';
import { calculateCurrentDistance } from '@/utils/raceUtils';

interface CurrentRunnerCardProps {
  currentRunner: any;
  currentRunnerInfo: any;
  currentTime: Date;
  isCurrentRunnerLoading: boolean;
  getRemainingDistance: () => number;
}

const CurrentRunnerCard: React.FC<CurrentRunnerCardProps> = ({
  currentRunner,
  currentRunnerInfo,
  currentTime,
  isCurrentRunnerLoading,
  getRemainingDistance
}) => {
  return (
    <Card className="group relative overflow-hidden border-border shadow-2xl bg-card">
      <div className="absolute inset-0 bg-green-500 h-1"></div>

      <div className="p-2 sm:p-3 md:p-4 bg-green-500/10 rounded-b-none rounded-lg">
        <div className="space-y-4">
          {isCurrentRunnerLoading ? (
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
          ) : currentRunner && currentRunnerInfo ? (
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
          {isCurrentRunnerLoading ? (
            <>
              <div className="grid grid-cols-2 gap-6">
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
                <Skeleton className="w-full h-3 rounded-full" />
                <div className="flex justify-between items-baseline">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-32" />
                </div>
              </div>
            </>
          ) : currentRunner && currentRunnerInfo ? (
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
  );
};

export default CurrentRunnerCard;
