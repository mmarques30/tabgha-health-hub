import { z } from "zod";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { provisionalPassword } from "@/lib/provisional-password";

const schema = z.object({
  user_id: z.string().uuid(),
});

type EdgePayload = {
  ok?: boolean;
  user_id?: string;
  email?: string;
  error?: string;
  temporary_password?: string | null;
  reused_existing?: boolean;
  roles?: string[];
};

async function readEdgeError(error: unknown, fallbackData: EdgePayload | null): Promise<string> {
  if (fallbackData?.error) return fallbackData.error;
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as EdgePayload;
      if (body?.error) return body.error;
    } catch {
      /* ignore */
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return "Falha ao redefinir senha.";
}

export type ResetPasswordResult = {
  user_id: string;
  email: string;
  temporary_password: string;
  roles?: string[];
};

/** Redefine a senha provisória (Tabgha{ano}) e devolve as credenciais para copiar. */
export async function resetProvisionalPassword(input: {
  data: z.infer<typeof schema>;
}): Promise<ResetPasswordResult> {
  const data = schema.parse(input.data);

  const { data: result, error } = await supabase.functions.invoke("admin-create-user", {
    body: {
      action: "reset_password",
      user_id: data.user_id,
    },
  });

  const payload = (result as EdgePayload | null) ?? null;
  if (error) throw new Error(await readEdgeError(error, payload));
  if (!payload?.ok || !payload.user_id) {
    throw new Error(payload?.error || "Falha ao redefinir senha.");
  }

  return {
    user_id: payload.user_id,
    email: payload.email || "",
    temporary_password: payload.temporary_password || provisionalPassword(),
    roles: payload.roles,
  };
}
