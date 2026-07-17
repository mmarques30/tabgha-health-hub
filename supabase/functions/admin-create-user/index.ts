// Cria usuário Auth + profile/role (admin only).
// POST { email, nome, role, cliente_id?, permissoes? }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY || SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ ok: false, error: "unauthorized" }, 401);

    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (roleErr || !isAdmin) return json({ ok: false, error: "apenas admin" }, 403);

    const body = (await req.json()) as {
      email?: string;
      nome?: string;
      role?: "admin" | "cliente";
      cliente_id?: string | null;
      permissoes?: string[];
    };

    const email = body.email?.trim().toLowerCase();
    const nome = body.nome?.trim();
    const role = body.role;
    if (!email || !nome || !role) {
      return json({ ok: false, error: "email, nome e role são obrigatórios" }, 400);
    }
    if (role === "cliente" && !body.cliente_id) {
      return json({ ok: false, error: "cliente_id obrigatório para perfil cliente" }, 400);
    }

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: `${crypto.randomUUID()}-Tmp1!`,
    });
    if (authError) return json({ ok: false, error: authError.message }, 400);

    const userId = authData.user.id;
    const { error: rpcError } = await admin.rpc("admin_upsert_profile_role", {
      _user_id: userId,
      _role: role,
      _cliente_id: body.cliente_id ?? undefined,
      _permissoes: body.permissoes ?? ["*"],
    });
    if (rpcError) return json({ ok: false, error: rpcError.message }, 400);

    await admin.from("profiles").update({ nome, email }).eq("id", userId);

    return json({ ok: true, user_id: userId });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});
