import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AdminRecoveryRequest {
  teamId: string;
  admin_secret: string;
  device_profile: {
    first_name?: string;
    last_name?: string;
    display_name?: string;
  };
}

interface AdminRecoveryResponse {
  success: boolean;
  deviceId: string;
  message: string;
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

    const { teamId, admin_secret, device_profile }: AdminRecoveryRequest = await req.json()

    // Validate input
    if (!teamId) {
      return new Response(
        JSON.stringify({ error: 'teamId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!admin_secret) {
      return new Response(
        JSON.stringify({ error: 'admin_secret is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!device_profile) {
      return new Response(
        JSON.stringify({ error: 'device_profile is required' }),
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

    // Verify admin secret
    if (admin_secret !== team.admin_secret) {
      return new Response(
        JSON.stringify({ error: 'Invalid admin secret' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if there are any existing admin devices
    const { data: existingAdmins, error: adminCheckError } = await supabase
      .from('team_devices')
      .select('device_id')
      .eq('team_id', teamId)
      .eq('role', 'admin')

    if (adminCheckError) {
      console.error('Admin check error:', adminCheckError)
      return new Response(
        JSON.stringify({ error: 'Failed to check existing admins' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If there are existing admins, remove them first (admin secret proves ownership)
    // This allows recovery when cache is cleared and device IDs are lost
    if (existingAdmins && existingAdmins.length > 0) {
      console.log(`Removing ${existingAdmins.length} existing admin devices for recovery`)
      
      // Remove all existing admin devices
      const { error: removeError } = await supabase
        .from('team_devices')
        .delete()
        .eq('team_id', teamId)
        .eq('role', 'admin')

      if (removeError) {
        console.error('Failed to remove existing admin devices:', removeError)
        return new Response(
          JSON.stringify({ error: 'Failed to remove existing admin devices for recovery' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Generate new device ID
    const deviceId = crypto.randomUUID()

    // Create recovery admin device
    const recoveryDevice = {
      team_id: teamId,
      device_id: deviceId,
      role: 'admin',
      first_name: device_profile.first_name || '',
      last_name: device_profile.last_name || '',
      display_name: device_profile.display_name || 'Recovery Admin',
      last_seen: new Date().toISOString(),
    }

    const { error: deviceError } = await supabase
      .from('team_devices')
      .insert(recoveryDevice)

    if (deviceError) {
      console.error('Recovery device creation error:', deviceError)
      return new Response(
        JSON.stringify({ error: 'Failed to create recovery admin device' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log audit event
    await supabase.from('team_audit').insert({
      team_id: teamId,
      device_id: deviceId,
      action: 'admin_recovery',
      payload: { 
        recovery_device_name: recoveryDevice.display_name,
        auth_method: 'admin_secret'
      }
    })

    const response: AdminRecoveryResponse = {
      success: true,
      deviceId: deviceId,
      message: 'Recovery admin device created successfully',
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
