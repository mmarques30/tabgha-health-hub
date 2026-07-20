// OAuth Meta Login for Business — troca code por long-lived token e salva no cliente.
//
// GET ?code=&state={cliente_id}  (redirect do Facebook)
// Env: META_APP_ID, META_APP_SECRET, META_OAUTH_REDIRECT_URI (opcional),
//      META_OAUTH_SUCCESS_URL (redirect final pro admin)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_APP_ID = Deno.env.get("META_APP_ID") ?? "";
const META_APP_SECRET = Deno.env.get("META_APP_SECRET") ?? "";
const GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") ?? "v19.0";
const REDIRECT_URI =
  Deno.env.get("META_OAUTH_REDIRECT_URI") ?? `${SUPABASE_URL}/functions/v1/meta-oauth-callback`;
const SUCCESS_URL = Deno.env.get("META_OAUTH_SUCCESS_URL") ?? "/admin/config-meta?meta=connected";
const ERROR_URL = Deno.env.get("META_OAUTH_ERROR_URL") ?? "/admin/config-meta?meta=error";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function redirect(to: string) {
  return Response.redirect(to, 302);
}

function absoluteAppUrl(pathOrUrl: string, req: Request) {
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  const origin =
    Deno.env.get("APP_ORIGIN") ??
    req.headers.get("origin") ??
    "https://tabgha-clinic-pulse.lovable.app";
  return `${origin.replace(/\/$/, "")}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

function normalizeAccountId(raw: string): string {
  return raw.replace(/^act_/, "");
}

async function exchangeCode(code: string) {
  const url =
    `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token` +
    `?client_id=${encodeURIComponent(META_APP_ID)}` +
    `&client_secret=${encodeURIComponent(META_APP_SECRET)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&code=${encodeURIComponent(code)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`token exchange failed: ${await res.text()}`);
  }
  return (await res.json()) as { access_token: string; expires_in?: number };
}

async function toLongLived(shortToken: string) {
  const url =
    `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token` +
    `?grant_type=fb_exchange_token` +
    `&client_id=${encodeURIComponent(META_APP_ID)}` +
    `&client_secret=${encodeURIComponent(META_APP_SECRET)}` +
    `&fb_exchange_token=${encodeURIComponent(shortToken)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`long-lived exchange failed: ${await res.text()}`);
  }
  return (await res.json()) as { access_token: string; expires_in?: number };
}

async function fetchPages(token: string) {
  const url =
    `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts` +
    `?fields=id,name,access_token` +
    `&limit=100` +
    `&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`pages fetch failed: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    data?: Array<{ id: string; name: string; access_token: string }>;
  };
  return data.data ?? [];
}

type AdAccount = {
  id: string;
  name: string;
  amount_spent: number;
  currency?: string;
};

async function fetchAdAccounts(token: string): Promise<AdAccount[]> {
  const url =
    `https://graph.facebook.com/${GRAPH_VERSION}/me/adaccounts` +
    `?fields=id,name,account_id,amount_spent,currency` +
    `&limit=100` +
    `&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url);
  if (!res.ok) {
    return [];
  }
  const data = (await res.json()) as {
    data?: Array<{
      id?: string;
      name?: string;
      account_id?: string;
      amount_spent?: string;
      currency?: string;
    }>;
  };

  return (data.data ?? [])
    .map((row) => {
      const id = normalizeAccountId(row.account_id ?? row.id ?? "");
      if (!id) return null;
      return {
        id,
        name: row.name ?? id,
        amount_spent: Number(row.amount_spent ?? 0),
        currency: row.currency,
      } satisfies AdAccount;
    })
    .filter((row): row is AdAccount => Boolean(row));
}

function pickAdAccount(accounts: AdAccount[], pageName?: string | null): string | null {
  if (accounts.length === 0) return null;
  const page = (pageName ?? "").trim().toLowerCase();
  const ranked = [...accounts].sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    const aMatch = page && (aName.includes(page) || page.includes(aName)) ? 1 : 0;
    const bMatch = page && (bName.includes(page) || page.includes(bName)) ? 1 : 0;
    if (aMatch !== bMatch) return bMatch - aMatch;
    if (a.amount_spent !== b.amount_spent) return b.amount_spent - a.amount_spent;
    return aName.localeCompare(bName);
  });
  return ranked[0]?.id ?? null;
}

async function subscribePageLeadgen(pageId: string, pageToken: string) {
  const url =
    `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/subscribed_apps` +
    `?subscribed_fields=leadgen` +
    `&access_token=${encodeURIComponent(pageToken)}`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    return { ok: false as const, error: await res.text() };
  }
  return { ok: true as const, payload: await res.json() };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // cliente_id
  const oauthError = url.searchParams.get("error");

  if (oauthError || !code || !state) {
    return redirect(absoluteAppUrl(`${ERROR_URL}&reason=${oauthError ?? "missing_code"}`, req));
  }

  if (!META_APP_ID || !META_APP_SECRET) {
    await supabase.from("webhook_errors").insert({
      source: "meta_oauth",
      cliente_id: state,
      error: "META_APP_ID/META_APP_SECRET não configurados",
    });
    return redirect(absoluteAppUrl(`${ERROR_URL}&reason=missing_app_secrets`, req));
  }

  try {
    const short = await exchangeCode(code);
    const longLived = await toLongLived(short.access_token);
    const pages = await fetchPages(longLived.access_token);
    const page = pages[0] ?? null;

    const pageToken = page?.access_token ?? longLived.access_token;
    const pageId = page?.id ?? null;
    const adAccounts = await fetchAdAccounts(longLived.access_token);
    const adAccountId = pickAdAccount(adAccounts, page?.name);
    const expiresAt = longLived.expires_in
      ? new Date(Date.now() + longLived.expires_in * 1000).toISOString()
      : null;

    let leadgenSubscribe: { ok: boolean; error?: string } | null = null;
    if (pageId && page?.access_token) {
      const sub = await subscribePageLeadgen(pageId, page.access_token);
      leadgenSubscribe = sub.ok
        ? { ok: true }
        : { ok: false, error: "error" in sub ? sub.error : "subscribe_failed" };
    }

    const { data: cliente, error: clienteError } = await supabase
      .from("clientes")
      .select("id, dados_extras")
      .eq("id", state)
      .maybeSingle();

    if (clienteError || !cliente) {
      throw new Error("cliente_not_found");
    }

    const extras = (cliente.dados_extras as Record<string, unknown> | null) ?? {};
    const prevMeta = {
      ...((extras.meta as Record<string, unknown> | undefined) ?? {}),
    };
    // Nunca persistir catálogo da BM (outras contas/páginas + gasto histórico).
    delete prevMeta.ad_accounts;
    delete prevMeta.pages;
    const selectedAdAccount = adAccounts.find((a) => a.id === adAccountId) ?? null;
    const nextExtras = {
      ...extras,
      meta: {
        ...prevMeta,
        access_token: pageToken,
        user_access_token: longLived.access_token,
        page_id: pageId,
        page_name: page?.name ?? null,
        ad_account_id: adAccountId,
        ad_account_name: selectedAdAccount?.name ?? null,
        leadgen_subscribed: leadgenSubscribe?.ok ?? false,
        expires_at: expiresAt,
        connected_at: new Date().toISOString(),
      },
    };

    const { error: updateError } = await supabase
      .from("clientes")
      .update({ dados_extras: nextExtras })
      .eq("id", state);

    if (updateError) throw updateError;

    await supabase.from("automation_logs").insert({
      cliente_id: state,
      action: "meta_oauth_connected",
      metadata: {
        page_id: pageId,
        page_name: page?.name ?? null,
        ad_account_id: adAccountId,
        ad_account_name: selectedAdAccount?.name ?? null,
        ad_accounts_count: adAccounts.length,
        leadgen_subscribed: leadgenSubscribe?.ok ?? false,
        leadgen_subscribe_error: leadgenSubscribe?.ok === false ? leadgenSubscribe.error : null,
        expires_at: expiresAt,
      },
    });

    if (leadgenSubscribe && !leadgenSubscribe.ok) {
      await supabase.from("webhook_errors").insert({
        source: "meta_oauth_leadgen_subscribe",
        cliente_id: state,
        payload: { page_id: pageId },
        error: leadgenSubscribe.error ?? "subscribe_failed",
      });
    }

    return redirect(
      absoluteAppUrl(
        `${SUCCESS_URL}&page_id=${encodeURIComponent(pageId ?? "")}&cliente_id=${state}`,
        req,
      ),
    );
  } catch (error) {
    console.error("meta-oauth-callback error", error);
    await supabase.from("webhook_errors").insert({
      source: "meta_oauth",
      cliente_id: state,
      error: error instanceof Error ? error.message : String(error),
    });
    return redirect(absoluteAppUrl(`${ERROR_URL}&reason=exchange_failed`, req));
  }
});
