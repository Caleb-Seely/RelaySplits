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
