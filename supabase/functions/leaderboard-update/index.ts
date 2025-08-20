import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LeaderboardUpdatePayload {
  team_id: string;
  current_leg: number;
  projected_finish_time: number;
  current_leg_projected_finish: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload: LeaderboardUpdatePayload = await req.json();
    
    // Debug logging
    console.log('Received payload:', JSON.stringify(payload, null, 2));
    console.log('Payload validation:', {
      team_id: !!payload.team_id,
      current_leg: !!payload.current_leg,
      projected_finish_time: !!payload.projected_finish_time,
      current_leg_projected_finish: !!payload.current_leg_projected_finish
    });
    
    // Validate required fields
    if (!payload.team_id || !payload.current_leg || !payload.projected_finish_time || !payload.current_leg_projected_finish) {
      console.log('Validation failed - missing fields');
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields',
          received: payload,
          validation: {
            team_id: !!payload.team_id,
            current_leg: !!payload.current_leg,
            projected_finish_time: !!payload.projected_finish_time,
            current_leg_projected_finish: !!payload.current_leg_projected_finish
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Validation passed, proceeding with update');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get team name for the update
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('name')
      .eq('id', payload.team_id)
      .single();

    if (teamError || !team) {
      return new Response(
        JSON.stringify({ error: 'Team not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update or insert leaderboard entry
    const { error: updateError } = await supabase
      .from('leaderboard')
      .upsert({
        team_id: payload.team_id,
        team_name: team.name,
        team_start_time: payload.current_leg_projected_finish - (payload.current_leg - 1) * 30 * 60 * 1000, // Estimate start time
        current_leg: payload.current_leg,
        projected_finish_time: payload.projected_finish_time,
        current_leg_projected_finish: payload.current_leg_projected_finish,
        last_updated_at: new Date().toISOString()
      }, {
        onConflict: 'team_id'
      });

    if (updateError) {
      console.error('Leaderboard update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update leaderboard' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Leaderboard updated successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Leaderboard update error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to update leaderboard',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
