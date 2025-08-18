
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRaceStore } from '@/store/raceStore';
import { useTeamSync } from '@/hooks/useTeamSync';
import { formatTime, formatDuration } from '@/utils/raceUtils';
import { Timer, Flag } from 'lucide-react';

const RaceTimer = () => {
  const { startTime, legs } = useRaceStore();
  const { team } = useTeamSync();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Get the actual race start time from leg 1's actual start, or fall back to team start time or local start time
  const actualRaceStartTime = legs.length > 0 && legs[0].actualStart
    ? legs[0].actualStart
    : (team?.start_time ? new Date(team.start_time).getTime() : startTime);

  const raceElapsedMs = currentTime.getTime() - actualRaceStartTime;
  const isRaceStarted = raceElapsedMs > 0;

  return (
    <Card className="border-l-4 border-l-green-400 shadow-lg">
      <CardHeader className="pb-3 bg-gradient-to-r from-green-50 to-green-100">
        <CardTitle className="flex items-center gap-2 text-lg text-green-800">
          {isRaceStarted ? <Timer className="h-5 w-5" /> : <Flag className="h-5 w-5" />}
          Race Timer
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-3">
          <div>
            <div className="text-sm text-gray-600 mb-1">
              {legs.length > 0 && legs[0].actualStart ? 'Actual Start:' : 'Scheduled Start:'}
            </div>
            <div className="text-lg font-bold text-blue-900">
              {formatTime(actualRaceStartTime)}
            </div>
          </div>
          
          <div>
            <div className="text-sm text-gray-600 mb-1">Race Duration:</div>
            <div className="text-2xl font-bold text-green-600">
              {isRaceStarted ? (
                formatDuration(raceElapsedMs)
              ) : (
                <span className="text-orange-600">Not Started</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RaceTimer;
