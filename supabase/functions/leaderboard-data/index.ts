import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LeaderboardTeam {
  id: string;
  team_name: string;
  team_start_time: number;
  current_leg: number;
  projected_finish_time: number;
  current_leg_projected_finish: number;
  last_updated_at: string;
  // Derived fields (calculated on-demand)
  progress_percentage?: number;
  status?: 'active' | 'dnf' | 'finished' | 'not_started';
  minutes_remaining_in_current_leg?: number;
}

interface LeaderboardResponse {
  teams: LeaderboardTeam[];
  last_updated: string;
  meta: {
    query_time_ms: number;
    teams_count: number;
    cache_hit: boolean;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const startTime = performance.now();
    
    // Check for cache headers
    const lastUpdate = req.headers.get('x-last-update');
    const forceRefresh = req.headers.get('x-force-refresh') === 'true';
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Query the simplified leaderboard table
    const { data: rawTeams, error } = await supabase
      .from('leaderboard')
      .select(`
        team_id,
        team_name,
        team_start_time,
        current_leg,
        projected_finish_time,
        current_leg_projected_finish,
        last_updated_at
      `)
      .order('projected_finish_time', { ascending: true })
      .order('last_updated_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    // Transform the data and calculate derived fields
    const teams: LeaderboardTeam[] = (rawTeams || []).map((team: any) => {
      const now = Date.now();
      
      // Calculate derived fields
      const progressPercentage = Math.round(((team.current_leg - 1) / 36.0) * 100 * 100) / 100;
      
      let status: 'active' | 'dnf' | 'finished' | 'not_started';
      if (team.current_leg <= 1) {
        status = 'not_started';
      } else if (team.current_leg > 36) {
        status = 'finished';
      } else if (team.current_leg_projected_finish < now - (2 * 60 * 60 * 1000)) {
        status = 'dnf';
      } else {
        status = 'active';
      }
      
      const minutesRemaining = team.current_leg_projected_finish > now 
        ? Math.max(0, Math.round((team.current_leg_projected_finish - now) / (60 * 1000)))
        : 0;
      
      return {
        id: team.team_id,
        team_name: team.team_name,
        team_start_time: team.team_start_time,
        current_leg: team.current_leg,
        projected_finish_time: team.projected_finish_time,
        current_leg_projected_finish: team.current_leg_projected_finish,
        last_updated_at: team.last_updated_at,
        progress_percentage: progressPercentage,
        status: status,
        minutes_remaining_in_current_leg: minutesRemaining
      };
    });

    const response: LeaderboardResponse = {
      teams: teams,
      last_updated: new Date().toISOString(),
      meta: {
        query_time_ms: Math.round(performance.now() - startTime),
        teams_count: teams.length,
        cache_hit: false
      }
    };

    return new Response(JSON.stringify(response), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30' // 30 second cache
      }
    });
    
  } catch (error) {
    console.error('Leaderboard error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch leaderboard data',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
