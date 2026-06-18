import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/cliente/conexoes")({
  component: ConexoesPage,
  head: () => ({ meta: [{ title: "Conexões — Portal" }] }),
});

type RedesForm = {
  instagram: string;
  facebook: string;
  doctoralia: string;
  site: string;
  linkedin: string;
  tiktok: string;
};

function ConexoesPage() {
  const { profile } = useAuth();
  const clienteId = profile?.cliente_id;
  const qc = useQueryClient();

  const { data: cliente, isLoading } = useQuery({
    queryKey: ["cliente", "conexoes", clienteId],
    enabled: !!clienteId,
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes").select("dados_extras").eq("id", clienteId!).single();
      if (error) throw error;
      return data;
    },
  });

  const redes = (cliente?.dados_extras as Record<string, Json> | null)?.redes as Record<string, string> | undefined;

  const form = useForm<RedesForm>({
    defaultValues: { instagram: "", facebook: "", doctoralia: "", site: "", linkedin: "", tiktok: "" },
  });

  useEffect(() => {
    if (redes) form.reset({
      instagram: redes.instagram ?? "",
      facebook: redes.facebook ?? "",
      doctoralia: redes.doctoralia ?? "",
      site: redes.site ?? "",
      linkedin: redes.linkedin ?? "",
      tiktok: redes.tiktok ?? "",
    });
  }, [redes, form]);

  const save = useMutation({
    mutationFn: async (values: RedesForm) => {
      const novasDados = {
        ...((cliente?.dados_extras as object) ?? {}),
        redes: values,
      };
      const { error } = await supabase
        .from("clientes").update({ dados_extras: novasDados }).eq("id", clienteId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conexões atualizadas.");
      qc.invalidateQueries({ queryKey: ["cliente", "conexoes"] });
    },
    onError: () => toast.error("Erro ao salvar."),
  });

  const CAMPOS: { name: keyof RedesForm; label: string; placeholder: string }[] = [
    { name: "instagram", label: "Instagram", placeholder: "@usuario ou URL do perfil" },
    { name: "facebook", label: "Facebook", placeholder: "URL da página" },
    { name: "doctoralia", label: "Doctoralia", placeholder: "URL do perfil" },
    { name: "site", label: "Site / Landing Page", placeholder: "https://…" },
    { name: "linkedin", label: "LinkedIn", placeholder: "URL do perfil" },
    { name: "tiktok", label: "TikTok", placeholder: "@usuario" },
  ];

  if (isLoading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="px-8 py-8">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Configurações</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Conexões</h1>
        <p className="mt-1 text-sm text-muted-foreground">Links e redes sociais do seu consultório.</p>
      </header>

      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="max-w-lg space-y-5">
        {CAMPOS.map(({ name, label, placeholder }) => (
          <div key={name} className="space-y-1">
            <Label className="flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground" />{label}
            </Label>
            <Input placeholder={placeholder} {...form.register(name)} />
          </div>
        ))}
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar conexões
        </Button>
      </form>
    </div>
  );
}
