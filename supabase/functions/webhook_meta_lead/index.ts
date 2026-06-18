// Webhook do Meta Lead Ads.
//
// Recebe payloads do Facebook/Instagram quando um lead preenche um lead form.
// Identifica o cliente Tabgha (via page_id) e insere em `leads`.
//
// Setup:
//   1. Subir essa function no Supabase: `supabase functions deploy webhook_meta_lead`
//   2. Configurar webhook no Meta Business → Webhooks → Leadgen apontando pra
//      https://<project>.supabase.co/functions/v1/webhook_meta_lead
//   3. Verify token: usar variável META_WEBHOOK_VERIFY_TOKEN
//   4. Mapeamento page_id → cliente_id mora em `clientes.dados_extras.meta.page_id`
//      ou no novo `app_config` chave "meta_page_map".
//
// Status: STUB. Implementação real precisa do token Page Access do Meta pra
// puxar o conteúdo do lead via Graph API.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// @ts-expect-error Deno global available in edge runtime
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// @ts-expect-error Deno global available in edge runtime
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// @ts-expect-error Deno global available in edge runtime
const VERIFY_TOKEN = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// @ts-expect-error Deno global available in edge runtime
Deno.serve(async (req: Request) => {
  // Meta exige GET com hub.challenge na criação do webhook.
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
    // Meta envia entries[].changes[].value com leadgen_id + page_id.
    const entries = body.entry ?? [];
    let inseridos = 0;

    for (const entry of entries) {
      const changes = entry.changes ?? [];
      for (const change of changes) {
        if (change.field !== "leadgen") continue;
        const pageId = change.value?.page_id;
        const leadgenId = change.value?.leadgen_id;
        if (!pageId || !leadgenId) continue;

        // Mapear page_id pra cliente_id — lookup em clientes.dados_extras.
        const { data: matches } = await supabase
          .from("clientes")
          .select("id, dados_extras")
          .filter(
            "dados_extras->>meta_page_id" as never,
            "eq" as never,
            String(pageId) as never,
          );
        const clienteId = matches?.[0]?.id;
        if (!clienteId) {
          console.warn("Lead Meta sem cliente mapeado", { pageId, leadgenId });
          continue;
        }

        // TODO: buscar dados do lead na Graph API (precisa token).
        // Por enquanto registramos o evento com placeholders.
        await supabase.from("leads").insert({
          cliente_id: clienteId,
          nome: "Lead Meta (sync pendente)",
          canal: "facebook",
          origem: `leadgen:${leadgenId}`,
          utm_source: "meta_ads",
          status: "novo",
        });
        inseridos += 1;
      }
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
