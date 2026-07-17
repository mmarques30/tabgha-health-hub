import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") ?? "v19.0";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

type MetaConfig = {
  access_token?: string;
  user_access_token?: string;
  ad_account_id?: string;
};

type ClienteRow = {
  id: string;
  status?: string;
  dados_extras?: { meta?: MetaConfig };
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

function parseLeads(
  actions: Array<{ action_type?: string; value?: string }> | null | undefined,
): number {
  const accepted = new Set([
    "lead",
    "onsite_conversion.lead_grouped",
    "offsite_conversion.fb_pixel_lead",
  ]);
  return (actions ?? []).reduce((acc, item) => {
    if (item.action_type && accepted.has(item.action_type)) {
      return acc + Number(item.value ?? 0);
    }
    return acc;
  }, 0);
}

function datesBetween(since: string, until: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${since}T00:00:00Z`);
  const end = new Date(`${until}T00:00:00Z`);
  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

async function fetchMetaInsights(
  accessToken: string,
  adAccountId: string,
  since: string,
  until: string,
): Promise<Array<Record<string, unknown>>> {
  const path = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const base =
    `https://graph.facebook.com/${GRAPH_VERSION}/${path}/insights` +
    `?access_token=${encodeURIComponent(accessToken)}` +
    `&fields=campaign_name,spend,impressions,clicks,actions,action_values,date_start` +
    `&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}` +
    `&time_increment=1` +
    `&limit=500`;

  // Preferência: nível campanha. Fallback: conta (quando não há breakdown).
  for (const level of ["campaign", "account"]) {
    const url = `${base}&level=${level}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Meta API ${response.status}: ${await response.text()}`);
    }
    const payload = (await response.json()) as {
      data?: Array<Record<string, unknown>>;
    };
    const rows = payload.data ?? [];
    if (rows.length > 0 || level === "account") return rows;
  }
  return [];
}

async function upsertMetrica(clienteId: string, date: string, row: Record<string, unknown>) {
  const campaign = String(row.campaign_name ?? "Conta Meta");
  const investimento = Number(row.spend ?? 0);
  const leads = parseLeads(
    (row.actions as Array<{ action_type?: string; value?: string }> | undefined) ?? [],
  );
  const clicks = Number(row.clicks ?? 0);

  const { error } = await supabase.from("metricas_ads").upsert(
    {
      cliente_id: clienteId,
      data: date,
      plataforma: "meta",
      campanha: campaign,
      investimento,
      leads,
      conversoes: leads,
      cpl: leads > 0 ? investimento / leads : null,
      cpa: leads > 0 ? investimento / leads : null,
      roas: null,
    },
    { onConflict: "cliente_id,data,plataforma,campanha" },
  );

  if (error) throw error;
  return { campanha: campaign, investimento, leads, clicks };
}

async function syncMetaForClient(cliente: ClienteRow, since: string, until: string) {
  const config = cliente.dados_extras?.meta;
  // Insights de Ads precisam do user token (ads_read). Page token fica para leadgen.
  const accessToken = config?.user_access_token || config?.access_token;
  const adAccountId = config?.ad_account_id;

  if (!accessToken || !adAccountId) {
    return { inseridos: 0, skipped: true, motivo: "meta_not_configured" };
  }

  try {
    const rows = await fetchMetaInsights(accessToken, adAccountId, since, until);
    let inseridos = 0;
    for (const row of rows) {
      const date = String(row.date_start ?? since);
      await upsertMetrica(cliente.id, date, row);
      inseridos += 1;
    }

    await supabase.from("automation_logs").insert({
      cliente_id: cliente.id,
      action: "meta_ads_synced",
      metadata: { since, until, linhas: inseridos },
    });

    return { inseridos, linhas: rows.length, since, until };
  } catch (error) {
    await supabase.from("webhook_errors").insert({
      source: "meta_ads_sync",
      cliente_id: cliente.id,
      payload: { since, until, retry_in_minutes: 30, max_attempts: 3 },
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      inseridos: 0,
      erro: error instanceof Error ? error.message : String(error),
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json({ ok: true });

  if (req.method !== "POST" && req.method !== "GET") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  try {
    let since: string | null = null;
    let until: string | null = null;
    let clienteId: string | null = null;
    let days = 1;

    if (req.method === "POST") {
      try {
        const body = (await req.json()) as {
          date?: string;
          since?: string;
          until?: string;
          days?: number;
          cliente_id?: string;
        };
        if (body.cliente_id) clienteId = body.cliente_id;
        if (body.since && body.until) {
          since = body.since;
          until = body.until;
        } else if (body.date) {
          since = body.date;
          until = body.date;
        } else if (typeof body.days === "number" && body.days > 0) {
          days = Math.min(Math.floor(body.days), 90);
        }
      } catch {
        // body opcional
      }
    }

    if (!since || !until) {
      const end = new Date();
      end.setUTCDate(end.getUTCDate() - 1);
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - (days - 1));
      since = start.toISOString().slice(0, 10);
      until = end.toISOString().slice(0, 10);
    }

    const dias = datesBetween(since, until).length;

    let query = supabase
      .from("clientes")
      .select("id, status, dados_extras")
      .in("status", ["ativo", "onboarding", "pausa"]);

    if (clienteId) query = query.eq("id", clienteId);

    const { data: clientes, error } = await query;
    if (error) throw error;

    const resultados: Array<Record<string, unknown>> = [];
    for (const cliente of (clientes ?? []) as ClienteRow[]) {
      const meta = cliente.dados_extras?.meta;
      if (!meta?.ad_account_id || !(meta.user_access_token || meta.access_token)) {
        resultados.push({
          cliente: cliente.id,
          meta: { skipped: true, motivo: "meta_not_configured" },
        });
        continue;
      }

      const metaResult = await syncMetaForClient(cliente, since, until);
      resultados.push({ cliente: cliente.id, meta: metaResult });
    }

    return json({ ok: true, since, until, dias, resultados });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});
