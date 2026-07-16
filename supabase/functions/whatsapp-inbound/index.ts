import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type ZapiPayload = {
  type?: string
  phone?: string
  fromMe?: boolean
  messageId?: string
  instanceId?: string
  momment?: number
  senderName?: string
  text?: { message?: string }
  image?: { imageUrl?: string }
  audio?: { audioUrl?: string }
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '')
}

function extractMessageBody(payload: ZapiPayload) {
  if (payload.text?.message) {
    return payload.text.message
  }

  if (payload.image?.imageUrl) {
    return '[imagem]'
  }

  if (payload.audio?.audioUrl) {
    return '[áudio]'
  }

  return '[mensagem]'
}

async function resolveClienteId(instanceId: string | undefined) {
  if (!instanceId) {
    return null
  }

  // Preferência: whatsapp_instances (Onda 1)
  const { data: instance } = await supabase
    .from('whatsapp_instances')
    .select('cliente_id, dados_extras, status')
    .eq('instance_id', instanceId)
    .in('status', ['connected', 'connecting'])
    .limit(1)
    .maybeSingle()

  if (instance?.cliente_id) {
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id, dados_extras')
      .eq('id', instance.cliente_id)
      .maybeSingle()

    if (cliente) {
      return {
        ...cliente,
        instance_dados_extras: instance.dados_extras,
      }
    }
  }

  // Fallback legado: clientes.dados_extras.automacoes.zapi
  const { data } = await supabase
    .from('clientes')
    .select('id, dados_extras')
    .filter('dados_extras->automacoes->zapi->>instance_id', 'eq', instanceId)
    .limit(1)

  return data?.[0] ? { ...data[0], instance_dados_extras: null } : null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405)
  }

  let payload: ZapiPayload

  try {
    payload = await req.json()
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 200)
  }

  try {
    const messageId = payload.messageId
    if (!messageId) {
      return json({ ok: true, skipped: true, reason: 'missing_message_id' })
    }

    const { data: existing } = await supabase
      .from('whatsapp_messages')
      .select('id')
      .eq('zapi_message_id', messageId)
      .maybeSingle()

    if (existing) {
      return json({ ok: true, skipped: true, reason: 'duplicate' })
    }

    const cliente = await resolveClienteId(payload.instanceId)
    if (!cliente) {
      await supabase.from('webhook_errors').insert({
        source: 'whatsapp_inbound',
        payload,
        error: 'cliente não encontrado para instanceId',
      })
      return json({ ok: true, skipped: true, reason: 'cliente_not_found' })
    }

    const phone = normalizePhone(payload.phone ?? '')
    if (!phone) {
      return json({ ok: true, skipped: true, reason: 'missing_phone' })
    }

    const { data: conversationId, error: conversationError } = await supabase.rpc(
      'get_or_create_conversation',
      {
        _cliente_id: cliente.id,
        _phone: phone,
        _nome: payload.senderName ?? null,
        _origem: 'desconhecido',
      },
    )

    if (conversationError || !conversationId) {
      throw conversationError ?? new Error('failed to create conversation')
    }

    const body = extractMessageBody(payload)
    const metadata = {
      image_url: payload.image?.imageUrl ?? null,
      audio_url: payload.audio?.audioUrl ?? null,
      raw_type: payload.type ?? null,
    }

    if (payload.fromMe) {
      await supabase.from('whatsapp_messages').insert({
        conversation_id: conversationId,
        cliente_id: cliente.id,
        direction: 'outbound',
        sender_type: 'human',
        body,
        zapi_message_id: messageId,
        metadata,
      })

      await supabase
        .from('whatsapp_conversations')
        .update({
          last_outbound_at: new Date().toISOString(),
          owner_state: 'human_active',
        })
        .eq('id', conversationId)

      return json({ ok: true })
    }

    await supabase.from('whatsapp_messages').insert({
      conversation_id: conversationId,
      cliente_id: cliente.id,
      direction: 'inbound',
      sender_type: 'lead',
      body,
      zapi_message_id: messageId,
      metadata,
    })

    const { data: conversation } = await supabase
      .from('whatsapp_conversations')
      .select('lead_id, owner_state, step_count')
      .eq('id', conversationId)
      .single()

    const updates: Record<string, unknown> = {
      last_inbound_at: new Date().toISOString(),
      step_count: (conversation?.step_count ?? 0) + 1,
    }

    let leadId = conversation?.lead_id

    if (!leadId) {
      const { data: lead } = await supabase
        .from('leads')
        .insert({
          cliente_id: cliente.id,
          nome: payload.senderName ?? phone,
          telefone: phone,
          canal: 'whatsapp',
          status: 'novo',
        })
        .select('id')
        .single()

      leadId = lead?.id ?? null
      if (leadId) {
        updates.lead_id = leadId
      }
    }

    await supabase.from('whatsapp_conversations').update(updates).eq('id', conversationId)

    const instanceExtras = cliente.instance_dados_extras as {
      agente_ativo?: boolean | string
    } | null
    const legacyExtras = cliente.dados_extras as {
      automacoes?: { zapi?: { agente_ativo?: boolean | string } }
    } | null

    const agenteFlag =
      instanceExtras?.agente_ativo ?? legacyExtras?.automacoes?.zapi?.agente_ativo
    const agenteAtivo = agenteFlag === true || agenteFlag === 'true'

    if (conversation?.owner_state === 'bot' && agenteAtivo) {
      // ai-respond edge function will be wired in a follow-up prompt (Onda 5).
    }

    return json({ ok: true })
  } catch (error) {
    console.error('whatsapp-inbound error', error)

    await supabase.from('webhook_errors').insert({
      source: 'whatsapp_inbound',
      payload,
      error: error instanceof Error ? error.message : String(error),
    })

    return json({ ok: false, error: 'handled' }, 200)
  }
})
