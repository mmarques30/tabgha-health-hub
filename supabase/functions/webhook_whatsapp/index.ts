// Webhook do WhatsApp Business Cloud API.
//
// Recebe mensagens inbound + status de entrega. Por cliente, identifica via
// phone_number_id (configurado em clientes.dados_extras.whatsapp.phone_number_id).
// Quando é primeira mensagem de um número novo, cria lead com canal=whatsapp.
//
// Setup:
//   1. Deploy: `supabase functions deploy webhook_whatsapp`
//   2. No Meta Business > WhatsApp > Configuração > Webhook:
//      URL: https://<project>.supabase.co/functions/v1/webhook_whatsapp
//      Token: WHATSAPP_VERIFY_TOKEN
//      Eventos: messages, message_status
//
// Status: STUB. Lógica de roteamento + agente IA virá em fase seguinte.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// @ts-expect-error Deno global available in edge runtime
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// @ts-expect-error Deno global available in edge runtime
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// @ts-expect-error Deno global available in edge runtime
const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// @ts-expect-error Deno global available in edge runtime
Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const entry = body.entry?.[0];
    const value = entry?.changes?.[0]?.value;
    if (!value) {
      return new Response(JSON.stringify({ ok: true, skipped: "no value" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const phoneNumberId = value.metadata?.phone_number_id;
    // Mapeia phone_number_id pra cliente_id.
    const { data: matches } = await supabase
      .from("clientes")
      .select("id")
      .filter(
        "dados_extras->>whatsapp_phone_id" as never,
        "eq" as never,
        String(phoneNumberId) as never,
      );
    const clienteId = matches?.[0]?.id;

    if (!clienteId) {
      console.warn("WhatsApp inbound sem cliente mapeado", { phoneNumberId });
      return new Response(JSON.stringify({ ok: true, skipped: "no cliente" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const messages = value.messages ?? [];
    let inseridos = 0;
    for (const msg of messages) {
      const from = msg.from;
      const text = msg.text?.body ?? "[mídia]";

      // Lead existe? Procura por telefone + cliente.
      const { data: existentes } = await supabase
        .from("leads")
        .select("id")
        .eq("cliente_id", clienteId)
        .eq("telefone", from)
        .limit(1);

      if (existentes && existentes.length > 0) {
        // TODO: log de mensagem (tabela whatsapp_messages futura).
        continue;
      }

      await supabase.from("leads").insert({
        cliente_id: clienteId,
        nome: msg.profile?.name ?? from,
        telefone: from,
        canal: "whatsapp",
        origem: "whatsapp_inbound",
        observacao: text.slice(0, 500),
        status: "novo",
      });
      inseridos += 1;
    }

    return new Response(JSON.stringify({ ok: true, inseridos }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
