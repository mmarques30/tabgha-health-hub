// Cria usuário Auth + profile/role (admin only).
// Se o email já existir, atualiza perfil/role e gera link de recuperação.
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

function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("already been registered") || lower.includes("email_exists")) {
    return "Este email já está cadastrado. Atualizamos o perfil existente — use o link de recuperação ou a senha temporária.";
  }
  return message;
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  // Lista paginada — base pequena; suficiente para equipe Tabgha
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (found) return found.id;
    if (data.users.length < 200) break;
  }
  return null;
}

async function generateRecoveryLink(email: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });
  if (error) {
    console.error("generateLink failed", error.message);
    return null;
  }
  return data.properties?.action_link ?? null;
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

    const temporaryPassword = `${crypto.randomUUID().slice(0, 8)}-Tabgha1!`;
    let userId: string | null = null;
    let reusedExisting = false;

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: temporaryPassword,
    });

    if (authError) {
      const msg = authError.message || "";
      const exists =
        msg.toLowerCase().includes("already been registered") ||
        msg.toLowerCase().includes("email_exists") ||
        (authError as { code?: string }).code === "email_exists";

      if (!exists) {
        return json({ ok: false, error: translateAuthError(msg) }, 400);
      }

      userId = await findUserIdByEmail(email);
      if (!userId) {
        return json(
          {
            ok: false,
            error:
              "Este email já existe no Auth, mas não foi possível localizar o usuário. Contate o suporte.",
          },
          400,
        );
      }
      reusedExisting = true;

      // Garante senha conhecida para o admin passar ao usuário
      const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
        password: temporaryPassword,
        email_confirm: true,
      });
      if (updateErr) {
        return json({ ok: false, error: updateErr.message }, 400);
      }
    } else {
      userId = authData.user.id;
    }

    const { error: rpcError } = await admin.rpc("admin_upsert_profile_role", {
      _user_id: userId,
      _role: role,
      _cliente_id: body.cliente_id ?? undefined,
      _permissoes: body.permissoes ?? ["*"],
    });
    if (rpcError) return json({ ok: false, error: rpcError.message }, 400);

    // Garante role única desejada (admin_upsert só faz ON CONFLICT DO NOTHING)
    await admin.from("user_roles").delete().eq("user_id", userId).neq("role", role);
    const { error: roleInsertErr } = await admin.from("user_roles").upsert(
      { user_id: userId, role },
      { onConflict: "user_id,role" },
    );
    if (roleInsertErr) {
      console.error("role upsert", roleInsertErr.message);
    }

    await admin
      .from("profiles")
      .update({
        nome,
        email,
        cliente_id: role === "cliente" ? body.cliente_id : null,
        permissoes: body.permissoes ?? ["*"],
      })
      .eq("id", userId);

    const recoveryLink = await generateRecoveryLink(email);

    return json({
      ok: true,
      user_id: userId,
      reused_existing: reusedExisting,
      temporary_password: temporaryPassword,
      recovery_link: recoveryLink,
      message: reusedExisting
        ? "Usuário já existia — perfil atualizado e senha temporária gerada."
        : "Usuário criado com senha temporária.",
    });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});
