import React, { createContext, useContext, useEffect, useState } from 'react';
import { getDeviceId } from '@/integrations/supabase/edge';

interface DeviceInfo {
  deviceId: string;
  teamId: string;
  role: string;
  firstName: string;
  lastName: string;
  displayName: string;
}

interface TeamContextType {
  deviceInfo: DeviceInfo | null;
  teamId: string | null;
  isInTeam: boolean;
  loading: boolean;
  setDeviceInfo: (info: DeviceInfo | null) => void;
  clearTeam: () => void;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export const useTeam = () => {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
};

export const TeamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deviceInfo, setDeviceInfoState] = useState<DeviceInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load stored team/device info on mount
    loadStoredInfo();
  }, []);

  const loadStoredInfo = () => {
    try {
      const storedTeamId = localStorage.getItem('relay_team_id');
      const storedDeviceInfo = localStorage.getItem('relay_device_info');
      
      console.log('[TeamContext] Loading stored info:', {
        storedTeamId,
        storedDeviceInfo: storedDeviceInfo ? 'present' : 'null'
      });
      
      if (storedTeamId && storedDeviceInfo) {
        const deviceInfo = JSON.parse(storedDeviceInfo) as DeviceInfo;
        console.log('[TeamContext] Setting device info from localStorage:', deviceInfo);
        setDeviceInfoState(deviceInfo);
      } else {
        console.log('[TeamContext] No stored team info found');
      }
    } catch (error) {
      console.error('Error loading stored team info:', error);
    } finally {
      setLoading(false);
    }
  };

  const setDeviceInfo = (info: DeviceInfo | null) => {
    console.log('[TeamContext] setDeviceInfo called with:', info);
    setDeviceInfoState(info);
    
    if (info) {
      localStorage.setItem('relay_team_id', info.teamId);
      localStorage.setItem('relay_device_info', JSON.stringify(info));
      console.log('[TeamContext] Updated localStorage with team info');
    } else {
      localStorage.removeItem('relay_team_id');
      localStorage.removeItem('relay_device_info');
      console.log('[TeamContext] Cleared localStorage team info');
    }
  };

  const clearTeam = () => {
    setDeviceInfo(null);
  };

  const value: TeamContextType = {
    deviceInfo,
    teamId: deviceInfo?.teamId || null,
    isInTeam: !!deviceInfo?.teamId,
    loading,
    setDeviceInfo,
    clearTeam
  };

  return (
    <TeamContext.Provider value={value}>
      {children}
    </TeamContext.Provider>
  );
};
