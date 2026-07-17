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

/**
 * Cria usuário via edge `admin-create-user` (service role no servidor).
 */
export async function createUserWithRole(input: {
  data: Input;
}): Promise<{ user_id: string }> {
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

  if (error) throw new Error(error.message || "Falha ao criar usuário.");
  const payload = result as { ok?: boolean; user_id?: string; error?: string } | null;
  if (!payload?.ok || !payload.user_id) {
    throw new Error(payload?.error || "Falha ao criar usuário.");
  }

  return { user_id: payload.user_id };
}
