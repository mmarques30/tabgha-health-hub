import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const schema = z.object({
  id: z.string().uuid(),
  nome: z.string().min(2).nullable().optional(),
  cliente_id: z.string().uuid().nullable().optional(),
  permissoes: z.array(z.string()).min(1),
});

type Input = z.infer<typeof schema>;

/**
 * Atualiza nome, vínculo de cliente e permissões de um membro (admin via RLS).
 */
export async function updateMemberAccess(input: { data: Input }): Promise<void> {
  const data = schema.parse(input.data);

  const patch: {
    nome?: string | null;
    cliente_id?: string | null;
    permissoes: string[];
  } = {
    permissoes: data.permissoes,
  };

  if (data.nome !== undefined) patch.nome = data.nome?.trim() || null;
  if (data.cliente_id !== undefined) patch.cliente_id = data.cliente_id;

  const { error } = await supabase.from("profiles").update(patch).eq("id", data.id);
  if (error) throw new Error(error.message || "Falha ao atualizar acessos.");
}
