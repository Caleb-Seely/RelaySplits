import React from 'react';
import { Clock, MapPin, Trophy, AlertTriangle, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useRaceStore } from '@/store/raceStore';
import { useTeamSync } from '@/hooks/useTeamSync';
import SyncStatusIndicator from '@/components/SyncStatusIndicator';
import { formatDuration, formatRaceTime } from '@/utils/raceUtils';
import { calculateTotalDistanceTraveled } from '@/utils/raceUtils';

interface DashboardHeaderProps {
  isViewOnly?: boolean;
  viewOnlyTeamName?: string;
  team?: any;
  actualRaceStartTime: number | null;
  currentTime: Date;
  isRaceComplete: () => boolean;
  getFinalRaceTime: () => number | null;
  onCheckMissingTimes: () => void;
  onCheckSingleRunnerRule: () => void;
  canEdit: boolean;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  isViewOnly,
  viewOnlyTeamName,
  team,
  actualRaceStartTime,
  currentTime,
  isRaceComplete,
  getFinalRaceTime,
  onCheckMissingTimes,
  onCheckSingleRunnerRule,
  canEdit
}) => {
  const navigate = useNavigate();
  const { legs } = useRaceStore();

  const getRaceProgress = () => {
    const totalLegs = legs.length;
    const completedLegs = legs.filter(leg => leg.actualFinish).length;
    
    let currentLegId;
    if (isRaceComplete()) {
      currentLegId = totalLegs;
    } else {
      // Find current or next runner logic would go here
      currentLegId = 1; // Simplified for now
    }
    
    return {
      completed: completedLegs,
      total: totalLegs,
      current: currentLegId,
      percentage: totalLegs > 0 ? (completedLegs / totalLegs) * 100 : 0
    };
  };

  const progress = getRaceProgress();

  return (
    <div className="text-center space-y-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex-1"></div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          {isViewOnly && viewOnlyTeamName ? viewOnlyTeamName : (team?.name || 'Team Name')}
        </h1>
        <div className="flex-1 flex justify-end gap-2">
          <Button
            onClick={() => navigate('/notifications-test')}
            variant="outline"
            size="sm"
            className="bg-card hover:bg-accent"
            title="Notification Diagnostics"
          >
            <Bell className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => navigate('/leaderboard')}
            variant="outline"
            size="sm"
            className="bg-card hover:bg-accent"
          >
            <Trophy className="h-4 w-4" />
          </Button>
        </div>
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
              ? (getFinalRaceTime() ? formatDuration(getFinalRaceTime()!) : '--')
              : (actualRaceStartTime ? formatDuration(Math.max(0, currentTime.getTime() - actualRaceStartTime)) : '--')
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
              {actualRaceStartTime ? formatRaceTime(actualRaceStartTime) : '--'}
            </div>
            <div className="flex items-center justify-start gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Start</span>
            </div>
          </div>
          <div className="justify-self-center text-center">
            <div className="flex items-center justify-center gap-2">
              <SyncStatusIndicator />
              {!isViewOnly && canEdit && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCheckMissingTimes}
                    className="flex items-center gap-2"
                    title="Check for missing times"
                  >
                    <Clock className="h-4 w-4" />
                    Check Times
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCheckSingleRunnerRule}
                    className="flex items-center gap-2"
                    title="Check for multiple runners running simultaneously"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Validate Race
                  </Button>
                </>
              )}
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
  );
};

export default DashboardHeader;
