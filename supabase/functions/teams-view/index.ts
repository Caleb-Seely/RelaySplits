import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ViewTeamRequest {
  viewer_code: string;
}

interface ViewTeamResponse {
  teamId: string;
  role: 'viewer';
  teamName: string;
  viewer_code: string;
  start_time: string;
  isSetUp: boolean;
  runnersCount: number;
  legsCount: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { viewer_code }: ViewTeamRequest = await req.json()

    // Validate input
    if (!viewer_code?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Viewer code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find team by viewer code (case-insensitive)
    // Note: We're using the existing join_code field as the viewer_code
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .ilike('join_code', viewer_code.trim())
      .single()

    if (teamError || !team) {
      return new Response(
        JSON.stringify({ error: 'Invalid viewer code' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if team is set up by looking for legs data
    const { data: legs, error: legsError } = await supabase
      .from('legs')
      .select('id')
      .eq('team_id', team.id)
      .limit(1);

    const { data: runners, error: runnersError } = await supabase
      .from('runners')
      .select('id')
      .eq('team_id', team.id);

    const legsCount = legs?.length || 0;
    const runnersCount = runners?.length || 0;
    const isSetUp = legsCount > 0 || (runnersCount > 0 && team.start_time);

    // Log audit event for viewer access
    await supabase.from('team_audit').insert({
      team_id: team.id,
      device_id: null, // No device for viewers
      action: 'team_viewed',
      payload: { viewer_code: viewer_code.trim() }
    })

    const response: ViewTeamResponse = {
      teamId: team.id,
      role: 'viewer',
      teamName: team.name,
      viewer_code: team.join_code,
      start_time: team.start_time,
      isSetUp,
      runnersCount,
      legsCount,
    }

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
