import { z } from "zod";
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

/**
 * Cria usuário via edge `admin-create-user`.
 * Retorna senha temporária obrigatória para o admin copiar.
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

  const payload = result as {
    ok?: boolean;
    user_id?: string;
    email?: string;
    error?: string;
    reused_existing?: boolean;
    temporary_password?: string | null;
    role?: string;
  } | null;

  if (error) {
    throw new Error(payload?.error || error.message || "Falha ao criar usuário.");
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
