import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") ?? "v19.0";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

type MetaConfig = {
  access_token?: string;
  ad_account_id?: string;
};

type ClienteRow = {
  id: string;
  dados_extras?: { meta?: MetaConfig };
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
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

async function fetchMetaInsights(
  accessToken: string,
  adAccountId: string,
  date: string,
): Promise<Array<Record<string, unknown>>> {
  const path = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const url =
    `https://graph.facebook.com/${GRAPH_VERSION}/${path}/insights` +
    `?access_token=${encodeURIComponent(accessToken)}` +
    `&level=campaign` +
    `&fields=campaign_name,spend,impressions,clicks,actions,action_values` +
    `&time_range=${encodeURIComponent(JSON.stringify({ since: date, until: date }))}` +
    `&limit=200`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Meta API ${response.status}: ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    data?: Array<Record<string, unknown>>;
  };
  return payload.data ?? [];
}

async function upsertMetrica(clienteId: string, date: string, row: Record<string, unknown>) {
  const campaign = String(row.campaign_name ?? "Sem nome");
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

  if (error) {
    throw error;
  }

  return { campanha: campaign, investimento, leads, clicks };
}

async function syncMetaForClient(cliente: ClienteRow, date: string) {
  const config = cliente.dados_extras?.meta;
  const accessToken = config?.access_token;
  const adAccountId = config?.ad_account_id;

  if (!accessToken || !adAccountId) {
    return { inseridos: 0, skipped: true, motivo: "meta_not_configured" };
  }

  try {
    const rows = await fetchMetaInsights(accessToken, adAccountId, date);
    let inseridos = 0;
    for (const row of rows) {
      await upsertMetrica(cliente.id, date, row);
      inseridos += 1;
    }

    await supabase.from("automation_logs").insert({
      cliente_id: cliente.id,
      action: "meta_ads_synced",
      metadata: {
        data: date,
        campanhas: inseridos,
      },
    });

    return { inseridos, campanhas: rows.length };
  } catch (error) {
    await supabase.from("webhook_errors").insert({
      source: "meta_ads_sync",
      cliente_id: cliente.id,
      payload: { date, retry_in_minutes: 30, max_attempts: 3 },
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      inseridos: 0,
      erro: error instanceof Error ? error.message : String(error),
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  try {
    let date = new Date();
    date.setDate(date.getDate() - 1);

    if (req.method === "POST") {
      try {
        const body = (await req.json()) as { date?: string };
        if (body.date) {
          date = new Date(`${body.date}T00:00:00Z`);
        }
      } catch {
        // body opcional
      }
    }

    const dateISO = date.toISOString().slice(0, 10);

    const { data: clientes, error } = await supabase
      .from("clientes")
      .select("id, dados_extras")
      .eq("status", "ativo");

    if (error) throw error;

    const resultados: Array<Record<string, unknown>> = [];
    for (const cliente of (clientes ?? []) as ClienteRow[]) {
      const metaResult = await syncMetaForClient(cliente, dateISO);
      resultados.push({ cliente: cliente.id, meta: metaResult });
    }

    return json({ ok: true, data: dateISO, resultados });
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
