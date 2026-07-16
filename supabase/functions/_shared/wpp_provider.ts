export type WppInstance = {
  id: string
  cliente_id: string
  provider: 'zapi' | 'cloud_api' | 'evolution'
  instance_id: string | null
  token: string | null
  phone: string | null
  status: string
  dados_extras?: Record<string, unknown> | null
}

export type SendResult = {
  messageId: string
}

export interface WppProvider {
  send(to: string, body: string): Promise<SendResult>
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '')
}

class ZapiProvider implements WppProvider {
  constructor(private readonly inst: WppInstance) {}

  async send(to: string, body: string): Promise<SendResult> {
    const instanceId = this.inst.instance_id
    const token = this.inst.token

    if (!instanceId || !token) {
      throw new Error('ZAPI instance_id/token ausentes')
    }

    const extras = (this.inst.dados_extras ?? {}) as {
      base_url?: string
      client_token?: string
    }
    const baseUrl = extras.base_url ?? 'https://api.z-api.io'
    const url = `${baseUrl}/instances/${instanceId}/token/${token}/send-text`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (extras.client_token) {
      headers['Client-Token'] = extras.client_token
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        phone: normalizePhone(to),
        message: body,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Z-API error ${response.status}: ${text}`)
    }

    const payload = (await response.json()) as {
      zaapId?: string
      messageId?: string
      id?: string
    }

    const messageId = payload.zaapId ?? payload.messageId ?? payload.id
    if (!messageId) {
      throw new Error('Z-API não retornou messageId')
    }

    return { messageId }
  }
}

export function getProvider(inst: WppInstance): WppProvider {
  if (inst.provider === 'zapi') {
    return new ZapiProvider(inst)
  }

  throw new Error(`provider não suportado ainda: ${inst.provider}`)
}
