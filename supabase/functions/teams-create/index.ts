import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateTeamRequest {
  name: string;
  admin_display_name?: string;
  device_profile?: {
    first_name?: string;
    last_name?: string;
    display_name?: string;
  };
}

interface CreateTeamResponse {
  teamId: string;
  invite_token: string;
  join_code: string;
  admin_secret: string;
  deviceId: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Read body once, then parse it (avoid double consumption of the stream)
    const bodyText = await req.text();

    // Gracefully handle empty or invalid JSON
    let name, admin_display_name, device_profile;
    try {
      const parsedBody: CreateTeamRequest = JSON.parse(bodyText);
      name = parsedBody.name;
      admin_display_name = parsedBody.admin_display_name;
      device_profile = parsedBody.device_profile;
    } catch (e) {
      console.error('JSON parsing error');
      return new Response(JSON.stringify({ error: 'Invalid JSON format' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!name || name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Team name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role key (for privileged operations)
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

    // No user auth required. This function relies on generated team secrets
    // and device roles for subsequent authorization flows.

    // Generate secrets
    const { data: tokenData } = await supabase.rpc('generate_invite_token')
    const { data: codeData } = await supabase.rpc('generate_join_code')
    const { data: secretData } = await supabase.rpc('generate_admin_secret')

    if (!tokenData || !codeData || !secretData) {
      throw new Error('Failed to generate team secrets')
    }

    // Create team (team-managed access model)
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        name: name.trim(),
        invite_token: tokenData,
        join_code: codeData,
        admin_secret: secretData,
        invite_token_rotated_at: new Date().toISOString(),
        start_time: new Date().toISOString(),
      })
      .select()
      .single()

    if (teamError) {
      console.error('Team creation error:', teamError)
      return new Response(
        JSON.stringify({ error: 'Failed to create team' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate device ID
    const deviceId = crypto.randomUUID()

    // Create admin device
    const adminDevice = {
      team_id: team.id,
      device_id: deviceId,
      role: 'admin',
      first_name: device_profile?.first_name || '',
      last_name: device_profile?.last_name || '',
      display_name: device_profile?.display_name || admin_display_name || 'Admin',
      last_seen: new Date().toISOString(),
    }

    const { error: deviceError } = await supabase
      .from('team_devices')
      .insert(adminDevice)

    if (deviceError) {
      console.error('Admin device creation error:', deviceError)
      // Clean up team if device creation fails
      await supabase.from('teams').delete().eq('id', team.id)
      return new Response(
        JSON.stringify({ error: 'Failed to create admin device' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log audit event
    await supabase.from('team_audit').insert({
      team_id: team.id,
      device_id: deviceId,
      action: 'team_created',
      payload: { team_name: name, admin_display_name }
    })

    const response: CreateTeamResponse = {
      teamId: team.id,
      invite_token: tokenData,
      join_code: codeData,
      admin_secret: secretData,
      deviceId: deviceId,
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
