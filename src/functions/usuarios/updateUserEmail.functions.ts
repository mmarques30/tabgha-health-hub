import { z } from "zod";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const schema = z.object({
  user_id: z.string().uuid(),
  email: z.string().email(),
  sync_cliente_email: z.boolean().optional(),
});

type EdgePayload = {
  ok?: boolean;
  error?: string;
  email?: string;
  previous_email?: string | null;
  cliente_synced?: boolean;
  unchanged?: boolean;
};

async function readError(error: unknown, payload: EdgePayload | null): Promise<string> {
  if (payload?.error) return payload.error;
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as EdgePayload;
      if (body?.error) return body.error;
    } catch {
      /* ignore */
    }
  }
  if (error instanceof Error) return error.message;
  return "Falha ao atualizar email.";
}

/** Atualiza email de login (Auth + profile). Admin only via edge. */
export async function updateUserEmail(input: {
  data: z.infer<typeof schema>;
}): Promise<EdgePayload> {
  const data = schema.parse(input.data);
  const email = data.email.trim().toLowerCase();

  const { data: result, error } = await supabase.functions.invoke("admin-update-user-email", {
    body: {
      user_id: data.user_id,
      email,
      sync_cliente_email: data.sync_cliente_email ?? true,
    },
  });

  const payload = (result as EdgePayload | null) ?? null;
  if (error) throw new Error(await readError(error, payload));
  if (!payload?.ok) throw new Error(payload?.error || "Falha ao atualizar email.");
  return payload;
}
