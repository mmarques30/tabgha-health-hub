import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  createUserWithRole,
  type CreateUserResult,
} from "@/functions/usuarios/createUserWithRole.functions";

const schema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  cnpj: z.string().optional(),
  especialidade: z.string().optional(),
  /** Se true (padrão), também cria login no portal com senha temporária */
  gerar_acesso_portal: z.boolean().default(true),
});

type Input = z.infer<typeof schema>;

function adminErrorMessage(raw: string) {
  if (raw.includes("apenas admin") || raw.includes("42501")) {
    return "Sem permissão de admin. Faça login novamente com a conta admin.";
  }
  return raw || "Operação falhou.";
}

export type CreateClientResult = {
  cliente_id: string;
  portal?: CreateUserResult | null;
};

/**
 * Cria consultório via RPC `admin_create_cliente`.
 * Opcionalmente cria o login do portal (role cliente) com senha temporária.
 */
export async function createClientWithAccess(input: { data: Input }): Promise<CreateClientResult> {
  const data = schema.parse(input.data);
  const email = data.email.trim().toLowerCase();

  const { data: existing, error: existingError } = await supabase
    .from("clientes")
    .select("id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (existingError) throw new Error(adminErrorMessage(existingError.message));
  if (existing) throw new Error("Email já cadastrado em outro cliente.");

  const { data: clienteId, error } = await supabase.rpc("admin_create_cliente", {
    _nome: data.nome.trim(),
    _email: email,
    _cnpj: data.cnpj?.trim() || undefined,
    _especialidade: data.especialidade?.trim() || undefined,
  });

  if (error) throw new Error(adminErrorMessage(error.message));
  if (!clienteId) throw new Error("Falha ao criar cliente.");

  let portal: CreateUserResult | null = null;
  if (data.gerar_acesso_portal !== false) {
    portal = await createUserWithRole({
      data: {
        nome: data.nome.trim(),
        email,
        role: "cliente",
        cliente_id: clienteId as string,
        permissoes: ["*"],
      },
    });
  }

  return { cliente_id: clienteId as string, portal };
}

export async function updateClienteAdmin(input: {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  cnpj: string;
  razao_social: string;
  especialidade: string;
  status: string;
}) {
  const { error } = await supabase.rpc("admin_update_cliente", {
    _id: input.id,
    _nome: input.nome,
    _email: input.email,
    _telefone: input.telefone,
    _cnpj: input.cnpj,
    _razao_social: input.razao_social,
    _especialidade: input.especialidade,
    _status: input.status,
  });
  if (error) throw new Error(adminErrorMessage(error.message));
}

export async function deleteClienteAdmin(id: string) {
  const { error } = await supabase.rpc("admin_delete_cliente", { _id: id });
  if (error) throw new Error(adminErrorMessage(error.message));
}
