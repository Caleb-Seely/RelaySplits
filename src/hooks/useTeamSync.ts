
import { useState, useEffect } from 'react';
import { invokeEdge, getDeviceId } from '@/integrations/supabase/edge';
import { useRaceStore } from '@/store/raceStore';
import { useTeam } from '@/contexts/TeamContext';
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
  const { deviceInfo, setDeviceInfo } = useTeam();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStoredTeamInfo();
  }, []);

  const loadStoredTeamInfo = () => {
    try {
      const storedTeamId = localStorage.getItem('relay_team_id');
      const storedDeviceInfo = localStorage.getItem('relay_device_info');
      const storedTeamName = localStorage.getItem('relay_team_name');
      const storedJoinCode = localStorage.getItem('relay_team_join_code');
      const storedInviteToken = localStorage.getItem('relay_team_invite_token');
      

      
      if (storedTeamId && storedDeviceInfo) {
        const deviceInfoData = JSON.parse(storedDeviceInfo) as DeviceInfo;
        // Only set device info if it's not already set to avoid triggering unnecessary updates
        if (!deviceInfo || deviceInfo.teamId !== deviceInfoData.teamId) {
          setDeviceInfo(deviceInfoData);
        }
        
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
            start_time: teamStartTime,
            join_code: storedJoinCode || undefined,
            invite_token: storedInviteToken || undefined
          });
          
          // Sync race store start time with team start time
          race.setStartTime(new Date(teamStartTime).getTime());
          
          // Initialize legs if they don't exist yet (with delay to ensure sync tracking is ready)
          if (race.legs.length === 0) {
            setTimeout(() => {
              const currentRace = useRaceStore.getState();
              if (currentRace.legs.length === 0) {
                currentRace.initializeLegs();
              }
            }, 100);
          }
        } else {
          // Try to fetch current team details via Edge Function
          if (storedTeamId) {
            fetchTeamDetails(storedTeamId);
          }
        }
      }
    } catch (error) {
      console.error('Error loading stored team info:', error);
    }
  };

  const fetchTeamDetails = async (teamId: string | undefined) => {
    if (!teamId) {
      console.warn('[fetchTeamDetails] No teamId provided');
      return;
    }
    
    try {
      const deviceId = getDeviceId();
      console.log('[fetchTeamDetails] Fetching team details for teamId:', teamId, 'deviceId:', deviceId);
      
      // Use teams-get to fetch team details including join_code and invite_token
      const result = await invokeEdge<{ team: { id: string; name: string; start_time: string; join_code: string; invite_token?: string } }>('teams-get', { teamId, deviceId });
      
      console.log('[fetchTeamDetails] Result:', result);
      
      if (!(result as any).error) {
        const teamData = (result as any).data.team;
        console.log('[fetchTeamDetails] Team data received:', teamData);
        
        // Store team details in localStorage
        localStorage.setItem('relay_team_name', teamData.name);
        localStorage.setItem('relay_team_start_time', teamData.start_time);
        localStorage.setItem('relay_team_join_code', teamData.join_code);
        if (teamData.invite_token) {
          localStorage.setItem('relay_team_invite_token', teamData.invite_token);
          console.log('[fetchTeamDetails] Stored invite token:', teamData.invite_token);
        } else {
          console.log('[fetchTeamDetails] No invite token in team data');
        }
        
        // Set team in state
        setTeam({ 
          id: teamData.id, 
          name: teamData.name, 
          start_time: teamData.start_time,
          join_code: teamData.join_code,
          invite_token: teamData.invite_token
        });
        
        // Sync race store start time with team start time
        const race = useRaceStore.getState();
        race.setStartTime(new Date(teamData.start_time).getTime());
        
        // Initialize legs if they don't exist yet (with delay to ensure sync tracking is ready)
        if (race.legs.length === 0) {
          setTimeout(() => {
            const currentRace = useRaceStore.getState();
            if (currentRace.legs.length === 0) {
              currentRace.initializeLegs();
            }
          }, 100);
        }
      } else {
        console.error('[fetchTeamDetails] Error in result:', (result as any).error);
      }
    } catch (error) {
      console.error('Error fetching team details:', error);
    }
  };

  const createTeam = async (name: string, firstName: string, lastName: string) => {
    setLoading(true);
    
    try {
      // Create team via Edge Function (expects: name, admin_display_name, device_profile)
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
        admin_secret: adminSecret,
        deviceId,
      } = (result as any).data as {
        teamId: string;
        invite_token: string;
        join_code: string;
        admin_secret: string;
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
      
      // Store admin secret securely
      localStorage.setItem('relay_admin_secret', adminSecret);
      
      // Store team data in localStorage but don't update context yet
      // This prevents Index.tsx from thinking it's an existing team
      console.log('[createTeam] Storing team data in localStorage but not updating context yet');
      const race = useRaceStore.getState();
      const teamStartTime = new Date(race.startTime).toISOString();
      localStorage.setItem('relay_team_start_time', teamStartTime);
      localStorage.setItem('relay_team_join_code', joinCode);
      localStorage.setItem('relay_team_invite_token', inviteToken);
      
      // Set the new team flag immediately to prevent Index.tsx from treating this as an existing team
      localStorage.setItem('relay_is_new_team', '1');
      console.log('[createTeam] New team flag set immediately');
      
      // Don't call setTeam() or setDeviceInfo() here - this will be done after admin secret dialog
      // This prevents Index.tsx from immediately thinking it's an existing team
      console.log('[createTeam] Team context will be updated after admin secret dialog is closed');
      
      // Reset race store for new team
      race.setTeamId(teamId);
      race.setRaceData({ isSetupComplete: false });
      race.setSetupStep(1);
      race.setDidInitFromTeam(false);
      // Don't set start time here - it will be set in SetupWizard

      setLoading(false);
      return { success: true, teamId, inviteToken, adminSecret };
    } catch (error) {
      setLoading(false);
      return { error: 'Failed to create team' };
    }
  };

  const joinTeam = async (codeOrToken: string, firstName: string, lastName: string) => {
    setLoading(true);
    
    try {
      const deviceId = getDeviceId();
      
      // Parse invite token from various formats
      const parseInviteToken = (raw: string): string => {
        const input = raw.trim();
        // Try URL parsing
        try {
          const u = new URL(input);
          const qp = u.searchParams;
          const invite = qp.get('invite_token') || qp.get('token') || qp.get('t');
          if (invite) return invite.trim();
          // Fall back to last path segment if present
          const segments = u.pathname.split('/').filter(Boolean);
          if (segments.length) {
            const last = segments[segments.length - 1];
            if (last.length > 16) { // Invite tokens are long
              return last.trim();
            }
          }
        } catch (_) {
          // Not a URL; continue
        }
        // Not a URL: treat as raw invite token
        return input;
      };

      const inviteToken = parseInviteToken(codeOrToken);

      // Base payload
      const basePayload = {
        device_profile: {
          first_name: firstName,
          last_name: lastName,
          display_name: `${firstName} ${lastName}`,
        },
        device_id: deviceId,
        invite_token: inviteToken,
      } as const;

      // Call teams-join with invite token
      const result = await invokeEdge<{ teamId: string; role: string; teamName: string; deviceId: string; join_code: string; invite_token: string }>('teams-join', basePayload);

      if ((result as any).error) {
        setLoading(false);
        return { error: (result as any).error.message || 'Failed to join team' };
      }

      const { teamId, role, teamName, deviceId: returnedDeviceId, join_code, invite_token } = (result as any).data as {
        teamId: string;
        role: string;
        teamName: string;
        deviceId: string;
        join_code: string;
        invite_token: string;
      };

      const newDeviceInfo = {
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
      localStorage.setItem('relay_team_name', teamName);
      localStorage.setItem('relay_team_join_code', join_code);
      localStorage.setItem('relay_team_invite_token', invite_token);
      
      // Send team ID and Supabase URL to service worker for background notifications
      sendTeamIdToServiceWorker(teamId);
      sendSupabaseUrlToServiceWorker();
      
      // Use race store's current start time for joined team
      const race = useRaceStore.getState();
      const teamStartTime = new Date(race.startTime).toISOString();
      localStorage.setItem('relay_team_start_time', teamStartTime);
      setDeviceInfo(newDeviceInfo);

      // Set team state immediately with the data we have from the join response
      setTeam({ 
        id: teamId, 
        name: teamName, 
        start_time: teamStartTime, 
        join_code,
        invite_token
      });
      
      // Optionally fetch full team details to ensure we have the latest data
      await fetchTeamDetails(teamId);

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

  // Function to send team ID to service worker
  const sendTeamIdToServiceWorker = (teamId: string | null) => {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      try {
        navigator.serviceWorker.controller.postMessage({
          type: 'UPDATE_TEAM_ID',
          teamId: teamId
        });
        console.log('[useTeamSync] Sent team ID to service worker:', teamId);
      } catch (error) {
        console.log('[useTeamSync] Failed to send team ID to service worker:', error);
      }
    }
  };

  // Function to send Supabase URL to service worker
  const sendSupabaseUrlToServiceWorker = () => {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        if (supabaseUrl) {
          navigator.serviceWorker.controller.postMessage({
            type: 'UPDATE_SUPABASE_URL',
            supabaseUrl: supabaseUrl
          });
          console.log('[useTeamSync] Sent Supabase URL to service worker');
        }
      } catch (error) {
        console.log('[useTeamSync] Failed to send Supabase URL to service worker:', error);
      }
    }
  };

  const leaveTeam = () => {
    // Clear local storage
    localStorage.removeItem('relay_team_id');
    localStorage.removeItem('relay_device_info');
    localStorage.removeItem('relay_device_id');
    localStorage.removeItem('relay_team_start_time');
    localStorage.removeItem('relay_team_name');
    localStorage.removeItem('relay_team_join_code');
    localStorage.removeItem('relay_team_invite_token');
    
    // Clear team ID in service worker
    sendTeamIdToServiceWorker(null);
    
    // Clear state
    setTeam(null);
    setDeviceInfo(null);
    
    // Reset race store
    const race = useRaceStore.getState();
    race.setTeamId(undefined);
    race.forceReset();
  };

  const refreshTeamData = async () => {
    const currentTeamId = deviceInfo?.teamId || localStorage.getItem('relay_team_id') || null;
    console.log('[refreshTeamData] Refreshing team data for teamId:', currentTeamId);
    if (currentTeamId) {
      await fetchTeamDetails(currentTeamId);
    } else {
      console.log('[refreshTeamData] No teamId available');
    }
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

  const updateTeamInviteToken = (newInviteToken: string) => {
    if (team) {
      setTeam({ ...team, invite_token: newInviteToken });
      localStorage.setItem('relay_team_invite_token', newInviteToken);
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
    refreshTeamData,
    updateTeamStartTime,
    updateTeamInviteToken
  };
};
