
import { useState, useEffect } from 'react';
import { invokeEdge, getDeviceId } from '@/integrations/supabase/edge';
import { useRaceStore } from '@/store/raceStore';
import { toast } from 'sonner';

interface Team {
  id: string;
  name: string;
  start_time: string;
  invite_token?: string;
  join_code?: string;
}

interface DeviceInfo {
  deviceId: string;
  teamId: string;
  role: string;
  firstName: string;
  lastName: string;
  displayName: string;
}

export const useTeamSync = () => {
  const [team, setTeam] = useState<Team | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStoredTeamInfo();
  }, []);

  const loadStoredTeamInfo = () => {
    try {
      const storedTeamId = localStorage.getItem('relay_team_id');
      const storedDeviceInfo = localStorage.getItem('relay_device_info');
      const storedTeamName = localStorage.getItem('relay_team_name');
      
      if (storedTeamId && storedDeviceInfo) {
        const deviceInfo = JSON.parse(storedDeviceInfo) as DeviceInfo;
        setDeviceInfo(deviceInfo);
        
        // Set team info in race store
        const race = useRaceStore.getState();
        race.setTeamId(storedTeamId);
        
        // Set team with stored name and start time if available
        const storedTeamStartTime = localStorage.getItem('relay_team_start_time');
        
        if (storedTeamName) {
          // If we have a stored team start time, use it; otherwise use race store's current start time
          const race = useRaceStore.getState();
          const teamStartTime = storedTeamStartTime || new Date(race.startTime).toISOString();
          

          
          setTeam({ 
            id: storedTeamId, 
            name: storedTeamName, 
            start_time: teamStartTime
          });
          
          // Sync race store start time with team start time
          race.setStartTime(new Date(teamStartTime).getTime());
        } else {
          // Try to fetch current team details via Edge Function
          fetchTeamDetails(storedTeamId);
        }
      }
    } catch (error) {
      console.error('Error loading stored team info:', error);
    }
  };

  const fetchTeamDetails = async (teamId: string) => {
    try {
      const deviceId = getDeviceId();
      // Use runners-list as a proxy to verify team access
      const result = await invokeEdge<{ runners: any[] }>('runners-list', { teamId, deviceId });
      
      if (!(result as any).error) {
        // Team access is valid, get stored team name and start time or use defaults
        const storedTeamName = localStorage.getItem('relay_team_name');
        const storedTeamStartTime = localStorage.getItem('relay_team_start_time');
        
        // If we have a stored team start time, use it; otherwise use race store's current start time
        const race = useRaceStore.getState();
        const teamStartTime = storedTeamStartTime || new Date(race.startTime).toISOString();
        
        setTeam({ 
          id: teamId, 
          name: storedTeamName || 'Team', 
          start_time: teamStartTime
        });
        
        // Sync race store start time with team start time
        race.setStartTime(new Date(teamStartTime).getTime());
      }
    } catch (error) {
      console.error('Error fetching team details:', error);
    }
  };

  const createTeam = async (name: string, firstName: string, lastName: string) => {
    setLoading(true);
    
    try {
      // Create team via Edge Function (expects: name, optional admin_display_name, device_profile)
      const result = await invokeEdge<{
        teamId: string;
        invite_token: string;
        join_code: string;
        admin_secret: string;
        deviceId: string;
      }>('teams-create', {
        name,
        admin_display_name: `${firstName} ${lastName}`,
        device_profile: {
          first_name: firstName,
          last_name: lastName,
          display_name: `${firstName} ${lastName}`,
        },
      });

      if ((result as any).error) {
        setLoading(false);
        return { error: (result as any).error.message || 'Failed to create team' };
      }

      const {
        teamId,
        invite_token: inviteToken,
        join_code: joinCode,
        deviceId,
      } = (result as any).data as {
        teamId: string;
        invite_token: string;
        join_code: string;
        deviceId: string;
      };

      // Store team and device info locally
      const newDeviceInfo: DeviceInfo = {
        deviceId,
        teamId,
        role: 'admin',
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`
      };

      localStorage.setItem('relay_team_id', teamId);
      localStorage.setItem('relay_device_info', JSON.stringify(newDeviceInfo));
      localStorage.setItem('relay_team_name', name);
      // Ensure the global deviceId used by Edge Functions matches the server-registered one
      localStorage.setItem('relay_device_id', deviceId);
      
      // Use race store's current start time for new team
      const race = useRaceStore.getState();
      const teamStartTime = new Date(race.startTime).toISOString();
      setTeam({ id: teamId, name, start_time: teamStartTime, invite_token: inviteToken, join_code: joinCode });
      localStorage.setItem('relay_team_start_time', teamStartTime);
      setDeviceInfo(newDeviceInfo);

      // Reset race store for new team
      race.setTeamId(teamId);
      race.setRaceData({ isSetupComplete: false });
      race.setSetupStep(1);
      race.setDidInitFromTeam(false);
      // Don't set start time here - it will be set in SetupWizard

      setLoading(false);
      return { success: true, teamId, inviteToken };
    } catch (error) {
      setLoading(false);
      return { error: 'Failed to create team' };
    }
  };

  const joinTeam = async (codeOrToken: string, firstName: string, lastName: string) => {
    setLoading(true);
    
    try {
      const deviceId = getDeviceId();
      
      // Normalize/parse the input which could be:
      // - a full URL with query (?invite_token=..., ?token=..., ?t=..., ?join_code=..., ?code=...)
      // - a URL with last path segment as code
      // - a raw invite token (long)
      // - a raw short join code
      const parseJoinInput = (raw: string): { invite_token?: string; join_code?: string } => {
        const input = raw.trim();
        // Try URL parsing
        try {
          const u = new URL(input);
          const qp = u.searchParams;
          const invite = qp.get('invite_token') || qp.get('token') || qp.get('t');
          const code = qp.get('join_code') || qp.get('code') || qp.get('c');
          if (invite) return { invite_token: invite.trim() };
          if (code) return { join_code: code.trim() };
          // Fall back to last path segment if present
          const segments = u.pathname.split('/').filter(Boolean);
          if (segments.length) {
            const last = segments[segments.length - 1];
            if (last.length >= 3 && last.length <= 64) {
              return { join_code: last.trim() };
            }
          }
        } catch (_) {
          // Not a URL; continue
        }
        // Not a URL: decide by shape
        if (input.length <= 64) {
          // Heuristic: short-ish strings without spaces likely join codes
          if (!input.includes(' ') && input.length <= 16) {
            return { join_code: input };
          }
        }
        return { invite_token: input };
      };

      const parsed = parseJoinInput(codeOrToken);

      // Base payload
      const basePayload = {
        device_profile: {
          first_name: firstName,
          last_name: lastName,
          display_name: `${firstName} ${lastName}`,
        },
        device_id: deviceId,
      } as const;

      // Call once with the correctly parsed field
      const result = await invokeEdge<{ teamId: string; role: string; teamName: string; deviceId: string }>('teams-join', {
        ...basePayload,
        ...parsed,
      });

      if ((result as any).error) {
        setLoading(false);
        return { error: (result as any).error.message || 'Failed to join team' };
      }

      const { teamId, role, teamName, deviceId: returnedDeviceId } = (result as any).data as {
        teamId: string;
        role: string;
        teamName: string;
        deviceId: string;
      };

      // Store team and device info locally
      const newDeviceInfo: DeviceInfo = {
        deviceId: returnedDeviceId || deviceId,
        teamId,
        role,
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`
      };

      localStorage.setItem('relay_team_id', teamId);
      localStorage.setItem('relay_device_info', JSON.stringify(newDeviceInfo));
      // Ensure the global deviceId used by Edge Functions matches the server-registered one
      localStorage.setItem('relay_device_id', newDeviceInfo.deviceId);
      
      // Use race store's current start time for joined team
      const race = useRaceStore.getState();
      const teamStartTime = new Date(race.startTime).toISOString();
      setTeam({ id: teamId, name: teamName, start_time: teamStartTime });
      localStorage.setItem('relay_team_start_time', teamStartTime);
      setDeviceInfo(newDeviceInfo);

      // Reset race store for joined team
      race.setTeamId(teamId);
      race.setRaceData({ isSetupComplete: false });
      race.setSetupStep(1);
      race.setDidInitFromTeam(false);

      setLoading(false);
      return { success: true };
    } catch (error) {
      setLoading(false);
      return { error: 'Failed to join team' };
    }
  };

  const leaveTeam = () => {
    // Clear local storage
    localStorage.removeItem('relay_team_id');
    localStorage.removeItem('relay_device_info');
    localStorage.removeItem('relay_device_id');
    localStorage.removeItem('relay_team_start_time');
    
    // Clear state
    setTeam(null);
    setDeviceInfo(null);
    
    // Reset race store
    const race = useRaceStore.getState();
    race.setTeamId(undefined);
    race.forceReset();
  };

  const updateTeamStartTime = async (newStartTime: Date) => {
    if (!team || !deviceInfo) return { error: 'Not ready' };
    
    try {
      // For now, just update locally since we don't have a teams-update Edge Function
      // TODO: Add teams-update Edge Function for start time updates
      
      // Update local team state and localStorage
      const startTimeISO = newStartTime.toISOString();
      setTeam({ ...team, start_time: startTimeISO });
      localStorage.setItem('relay_team_start_time', startTimeISO);

      // Propagate to race store
      const race = useRaceStore.getState();
      const startMs = newStartTime.getTime();
      race.setStartTime(startMs);

      // Ensure legs exist
      if (race.legs.length === 0) {
        race.initializeLegs();
      }
      
      const latest = useRaceStore.getState();
      const firstLeg = latest.legs[0];

      const now = Date.now();
      if (startMs <= now) {
        // Set leg 1 actual start to that time immediately
        if (firstLeg && firstLeg.actualStart !== startMs) {
          latest.updateLegActualTime(1, 'actualStart', startMs);
        }
      }

      latest.setLastSyncedAt(Date.now());

      toast.success('Team start time updated');
      return { success: true };
    } catch (e) {
      toast.error('Failed to update team start time');
      return { error: 'Unexpected error' };
    }
  };

  return {
    team,
    deviceInfo,
    loading,
    createTeam,
    joinTeam,
    leaveTeam,
    refetch: loadStoredTeamInfo,
    updateTeamStartTime
  };
};
