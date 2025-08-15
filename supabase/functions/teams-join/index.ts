import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface JoinTeamRequest {
  invite_token?: string;
  join_code?: string;
  device_profile: {
    first_name: string;
    last_name: string;
    display_name?: string;
  };
  device_id?: string;
}

interface JoinTeamResponse {
  teamId: string;
  role: string;
  deviceId: string;
  teamName: string;
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

    const { invite_token, join_code, device_profile, device_id }: JoinTeamRequest = await req.json()

    // Validate input
    if (!invite_token && !join_code) {
      return new Response(
        JSON.stringify({ error: 'Either invite_token or join_code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!device_profile?.first_name || !device_profile?.last_name) {
      return new Response(
        JSON.stringify({ error: 'First name and last name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Normalize inputs
    const inviteToken = invite_token?.trim()
    const joinCode = join_code?.trim()

    // Find team by token or code (case-insensitive for join_code)
    let teamQuery = supabase.from('teams').select('*')
    if (inviteToken) {
      teamQuery = teamQuery.eq('invite_token', inviteToken)
    } else if (joinCode) {
      // Use ilike for case-insensitive exact match
      teamQuery = teamQuery.ilike('join_code', joinCode)
      // Check if join code is expired (optional - implement expiration logic here)
    }

    const { data: team, error: teamError } = await teamQuery.single()

    if (teamError || !team) {
      return new Response(
        JSON.stringify({ error: 'Invalid invite token or join code' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate or use provided device ID
    const deviceId = device_id || crypto.randomUUID()

    // Check if device already exists for this team
    const { data: existingDevice } = await supabase
      .from('team_devices')
      .select('*')
      .eq('team_id', team.id)
      .eq('device_id', deviceId)
      .single()

    if (existingDevice) {
      // Update existing device info and last_seen
      const { error: updateError } = await supabase
        .from('team_devices')
        .update({
          first_name: device_profile.first_name,
          last_name: device_profile.last_name,
          display_name: device_profile.display_name || `${device_profile.first_name} ${device_profile.last_name}`,
          last_seen: new Date().toISOString(),
        })
        .eq('id', existingDevice.id)

      if (updateError) {
        console.error('Device update error:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update device info' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Log audit event
      await supabase.from('team_audit').insert({
        team_id: team.id,
        device_id: deviceId,
        action: 'device_rejoined',
        payload: { device_profile }
      })

      const response: JoinTeamResponse = {
        teamId: team.id,
        role: existingDevice.role,
        deviceId: deviceId,
        teamName: team.name,
      }

      return new Response(
        JSON.stringify(response),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create new device (default role: member)
    const newDevice = {
      team_id: team.id,
      device_id: deviceId,
      role: 'member',
      first_name: device_profile.first_name,
      last_name: device_profile.last_name,
      display_name: device_profile.display_name || `${device_profile.first_name} ${device_profile.last_name}`,
      last_seen: new Date().toISOString(),
    }

    const { error: deviceError } = await supabase
      .from('team_devices')
      .insert(newDevice)

    if (deviceError) {
      console.error('Device creation error:', deviceError)
      return new Response(
        JSON.stringify({ error: 'Failed to join team' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log audit event
    await supabase.from('team_audit').insert({
      team_id: team.id,
      device_id: deviceId,
      action: 'device_joined',
      payload: { device_profile, join_method: invite_token ? 'invite_token' : 'join_code' }
    })

    const response: JoinTeamResponse = {
      teamId: team.id,
      role: 'member',
      deviceId: deviceId,
      teamName: team.name,
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
