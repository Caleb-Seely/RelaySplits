import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { teamId, legId, targetTimestamp, limit = 10 } = await req.json()

    if (!teamId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: teamId' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    let query = supabaseClient
      .from('backups')
      .select('*')
      .eq('team_id', teamId)
      .order('timestamp', { ascending: false })
      .limit(limit)

    // Filter by leg if specified
    if (legId) {
      query = query.eq('legId', legId)
    }

    // Filter by timestamp if specified
    if (targetTimestamp) {
      // Find backups within 5 minutes of target timestamp
      const timeWindow = 5 * 60 * 1000 // 5 minutes in milliseconds
      const minTime = targetTimestamp - timeWindow
      const maxTime = targetTimestamp + timeWindow
      
      query = query
        .gte('timestamp', minTime)
        .lte('timestamp', maxTime)
    }

    const { data, error } = await query

    if (error) {
      console.error('Backup list error:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

    // If target timestamp specified, find the closest backup
    let backup = null
    if (targetTimestamp && data && data.length > 0) {
      backup = data.reduce((closest: any, current: any) => {
        return Math.abs(current.timestamp - targetTimestamp) < Math.abs(closest.timestamp - targetTimestamp)
          ? current : closest
      })
    } else if (data && data.length > 0) {
      // Return most recent backup
      backup = data[0]
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        backup: backup,
        backups: data || [],
        count: data?.length || 0
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Backup list error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
