// Renova tokens Meta long-lived antes de expirar.
// Agendar semanalmente (ex.: segunda 06:00 UTC) com Authorization: Bearer SERVICE_ROLE.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_APP_ID = Deno.env.get("META_APP_ID") ?? "";
const META_APP_SECRET = Deno.env.get("META_APP_SECRET") ?? "";
const GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") ?? "v19.0";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (token !== SERVICE_KEY) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  if (!META_APP_ID || !META_APP_SECRET) {
    return json({ ok: false, error: "missing_meta_secrets" }, 500);
  }

  const { data: clientes, error } = await supabase
    .from("clientes")
    .select("id, dados_extras")
    .not("dados_extras->meta->>access_token", "is", null);

  if (error) {
    return json({ ok: false, error: error.message }, 500);
  }

  let refreshed = 0;
  let skipped = 0;
  let failed = 0;

  for (const cli of clientes ?? []) {
    const meta = (cli.dados_extras as { meta?: Record<string, unknown> } | null)?.meta;
    const current =
      (meta?.user_access_token as string | undefined) ??
      (meta?.access_token as string | undefined);
    if (!current) {
      skipped += 1;
      continue;
    }

    const expiresAt = meta?.expires_at ? new Date(String(meta.expires_at)) : null;
    // Só renova se faltar < 14 dias ou se não houver expires_at
    if (expiresAt && expiresAt.getTime() - Date.now() > 14 * 24 * 60 * 60 * 1000) {
      skipped += 1;
      continue;
    }

    try {
      const url =
        `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token` +
        `?grant_type=fb_exchange_token` +
        `&client_id=${encodeURIComponent(META_APP_ID)}` +
        `&client_secret=${encodeURIComponent(META_APP_SECRET)}` +
        `&fb_exchange_token=${encodeURIComponent(current)}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(await res.text());

      const payload = (await res.json()) as { access_token: string; expires_in?: number };
      const nextExpires = payload.expires_in
        ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
        : null;

      const extras = (cli.dados_extras as Record<string, unknown>) ?? {};
      const nextMeta = {
        ...(meta ?? {}),
        user_access_token: payload.access_token,
        // Mantém page token se existir; senão usa o renovado
        access_token: (meta?.access_token as string | undefined) ?? payload.access_token,
        expires_at: nextExpires,
        refreshed_at: new Date().toISOString(),
      };

      await supabase
        .from("clientes")
        .update({ dados_extras: { ...extras, meta: nextMeta } })
        .eq("id", cli.id);

      await supabase.from("automation_logs").insert({
        cliente_id: cli.id,
        action: "meta_token_refreshed",
        metadata: { expires_at: nextExpires },
      });

      refreshed += 1;
    } catch (err) {
      failed += 1;
      await supabase.from("webhook_errors").insert({
        source: "meta_token_refresh",
        cliente_id: cli.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return json({ ok: true, refreshed, skipped, failed });
});
