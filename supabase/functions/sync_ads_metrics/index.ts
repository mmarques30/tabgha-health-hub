import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") ?? "v19.0";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

type MetaConfig = {
  access_token?: string;
  user_access_token?: string;
  ad_account_id?: string;
  ad_account_name?: string | null;
  page_name?: string;
  page_id?: string;
};

type ClienteRow = {
  id: string;
  status?: string;
  dados_extras?: { meta?: MetaConfig } & Record<string, unknown>;
};

type AdAccount = {
  id: string;
  account_id: string;
  name: string;
  amount_spent: number;
  currency?: string;
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

function normalizeAccountId(raw: string): string {
  return raw.replace(/^act_/, "");
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

async function listAdAccounts(accessToken: string): Promise<AdAccount[]> {
  const url =
    `https://graph.facebook.com/${GRAPH_VERSION}/me/adaccounts` +
    `?fields=id,name,account_id,amount_spent,currency` +
    `&limit=100` +
    `&access_token=${encodeURIComponent(accessToken)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Meta adaccounts ${response.status}: ${await response.text()}`);
  }
  const payload = (await response.json()) as {
    data?: Array<{
      id?: string;
      name?: string;
      account_id?: string;
      amount_spent?: string;
      currency?: string;
    }>;
  };

  return (payload.data ?? [])
    .map((row) => {
      const accountId = normalizeAccountId(row.account_id ?? row.id ?? "");
      if (!accountId) return null;
      return {
        id: row.id ?? `act_${accountId}`,
        account_id: accountId,
        name: row.name ?? accountId,
        amount_spent: Number(row.amount_spent ?? 0),
        currency: row.currency,
      } satisfies AdAccount;
    })
    .filter((row): row is AdAccount => Boolean(row));
}

function rankAdAccounts(accounts: AdAccount[], pageName?: string | null): AdAccount[] {
  const page = (pageName ?? "").trim().toLowerCase();
  return [...accounts].sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    const aMatch = page && (aName.includes(page) || page.includes(aName)) ? 1 : 0;
    const bMatch = page && (bName.includes(page) || page.includes(bName)) ? 1 : 0;
    if (aMatch !== bMatch) return bMatch - aMatch;
    if (a.amount_spent !== b.amount_spent) return b.amount_spent - a.amount_spent;
    return aName.localeCompare(bName);
  });
}

async function persistAdAccount(
  cliente: ClienteRow,
  adAccountId: string,
  accounts: AdAccount[],
) {
  const extras = { ...(cliente.dados_extras ?? {}) } as Record<string, unknown>;
  const meta = { ...((extras.meta as MetaConfig | undefined) ?? {}) } as Record<string, unknown>;
  const selected = accounts.find((a) => a.account_id === adAccountId);
  meta.ad_account_id = adAccountId;
  meta.ad_account_name = selected?.name ?? (meta.ad_account_name as string | null | undefined) ?? null;
  // Catálogo da BM não deve ir para o cliente (UI / outros sistemas).
  delete meta.ad_accounts;
  delete meta.pages;
  extras.meta = meta;

  const { error } = await supabase
    .from("clientes")
    .update({ dados_extras: extras })
    .eq("id", cliente.id);
  if (error) throw error;

  cliente.dados_extras = extras as ClienteRow["dados_extras"];
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
  let adAccountId = config?.ad_account_id ? normalizeAccountId(config.ad_account_id) : null;

  if (!accessToken) {
    return { inseridos: 0, skipped: true, motivo: "meta_not_configured" };
  }

  try {
    const accounts = await listAdAccounts(accessToken);
    const ranked = rankAdAccounts(accounts, config?.page_name);

    if (!adAccountId) {
      adAccountId = ranked[0]?.account_id ?? null;
      if (adAccountId) {
        await persistAdAccount(cliente, adAccountId, accounts);
      }
    }

    if (!adAccountId) {
      return {
        inseridos: 0,
        skipped: true,
        motivo: "ad_account_missing",
        ad_accounts_count: accounts.length,
      };
    }

    let rows = await fetchMetaInsights(accessToken, adAccountId, since, until);
    let usedAccount = adAccountId;
    let autoSwitched = false;

    // Conta errada (comum: OAuth pega a 1ª com gasto 0) → tenta as demais por ranking.
    if (rows.length === 0 && ranked.length > 1) {
      for (const candidate of ranked) {
        if (candidate.account_id === adAccountId) continue;
        const candidateRows = await fetchMetaInsights(
          accessToken,
          candidate.account_id,
          since,
          until,
        );
        if (candidateRows.length > 0) {
          rows = candidateRows;
          usedAccount = candidate.account_id;
          autoSwitched = true;
          await persistAdAccount(cliente, usedAccount, accounts);
          break;
        }
      }
    } else if (accounts.length > 0 && !config?.ad_account_name) {
      // Só grava o nome da conta vinculada (sem catálogo da BM).
      await persistAdAccount(cliente, usedAccount, accounts);
    }

    let inseridos = 0;
    for (const row of rows) {
      const date = String(row.date_start ?? since);
      await upsertMetrica(cliente.id, date, row);
      inseridos += 1;
    }

    const linkedName =
      ranked.find((a) => a.account_id === usedAccount)?.name ?? config?.ad_account_name ?? null;

    await supabase.from("automation_logs").insert({
      cliente_id: cliente.id,
      action: "meta_ads_synced",
      metadata: {
        since,
        until,
        linhas: inseridos,
        ad_account_id: usedAccount,
        ad_account_name: linkedName,
        auto_switched: autoSwitched,
        ad_accounts_count: ranked.length,
      },
    });

    return {
      inseridos,
      linhas: rows.length,
      since,
      until,
      ad_account_id: usedAccount,
      ad_account_name: linkedName,
      auto_switched: autoSwitched,
      motivo: rows.length === 0 ? "no_insights_in_range" : undefined,
      ad_accounts_count: ranked.length,
    };
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
    let days = 7;

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
      if (!(meta?.user_access_token || meta?.access_token)) {
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
