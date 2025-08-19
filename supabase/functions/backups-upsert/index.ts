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

    const { teamId, backups } = await req.json()

    if (!teamId || !backups || !Array.isArray(backups)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: teamId, backups' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Add team_id and timestamps to each backup
    const processedBackups = backups.map((backup: any) => ({
      ...backup,
      team_id: teamId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))

    // Insert backups into the backups table
    const { data, error } = await supabaseClient
      .from('backups')
      .upsert(processedBackups, { 
        onConflict: 'id',
        ignoreDuplicates: false
      })
      .select()

    if (error) {
      console.error('Backup upsert error:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

    // Broadcast update to real-time subscribers
    await supabaseClient
      .channel('backups')
      .send({
        type: 'broadcast',
        event: 'backups_updated',
        payload: {
          teamId,
          count: processedBackups.length,
          timestamp: Date.now()
        }
      })

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: data,
        count: processedBackups.length 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Backup upsert error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
