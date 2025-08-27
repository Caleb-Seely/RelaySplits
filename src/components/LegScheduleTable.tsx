import React, { useState, useEffect } from 'react';
import { 
  Edit, 
  Clock, 
  Timer, 
  MapPin, 
  Target, 
  Play, 
  CheckCircle,
  AlertCircle,
  Users,
  Activity,
  Zap,
  Grid3X3,
  List,
  ChevronRight
} from 'lucide-react';

import TimePicker from './TimePicker';
import RunnerAssignmentModal from './RunnerAssignmentModal';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useRaceStore } from '@/store/raceStore';
import { useTeamSync } from '@/hooks/useTeamSync';
import { 
  getLegStatus, 
  getRunTime, 
  formatDuration, 
  getCountdownTime, 
  formatCountdown, 
  calculateActualPace
} from '@/utils/raceUtils';
import { MAJOR_EXCHANGES, getLegDirectionsUrl } from '@/utils/legData';

interface LegScheduleTableProps {
  viewMode: 'cards' | 'table';
  onRunnerClick?: (runnerId: number, legId: number) => void;
  isViewOnly?: boolean;
}

const LegScheduleTable: React.FC<LegScheduleTableProps> = ({ viewMode, onRunnerClick, isViewOnly = false }) => {
  const { legs, runners, currentVan, updateRunner, updateLegDistance, updateLegActualTime, assignRunnerToLegs, startTime, fixDataInconsistencies } = useRaceStore();
  const { team } = useTeamSync();
  const [editingRunner, setEditingRunner] = useState<number | null>(null);
  const [editingDistance, setEditingDistance] = useState<number | null>(null);
  const [runnerName, setRunnerName] = useState('');
  const [runnerPace, setRunnerPace] = useState('');
  const [distanceInput, setDistanceInput] = useState('');
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [timePickerConfig, setTimePickerConfig] = useState<any>(null);
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [selectedRunner, setSelectedRunner] = useState<any>(null);

  const currentTime = new Date();
  
  // Use the actual start of leg 1 if available; otherwise use official team start time or fall back to local start time
  const actualRaceStartTime = legs.length > 0 && legs[0].actualStart
    ? legs[0].actualStart
    : (() => {
        if (team?.start_time) {
          const teamStartTime = new Date(team.start_time);
          const placeholderDate = new Date('2099-12-31T23:59:59Z');
          if (Math.abs(teamStartTime.getTime() - placeholderDate.getTime()) > 1000) {
            return teamStartTime.getTime();
          }
        }
        return startTime;
      })();

  // Filter legs by current van
  const vanRunners = runners.filter(r => r.van === currentVan);
  const vanRunnerIds = new Set(vanRunners.map(r => r.id));
  const filteredLegs = legs.filter(leg => {
    // Ensure leg has a valid runnerId and the runner exists
    if (!leg.runnerId || leg.runnerId <= 0) {
      console.warn(`[LegScheduleTable] Leg ${leg.id} has invalid runnerId: ${leg.runnerId}`);
      return false;
    }
    
    const runner = runners.find(r => r.id === leg.runnerId);
    if (!runner) {
      console.warn(`[LegScheduleTable] Leg ${leg.id} assigned to non-existent runner ${leg.runnerId}`);
      return false;
    }
    
    return vanRunnerIds.has(leg.runnerId);
  });

  // Auto-fix data inconsistencies when component mounts or data changes
  useEffect(() => {
    if (legs.length > 0 && runners.length > 0) {
      const hasInvalidLegs = legs.some(leg => !leg.runnerId || leg.runnerId <= 0);
      const hasInvalidRunners = runners.some(runner => 
        !runner || 
        typeof runner.id !== 'number' || 
        runner.id <= 0 || 
        typeof runner.pace !== 'number' || 
        runner.pace <= 0 ||
        (runner.van !== 1 && runner.van !== 2)
      );
      
      if (hasInvalidLegs || hasInvalidRunners) {
        console.warn('[LegScheduleTable] Detected data inconsistencies, attempting auto-fix');
        const wasFixed = fixDataInconsistencies();
        if (wasFixed) {
          console.log('[LegScheduleTable] Successfully fixed data inconsistencies');
        }
      }
    }
  }, [legs, runners, fixDataInconsistencies]);
  
  // Function to format time without seconds, using AM/PM
  const formatTimeShort = (timestamp: number) => {
    if (!timestamp || timestamp <= 0) return 'N/A';
    const date = new Date(timestamp);
    const options: Intl.DateTimeFormatOptions = { 
      hour: "2-digit" as const, 
      minute: "2-digit" as const, 
      hour12: true 
    };
    return date.toLocaleTimeString('en-US', options);
  };

  // Function to format time with seconds, using AM/PM
  const formatTime = (timestamp: number) => {
    if (!timestamp || timestamp <= 0) return 'N/A';
    const date = new Date(timestamp);
    const options: Intl.DateTimeFormatOptions = { 
      hour: "2-digit" as const, 
      minute: "2-digit" as const, 
      second: "2-digit" as const, 
      hour12: true 
    };
    return date.toLocaleTimeString('en-US', options);
  };

  // Function to format pace in MM:SS format, rounding seconds
  const formatPace = (totalSeconds: number) => {
    if (isNaN(totalSeconds) || totalSeconds <= 0) return 'N/A';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds % 60);
    const paddedSeconds = seconds < 10 ? `0${seconds}` : seconds;
    return `${minutes}:${paddedSeconds}`;
  };

  const handleRunnerEdit = (runnerId: number, legId: number) => {
    const runner = runners.find(r => r.id === runnerId);
    if (runner) {
      if (onRunnerClick) {
        onRunnerClick(runnerId, legId);
      } else {
        // Open the assignment modal instead of inline editing
        setSelectedRunner(runner);
        setAssignmentModalOpen(true);
      }
    }
  };

  const handleAssignmentSave = (
    runnerId: number,
    name: string,
    paceSeconds: number,
    selectedLegIds: number[],
    totalMiles: number
  ) => {
    // Update runner details
    updateRunner(runnerId, { 
      name: name,
      pace: paceSeconds 
    });
    
    // Assign legs to this runner
    if (selectedLegIds.length > 0) {
      assignRunnerToLegs(runnerId, selectedLegIds);
    }
    
    setAssignmentModalOpen(false);
    setSelectedRunner(null);
  };

  const handleRunnerSubmit = () => {
    if (!editingRunner) return;
    
    try {
      const paceSeconds = runnerPace.includes(':') ? 
        parseInt(runnerPace.split(':')[0]) * 60 + parseInt(runnerPace.split(':')[1]) :
        parseInt(runnerPace) * 60;

      updateRunner(editingRunner, { 
        name: runnerName,
        pace: paceSeconds 
      });
      
      setEditingRunner(null);
      setRunnerName('');
      setRunnerPace('');
    } catch (error) {
      console.error('Please enter a valid pace'); 
    }
  };

  const handleDistanceEdit = (legId: number) => {
    if (isViewOnly) return;
    const leg = legs.find(l => l.id === legId);
    if (leg) {
      setEditingDistance(legId);
      setDistanceInput(leg.distance.toString());
    }
  };

  const handleDistanceSubmit = () => {
    if (isViewOnly || !editingDistance) return;
    
    const distance = parseFloat(distanceInput);
    if (!isNaN(distance) && distance > 0) {
      updateLegDistance(editingDistance, distance);
      setEditingDistance(null);
      setDistanceInput('');
    } else {
      console.error('Please enter a valid distance');
    }
  };

  const handleTimeEdit = (legId: number, field: string) => {
    if (isViewOnly) return;
    const leg = legs.find(l => l.id === legId);
    const runner = leg ? runners.find(r => r.id === leg.runnerId) : null;
    const existingTime = leg ? leg[field as keyof typeof leg] as number : null;

    if (leg && runner) {
      setTimePickerConfig({
        legId,
        field,
        title: field === 'actualStart' ? `Record Start Time - Leg ${legId}` : `Record Finish Time - Leg ${legId}`,
        runnerName: runner.name,
        initialTime: existingTime || Date.now()
      });
      setTimePickerOpen(true);
    }
  };

  const handleTimeSubmit = (timestamp: number) => {
    if (isViewOnly) return;
    if (timePickerConfig) {
      updateLegActualTime(timePickerConfig.legId, timePickerConfig.field, timestamp);
    }
    setTimePickerOpen(false);
    setTimePickerConfig(null);
  };

  const getStatusBadge = (leg: any) => {
   const status = getLegStatus(leg, currentTime);
   const statusConfig = {
     ready: { 
       className: 'bg-blue-50 text-blue-700 border-blue-200',
       icon: Clock,
       label: '',
       dot: 'bg-blue-500'
     },
     running: { 
       className: 'bg-orange-50 text-orange-700 border-orange-200',
       icon: Play,
       label: 'Running',
       dot: 'bg-orange-500 animate-pulse'
     },
     finished: { 
       className: 'bg-green-50 text-green-700 border-green-200',
       icon: CheckCircle,
       label: 'Finished',
       dot: 'bg-green-500'
     },
     'next-up': { 
       className: 'bg-slate-50 text-slate-700 border-slate-200',
       icon: Timer,
       label: 'Next Up',
       dot: 'bg-slate-400'
     }
   };
 
   const config = statusConfig[status];
   const Icon = config.icon;
   
   let label = config.label;
   if (status === 'ready') {
     const countdownMs = getCountdownTime(leg, currentTime, legs, actualRaceStartTime);
     label = countdownMs > 0 ? formatCountdown(countdownMs) : 'Ready';
   }
 
   return (
     <div className="flex items-center gap-2">
       <div className={`w-2 h-2 rounded-full ${config.dot}`}></div>
       <Badge className={`${config.className} border text-xs font-medium px-2 py-1`}>
         <Icon className="h-3 w-3 mr-1" />
         {label}
       </Badge>
     </div>
   );
  };

  const renderStatusData = (leg: any, status: string) => {
    if (status === 'finished' && leg.actualStart && leg.actualFinish) {
      const runTime = getRunTime(leg);
      const actualPace = calculateActualPace(leg);
      return (
        <div className="mt-2 space-y-1">
          <div className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-md inline-block">
            {runTime ? formatDuration(runTime) : ''}
          </div>
          {actualPace && (
            <div className="text-xs font-medium text-slate-600">
              {formatPace(actualPace * 60)} pace
            </div>
          )}
        </div>
      );
    }
    
    if (status === 'ready') {
      const countdownMs = getCountdownTime(leg, currentTime, legs, actualRaceStartTime);
      return countdownMs > 0 ? (
        <div className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded-md inline-block mt-2">
          {formatCountdown(countdownMs)}
        </div>
      ) : null;
    }
    
    return null;
  };

  const renderCompactCard = (leg: any) => {
    const runner = runners.find(r => r.id === leg.runnerId);
    if (!runner) return null;

    const status = getLegStatus(leg, currentTime);
    const isMajorExchange = MAJOR_EXCHANGES.includes(leg.id);
    
    const runTime = status === 'finished' && leg.actualStart && leg.actualFinish ? getRunTime(leg) : null;
    const actualPace = status === 'finished' && runTime ? calculateActualPace(leg) : null;

    return (
      <Card
        key={leg.id}
        className={`group hover:shadow-md transition-all duration-200 border ${
          status === 'running'
            ? 'border-orange-200 bg-gradient-to-r from-orange-50/70 to-white'
            : status === 'finished'
            ? 'border-green-200 bg-gradient-to-r from-green-50/70 to-white'
            : status === 'ready'
            ? 'border-blue-200 bg-gradient-to-r from-blue-50/70 to-white'
            : 'border-slate-200 bg-white'
        }`}
      >
        <CardContent className="p-2 sm:p-3 md:p-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <button
                onClick={() => {
                  const directionsUrl = getLegDirectionsUrl(leg.id);
                  window.open(directionsUrl, '_blank');
                }}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-sm flex-shrink-0 hover:opacity-80 transition-opacity cursor-pointer ${
                  status === 'running'
                    ? 'bg-orange-500'
                    : status === 'finished'
                    ? 'bg-green-500'
                    : status === 'ready'
                    ? 'bg-blue-500'
                    : 'bg-slate-500'
                }`}
                title={`Get directions to Leg ${leg.id}`}
              >
                {leg.id}
              </button>

              <button
                className={`min-w-0 flex-1 text-left p-2 -m-2 rounded transition-colors ${
                  isViewOnly ? 'cursor-default' : 'hover:bg-slate-50'
                }`}
                onClick={isViewOnly ? undefined : () => handleRunnerEdit(runner.id, leg.id)}
                disabled={isViewOnly}
              >
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-gray-900 truncate">{runner.name}</h3>
                      {isMajorExchange && (
                        <Badge className="bg-amber-100 text-amber-800 text-xs px-1.5 py-0.5 flex-shrink-0">
                          <Zap className="h-2.5 w-2.5 mr-1" />
                          Exchange
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-600">{leg.distance} miles</div>
                  </div>
                  {runTime && (
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold text-green-700">{formatDuration(runTime)}</div>
                      {actualPace && (
                        <div className="text-xs font-medium text-green-600">{formatPace(actualPace * 60)}/mi</div>
                      )}
                    </div>
                  )}
                </div>
              </button>
            </div>
            <div className="flex-shrink-0 ml-2">{getStatusBadge(leg)}</div>
          </div>

          <div className="text-xs border-t border-slate-100 pt-3">
            <div className="space-y-1">
              <div className={`font-medium ${leg.actualStart ? 'text-green-600' : 'text-blue-600'}`}>
                {leg.actualStart ? 'Actual' : 'Projected'}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={`text-xs font-medium ${
                    leg.actualStart ? 'text-green-600' : 'text-blue-600'
                  } ${!isViewOnly ? 'hover:underline' : ''}`}
                  onClick={isViewOnly ? undefined : () => handleTimeEdit(leg.id, 'actualStart')}
                  disabled={isViewOnly}
                >
                  {leg.actualStart ? formatTimeShort(leg.actualStart) : (leg.projectedStart && leg.projectedStart > 0 ? `${formatTimeShort(leg.projectedStart)} (proj.)` : 'Set Start')}
                </button>
                <span className="text-slate-400">to</span>
                <button
                  className={`text-xs font-medium ${
                    leg.actualFinish ? 'text-green-600' : leg.actualStart ? 'text-blue-600' : 'text-slate-400'
                  } ${!isViewOnly ? 'hover:underline' : ''}`}
                  onClick={isViewOnly ? undefined : () => leg.actualStart && handleTimeEdit(leg.id, 'actualFinish')}
                  disabled={isViewOnly || !leg.actualStart}
                >
                  {leg.actualFinish ? formatTimeShort(leg.actualFinish) : leg.projectedFinish ? `${formatTimeShort(leg.projectedFinish)} (proj.)` : (leg.actualStart ? 'Set Finish' : 'Pending')}
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderTableView = () => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
              <th className="text-left px-2 py-2 sm:px-3 sm:py-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">Leg</th>
              <th className="text-left px-2 py-2 sm:px-3 sm:py-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">Runner</th>
              <th className="text-left px-2 py-2 sm:px-3 sm:py-3 text-xs font-semibold text-slate-700 uppercase tracking-wide hidden sm:table-cell">Distance</th>
              <th className="text-left px-2 py-2 sm:px-3 sm:py-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">Times</th>
              <th className="text-left px-2 py-2 sm:px-3 sm:py-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredLegs.map((leg) => {
              const runner = runners.find(r => r.id === leg.runnerId);
              if (!runner) return null;

              const status = getLegStatus(leg, currentTime);
              const isMajorExchange = MAJOR_EXCHANGES.includes(leg.id);

              return (
                <tr
                  key={leg.id}
                  className={`hover:bg-slate-50/50 transition-colors ${
                    isMajorExchange ? 'bg-gradient-to-r from-amber-50/30 to-transparent border-l-2 border-l-amber-400' : ''
                  }`}
                >
                  <td className="px-2 py-2 sm:px-3 sm:py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const directionsUrl = getLegDirectionsUrl(leg.id);
                          window.open(directionsUrl, '_blank');
                        }}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold hover:opacity-80 transition-opacity cursor-pointer ${
                          status === 'running'
                            ? 'bg-orange-500'
                            : status === 'finished'
                            ? 'bg-green-500'
                            : status === 'ready'
                            ? 'bg-blue-500'
                            : 'bg-slate-500'
                        }`}
                        title={`Get directions to Leg ${leg.id}`}
                      >
                        {leg.id}
                      </button>
                      {isMajorExchange && (
                        <Badge className="bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 hidden sm:inline-flex">EX</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 sm:px-3 sm:py-3">
                    <button
                      className={`min-w-0 text-left ${!isViewOnly ? 'hover:underline' : ''}`}
                      onClick={isViewOnly ? undefined : () => handleRunnerEdit(runner.id, leg.id)}
                      disabled={isViewOnly}
                    >
                      <div className="font-medium text-sm text-gray-900 truncate">{runner.name}</div>
                      <div className="text-xs text-slate-600">{formatTimeShort(leg.projectedStart)}</div>
                    </button>
                  </td>
                  <td className="px-2 py-2 sm:px-3 sm:py-3 text-sm text-slate-700 hidden sm:table-cell">{leg.distance}mi</td>
                  <td className="px-2 py-2 sm:px-3 sm:py-3">
                    <div className="space-y-1">
                      <div className={`text-xs font-medium ${leg.actualStart ? 'text-green-600' : 'text-blue-600'}`}>
                        {leg.actualStart ? 'Actual' : 'Projected'}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          className={`text-xs font-medium ${
                            leg.actualStart ? 'text-green-600' : 'text-blue-600'
                          } ${!isViewOnly ? 'hover:underline' : ''}`}
                          onClick={isViewOnly ? undefined : () => handleTimeEdit(leg.id, 'actualStart')}
                          disabled={isViewOnly}
                        >
                          {leg.actualStart ? formatTimeShort(leg.actualStart) : (leg.projectedStart && leg.projectedStart > 0 ? `${formatTimeShort(leg.projectedStart)} (proj.)` : 'Set Start')}
                        </button>
                        <span className="text-slate-400 text-xs">to</span>
                        <button
                          className={`text-xs font-medium ${
                            leg.actualFinish ? 'text-green-600' : leg.actualStart ? 'text-blue-600' : 'text-slate-400'
                          } ${!isViewOnly ? 'hover:underline' : ''}`}
                          onClick={isViewOnly ? undefined : () => leg.actualStart && handleTimeEdit(leg.id, 'actualFinish')}
                          disabled={isViewOnly || !leg.actualStart}
                        >
                          {leg.actualFinish ? formatTimeShort(leg.actualFinish) : leg.projectedFinish ? `${formatTimeShort(leg.projectedFinish)} (proj.)` : (leg.actualStart ? 'Set Finish' : 'Pending')}
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2 sm:px-3 sm:py-3">{getStatusBadge(leg)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <>
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3 md:gap-4 p-2 sm:p-3 md:p-4">
          {filteredLegs.map(renderCompactCard)}
        </div>
      ) : (
        <div className="sm:p-3 md:p-4">
          {renderTableView()}
        </div>
      )}

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
          initialTime={timePickerConfig.initialTime}
        />
      )}

      <RunnerAssignmentModal
        isOpen={assignmentModalOpen}
        onClose={() => {
          setAssignmentModalOpen(false);
          setSelectedRunner(null);
        }}
        runner={selectedRunner}
        onSave={handleAssignmentSave}
      />
    </>
  );
};

export default LegScheduleTable;