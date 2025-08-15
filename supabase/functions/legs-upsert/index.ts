import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LegUpsertRequest {
  teamId: string;
  deviceId: string;
  legs: any[]; // Array of leg objects to upsert
  action?: 'upsert' | 'delete';
}

interface LegUpsertResponse {
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

    const { teamId, deviceId, legs, action = 'upsert' }: LegUpsertRequest = await req.json()

    // Validate input
    if (!teamId || !deviceId) {
      return new Response(
        JSON.stringify({ error: 'teamId and deviceId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!Array.isArray(legs)) {
      return new Response(
        JSON.stringify({ error: 'legs must be an array' }),
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
      // Delete legs by IDs
      const legIds = legs.map(leg => leg.id).filter(Boolean)
      if (legIds.length > 0) {
        const { error: deleteError, count: deleteCount } = await supabase
          .from('legs')
          .delete()
          .eq('team_id', teamId)
          .in('id', legIds)

        if (deleteError) {
          console.error('Legs delete error:', deleteError)
          return new Response(
            JSON.stringify({ error: 'Failed to delete legs' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        count = deleteCount || 0
        effectiveIds = legIds
      }
    } else {
      // Decide between bulk upsert (for full rows) vs per-row updates (for partial rows)
      const isFullRow = (l: any) => (
        // number and distance are NOT NULL on legs
        typeof l?.number === 'number' && l?.distance !== undefined && l?.distance !== null
      )

      const fullRows = legs.filter(isFullRow)
      const partialRows = legs.filter((l) => !isFullRow(l))

      // 1) Handle bulk upsert for full rows
      if (fullRows.length > 0) {
        const legsWithTeamId = fullRows.map(leg => ({
          // Spread first so our fields below always take precedence
          ...leg,
          // Ensure id is set even if incoming leg.id is null/undefined
          id: leg.id ?? crypto.randomUUID(),
          team_id: teamId,
          updated_at: new Date().toISOString()
        }))

        const { error: upsertError, count: upsertCount } = await supabase
          .from('legs')
          .upsert(legsWithTeamId, {
            onConflict: 'id',
            count: 'exact'
          })

        if (upsertError) {
          console.error('Legs upsert error (full rows):', upsertError)
          return new Response(
            JSON.stringify({ error: 'Failed to upsert legs' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        count += upsertCount || 0
        effectiveIds.push(...legsWithTeamId.map(l => l.id).filter(Boolean))
      }

      // 2) Handle partial updates per row (requires id)
      for (const row of partialRows) {
        if (!row?.id) {
          console.error('Partial leg update missing id:', row)
          return new Response(
            JSON.stringify({ error: 'Partial leg update requires id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const updatePayload = {
          ...row,
          team_id: teamId, // reinforce team scoping
          updated_at: new Date().toISOString()
        }
        // Avoid accidentally changing immutable fields if they are undefined in payload
        // Keep only fields that are explicitly provided
        // (Already satisfied since we spread row directly)

        const { error: updateError } = await supabase
          .from('legs')
          .update(updatePayload)
          .eq('team_id', teamId)
          .eq('id', row.id)

        if (updateError) {
          console.error('Legs partial update error:', updateError)
          return new Response(
            JSON.stringify({ error: 'Failed to update leg' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        count += 1
        effectiveIds.push(row.id)
      }
    }

    // Log audit event (use effective IDs after mapping)
    await supabase.from('team_audit').insert({
      team_id: teamId,
      device_id: deviceId,
      action: `legs_${action}`,
      payload: { count, leg_ids: effectiveIds }
    })

    // Send broadcast message to team channel for realtime updates
    try {
      await supabase.channel(`team-${teamId}`).send({
        type: 'broadcast',
        event: 'data_updated',
        payload: {
          type: 'legs',
          action: action,
          count: count,
          device_id: deviceId,
          timestamp: new Date().toISOString()
        }
      })
    } catch (broadcastError) {
      console.warn('Failed to send broadcast message:', broadcastError)
      // Don't fail the request if broadcast fails
    }

    const response: LegUpsertResponse = {
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
