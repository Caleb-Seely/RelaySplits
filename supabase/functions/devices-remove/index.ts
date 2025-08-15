import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RemoveDeviceRequest {
  teamId: string;
  deviceId?: string;
  admin_secret?: string;
  target_device_id: string;
}

interface RemoveDeviceResponse {
  success: boolean;
  removed_device: {
    device_id: string;
    display_name: string;
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

    const { teamId, deviceId, admin_secret, target_device_id }: RemoveDeviceRequest = await req.json()

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

    if (!target_device_id) {
      return new Response(
        JSON.stringify({ error: 'target_device_id is required' }),
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

    // Prevent self-removal via deviceId (admin secret can remove any device including itself)
    if (deviceId && deviceId === target_device_id) {
      return new Response(
        JSON.stringify({ error: 'Cannot remove yourself. Use admin secret for self-removal' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get target device to verify it exists and get info for response
    const { data: targetDevice, error: targetDeviceError } = await supabase
      .from('team_devices')
      .select('device_id, display_name, role')
      .eq('team_id', teamId)
      .eq('device_id', target_device_id)
      .single()

    if (targetDeviceError || !targetDevice) {
      return new Response(
        JSON.stringify({ error: 'Target device not found in team' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if this would remove the last admin (prevent lockout)
    if (targetDevice.role === 'admin') {
      const { data: adminDevices, error: adminCountError } = await supabase
        .from('team_devices')
        .select('device_id')
        .eq('team_id', teamId)
        .eq('role', 'admin')

      if (adminCountError) {
        console.error('Admin count check error:', adminCountError)
        return new Response(
          JSON.stringify({ error: 'Failed to verify admin count' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (adminDevices && adminDevices.length <= 1) {
        return new Response(
          JSON.stringify({ error: 'Cannot remove the last admin device. Promote another device to admin first' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Remove the device
    const { error: removeError } = await supabase
      .from('team_devices')
      .delete()
      .eq('team_id', teamId)
      .eq('device_id', target_device_id)

    if (removeError) {
      console.error('Device removal error:', removeError)
      return new Response(
        JSON.stringify({ error: 'Failed to remove device' }),
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
      action: 'device_removed',
      payload: { 
        removed_device_id: target_device_id,
        removed_device_name: targetDevice.display_name,
        removed_device_role: targetDevice.role,
        auth_method: admin_secret ? 'admin_secret' : 'admin_device' 
      }
    })

    const response: RemoveDeviceResponse = {
      success: true,
      removed_device: {
        device_id: targetDevice.device_id,
        display_name: targetDevice.display_name
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
