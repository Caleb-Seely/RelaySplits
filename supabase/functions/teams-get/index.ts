import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GetTeamRequest {
  teamId: string;
  deviceId: string;
}

interface GetTeamResponse {
  success: boolean;
  team: {
    id: string;
    name: string;
    start_time: string;
    join_code: string;
    invite_token?: string;
  };
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

    const { teamId, deviceId }: GetTeamRequest = await req.json()

    // Validate input
    if (!teamId || !deviceId) {
      return new Response(
        JSON.stringify({ error: 'teamId and deviceId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify device is a member of the team
    const { data: device, error: deviceError } = await supabase
      .from('team_devices')
      .select('*')
      .eq('team_id', teamId)
      .eq('device_id', deviceId)
      .single()

    if (deviceError || !device) {
      return new Response(
        JSON.stringify({ error: 'Device not found or not a member of this team' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get team details
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name, start_time, join_code, invite_token')
      .eq('id', teamId)
      .single()

    if (teamError || !team) {
      return new Response(
        JSON.stringify({ error: 'Team not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update device last_seen
    await supabase
      .from('team_devices')
      .update({ last_seen: new Date().toISOString() })
      .eq('team_id', teamId)
      .eq('device_id', deviceId)

    const response: GetTeamResponse = {
      success: true,
      team: {
        id: team.id,
        name: team.name,
        start_time: team.start_time,
        join_code: team.join_code,
        invite_token: team.invite_token
      }
    }

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
