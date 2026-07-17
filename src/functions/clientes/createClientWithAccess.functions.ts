import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const schema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  cnpj: z.string().optional(),
  especialidade: z.string().optional(),
});

type Input = z.infer<typeof schema>;

/**
 * Cria cliente via RPC `admin_create_cliente` (SECURITY DEFINER + assert_current_admin).
 * Roda no browser com a sessão do admin — não depende de createServerFn / service role.
 */
export async function createClientWithAccess(input: { data: Input }): Promise<{ cliente_id: string }> {
  const data = schema.parse(input.data);

  const email = data.email.trim().toLowerCase();

  const { data: existing, error: existingError } = await supabase
    .from("clientes")
    .select("id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing) throw new Error("Email já cadastrado em outro cliente.");

  const { data: clienteId, error } = await supabase.rpc("admin_create_cliente", {
    _nome: data.nome.trim(),
    _email: email,
    _cnpj: data.cnpj?.trim() || undefined,
  });

  if (error) throw new Error(error.message);
  if (!clienteId) throw new Error("Falha ao criar cliente.");

  const especialidade = data.especialidade?.trim();
  if (especialidade) {
    const { error: updateError } = await supabase
      .from("clientes")
      .update({ especialidade })
      .eq("id", clienteId);
    if (updateError) throw new Error(updateError.message);
  }

  return { cliente_id: clienteId as string };
}
