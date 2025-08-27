import React, { createContext, useContext, useState, useCallback } from 'react';

import { useRaceStore } from '@/store/raceStore';
import { eventBus, EVENT_TYPES } from '@/utils/eventBus';
import { MissingTimeConflict } from '@/utils/dataConsistency';

interface Conflict {
  id: string;
  runnerName: string;
  legNumber: number;
  field: 'start' | 'finish';
  localTime: number;
  serverTime: number;
  legId: number;
  remoteId: string;
}

interface MissingTimeConflictData {
  id: string;
  legId: number;
  runnerName: string;
  field: 'actualStart' | 'actualFinish';
  suggestedTime?: number;
  previousLegFinishTime?: number;
  nextLegStartTime?: number;
}

interface ConflictResolutionContextType {
  currentConflict: Conflict | null;
  currentMissingTimeConflict: MissingTimeConflictData | null;
  isConflictModalOpen: boolean;
  isMissingTimeModalOpen: boolean;
  showConflict: (conflict: Conflict) => void;
  showMissingTimeConflict: (conflict: MissingTimeConflictData) => void;
  closeConflict: () => void;
  closeMissingTimeConflict: () => void;
  resolveConflict: (selectedTime: number) => void;
  resolveMissingTimeConflict: (selectedTime: number | null) => void;
  onConflictDetected: (conflictData: any) => void;
  onMissingTimeConflictDetected: (conflictData: MissingTimeConflict) => void;
  pendingMissingTimeConflicts: MissingTimeConflictData[];
}

const ConflictResolutionContext = createContext<ConflictResolutionContextType | undefined>(undefined);

export const useConflictResolution = () => {
  const context = useContext(ConflictResolutionContext);
  if (!context) {
    throw new Error('useConflictResolution must be used within a ConflictResolutionProvider');
  }
  return context;
};

interface ConflictResolutionProviderProps {
  children: React.ReactNode;
}

export const ConflictResolutionProvider: React.FC<ConflictResolutionProviderProps> = ({ children }) => {
  const [currentConflict, setCurrentConflict] = useState<Conflict | null>(null);
  const [currentMissingTimeConflict, setCurrentMissingTimeConflict] = useState<MissingTimeConflictData | null>(null);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [isMissingTimeModalOpen, setIsMissingTimeModalOpen] = useState(false);
  const [pendingMissingTimeConflicts, setPendingMissingTimeConflicts] = useState<MissingTimeConflictData[]>([]);
  const { runners } = useRaceStore();

  // CRITICAL FIX: Generate simple conflict ID for UI purposes only
  const generateConflictId = useCallback((conflictData: any): string => {
    const { localLeg, field } = conflictData;
    return `${field}_${localLeg.id}_${Date.now()}`;
  }, []);

  const showConflict = useCallback((conflict: Conflict) => {
    setCurrentConflict(conflict);
    setIsConflictModalOpen(true);
  }, []);

  const closeConflict = useCallback(() => {
    setCurrentConflict(null);
    setIsConflictModalOpen(false);
  }, []);

  const resolveConflict = useCallback(async (selectedTime: number) => {
    if (!currentConflict) return;

    const field = currentConflict.field === 'start' ? 'actualStart' : 'actualFinish';
    
    // CRITICAL FIX: Simply update the data and save it
    const store = useRaceStore.getState();
    const updatedLegs = store.legs.map(leg => 
      leg.id === currentConflict.legId 
        ? { ...leg, [field]: selectedTime }
        : leg
    );
    store.setRaceData({ legs: updatedLegs });

    // Trigger sync to save the resolved data
    eventBus.publish({
      type: EVENT_TYPES.LEG_UPDATE,
      payload: {
        legId: currentConflict.legId,
        field: field === 'actualStart' ? 'start' : 'finish',
        value: selectedTime,
        previousValue: field === 'actualStart' ? currentConflict.localTime : currentConflict.serverTime,
        runnerId: store.legs.find(leg => leg.id === currentConflict.legId)?.runnerId,
        timestamp: Date.now(),
        source: 'conflict-resolution'
      },
      priority: 'high',
      source: 'conflictResolution'
    });

    // Clear the conflict - no need to track it
    setCurrentConflict(null);
    setIsConflictModalOpen(false);
  }, [currentConflict]);

  const showMissingTimeConflict = useCallback((conflict: MissingTimeConflictData) => {
    setCurrentMissingTimeConflict(conflict);
    setIsMissingTimeModalOpen(true);
  }, []);

  const closeMissingTimeConflict = useCallback(() => {
    setCurrentMissingTimeConflict(null);
    setIsMissingTimeModalOpen(false);
  }, []);

  const resolveMissingTimeConflict = useCallback(async (selectedTime: number | null) => {
    if (!currentMissingTimeConflict) return;

    const store = useRaceStore.getState();
    const updatedLegs = store.legs.map(leg => 
      leg.id === currentMissingTimeConflict.legId 
        ? { ...leg, [currentMissingTimeConflict.field]: selectedTime }
        : leg
    );
    store.setRaceData({ legs: updatedLegs });

    // Trigger sync to save the resolved data
    if (selectedTime !== null) {
      eventBus.publish({
        type: EVENT_TYPES.LEG_UPDATE,
        payload: {
          legId: currentMissingTimeConflict.legId,
          field: currentMissingTimeConflict.field === 'actualStart' ? 'start' : 'finish',
          value: selectedTime,
          previousValue: null,
          runnerId: store.legs.find(leg => leg.id === currentMissingTimeConflict.legId)?.runnerId,
          timestamp: Date.now(),
          source: 'missing-time-resolution'
        },
        priority: 'high',
        source: 'missingTimeConflictResolution'
      });
    }

    // Clear current conflict and show next one if available
    setCurrentMissingTimeConflict(null);
    setIsMissingTimeModalOpen(false);
    
    // Show next conflict in queue if available
    if (pendingMissingTimeConflicts.length > 0) {
      const nextConflict = pendingMissingTimeConflicts[0];
      const remainingConflicts = pendingMissingTimeConflicts.slice(1);
      setPendingMissingTimeConflicts(remainingConflicts);
      setCurrentMissingTimeConflict(nextConflict);
      setIsMissingTimeModalOpen(true);
    }
  }, [currentMissingTimeConflict, pendingMissingTimeConflicts]);

  const onConflictDetected = useCallback((conflictData: any) => {
    if (conflictData.type === 'timing') {
      const { localLeg, serverLeg, field } = conflictData;
      const runner = runners.find(r => r.id === localLeg.runnerId);
      
      // CRITICAL FIX: Simple conflict ID for UI only
      const conflictId = generateConflictId(conflictData);
      
      const conflict: Conflict = {
        id: conflictId,
        runnerName: runner?.name || `Runner ${localLeg.runnerId}`,
        legNumber: localLeg.id,
        field: field === 'start' ? 'start' : 'finish',
        localTime: field === 'start' ? localLeg.actualStart : localLeg.actualFinish,
        serverTime: field === 'start' ? serverLeg.actualStart : serverLeg.actualFinish,
        legId: localLeg.id,
        remoteId: localLeg.remoteId
      };
      
      showConflict(conflict);
    } else if (conflictData.type === 'missing_time') {
      const { legId, runnerName, field, suggestedTime, previousLegFinishTime, nextLegStartTime } = conflictData;
      const conflictId = `missing_time_${legId}_${field}_${Date.now()}`;
      
      const conflict: MissingTimeConflictData = {
        id: conflictId,
        legId,
        runnerName,
        field,
        suggestedTime,
        previousLegFinishTime,
        nextLegStartTime
      };
      
      // If no current conflict is being shown, show this one immediately
      if (!currentMissingTimeConflict && !isMissingTimeModalOpen) {
        showMissingTimeConflict(conflict);
      } else {
        // Otherwise, add to queue
        setPendingMissingTimeConflicts(prev => [...prev, conflict]);
      }
    }
  }, [runners, showConflict, generateConflictId, showMissingTimeConflict, currentMissingTimeConflict, isMissingTimeModalOpen]);

  const onMissingTimeConflictDetected = useCallback((conflictData: MissingTimeConflict) => {
    const conflictId = `missing_time_${conflictData.legId}_${conflictData.field}_${Date.now()}`;
    
    const conflict: MissingTimeConflictData = {
      id: conflictId,
      legId: conflictData.legId,
      runnerName: conflictData.runnerName,
      field: conflictData.field,
      suggestedTime: conflictData.suggestedTime,
      previousLegFinishTime: conflictData.previousLegFinishTime,
      nextLegStartTime: conflictData.nextLegStartTime
    };
    
    showMissingTimeConflict(conflict);
  }, [showMissingTimeConflict]);

  const value: ConflictResolutionContextType = {
    currentConflict,
    currentMissingTimeConflict,
    isConflictModalOpen,
    isMissingTimeModalOpen,
    showConflict,
    showMissingTimeConflict,
    closeConflict,
    closeMissingTimeConflict,
    resolveConflict,
    resolveMissingTimeConflict,
    onConflictDetected,
    onMissingTimeConflictDetected,
    pendingMissingTimeConflicts
  };

  return (
    <ConflictResolutionContext.Provider value={value}>
      {children}
    </ConflictResolutionContext.Provider>
  );
};
