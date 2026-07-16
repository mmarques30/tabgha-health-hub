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

async function fetchPage(token: string) {
  const url =
    `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts` +
    `?fields=id,name,access_token` +
    `&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`pages fetch failed: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    data?: Array<{ id: string; name: string; access_token: string }>;
  };
  return data.data?.[0] ?? null;
}

async function fetchAdAccount(token: string) {
  const url =
    `https://graph.facebook.com/${GRAPH_VERSION}/me/adaccounts` +
    `?fields=id,name,account_id` +
    `&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url);
  if (!res.ok) {
    return null;
  }
  const data = (await res.json()) as {
    data?: Array<{ id?: string; account_id?: string }>;
  };

  const first = data.data?.[0];
  return first?.account_id ?? first?.id?.replace(/^act_/, "") ?? null;
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
    const page = await fetchPage(longLived.access_token);

    const pageToken = page?.access_token ?? longLived.access_token;
    const pageId = page?.id ?? null;
    const adAccountId = await fetchAdAccount(longLived.access_token);
    const expiresAt = longLived.expires_in
      ? new Date(Date.now() + longLived.expires_in * 1000).toISOString()
      : null;

    const { data: cliente, error: clienteError } = await supabase
      .from("clientes")
      .select("id, dados_extras")
      .eq("id", state)
      .maybeSingle();

    if (clienteError || !cliente) {
      throw new Error("cliente_not_found");
    }

    const extras = (cliente.dados_extras as Record<string, unknown> | null) ?? {};
    const nextExtras = {
      ...extras,
      meta: {
        ...((extras.meta as Record<string, unknown> | undefined) ?? {}),
        access_token: pageToken,
        user_access_token: longLived.access_token,
        page_id: pageId,
        page_name: page?.name ?? null,
        ad_account_id: adAccountId,
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
        expires_at: expiresAt,
      },
    });

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
