import React, { createContext, useContext, useState, useCallback } from 'react';
import { useRaceStore } from '@/store/raceStore';
import { eventBus, EVENT_TYPES } from '@/utils/eventBus';

interface Conflict {
  runnerName: string;
  legNumber: number;
  field: 'start' | 'finish';
  localTime: number;
  serverTime: number;
  legId: number;
  remoteId: string;
}

interface ConflictResolutionContextType {
  currentConflict: Conflict | null;
  isConflictModalOpen: boolean;
  showConflict: (conflict: Conflict) => void;
  closeConflict: () => void;
  resolveConflict: (selectedTime: number) => Promise<void>;
  onConflictDetected: (conflictData: any) => void;
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
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const { runners } = useRaceStore();

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
    
    // Update the local store - this will trigger the event bus and sync automatically
    const store = useRaceStore.getState();
    const updatedLegs = store.legs.map(leg => 
      leg.id === currentConflict.legId 
        ? { ...leg, [field]: selectedTime }
        : leg
    );
    store.setRaceData({ legs: updatedLegs });

    // The enhanced sync manager will automatically handle the sync via event bus
    // No need to manually call sync functions anymore

    // Clear the conflict
    setCurrentConflict(null);
    setIsConflictModalOpen(false);
  }, [currentConflict]);

  const onConflictDetected = useCallback((conflictData: any) => {
    if (conflictData.type === 'timing') {
      const { localLeg, serverLeg, field } = conflictData;
      const runner = runners.find(r => r.id === localLeg.runnerId);
      
      const conflict: Conflict = {
        runnerName: runner?.name || `Runner ${localLeg.runnerId}`,
        legNumber: localLeg.id,
        field: field === 'start' ? 'start' : 'finish',
        localTime: field === 'start' ? localLeg.actualStart : localLeg.actualFinish,
        serverTime: field === 'start' ? serverLeg.actualStart : serverLeg.actualFinish,
        legId: localLeg.id,
        remoteId: localLeg.remoteId
      };
      
      showConflict(conflict);
    }
  }, [runners, showConflict]);

  const value: ConflictResolutionContextType = {
    currentConflict,
    isConflictModalOpen,
    showConflict,
    closeConflict,
    resolveConflict,
    onConflictDetected
  };

  return (
    <ConflictResolutionContext.Provider value={value}>
      {children}
    </ConflictResolutionContext.Provider>
  );
};
