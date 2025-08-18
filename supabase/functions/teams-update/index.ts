import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UpdateTeamRequest {
  teamId: string;
  deviceId?: string;
  admin_secret?: string;
  name?: string;
  start_time?: string;
}

interface UpdateTeamResponse {
  success: boolean;
  team: {
    id: string;
    name: string;
    start_time: string;
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

    const body = await req.json()
    console.log('Received request body:', body);
    const { teamId, deviceId, admin_secret, name, start_time }: UpdateTeamRequest = body

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

    if (!name && !start_time) {
      return new Response(
        JSON.stringify({ error: 'At least one field (name or start_time) must be provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get team
    console.log('Looking for team with ID:', teamId);
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single()

    if (teamError || !team) {
      console.error('Team not found or error:', teamError);
      return new Response(
        JSON.stringify({ error: 'Team not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Found team:', team);

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
      console.log('Looking for device:', deviceId, 'in team:', teamId);
      const { data: device, error: deviceError } = await supabase
        .from('team_devices')
        .select('*')
        .eq('team_id', teamId)
        .eq('device_id', deviceId)
        .eq('role', 'admin')
        .single()

      if (deviceError || !device) {
        console.error('Device not found or error:', deviceError);
        return new Response(
          JSON.stringify({ error: 'Device not found or not admin' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      console.log('Found authorized device:', device);
      authorizedDeviceId = deviceId;
    }

    // Build update object
    const updateData: any = {}
    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: 'Team name cannot be empty' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      updateData.name = name.trim()
    }
    if (start_time !== undefined) {
      console.log('Processing start_time:', start_time, 'type:', typeof start_time);
      // Simplified validation - just ensure it's a valid date
      try {
        const date = new Date(start_time);
        console.log('Created date object:', date, 'timestamp:', date.getTime());
        if (isNaN(date.getTime())) {
          console.error('Invalid date - timestamp is NaN');
          return new Response(
            JSON.stringify({ error: 'Invalid start_time format' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const isoString = date.toISOString();
        console.log('Converted to ISO string:', isoString);
        updateData.start_time = isoString;
      } catch (e) {
        console.error('Error processing start_time:', e);
        return new Response(
          JSON.stringify({ error: 'Invalid start_time format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Update team
    console.log('Updating team with data:', updateData);
    
    const { data: updatedTeam, error: updateError } = await supabase
      .from('teams')
      .update(updateData)
      .eq('id', teamId)
      .select('id, name, start_time')
      .single()

    if (updateError) {
      console.error('Team update error:', updateError)
      return new Response(
        JSON.stringify({ error: `Failed to update team: ${updateError.message}` }),
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
      action: 'team_updated',
      payload: { 
        updated_fields: Object.keys(updateData),
        auth_method: admin_secret ? 'admin_secret' : 'admin_device' 
      }
    })

    const response: UpdateTeamResponse = {
      success: true,
      team: updatedTeam
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
