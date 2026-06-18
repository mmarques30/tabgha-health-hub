// Sync diário de métricas Meta Ads + Google Ads → metricas_ads.
//
// Pra cada cliente com tokens configurados em clientes.dados_extras, busca as
// métricas do dia anterior nas plataformas e upserta em metricas_ads.
//
// Roda diariamente via supabase cron:
//   SELECT cron.schedule('sync-ads-metrics', '0 6 * * *',
//     $$SELECT net.http_post(
//       url := 'https://<project>.functions.supabase.co/sync_ads_metrics',
//       headers := jsonb_build_object('Authorization', 'Bearer <anon_key>')
//     )$$);
//
// Status: STUB. Plug das APIs Meta Marketing e Google Ads precisa dos tokens
// OAuth de cada cliente — credenciais ficam em clientes.dados_extras.
// Por enquanto a function só registra que rodou e responde 200.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// @ts-expect-error Deno global available in edge runtime
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// @ts-expect-error Deno global available in edge runtime
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

type DadosExtras = {
  meta?: { access_token?: string; ad_account_id?: string };
  google?: { refresh_token?: string; customer_id?: string };
};

async function syncMetaForClient(
  _clienteId: string,
  _config: NonNullable<DadosExtras["meta"]>,
  _ontem: string,
) {
  // TODO: chamar Graph API /act_{ad_account_id}/insights
  // params: time_range[since/until] = ontem, fields = spend, clicks, impressions,
  //   actions[lead], action_values[lead] (atribuição)
  // upsert em metricas_ads (cliente_id, data, plataforma='meta', campanha, ...).
  return { inseridos: 0, erro: "not implemented" };
}

async function syncGoogleForClient(
  _clienteId: string,
  _config: NonNullable<DadosExtras["google"]>,
  _ontem: string,
) {
  // TODO: chamar Google Ads API customers/{customer_id}/googleAds:search
  // SELECT segments.date, metrics.cost_micros, metrics.clicks,
  //   metrics.impressions, metrics.conversions, metrics.conversions_value
  // upsert em metricas_ads (cliente_id, data, plataforma='google', ...).
  return { inseridos: 0, erro: "not implemented" };
}

// @ts-expect-error Deno global available in edge runtime
Deno.serve(async (_req: Request) => {
  try {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const ontemISO = ontem.toISOString().slice(0, 10);

    const { data: clientes, error } = await supabase
      .from("clientes")
      .select("id, dados_extras")
      .eq("status", "ativo");
    if (error) throw error;

    const resultados: Array<{
      cliente: string;
      meta?: { inseridos: number; erro?: string };
      google?: { inseridos: number; erro?: string };
    }> = [];

    for (const c of clientes ?? []) {
      const dx = (c as { id: string; dados_extras?: DadosExtras }).dados_extras ?? {};
      const out: (typeof resultados)[number] = { cliente: c.id };
      if (dx.meta?.access_token) {
        out.meta = await syncMetaForClient(c.id, dx.meta, ontemISO);
      }
      if (dx.google?.refresh_token) {
        out.google = await syncGoogleForClient(c.id, dx.google, ontemISO);
      }
      resultados.push(out);
    }

    return new Response(JSON.stringify({ ok: true, data: ontemISO, resultados }), {
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
