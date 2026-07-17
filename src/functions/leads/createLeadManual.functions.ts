import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "@/hooks/useLeads";

const schema = z.object({
  cliente_id: z.string().uuid(),
  nome: z.string().min(2, "Nome obrigatório"),
  telefone: z.string().min(8, "Telefone obrigatório"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  canal: z.string().min(1).default("manual"),
  observacoes: z.string().optional(),
});

export type CreateLeadManualInput = z.infer<typeof schema>;

export async function createLeadManual(input: { data: CreateLeadManualInput }): Promise<Lead> {
  const data = schema.parse(input.data);
  const telefone = data.telefone.replace(/\D/g, "");
  if (telefone.length < 8) {
    throw new Error("Telefone inválido.");
  }

  const { data: row, error } = await supabase
    .from("leads")
    .insert({
      cliente_id: data.cliente_id,
      nome: data.nome.trim(),
      telefone,
      email: data.email?.trim() || null,
      canal: data.canal,
      observacoes: data.observacoes?.trim() || null,
      status: "novo",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message || "Falha ao criar lead.");
  return row as Lead;
}
