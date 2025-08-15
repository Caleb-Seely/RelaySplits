import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ListDevicesRequest {
  teamId: string;
  deviceId?: string;
  admin_secret?: string;
}

interface Device {
  device_id: string;
  role: string;
  first_name: string;
  last_name: string;
  display_name: string;
  last_seen: string;
  created_at: string;
}

interface ListDevicesResponse {
  devices: Device[];
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

    const { teamId, deviceId, admin_secret }: ListDevicesRequest = await req.json()

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

    // Get all devices for the team
    const { data: devices, error: devicesError } = await supabase
      .from('team_devices')
      .select('device_id, role, first_name, last_name, display_name, last_seen, created_at')
      .eq('team_id', teamId)
      .order('created_at', { ascending: true })

    if (devicesError) {
      console.error('Devices list error:', devicesError)
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve devices' }),
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
      action: 'devices_listed',
      payload: { 
        device_count: devices?.length || 0,
        auth_method: admin_secret ? 'admin_secret' : 'admin_device' 
      }
    })

    const response: ListDevicesResponse = {
      devices: devices || []
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
