import { createClient } from "@supabase/supabase-js";
import { getRequestHeader } from "@tanstack/react-start/server";

import type { Database } from "@/integrations/supabase/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AuthContext = {
  userId: string;
  email: string | undefined;
  role: Database["public"]["Enums"]["app_role"];
  clienteId: string | null;
  permissoes: string[] | null;
  accessToken: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
};

export async function requireAuth(): Promise<AuthContext> {
  const authHeader = getRequestHeader("Authorization");
  const accessToken = authHeader?.replace(/^Bearer\s+/i, "");

  if (!accessToken) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Response("Missing Supabase auth env vars", { status: 500 });
  }

  const authClient = createClient<Database>(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(accessToken);

  if (error || !user) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");

  const [profileResult, roleResult] = await Promise.all([
    admin.from("profiles").select("cliente_id, permissoes").eq("id", user.id).maybeSingle(),
    admin.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
  ]);

  if (profileResult.error || roleResult.error || !roleResult.data?.role) {
    throw new Response("Forbidden", { status: 403 });
  }

  return {
    userId: user.id,
    email: user.email,
    role: roleResult.data.role,
    clienteId: profileResult.data?.cliente_id ?? null,
    permissoes: profileResult.data?.permissoes ?? null,
    accessToken,
    supabase: admin,
  };
}

export function assertClienteAccess(auth: AuthContext, clienteId: string) {
  if (auth.role === "admin") {
    return;
  }

  if (auth.role !== "cliente" || auth.clienteId !== clienteId) {
    throw new Response("Forbidden", { status: 403 });
  }
}
