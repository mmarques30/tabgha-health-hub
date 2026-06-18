import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  cnpj: z.string().optional(),
  especialidade: z.string().optional(),
});

export const createClientWithAccess = createServerFn()
  .validator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verifica se email já existe
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const emailTaken = existing.users.some((u) => u.email === data.email);
    if (emailTaken) throw new Error("Email já cadastrado no sistema.");

    // Cria o registro de cliente (sem usuário — usuário é criado separado em /admin/usuarios)
    const { data: clienteId, error } = await supabaseAdmin.rpc("admin_create_cliente", {
      _nome: data.nome,
      _email: data.email,
      _cnpj: data.cnpj,
    });
    if (error) throw new Error(error.message);

    // Atualiza especialidade se informada
    if (data.especialidade) {
      await supabaseAdmin.from("clientes").update({ especialidade: data.especialidade }).eq("id", clienteId);
    }

    return { cliente_id: clienteId as string };
  });
