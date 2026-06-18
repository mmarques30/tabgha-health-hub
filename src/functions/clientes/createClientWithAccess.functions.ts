import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  cnpj: z.string().optional(),
  especialidade: z.string().optional(),
});

type Input = z.infer<typeof schema>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createClientWithAccess = (createServerFn() as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .handler(async (ctx: any) => {
    const data = schema.parse(ctx.data);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const emailTaken = existing.users.some((u: { email?: string }) => u.email === data.email);
    if (emailTaken) throw new Error("Email já cadastrado no sistema.");

    const { data: clienteId, error } = await supabaseAdmin.rpc("admin_create_cliente", {
      _nome: data.nome,
      _email: data.email,
      _cnpj: data.cnpj,
    });
    if (error) throw new Error(error.message);

    if (data.especialidade) {
      await supabaseAdmin.from("clientes").update({ especialidade: data.especialidade }).eq("id", clienteId);
    }

    return { cliente_id: clienteId as string };
  }) as (input: { data: Input }) => Promise<{ cliente_id: string }>;
