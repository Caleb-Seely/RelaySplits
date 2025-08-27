import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
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
  getCountdownTime,
  formatCountdown,
  calculateCurrentDistance,
  getEffectiveStartTime,
  clearRunnerCache
} from '@/utils/raceUtils';
import { getRandomCelebrationMessage } from '@/utils/celebrationMessages';
import { triggerConfetti } from '@/utils/confetti';
import { useRaceTracking, useFeatureUsageTracking, useTechnicalTracking } from '@/hooks/useAnalytics';
import { detectMissingTimeConflicts } from '@/utils/dataConsistency';

export const useDashboard = (isViewOnly: boolean, viewOnlyTeamName?: string) => {
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
    validateSingleRunnerRule,
    autoFixSingleRunnerViolations,
    initializeLegs
  } = useRaceStore();

  const { onConflictDetected } = useConflictResolution();
  const { performSmartSync, getQueueStatus, isProcessingSync, setupRealtimeSubscriptions, manualRetry, fetchLatestData } = useEnhancedSyncManager();
  const { trackRaceStarted, trackLegCompleted, trackVanSwitched, trackRunnerAdded } = useRaceTracking();
  const { trackConfettiTest, trackConfettiStartRunner, trackConfettiCelebration, trackConfettiFinishRace, trackCelebrationButtonClicked } = useFeatureUsageTracking();
  const { trackSyncError } = useTechnicalTracking();
  const { trackFeatureUsage } = useFeatureUsageTracking();
  const { trackTechnicalEvent } = useTechnicalTracking();
  const { trackRaceEvent } = useRaceTracking();

  const { team, updateTeamStartTime, loading, refreshTeamData } = useTeamSync();
  const { deviceInfo } = useTeam();

  // State
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
  const [aboutMeModalOpen, setAboutMeModalOpen] = useState(false);
  const [isStartingRunner, setIsStartingRunner] = useState(false);
  const [lastRealtimeUpdate, setLastRealtimeUpdate] = useState<number | null>(null);

  // Determine if user can edit
  const canEdit = !isViewOnly && (deviceInfo?.role === 'admin' || deviceInfo?.role === 'member');

  // Enhanced sync setup
  useEffect(() => {
    if (!teamId || isViewOnly) return;
    
    console.log('[Dashboard] Setting up real-time subscriptions for team:', teamId);
    
    let cleanup: (() => void) | undefined;
    let syncStatusInterval: NodeJS.Timeout;
    
    const timeoutId = setTimeout(() => {
      cleanup = setupRealtimeSubscriptions(teamId);
      
      syncStatusInterval = setInterval(() => {
        const queueStatus = getQueueStatus();
        if (queueStatus.pendingCount > 0) {
          console.log('[Dashboard] Pending sync items:', queueStatus);
        }
      }, 10000);
    }, 100);
    
    return () => {
      clearTimeout(timeoutId);
      if (cleanup) cleanup();
      if (syncStatusInterval) clearInterval(syncStatusInterval);
    };
  }, [teamId, setupRealtimeSubscriptions, isViewOnly]);

  // Data loading effect
  useEffect(() => {
    if (!teamId || isViewOnly) return;
    
    const loadDataIfNeeded = async () => {
      const storedTeamStartTime = localStorage.getItem('relay_team_start_time');
      if (storedTeamStartTime) {
        const storedTime = new Date(storedTeamStartTime).getTime();
        const raceStoreTime = startTime;
        
        if (Math.abs(storedTime - raceStoreTime) > 1000) {
          const { setStartTime } = useRaceStore.getState();
          setStartTime(storedTime);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      if (legs.length === 0 && teamId) {
        if (isSetupComplete && runners.length > 0) {
          initializeLegs();
        } else if (isSetupComplete && runners.length === 0) {
          try {
            await fetchLatestData();
            const currentState = useRaceStore.getState();
            if (currentState.legs.length === 0) {
              initializeLegs();
            }
          } catch (error) {
            console.error('[Dashboard] Error fetching data:', error);
            initializeLegs();
          }
        } else {
          try {
            await fetchLatestData();
            const currentState = useRaceStore.getState();
            if (currentState.legs.length === 0) {
              initializeLegs();
            }
          } catch (error) {
            console.error('[Dashboard] Error loading data:', error);
            if (legs.length === 0) {
              initializeLegs();
            }
          }
        }
      } else if (legs.length === 0 && runners.length > 0) {
        initializeLegs();
      }
    };
    
    const timeoutId = setTimeout(loadDataIfNeeded, 500);
    return () => clearTimeout(timeoutId);
  }, [teamId, legs.length, runners.length, isSetupComplete, isViewOnly, fetchLatestData, initializeLegs, startTime]);

  // Fallback mechanism
  useEffect(() => {
    if (!teamId || isViewOnly || legs.length > 0) return;
    
    const fallbackTimer = setTimeout(async () => {
      const storedTeamStartTime = localStorage.getItem('relay_team_start_time');
      if (storedTeamStartTime) {
        const storedTime = new Date(storedTeamStartTime).getTime();
        const raceStoreTime = startTime;
        
        if (Math.abs(storedTime - raceStoreTime) > 1000) {
          const { setStartTime } = useRaceStore.getState();
          setStartTime(storedTime);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      initializeLegs();
    }, 3000);
    
    return () => clearTimeout(fallbackTimer);
  }, [teamId, legs.length, isViewOnly, initializeLegs, startTime]);

  // Real-time updates listener
  useEffect(() => {
    let lastNotificationTime = 0;
    const NOTIFICATION_COOLDOWN = 3000;
    
    const unsubscribe = eventBus.subscribe(EVENT_TYPES.REALTIME_UPDATE, (event) => {
      setLastRealtimeUpdate(Date.now());
      
      if (event.payload.device_id !== getDeviceId()) {
        const now = Date.now();
        if (now - lastNotificationTime > NOTIFICATION_COOLDOWN) {
          lastNotificationTime = now;
          toast.success(`Updated`, {
            duration: 2000,
            position: 'top-right'
          });
        }
      }
    });

    return unsubscribe;
  }, []);

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Race state validation
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
    }, 30000);
    
    return () => clearInterval(validationTimer);
  }, [legs.length, isSetupComplete, validateAndFixRaceState]);

  // Calculate actual race start time
  const actualRaceStartTime = (() => {
    const hasActualStart = legs.length > 0 && typeof legs[0].actualStart === 'number';
    const now = Date.now();
    const isActualStartReasonable = hasActualStart && 
      legs[0].actualStart > 0 && 
      legs[0].actualStart < now + (24 * 60 * 60 * 1000) && 
      Math.abs(legs[0].actualStart - now) > 60000;
    
    if (hasActualStart && isActualStartReasonable) {
      return legs[0].actualStart;
    }
    
    if (team?.start_time) {
      const teamStartTime = new Date(team.start_time);
      const placeholderDate = new Date('2099-12-31T23:59:59Z');
      if (Math.abs(teamStartTime.getTime() - placeholderDate.getTime()) > 1000) {
        return teamStartTime.getTime();
      }
    }
    
    const storedTeamStartTime = localStorage.getItem('relay_team_start_time');
    if (storedTeamStartTime) {
      const storedTime = new Date(storedTeamStartTime);
      const placeholderDate = new Date('2099-12-31T23:59:59Z');
      if (Math.abs(storedTime.getTime() - placeholderDate.getTime()) > 1000) {
        return storedTime.getTime();
      }
    }
    
    const defaultStartTime = new Date('2025-08-22T13:00').getTime();
    if (Math.abs(startTime - defaultStartTime) > 1000) {
      return startTime;
    }
    
    if (teamId) {
      return null;
    }
    
    return startTime;
  })();

  // Loading states
  const isWaitingForStartTime = teamId && !actualRaceStartTime && !isViewOnly;
  const isDataLoading = loading || (
    legs.length === 0 && 
    teamId && 
    !isViewOnly && 
    !isSetupComplete
  ) || (
    teamId && 
    !team?.start_time && 
    !isViewOnly
  ) || isWaitingForStartTime;

  // Runner calculations
  const currentRunner = getCurrentRunner(legs, currentTime);
  const nextRunner = getNextRunner(legs, currentTime, actualRaceStartTime ?? undefined);
  
  const isCurrentRunnerLoading = isDataLoading && !currentRunner;
  const isNextRunnerLoading = isDataLoading && !nextRunner;
  
  const currentRunnerInfo = currentRunner
    ? runners.find(r => r.id === currentRunner.runnerId)
    : null;

  const nextRunnerInfo = nextRunner
    ? runners.find(r => r.id === nextRunner.runnerId)
    : null;

  // Utility functions
  const getCountdownToNext = () => {
    if (!nextRunner || !actualRaceStartTime) return null;
    const countdownMs = getCountdownTime(nextRunner, currentTime, legs, actualRaceStartTime);
    return formatCountdown(countdownMs);
  };

  const getNextRunnerPrefix = () => {
    if (!nextRunner || !legs.length) return "Starts in:";
    
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

  const isRaceComplete = () => {
    if (legs.length === 0) return false;
    const lastLeg = legs[legs.length - 1];
    return lastLeg && 
           lastLeg.actualFinish !== undefined && 
           lastLeg.actualStart !== undefined &&
           lastLeg.actualFinish > lastLeg.actualStart &&
           lastLeg.actualFinish <= Date.now();
  };

  const getFinalRaceTime = () => {
    if (!isRaceComplete() || !actualRaceStartTime) return null;
    const lastLeg = legs[legs.length - 1];
    return lastLeg.actualFinish! - actualRaceStartTime;
  };

  // Event handlers
  const handleStartRunner = async () => {
    if (!canEdit || !nextRunner || isStartingRunner) return;
    
    setIsStartingRunner(true);
    
    try {
      clearRunnerCache();
      
      console.log('Triggering confetti for start runner');
      triggerConfetti({ particleCount: 100, spread: 70 });
      trackConfettiStartRunner({
        team_id: teamId,
        leg_number: nextRunner?.id,
        runner_id: nextRunner?.runnerId
      });
      
      if (!currentRunner) {
        console.log('[handleStartRunner] Starting first leg:', nextRunner.id);
        startNextRunner(null, nextRunner.id);
        
        trackRaceStarted({
          team_id: teamId,
          leg_number: nextRunner.id
        });
      } else {
        console.log('[handleStartRunner] Transitioning from leg', currentRunner.id, 'to leg', nextRunner.id);
        startNextRunner(currentRunner.id, nextRunner.id);
        
        trackLegCompleted({
          team_id: teamId,
          leg_number: currentRunner.id,
          runner_id: currentRunner.runnerId
        });
      }
      
      setCurrentTime(new Date());
      
      if (!currentRunner) {
        toast.success(`Started ${nextRunnerInfo?.name || `Runner ${nextRunner.runnerId}`} on Leg ${nextRunner.id}`);
      } else if (nextRunner.id === 36) {
        toast.success(`Finished ${currentRunnerInfo?.name || `Runner ${currentRunner.runnerId}`} on Final Leg`);
      } else {
        toast.success(`Transitioned from ${currentRunnerInfo?.name || `Runner ${currentRunner.runnerId}`} to ${nextRunnerInfo?.name || `Runner ${nextRunner.runnerId}`}`);
      }
      
      toast.success('Runner action synced to database...');
    } catch (error) {
      console.error('[handleStartRunner] Error:', error);
      toast.error('Failed to start runner. Please try again.');
    } finally {
      setTimeout(() => {
        setIsStartingRunner(false);
      }, 1000);
    }
  };

  const handleFinishRace = () => {
    console.log('[Dashboard] Finish Race button clicked for leg 36');
    updateLegActualTime(36, 'actualFinish', Date.now());
    console.log('Triggering confetti for finish race');
    triggerConfetti({ particleCount: 200, spread: 100 });
    trackCelebrationButtonClicked({
      team_id: teamId
    });
    toast.success('Race finished! 🎉');
  };

  const handleCelebrate = () => {
    console.log('Triggering confetti for celebrate');
    triggerConfetti({ particleCount: 150, spread: 80 });
    trackConfettiCelebration({
      team_id: teamId
    });
    trackCelebrationButtonClicked({
      team_id: teamId
    });
    toast(getRandomCelebrationMessage());
  };

  const checkForMissingTimes = useCallback(async () => {
    const missingTimeConflicts = await detectMissingTimeConflicts(legs, runners, teamId);
    if (missingTimeConflicts.length > 0) {
      console.log('[Dashboard] Found missing time conflicts:', missingTimeConflicts);
      missingTimeConflicts.forEach(conflict => {
        onConflictDetected({ type: 'missing_time', ...conflict });
      });
    } else {
      console.log('[Dashboard] No missing time conflicts found');
    }
  }, [legs, runners, onConflictDetected, teamId]);

  const checkSingleRunnerRule = useCallback(() => {
    const validation = validateSingleRunnerRule();
    if (!validation.isValid) {
      console.log('[Dashboard] Single runner rule violations found:', validation.issues);
      const result = autoFixSingleRunnerViolations();
      if (result.fixed) {
        console.log('[Dashboard] Auto-fixed violations:', result.changes);
        trackTechnicalEvent('single_runner_rule_auto_fixed', {
          issues_count: validation.issues.length,
          changes_count: result.changes.length
        });
      }
    } else {
      console.log('[Dashboard] No single runner rule violations found');
    }
  }, [validateSingleRunnerRule, autoFixSingleRunnerViolations, trackTechnicalEvent]);

  const handleVanChange = (van: number) => {
    setCurrentVan(van);
    trackVanSwitched({ team_id: teamId, van_number: van });
  };

  const handleRunnerClick = (runnerId: number, legId: number) => {
    if (!canEdit) return;
    setSelectedRunner(runnerId);
    setInitialLegId(legId);
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

  const handleTimeSubmit = async (timestamp: number) => {
    if (!timePickerConfig) return;
    
    updateLegActualTime(timePickerConfig.legId, timePickerConfig.field, timestamp);
    setTimePickerOpen(false);
    setTimePickerConfig(null);
  };

  return {
    // State
    currentTime,
    editingDistance,
    distanceValue,
    timePickerOpen,
    runnerEditModalOpen,
    selectedRunner,
    initialLegId,
    timePickerConfig,
    viewMode,
    settingsModalOpen,
    aboutMeModalOpen,
    isStartingRunner,
    lastRealtimeUpdate,
    
    // Data
    runners,
    legs,
    currentVan,
    team,
    teamId,
    actualRaceStartTime,
    currentRunner,
    nextRunner,
    currentRunnerInfo,
    nextRunnerInfo,
    
    // Loading states
    isDataLoading,
    isCurrentRunnerLoading,
    isNextRunnerLoading,
    loading,
    
    // Permissions
    canEdit,
    isViewOnly,
    viewOnlyTeamName,
    
    // Utility functions
    getCountdownToNext,
    getNextRunnerPrefix,
    getRemainingDistance,
    isRaceComplete,
    getFinalRaceTime,
    getEffectiveStartTime,
    
    // Event handlers
    handleStartRunner,
    handleFinishRace,
    handleCelebrate,
    handleVanChange,
    handleRunnerClick,
    handleRunnerAssignSave,
    handleTimeSubmit,
    checkForMissingTimes,
    checkSingleRunnerRule,
    
    // Setters
    setEditingDistance,
    setDistanceValue,
    setTimePickerOpen,
    setRunnerEditModalOpen,
    setSelectedRunner,
    setInitialLegId,
    setTimePickerConfig,
    setViewMode,
    setSettingsModalOpen,
    setAboutMeModalOpen,
    
    // External functions
    manualRetry,
    refreshTeamData
  };
};
