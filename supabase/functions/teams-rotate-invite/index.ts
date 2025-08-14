import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RotateInviteRequest {
  teamId: string;
  deviceId?: string;
  admin_secret?: string;
}

interface RotateInviteResponse {
  invite_token: string;
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

    const { teamId, deviceId, admin_secret }: RotateInviteRequest = await req.json()

    // Validate input
    if (!teamId) {
      return new Response(
        JSON.stringify({ error: 'teamId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!deviceId && !admin_secret) {
      return new Response(
        JSON.stringify({ error: 'Either deviceId or admin_secret is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single()

    if (teamError || !team) {
      return new Response(
        JSON.stringify({ error: 'Team not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify authorization
    let authorizedDeviceId = null;

    if (admin_secret) {
      // Verify admin secret
      if (admin_secret !== team.admin_secret) {
        return new Response(
          JSON.stringify({ error: 'Invalid admin secret' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else if (deviceId) {
      // Verify device is admin
      const { data: device, error: deviceError } = await supabase
        .from('team_devices')
        .select('*')
        .eq('team_id', teamId)
        .eq('device_id', deviceId)
        .eq('role', 'admin')
        .single()

      if (deviceError || !device) {
        return new Response(
          JSON.stringify({ error: 'Device not found or not admin' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      authorizedDeviceId = deviceId;
    }

    // Generate new invite token
    const { data: newToken } = await supabase.rpc('generate_invite_token')

    if (!newToken) {
      throw new Error('Failed to generate new invite token')
    }

    // Update team with new invite token
    const { error: updateError } = await supabase
      .from('teams')
      .update({
        invite_token: newToken,
        invite_token_rotated_at: new Date().toISOString(),
      })
      .eq('id', teamId)

    if (updateError) {
      console.error('Token rotation error:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to rotate invite token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update device last_seen if device-based auth
    if (authorizedDeviceId) {
      await supabase
        .from('team_devices')
        .update({ last_seen: new Date().toISOString() })
        .eq('team_id', teamId)
        .eq('device_id', authorizedDeviceId)
    }

    // Log audit event
    await supabase.from('team_audit').insert({
      team_id: teamId,
      device_id: authorizedDeviceId,
      action: 'invite_token_rotated',
      payload: { auth_method: admin_secret ? 'admin_secret' : 'admin_device' }
    })

    const response: RotateInviteResponse = {
      invite_token: newToken
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
