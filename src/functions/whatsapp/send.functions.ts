import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Json } from "@/integrations/supabase/types";
import type { AuthContext } from "@/server/auth";

const sendWhatsappInput = z.object({
  conversation_id: z.string().uuid(),
  body: z.string().min(1),
  sender_type: z.enum(["bot", "human"]),
  metadata: z.record(z.unknown()).optional(),
});

type ZapiConfig = {
  instance_id: string;
  token: string;
  client_token?: string;
  base_url?: string;
};

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function extractZapiConfig(dadosExtras: Json | null): ZapiConfig {
  const zapi = (dadosExtras as { automacoes?: { zapi?: ZapiConfig } })?.automacoes?.zapi;

  if (!zapi?.instance_id || !zapi?.token) {
    throw new Error("ZAPI não configurada para este cliente");
  }

  return zapi;
}

async function ensurePhoneExists(
  supabase: AuthContext["supabase"],
  phone: string,
  zapi: ZapiConfig,
) {
  const normalized = normalizePhone(phone);
  const cacheCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: cached } = await supabase
    .from("phone_cache")
    .select("exists, checked_at")
    .eq("telefone", normalized)
    .maybeSingle();

  if (cached && cached.checked_at >= cacheCutoff) {
    if (!cached.exists) {
      throw new Error("phone_not_on_whatsapp");
    }
    return;
  }

  const baseUrl = zapi.base_url ?? "https://api.z-api.io";
  const url = `${baseUrl}/instances/${zapi.instance_id}/token/${zapi.token}/phone-exists/${normalized}`;
  const headers: Record<string, string> = {};
  if (zapi.client_token) {
    headers["Client-Token"] = zapi.client_token;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    return;
  }

  const payload = (await response.json()) as { exists?: boolean };
  const exists = Boolean(payload.exists);

  await supabase.from("phone_cache").upsert({
    telefone: normalized,
    exists,
    checked_at: new Date().toISOString(),
  });

  if (!exists) {
    throw new Error("phone_not_on_whatsapp");
  }
}

type SendInput = z.infer<typeof sendWhatsappInput>;
type SendOutput = { ok: true; message_id: string; zapi_message_id: string | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sendWhatsappMessage = ((createServerFn({ method: "POST" }) as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .handler(async (ctx: any) => {
    const data = sendWhatsappInput.parse(ctx.data);
    const auth = await requireAuth();

    const { data: conversation, error: conversationError } = await auth.supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("id", data.conversation_id)
      .maybeSingle();

    if (conversationError || !conversation) {
      throw new Response("Conversation not found", { status: 404 });
    }

    assertClienteAccess(auth, conversation.cliente_id);

    const { data: cliente, error: clienteError } = await auth.supabase
      .from("clientes")
      .select("nome, dados_extras")
      .eq("id", conversation.cliente_id)
      .single();

    if (clienteError || !cliente) {
      throw new Response("Cliente not found", { status: 404 });
    }

    let zapi: ZapiConfig;
    try {
      zapi = extractZapiConfig(cliente.dados_extras);
    } catch {
      throw new Error(`Cliente ${cliente.nome} não tem Z-API configurada`);
    }

    await ensurePhoneExists(auth.supabase, conversation.contact_phone, zapi);

    const baseUrl = zapi.base_url ?? "https://api.z-api.io";
    const sendUrl = `${baseUrl}/instances/${zapi.instance_id}/token/${zapi.token}/send-text`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (zapi.client_token) {
      headers["Client-Token"] = zapi.client_token;
    }

    const zapiResponse = await fetch(sendUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        phone: conversation.contact_phone,
        message: data.body,
      }),
    });

    if (!zapiResponse.ok) {
      throw new Error(`Z-API error ${zapiResponse.status}: ${await zapiResponse.text()}`);
    }

    const zapiPayload = (await zapiResponse.json()) as {
      zaapId?: string;
      messageId?: string;
      id?: string;
    };

    const zapiMessageId = zapiPayload.zaapId ?? zapiPayload.messageId ?? zapiPayload.id ?? null;

    const { data: message, error: messageError } = await auth.supabase
      .from("whatsapp_messages")
      .insert({
        conversation_id: conversation.id,
        cliente_id: conversation.cliente_id,
        direction: "outbound",
        sender_type: data.sender_type,
        sender_user_id: data.sender_type === "human" ? auth.userId : null,
        body: data.body,
        zapi_message_id: zapiMessageId,
        metadata: (data.metadata ?? {}) as Json,
        delivery_status: "sent",
      })
      .select("id")
      .single();

    if (messageError) {
      throw messageError;
    }

    await auth.supabase
      .from("whatsapp_conversations")
      .update({
        last_outbound_at: new Date().toISOString(),
        owner_state: data.sender_type === "human" ? "human_active" : conversation.owner_state,
      })
      .eq("id", conversation.id);

    return {
      ok: true as const,
      message_id: message.id,
      zapi_message_id: zapiMessageId,
    };
  })) as (input: { data: SendInput }) => Promise<SendOutput>;
