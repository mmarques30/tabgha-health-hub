import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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

const CAMPOS: {
  name: keyof RedesForm;
  label: string;
  placeholder: string;
  barColor: string;
}[] = [
  { name: "instagram",  label: "Instagram",           placeholder: "@usuario ou URL do perfil", barColor: "bg-pink-500" },
  { name: "facebook",   label: "Facebook",            placeholder: "URL da página",             barColor: "bg-blue-500" },
  { name: "linkedin",   label: "LinkedIn",            placeholder: "URL do perfil",             barColor: "bg-sky-500" },
  { name: "tiktok",     label: "TikTok",              placeholder: "@usuario",                  barColor: "bg-slate-700" },
  { name: "doctoralia", label: "Doctoralia",          placeholder: "URL do perfil",             barColor: "bg-teal-500" },
  { name: "site",       label: "Site / Landing Page", placeholder: "https://…",                barColor: "bg-violet-500" },
];

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
      instagram:  redes.instagram  ?? "",
      facebook:   redes.facebook   ?? "",
      doctoralia: redes.doctoralia ?? "",
      site:       redes.site       ?? "",
      linkedin:   redes.linkedin   ?? "",
      tiktok:     redes.tiktok     ?? "",
    });
  }, [redes, form]);

  const save = useMutation({
    mutationFn: async (values: RedesForm) => {
      const { error } = await supabase.rpc("atualizar_redes_cliente", {
        _redes: values,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conexões atualizadas.");
      qc.invalidateQueries({ queryKey: ["cliente", "conexoes"] });
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao salvar."),
  });

  if (isLoading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  const connected = CAMPOS.filter(({ name }) => !!form.watch(name)).length;

  return (
    <div className="px-6 py-6">
      <header className="mb-8 animate-fade-up">
        <span className="eyebrow-pill">Configurações</span>
        <h1 className="mt-3 text-xl font-bold tracking-tight">Conexões</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Links e redes sociais do seu consultório.
          {connected > 0 && (
            <span className="ml-2 inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="font-medium text-emerald-600">{connected}/{CAMPOS.length} plataformas conectadas</span>
            </span>
          )}
        </p>
      </header>

      <form onSubmit={form.handleSubmit((v) => save.mutate(v))}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {CAMPOS.map(({ name, label, placeholder, barColor }, i) => {
            const hasValue = !!form.watch(name);
            return (
              <div
                key={name}
                className={cn(
                  "card-lift animate-fade-up rounded-2xl border bg-card px-5 pt-5 pb-4 shadow-[0_1px_3px_rgba(15,27,53,0.04)] flex flex-col",
                  hasValue ? "border-primary/15" : "border-border",
                )}
                style={{ animationDelay: `${i * 75}ms` }}
              >
                <span className="text-[9px] font-black tracking-[0.16em] text-muted-foreground/40 mb-4">
                  {String(i + 1).padStart(2, "0")}
                </span>

                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  {hasValue && (
                    <span className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Conectado
                    </span>
                  )}
                </div>

                <Input
                  placeholder={placeholder}
                  {...form.register(name)}
                  className="mt-auto text-sm bg-background"
                />

                <div className={cn("mt-3 h-0.5 w-full rounded-full", hasValue ? barColor : "bg-border")} />
              </div>
            );
          })}
        </div>

        <div className="mt-8 animate-fade-up" style={{ animationDelay: "450ms" }}>
          <Button type="submit" disabled={save.isPending} className="gap-2">
            {save.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Save className="h-4 w-4" />}
            Salvar conexões
          </Button>
        </div>
      </form>
    </div>
  );
}
