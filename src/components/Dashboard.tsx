import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useRaceStore } from '@/store/raceStore';
import { useTeamSync } from '@/hooks/useTeamSync';
import { useEnhancedSyncManager } from '@/hooks/useEnhancedSyncManager';
import { useTeam } from '@/contexts/TeamContext';
import { useConflictResolution } from '@/contexts/ConflictResolutionContext';
import { eventBus, EVENT_TYPES } from '@/utils/eventBus';
import { getDeviceId } from '@/integrations/supabase/edge';

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
  getEffectiveStartTime,
  clearRunnerCache
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
  HelpCircle,
  Bell,
  BellOff
} from 'lucide-react';
import LegScheduleTable from './LegScheduleTable';
import MajorExchanges from './MajorExchanges';
import RaceTimer from './RaceTimer';
import TimePicker from './TimePicker';
import PaceInputModal from './PaceInputModal';
import RunnerAssignmentModal from './RunnerAssignmentModal';
import SyncStatusIndicator from './SyncStatusIndicator';
import { toast } from 'sonner';
import TeamSettings from './TeamSettings';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import QuickHelpPopup from './QuickHelpPopup';
import { useQuickHelp } from '@/hooks/useQuickHelp';
import { usePWA } from '@/hooks/usePWA';
import { useDecoupledNotifications } from '@/hooks/useDecoupledNotifications';
import DashboardPrompts from './DashboardPrompts';

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
    startNextRunner,
    startTime,
    teamId,
    assignRunnerToLegs,
    isSetupComplete,
    didInitFromTeam,
    validateAndFixRaceState,
    initializeLegs
  } = useRaceStore();
  const { canInstall, install } = usePWA();
  const { onConflictDetected } = useConflictResolution();
  const { performSmartSync, getQueueStatus, isProcessingSync, setupRealtimeSubscriptions, manualRetry, fetchLatestData } = useEnhancedSyncManager();
  const { 
    isSupported: notificationsSupported, 
    getPermission: notificationPermission, 
    notificationManager,
    isNotificationPreferenceEnabled,
    clearNotificationPreference,
    setNotificationPreference,
    getPendingNotificationsCount,
    getNotificationState
  } = useDecoupledNotifications();

  // Ensure enhanced sync is active when Dashboard is mounted (but not in view-only mode)
  useEffect(() => {
    if (!teamId || isViewOnly) return;
    
    console.log('[Dashboard] Setting up real-time subscriptions for team:', teamId);
    
    let cleanup: (() => void) | undefined;
    let syncStatusInterval: NodeJS.Timeout;
    
    // Add a small delay to prevent rapid re-subscriptions
    const timeoutId = setTimeout(() => {
      cleanup = setupRealtimeSubscriptions(teamId);
      
      // Set up periodic sync status check
      syncStatusInterval = setInterval(() => {
        const queueStatus = getQueueStatus();
        if (queueStatus.pendingCount > 0) {
          console.log('[Dashboard] Pending sync items:', queueStatus);
        }
      }, 10000); // Check every 10 seconds
    }, 100); // Small delay to prevent rapid re-subscriptions
    
    return () => {
      clearTimeout(timeoutId);
      if (cleanup) cleanup();
      if (syncStatusInterval) clearInterval(syncStatusInterval);
    };
  }, [teamId, setupRealtimeSubscriptions, isViewOnly]);



  // Data loading effect - ensure legs data is loaded when dashboard mounts
  useEffect(() => {
    if (!teamId || isViewOnly) return;
    
    const loadDataIfNeeded = async () => {
      console.log('[Dashboard] Checking if data needs to be loaded...');
      console.log('[Dashboard] Current state - legs:', legs.length, 'runners:', runners.length, 'isSetupComplete:', isSetupComplete, 'teamId:', teamId);
      

      
      // If we have no legs but have a teamId, we need to load data
      if (legs.length === 0 && teamId) {
        // Check if this is a fresh team that just completed setup
        // In this case, we should initialize legs locally instead of fetching from server
        if (isSetupComplete && runners.length > 0) {
          console.log('[Dashboard] Fresh team after setup - initializing legs locally...');
          initializeLegs();
          
          // Check state after initialization
          const stateAfterInit = useRaceStore.getState();
          console.log('[Dashboard] State after local init - legs:', stateAfterInit.legs.length, 'runners:', stateAfterInit.runners.length);
          
          // Verify that legs were created with proper projected times
          if (stateAfterInit.legs.length > 0) {
            const firstLeg = stateAfterInit.legs[0];
            console.log('[Dashboard] First leg after init:', {
              id: firstLeg.id,
              runnerId: firstLeg.runnerId,
              projectedStart: firstLeg.projectedStart,
              projectedFinish: firstLeg.projectedFinish,
              actualStart: firstLeg.actualStart
            });
          }
        } else if (isSetupComplete && runners.length === 0) {
          // Setup is complete but no data - fetch from server
          console.log('[Dashboard] Setup complete but no data - fetching from server...');
          
          try {
            // Fetch latest data from server
            console.log('[Dashboard] Calling fetchLatestData...');
            await fetchLatestData();
            console.log('[Dashboard] fetchLatestData completed');
            
            // Check if data was loaded
            const currentState = useRaceStore.getState();
            console.log('[Dashboard] State after fetch - legs:', currentState.legs.length, 'runners:', currentState.runners.length);
            
            if (currentState.legs.length === 0) {
              console.log('[Dashboard] Still no legs after fetch, initializing legs...');
              initializeLegs();
            }
          } catch (error) {
            console.error('[Dashboard] Error fetching data:', error);
            // Fallback: initialize legs if fetch fails
            console.log('[Dashboard] Fallback: initializing legs after fetch error');
            initializeLegs();
          }
        } else {
          console.log('[Dashboard] No legs data found, attempting to load from server...');
          
          try {
            // First try to fetch latest data from server
            console.log('[Dashboard] Calling fetchLatestData...');
            await fetchLatestData();
            console.log('[Dashboard] fetchLatestData completed');
            
            // If still no legs after fetch, initialize them
            const currentState = useRaceStore.getState();
            console.log('[Dashboard] State after fetch - legs:', currentState.legs.length, 'runners:', currentState.runners.length);
            
            if (currentState.legs.length === 0) {
              console.log('[Dashboard] Still no legs after fetch, initializing legs...');
              initializeLegs();
              
              // Check state after initialization
              const stateAfterInit = useRaceStore.getState();
              console.log('[Dashboard] State after init - legs:', stateAfterInit.legs.length, 'runners:', stateAfterInit.runners.length);
            } else {
              // Log fetched data for debugging
              console.log('[Dashboard] Fetched legs from server:', currentState.legs.length);
              console.log('[Dashboard] Sample leg data:', currentState.legs[0]);
              
              // Check if fetched legs have proper projected times
              if (currentState.legs.length > 0) {
                const firstLeg = currentState.legs[0];
                console.log('[Dashboard] First leg from server:', {
                  id: firstLeg.id,
                  runnerId: firstLeg.runnerId,
                  projectedStart: firstLeg.projectedStart,
                  projectedFinish: firstLeg.projectedFinish,
                  actualStart: firstLeg.actualStart
                });
              }
            }
          } catch (error) {
            console.error('[Dashboard] Error loading data:', error);
            // Fallback: initialize legs if fetch fails
            if (legs.length === 0) {
              console.log('[Dashboard] Fallback: initializing legs after fetch error');
              initializeLegs();
            }
          }
        }
      } else if (legs.length === 0 && runners.length > 0) {
        // If we have runners but no legs, initialize legs
        console.log('[Dashboard] Have runners but no legs, initializing legs...');
        initializeLegs();
      } else if (legs.length > 0) {
        console.log('[Dashboard] Data already loaded - legs:', legs.length, 'runners:', runners.length);
        
        // Log current leg state for debugging
        if (legs.length > 0) {
          const firstLeg = legs[0];
          console.log('[Dashboard] Current first leg:', {
            id: firstLeg.id,
            runnerId: firstLeg.runnerId,
            projectedStart: firstLeg.projectedStart,
            projectedFinish: firstLeg.projectedFinish,
            actualStart: firstLeg.actualStart
          });
        }
      }
    };
    
    // Add a small delay to ensure all other initialization is complete
    const timeoutId = setTimeout(loadDataIfNeeded, 500);
    
    return () => clearTimeout(timeoutId);
  }, [teamId, legs.length, runners.length, isSetupComplete, isViewOnly, fetchLatestData, initializeLegs]);

  // Fallback mechanism to ensure legs are initialized if they're still missing after a delay
  useEffect(() => {
    if (!teamId || isViewOnly || legs.length > 0) return;
    
    const fallbackTimer = setTimeout(() => {
      console.log('[Dashboard] Fallback: Initializing legs after timeout');
      initializeLegs();
    }, 3000); // Wait 3 seconds before fallback initialization
    
    return () => clearTimeout(fallbackTimer);
  }, [teamId, legs.length, isViewOnly, initializeLegs]);



  // Listen for real-time updates
  useEffect(() => {
    let lastNotificationTime = 0;
    const NOTIFICATION_COOLDOWN = 3000; // 3 seconds between notifications
    
    const unsubscribe = eventBus.subscribe(EVENT_TYPES.REALTIME_UPDATE, (event) => {
      console.log('[Dashboard] Received real-time update:', event.payload);
      setLastRealtimeUpdate(Date.now());
      
      // Show a subtle notification for real-time updates (with cooldown to prevent spam)
      if (event.payload.device_id !== getDeviceId()) {
        const now = Date.now();
        if (now - lastNotificationTime > NOTIFICATION_COOLDOWN) {
          lastNotificationTime = now;
          toast.success(`Updated from another device`, {
            duration: 2000,
            position: 'top-right'
          });
        }
      }
    });

    return unsubscribe;
  }, []);

  const { team, updateTeamStartTime, loading, refreshTeamData } = useTeamSync();
  const { deviceInfo } = useTeam();

  // Determine if user can edit (not in view-only mode and has edit permissions)
  const canEdit = !isViewOnly && (deviceInfo?.role === 'admin' || deviceInfo?.role === 'member');

  // Comprehensive loading condition that includes team loading and race data initialization
  // Optimized to prevent showing skeleton when we have valid local data during sync operations
  const isDataLoading = loading || (
    legs.length === 0 && 
    teamId && 
    !isViewOnly && 
    !isSetupComplete // Don't show loading if setup is complete and we're just waiting for data
  );

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
  const [lastRealtimeUpdate, setLastRealtimeUpdate] = useState<number | null>(null);

  // Test confetti function for debugging
  const testConfetti = () => {
    console.log('Testing confetti');
    triggerConfetti({ particleCount: 50, spread: 50 });
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Validate race state periodically to catch sync issues
  useEffect(() => {
    if (!legs.length || !isSetupComplete) return;
    
    const validationTimer = setInterval(() => {
      const result = validateAndFixRaceState();
      if (!result.isValid && result.fixed) {
        console.log('[Dashboard] Fixed race state issues:', result.issues);
        toast.success('Fixed race synchronization issues');
      } else if (!result.isValid && !result.fixed) {
        console.warn('[Dashboard] Race state issues detected but could not auto-fix:', result.issues);
      }
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(validationTimer);
  }, [legs.length, isSetupComplete, validateAndFixRaceState]);

  // Use the actual start of leg 1 if available; otherwise use official team start time or fall back to local start time
  const actualRaceStartTime = legs.length > 0 && legs[0].actualStart
    ? legs[0].actualStart
    : (team?.start_time ? new Date(team.start_time).getTime() : startTime);

  // Check for team context mismatch (only log warnings, not every calculation)
  if (team?.start_time && Math.abs(new Date(team.start_time).getTime() - startTime) > 1000) {
    console.warn('[Dashboard] WARNING: Team context and race store start times differ by more than 1 second!');
    console.warn('  Team context:', new Date(team.start_time).toString());
    console.warn('  Race store:', new Date(startTime).toString());
  }

  // Refresh team data if it's missing but we have a teamId
  useEffect(() => {
    if (teamId && !team?.start_time && !loading) {
      refreshTeamData();
    }
  }, [teamId, team?.start_time, loading, refreshTeamData]);

  // Check localStorage for team start time and sync if needed (only log warnings)
  useEffect(() => {
    if (teamId && !team?.start_time) {
      const storedTeamStartTime = localStorage.getItem('relay_team_start_time');
      if (storedTeamStartTime) {
        const storedTime = new Date(storedTeamStartTime).getTime();
        const raceStoreTime = startTime;
        
        if (Math.abs(storedTime - raceStoreTime) > 1000) {
          console.warn('[Dashboard] localStorage and race store times differ significantly!');
          console.warn('  localStorage:', new Date(storedTime).toString());
          console.warn('  race store:', new Date(raceStoreTime).toString());
        }
      }
    }
  }, [teamId, team?.start_time, startTime]);



  const currentRunner = getCurrentRunner(legs, currentTime);
  const nextRunner = getNextRunner(legs, currentTime, startTime);
  
  // Enhanced loading state for current runner card that prevents skeleton when we have runner data
  const isCurrentRunnerLoading = isDataLoading && !currentRunner;
  const isNextRunnerLoading = isDataLoading && !nextRunner;
  
  // Debug logging for current and next runner
  if (process.env.NODE_ENV === 'development') {
    
  }

  const currentRunnerInfo = currentRunner
    ? runners.find(r => r.id === currentRunner.runnerId)
    : null;

  const nextRunnerInfo = nextRunner
    ? runners.find(r => r.id === nextRunner.runnerId)
    : null;

  // Debug effect to log current state (after currentRunner and nextRunner are declared)


  const getCountdownToNext = () => {
    if (!nextRunner) return null;
    const countdownMs = getCountdownTime(nextRunner, currentTime, legs, startTime);
    return formatCountdown(countdownMs);
  };

  const getNextRunnerPrefix = () => {
    if (!nextRunner || !legs.length) return "Starts in:";
    
    // Special case for leg 1 before race starts
    if (nextRunner.id === 1 && !nextRunner.actualStart) {
      return "Race starts in:";
    }
    
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
    } else if (nextRunner) {
      // If no current runner but we have a next runner, show the next leg as current
      currentLegId = nextRunner.id;
    } else if (totalLegs > 0) {
      // If we have legs but no current or next runner, show leg 1 as current
      currentLegId = 1;
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
      // Clear runner cache to ensure immediate UI updates
      clearRunnerCache();
      
      // Trigger confetti
      console.log('Triggering confetti for start runner');
      triggerConfetti({ particleCount: 100, spread: 70 });
      
      // Use the improved atomic start runner function that handles all scenarios
      // It will automatically determine the correct action based on the current state
      if (!currentRunner) {
        // Starting the first leg - no current runner exists
        console.log('[handleStartRunner] Starting first leg:', nextRunner.id);
        startNextRunner(null, nextRunner.id);
      } else {
        // Transitioning from current to next leg
        console.log('[handleStartRunner] Transitioning from leg', currentRunner.id, 'to leg', nextRunner.id);
        startNextRunner(currentRunner.id, nextRunner.id);
      }
      
      // Force immediate UI refresh by updating currentTime
      setCurrentTime(new Date());
      
      // Show appropriate toast message based on the scenario
      if (!currentRunner) {
        toast.success(`Started ${nextRunnerInfo?.name || `Runner ${nextRunner.runnerId}`} on Leg ${nextRunner.id}`);
      } else if (nextRunner.id === 36) {
        toast.success(`Finished ${currentRunnerInfo?.name || `Runner ${currentRunner.runnerId}`} on Final Leg`);
      } else {
        toast.success(`Transitioned from ${currentRunnerInfo?.name || `Runner ${currentRunner.runnerId}`} to ${nextRunnerInfo?.name || `Runner ${nextRunner.runnerId}`}`);
      }
    } catch (error) {
      console.error('[handleStartRunner] Error:', error);
      toast.error('Failed to start runner. Please try again.');
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
    // Only consider race complete if the last leg has both start and finish times,
    // and the finish time is valid (after start time and not in the future)
    return lastLeg && 
           lastLeg.actualFinish !== undefined && 
           lastLeg.actualStart !== undefined &&
           lastLeg.actualFinish > lastLeg.actualStart &&
           lastLeg.actualFinish <= Date.now();
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
                  <div className="flex items-center justify-center gap-2">
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

            {/* Next Runner Card - Restored blue styling */}
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
                ) : (() => {
                  // Don't show race completion content if data is still loading
                  if (isDataLoading) {
                    return false; // This will show the skeleton instead
                  }
                  
                  // Check if race is completed (leg 36 has actual finish time)
                  const leg36 = legs.find(leg => leg.id === 36);
                  const isRaceCompleted = leg36?.actualFinish;
                  
                  // Show race completed content only if leg 36 is finished
                  if (isRaceCompleted) {
                    return false; // This will trigger the else block with race completed content
                  }
                  
                  // Show next runner content if:
                  // 1. We have a next runner with valid runner info, OR
                  // 2. Leg 36 is currently running, OR
                  // 3. We have legs but no next runner (race hasn't started yet), OR
                  // 4. We have legs and a next runner but no runner info (data loading issue)
                  return (nextRunner && nextRunnerInfo) || 
                         (leg36?.actualStart && !leg36?.actualFinish) ||
                         (legs.length > 0 && !nextRunner) ||
                         (legs.length > 0 && nextRunner && !nextRunnerInfo);
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
                      
                      <div className="flex flex-col items-center gap-2 mt-6">
                        <Button
                          onClick={() => {
                            console.log('Triggering confetti for celebrate');
                            triggerConfetti({ particleCount: 150, spread: 80 });
                            toast(getRandomCelebrationMessage());
                          }}
                          size="lg"
                          className="bg-green-500 hover:bg-green-600 text-white px-6 py-3"
                        >
                          🎉 Celebrate
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
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
                ) : (() => {
                  // Don't show race completion content if data is still loading
                  if (isDataLoading) {
                    return false; // This will show the skeleton instead
                  }
                  
                  // Check if race is completed (leg 36 has actual finish time)
                  const leg36 = legs.find(leg => leg.id === 36);
                  const isRaceCompleted = leg36?.actualFinish && leg36?.actualStart;
                  
                  // Additional validation: ensure the finish time is valid and not in the future
                  const isValidCompletion = isRaceCompleted && 
                    leg36 && leg36.actualFinish && leg36.actualStart &&
                    leg36.actualFinish > leg36.actualStart && 
                    leg36.actualFinish <= Date.now();
                  
                  // Show race completed content only if leg 36 is properly finished
                  if (isValidCompletion) {
                    return false; // This will trigger the else block with race completed content
                  }
                  
                  // Show next runner content if:
                  // 1. We have a next runner with valid runner info, OR
                  // 2. Leg 36 is currently running, OR
                  // 3. We have legs but no next runner (race hasn't started yet), OR
                  // 4. We have legs and a next runner but no runner info (data loading issue)
                  return (nextRunner && nextRunnerInfo) || 
                         (leg36?.actualStart && !leg36?.actualFinish) ||
                         (legs.length > 0 && !nextRunner) ||
                         (legs.length > 0 && nextRunner && !nextRunnerInfo);
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
                                const isBeforeRaceStart = currentTime.getTime() < actualRaceStartTime;
                                const isFirstLeg = nextRunner && nextRunner.id === 1;
                                
                                // Before race starts, show official start time for leg 1
                                if (isFirstLeg && isBeforeRaceStart) {
                                  return formatRaceTime(actualRaceStartTime);
                                }
                                
                                // For other legs or after race starts, use effective start time
                                return nextRunner ? formatRaceTime(getEffectiveStartTime(nextRunner, legs, actualRaceStartTime)) : '--';
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
                                  className="font-semibold px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white"
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
                                  className="font-semibold px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white"
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
                      const copyText = `Join ${teamName} using this token!:\n ${team.invite_token}`;
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
              
              {/* Right side - Fallback share button and PWA install - hidden in view-only mode */}
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
                  
                  {/* Notification Toggle Button */}
                  {notificationsSupported && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const permission = notificationPermission();
                        
                        if (permission === 'granted') {
                          // Toggle notification preference
                          const isCurrentlyEnabled = isNotificationPreferenceEnabled();
                          if (isCurrentlyEnabled) {
                            clearNotificationPreference();
                            toast.success('Notifications disabled');
                          } else {
                            setNotificationPreference(true);
                            toast.success('Notifications enabled! You\'ll get alerts when runners start and finish.');
                          }
                        } else {
                          // Request permission first
                          try {
                            const newPermission = await notificationManager.requestPermission();
                            if (newPermission === 'granted') {
                              toast.success('Notifications enabled! You\'ll get alerts when runners start and finish.');
                            } else {
                              toast.error('Notification permission denied');
                            }
                          } catch (error) {
                            console.error('Notification permission request failed:', error);
                            toast.error('Failed to request notification permission');
                          }
                        }
                      }}
                      title={notificationPermission() === 'granted' 
                        ? (isNotificationPreferenceEnabled() ? 'Disable notifications' : 'Enable notifications')
                        : 'Enable push notifications for runner updates'
                      }
                    >
                      {notificationPermission() === 'granted' && isNotificationPreferenceEnabled() ? (
                        <Bell className="h-4 w-4" />
                      ) : (
                        <BellOff className="h-4 w-4" />
                      )}
                    </Button>
                  )}

                  {/* Test Notification Button - Only show in development */}
                  {process.env.NODE_ENV === 'development' && notificationPermission() === 'granted' && isNotificationPreferenceEnabled() && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await notificationManager.showTestNotification();
                          toast.success('Test notification sent!');
                          
                          // Also show a browser alert as a fallback for testing
                          setTimeout(() => {
                            alert('Test notification should have appeared! Check your browser notifications.');
                          }, 1000);
                        } catch (error) {
                          console.error('Test notification failed:', error);
                          toast.error('Test notification failed');
                        }
                      }}
                      title="Send test notification"
                    >
                      <Bell className="h-4 w-4 mr-1" />
                      Test
                    </Button>
                  )}

                  {/* Background Test Notification Button - Only show in development */}
                  {process.env.NODE_ENV === 'development' && notificationPermission() === 'granted' && isNotificationPreferenceEnabled() && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await notificationManager.showBackgroundTestNotification();
                          toast.success('Background test notification sent!');
                          
                          // Also show a browser alert as a fallback for testing
                          setTimeout(() => {
                            alert('Background test notification sent! Check your browser notifications.');
                          }, 1000);
                        } catch (error) {
                          console.error('Background test notification failed:', error);
                          toast.error('Background test notification failed');
                        }
                      }}
                      title="Send background test notification"
                    >
                      <Bell className="h-4 w-4 mr-1" />
                      Background Test
                    </Button>
                  )}

                  {/* Enhanced Sync System Test Button - Only show in development */}
                  {process.env.NODE_ENV === 'development' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Import and run the test
                        import('@/utils/syncTest').then(({ testDecoupledSystem, testRealtimeSubscription, testSyncPerformance, testDataFetching, testStoreUpdates }) => {
                          testDecoupledSystem();
                          setTimeout(() => testRealtimeSubscription(), 500);
                          setTimeout(() => testSyncPerformance(), 1000);
                          setTimeout(() => testDataFetching(), 1500);
                          setTimeout(() => testStoreUpdates(), 2000);
                        });
                      }}
                      title="Test enhanced sync system"
                    >
                      <HelpCircle className="h-4 w-4 mr-1" />
                      Test Sync
                    </Button>
                  )}

                  {/* Data Loading Debug Button - Only show in development */}
                  {process.env.NODE_ENV === 'development' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        console.log('[Dashboard] Debug: Current state:', {
                          teamId,
                          legs: legs.length,
                          runners: runners.length,
                          isSetupComplete,
                          isViewOnly,
                          loading,
                          currentRunner: currentRunner?.id,
                          nextRunner: nextRunner?.id,
                          currentRunnerInfo: currentRunnerInfo?.name,
                          nextRunnerInfo: nextRunnerInfo?.name
                        });
                        
                        if (teamId && legs.length === 0) {
                          console.log('[Dashboard] Debug: Attempting to load data...');
                          try {
                            await fetchLatestData();
                            console.log('[Dashboard] Debug: fetchLatestData completed');
                            
                            const currentState = useRaceStore.getState();
                            console.log('[Dashboard] Debug: State after fetch:', {
                              legs: currentState.legs.length,
                              runners: currentState.runners.length
                            });
                            
                            if (currentState.legs.length === 0) {
                              console.log('[Dashboard] Debug: Still no legs, initializing...');
                              initializeLegs();
                            }
                          } catch (error) {
                            console.error('[Dashboard] Debug: Error loading data:', error);
                          }
                        }
                      }}
                      title="Debug data loading"
                    >
                      <HelpCircle className="h-4 w-4 mr-1" />
                      Debug Data
                    </Button>
                  )}

                  {/* Manual Sync Button - Only show in development */}
                  {process.env.NODE_ENV === 'development' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        console.log('[Dashboard] Manual sync triggered');
                        manualRetry();
                      }}
                      title="Manually trigger sync"
                    >
                      <Cloud className="h-4 w-4 mr-1" />
                      Manual Sync
                    </Button>
                  )}

                  {/* Notification Debug Button - Only show in development */}
                  {process.env.NODE_ENV === 'development' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const queueStatus = notificationManager.getQueueStatus();
                        const pendingCount = getPendingNotificationsCount?.() || 0;
                        const notificationStateData = getNotificationState?.() || {};
                        
                        const debugInfo = {
                          permission: notificationPermission(),
                          preference: isNotificationPreferenceEnabled(),
                          queueStatus,
                          pendingCount,
                          notificationState: notificationStateData,
                          pageVisible: !document.hidden,
                          serviceWorker: !!navigator.serviceWorker?.controller,
                          timestamp: new Date().toISOString()
                        };
                        
                        console.log('Notification Debug Info:', debugInfo);
                        alert(`Notification Debug Info:\n${JSON.stringify(debugInfo, null, 2)}`);
                      }}
                      title="Debug notification system"
                    >
                      <HelpCircle className="h-4 w-4 mr-1" />
                      Debug
                    </Button>
                  )}

                  {/* Clear Notification Queue Button - Only show in development */}
                  {process.env.NODE_ENV === 'development' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        notificationManager.clearPendingNotifications();
                        toast.success('Notification queue cleared');
                      }}
                      title="Clear pending notifications"
                    >
                      <Undo className="h-4 w-4 mr-1" />
                      Clear Queue
                    </Button>
                  )}

                  {/* PWA Install Button */}
                  {canInstall && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const success = await install();
                          if (success) {
                            toast.success('App installed successfully!');
                          }
                        } catch (error) {
                          console.error('Install failed:', error);
                          toast.error('Installation failed');
                        }
                      }}
                      title="Install RelaySplits app"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Install App
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

      {/* Enhanced sync integration is now handled by useEnhancedSyncManager */}

      {/* Quick Help Popup for new team members */}
      <QuickHelpPopup 
        isOpen={shouldShowHelp && !isViewOnly} 
        onClose={dismissHelp} 
      />

      {/* Dashboard Prompts - PWA Install and Notification Permission */}
      <DashboardPrompts />
    </>
  );
};

export default Dashboard;



