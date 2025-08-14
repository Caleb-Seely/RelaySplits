import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RunnerUpsertRequest {
  teamId: string;
  deviceId: string;
  runners: any[]; // Array of runner objects to upsert
  action?: 'upsert' | 'delete';
}

interface RunnerUpsertResponse {
  success: boolean;
  count: number;
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

    const { teamId, deviceId, runners, action = 'upsert' }: RunnerUpsertRequest = await req.json()

    // Validate input
    if (!teamId || !deviceId) {
      return new Response(
        JSON.stringify({ error: 'teamId and deviceId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!Array.isArray(runners)) {
      return new Response(
        JSON.stringify({ error: 'runners must be an array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify device belongs to team
    const { data: device, error: deviceError } = await supabase
      .from('team_devices')
      .select('*')
      .eq('team_id', teamId)
      .eq('device_id', deviceId)
      .single()

    if (deviceError || !device) {
      return new Response(
        JSON.stringify({ error: 'Invalid team or device' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update device last_seen
    await supabase
      .from('team_devices')
      .update({ last_seen: new Date().toISOString() })
      .eq('id', device.id)

    let result;
    let count = 0;
    let effectiveIds: string[] = [];

    if (action === 'delete') {
      // Delete runners by IDs
      const runnerIds = runners.map(runner => runner.id).filter(Boolean)
      if (runnerIds.length > 0) {
        const { error: deleteError, count: deleteCount } = await supabase
          .from('runners')
          .delete()
          .eq('team_id', teamId)
          .in('id', runnerIds)

        if (deleteError) {
          console.error('Runners delete error:', deleteError)
          return new Response(
            JSON.stringify({ error: 'Failed to delete runners' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        count = deleteCount || 0
        effectiveIds = runnerIds
      }
    } else {
      // Normalize and validate van field to '1' | '2'
      const normalizedRunners = runners.map((runner) => {
        const raw = (runner?.van ?? '').toString().trim().toLowerCase()
        let van: '1' | '2' | null = null
        if (raw === '1' || raw === 'van 1' || raw === 'van1' || raw === 'team 1') van = '1'
        if (raw === '2' || raw === 'van 2' || raw === 'van2' || raw === 'team 2') van = '2'
        // Also accept numeric 1/2 passed through
        if (raw === '1') van = '1'
        if (raw === '2') van = '2'
        return { ...runner, van }
      })

      const invalid = normalizedRunners
        .map((r, i) => (r.van === null ? i : -1))
        .filter((i) => i >= 0)

      if (invalid.length > 0) {
        return new Response(
          JSON.stringify({ error: 'Invalid van value. Use 1 or 2', invalidIndices: invalid }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Upsert runners - ensure all have team_id and id
      const runnersWithTeamId = normalizedRunners.map(runner => ({
        // Spread first so our fields below always take precedence
        ...runner,
        // Ensure id is set even if incoming runner.id is null/undefined
        id: runner.id ?? crypto.randomUUID(),
        team_id: teamId,
        updated_at: new Date().toISOString()
      }))

      const { error: upsertError, count: upsertCount } = await supabase
        .from('runners')
        .upsert(runnersWithTeamId, {
          onConflict: 'id',
          count: 'exact'
        })

      if (upsertError) {
        console.error('Runners upsert error:', upsertError)
        return new Response(
          JSON.stringify({ error: 'Failed to upsert runners' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      count = upsertCount || 0
      effectiveIds = runnersWithTeamId.map(r => r.id).filter(Boolean)
    }

    // Log audit event (use effective IDs after mapping)
    await supabase.from('team_audit').insert({
      team_id: teamId,
      device_id: deviceId,
      action: `runners_${action}`,
      payload: { count, runner_ids: effectiveIds }
    })

    const response: RunnerUpsertResponse = {
      success: true,
      count: count
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
