
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSecureSync } from '@/hooks/useSecureSync';
import { useRaceStore } from '@/store/raceStore';
import { toast } from 'sonner';

interface Team {
  id: string;
  name: string;
  start_time: string;
  owner_id: string;
}

interface TeamMember {
  id: string;
  user_id: string;
  team_id: string;
  role: string;
}

export const useTeamSync = () => {
  const [team, setTeam] = useState<Team | null>(null);
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { secureQuery, secureUpdate } = useSecureSync();
  // Timer to auto-start leg 1 when official start time is in the future
  const pendingStartTimer = useRef<number | null>(null);

  useEffect(() => {
    if (user) {
      fetchUserTeam();
    }
  }, [user]);

  // Cleanup any pending auto-start timer when this hook unmounts
  useEffect(() => {
    return () => {
      if (pendingStartTimer.current) {
        clearTimeout(pendingStartTimer.current);
        pendingStartTimer.current = null;
      }
    };
  }, []);

  const fetchUserTeam = async () => {
    if (!user) {
      return;
    }

    try {
      // First check if user is a member of any team
      const memberResult = await secureQuery(
        supabase
          .from('team_members')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
        'fetch team membership'
      );

      if (!memberResult.error && memberResult.data) {
        setTeamMember(memberResult.data);
        
        // Fetch team details
        const teamResult = await secureQuery(
          supabase
            .from('teams')
            .select('*')
            .eq('id', memberResult.data.team_id)
            .single(),
          'fetch team details'
        );

        if (!teamResult.error && teamResult.data) {
          setTeam(teamResult.data);
        }
      }
    } catch (error) {
      console.error('Error in fetchUserTeam:', error);
    }
  };

  const createTeam = async (name: string, startTime: Date) => {
    if (!user) return { error: 'User not authenticated' };
    
    setLoading(true);
    
    try {
      // Create team
      const teamResult = await secureUpdate(
        supabase
          .from('teams')
          .insert([{
            name,
            start_time: startTime.toISOString(),
            owner_id: user.id
          }])
          .select()
          .single(),
        'create team'
      );

      if (teamResult.error) {
        setLoading(false);
        return { error: teamResult.error.message };
      }

      // Add user as owner to team_members
      const memberResult = await secureUpdate(
        supabase
          .from('team_members')
          .insert([{
            user_id: user.id,
            team_id: teamResult.data.id,
            role: 'owner'
          }]),
        'add team owner'
      );

      if (memberResult.error) {
        setLoading(false);
        return { error: memberResult.error.message };
      }

      // Immediately reflect new team in state for instant UI transition
      setTeam(teamResult.data);
      // Optionally set member locally for quicker access
      setTeamMember({ id: memberResult.data?.[0]?.id ?? '', user_id: user.id, team_id: teamResult.data.id, role: 'owner' });
      // Stop blocking UI on extra refetch; run in background to reconcile
      fetchUserTeam();
      setLoading(false);
      
      return { success: true };
    } catch (error) {
      setLoading(false);
      return { error: 'Failed to create team' };
    }
  };

  const joinTeam = async (teamId: string) => {
    if (!user) return { error: 'User not authenticated' };
    
    setLoading(true);
    
    try {
      // Check if team exists
      const teamResult = await secureQuery(
        supabase
          .from('teams')
          .select('*')
          .eq('id', teamId)
          .single(),
        'verify team exists'
      );

      if (teamResult.error) {
        setLoading(false);
        return { error: 'Team not found or access denied' };
      }

      // Add user to team_members
      const memberResult = await secureUpdate(
        supabase
          .from('team_members')
          .insert([{
            user_id: user.id,
            team_id: teamId,
            role: 'member'
          }]),
        'join team'
      );

      if (memberResult.error) {
        setLoading(false);
        return { error: memberResult.error.message };
      }

      // Immediately reflect joined team
      setTeam(teamResult.data);
      setTeamMember({ id: memberResult.data?.[0]?.id ?? '', user_id: user.id, team_id: teamId, role: 'member' });
      // Background reconciliation
      fetchUserTeam();
      setLoading(false);
      
      return { success: true };
    } catch (error) {
      setLoading(false);
      return { error: 'Failed to join team' };
    }
  };

  const updateTeamStartTime = async (newStartTime: Date) => {
    if (!user || !team) return { error: 'Not ready' };
    try {
      const updateResult = await secureUpdate(
        supabase
          .from('teams')
          .update({ start_time: newStartTime.toISOString() })
          .eq('id', team.id)
          .select()
          .single(),
        'update team start time'
      );

      if (updateResult.error) {
        toast.error('Failed to update team start time');
        return { error: updateResult.error.message };
      }

      setTeam(updateResult.data);

      // Propagate to race store so UI and projections reflect immediately
      const race = useRaceStore.getState();
      const startMs = newStartTime.getTime();
      race.setStartTime(startMs);

      // Ensure legs exist
      if (race.legs.length === 0) {
        race.initializeLegs();
      }
      const latest = useRaceStore.getState();
      const firstLeg = latest.legs[0];

      // Clear any previous pending auto-start
      if (pendingStartTimer.current) {
        clearTimeout(pendingStartTimer.current);
        pendingStartTimer.current = null;
      }

      const now = Date.now();
      if (startMs <= now) {
        // Official time is in the past: set leg 1 actual start to that time immediately
        if (firstLeg && firstLeg.actualStart !== startMs) {
          latest.updateLegActualTime(1, 'actualStart', startMs);
        }
      } else {
        // Official time is in the future: ensure leg 1 will auto-start when the time comes
        const delay = Math.max(0, startMs - now);
        pendingStartTimer.current = window.setTimeout(() => {
          const s = useRaceStore.getState();
          const fl = s.legs[0];
          if (fl && typeof fl.actualStart !== 'number') {
            s.updateLegActualTime(1, 'actualStart', startMs);
          }
          // Clear reference after firing
          if (pendingStartTimer.current) {
            clearTimeout(pendingStartTimer.current);
            pendingStartTimer.current = null;
          }
        }, delay);
      }

      // Update sync indicator since this was a successful backend update
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
    teamMember,
    loading,
    createTeam,
    joinTeam,
    refetch: fetchUserTeam,
    updateTeamStartTime
  };
};
