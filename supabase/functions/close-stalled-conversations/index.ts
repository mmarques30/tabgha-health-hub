// Cron helper: fecha conversas paradas (>4h sem outbound).
// Agendar a cada 30min no Supabase Dashboard → Edge Functions → Schedules,
// ou via pg_cron chamando public.close_stalled_conversations().

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return json({ ok: false, error: 'method_not_allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (token !== SERVICE_KEY) {
    return json({ ok: false, error: 'unauthorized' }, 401)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  try {
    const { data, error } = await supabase.rpc('close_stalled_conversations')
    if (error) {
      throw error
    }

    const closed = typeof data === 'number' ? data : 0

    if (closed > 0) {
      await supabase.from('automation_logs').insert({
        action: 'close_stalled_conversations',
        metadata: { closed },
      })
    }

    return json({ ok: true, closed })
  } catch (error) {
    console.error('close-stalled-conversations error', error)
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    )
  }
})
