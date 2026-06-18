import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  nome: z.string().min(2),
  role: z.enum(["admin", "cliente"]),
  cliente_id: z.string().uuid().nullable(),
  permissoes: z.array(z.string()),
});

export const createUserWithRole = createServerFn()
  .validator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      email_confirm: true,
      password: `${crypto.randomUUID()}-Tmp1!`,
    });
    if (authError) throw new Error(authError.message);

    const userId = authData.user.id;

    const { error: rpcError } = await supabaseAdmin.rpc("admin_upsert_profile_role", {
      _user_id: userId,
      _role: data.role,
      _cliente_id: data.cliente_id ?? undefined,
      _permissoes: data.permissoes,
    });
    if (rpcError) throw new Error(rpcError.message);

    // Atualiza o nome no profile (a RPC cria o profile, depois setamos o nome)
    await supabaseAdmin
      .from("profiles")
      .update({ nome: data.nome, email: data.email })
      .eq("id", userId);

    return { user_id: userId };
  });
