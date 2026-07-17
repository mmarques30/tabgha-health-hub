import { z } from "zod";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const schema = z.object({
  email: z.string().email(),
  nome: z.string().min(2),
  role: z.enum(["admin", "cliente"]),
  cliente_id: z.string().uuid().nullable(),
  permissoes: z.array(z.string()),
});

type Input = z.infer<typeof schema>;

export type CreateUserResult = {
  user_id: string;
  email: string;
  reused_existing?: boolean;
  temporary_password: string;
  role?: string;
};

type EdgePayload = {
  ok?: boolean;
  user_id?: string;
  email?: string;
  error?: string;
  reused_existing?: boolean;
  temporary_password?: string | null;
  role?: string;
};

async function readEdgeError(error: unknown, fallbackData: EdgePayload | null): Promise<string> {
  if (fallbackData?.error) return fallbackData.error;

  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as EdgePayload;
      if (body?.error) return body.error;
    } catch {
      /* body já consumido ou inválido */
    }
  }

  if (error instanceof Error && error.message) {
    if (error.message.includes("non-2xx")) {
      return "Não foi possível criar o acesso. Verifique se o email já existe com outro perfil.";
    }
    return error.message;
  }
  return "Falha ao criar usuário.";
}

/**
 * Cria usuário via edge `admin-create-user`.
 * Retorna senha provisória (Tabgha{ano}) para o admin copiar/enviar.
 */
export async function createUserWithRole(input: { data: Input }): Promise<CreateUserResult> {
  const data = schema.parse(input.data);

  if (data.role === "cliente" && !data.cliente_id) {
    throw new Error("Selecione o cliente ao criar um usuário com perfil Cliente.");
  }

  const { data: result, error } = await supabase.functions.invoke("admin-create-user", {
    body: {
      email: data.email.trim().toLowerCase(),
      nome: data.nome.trim(),
      role: data.role,
      cliente_id: data.cliente_id,
      permissoes: data.permissoes,
    },
  });

  const payload = (result as EdgePayload | null) ?? null;

  if (error) {
    throw new Error(await readEdgeError(error, payload));
  }
  if (!payload?.ok || !payload.user_id || !payload.temporary_password) {
    throw new Error(payload?.error || "Falha ao criar usuário.");
  }

  return {
    user_id: payload.user_id,
    email: payload.email || data.email.trim().toLowerCase(),
    reused_existing: payload.reused_existing,
    temporary_password: payload.temporary_password,
    role: payload.role || data.role,
  };
}
