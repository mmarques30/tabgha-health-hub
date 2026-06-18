import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Instagram, Facebook, Globe, Linkedin, Music2, Stethoscope } from "lucide-react";
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
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
}[] = [
  { name: "instagram",  label: "Instagram",          placeholder: "@usuario ou URL do perfil", icon: Instagram,   color: "text-pink-600",   bg: "bg-pink-50 border-pink-100" },
  { name: "facebook",   label: "Facebook",           placeholder: "URL da página",             icon: Facebook,    color: "text-blue-600",   bg: "bg-blue-50 border-blue-100" },
  { name: "linkedin",   label: "LinkedIn",           placeholder: "URL do perfil",             icon: Linkedin,    color: "text-sky-700",    bg: "bg-sky-50 border-sky-100" },
  { name: "tiktok",     label: "TikTok",             placeholder: "@usuario",                  icon: Music2,      color: "text-slate-800",  bg: "bg-slate-50 border-slate-200" },
  { name: "doctoralia", label: "Doctoralia",         placeholder: "URL do perfil",             icon: Stethoscope, color: "text-teal-600",   bg: "bg-teal-50 border-teal-100" },
  { name: "site",       label: "Site / Landing Page",placeholder: "https://…",                icon: Globe,       color: "text-violet-600", bg: "bg-violet-50 border-violet-100" },
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
      const novasDados = { ...((cliente?.dados_extras as object) ?? {}), redes: values };
      const { error } = await supabase.from("clientes").update({ dados_extras: novasDados }).eq("id", clienteId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conexões atualizadas.");
      qc.invalidateQueries({ queryKey: ["cliente", "conexoes"] });
    },
    onError: () => toast.error("Erro ao salvar."),
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
          {connected > 0 && <span className="ml-1 font-medium text-emerald-600">{connected}/{CAMPOS.length} plataformas conectadas.</span>}
        </p>
      </header>

      <form onSubmit={form.handleSubmit((v) => save.mutate(v))}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {CAMPOS.map(({ name, label, placeholder, icon: Icon, color, bg }, i) => {
            const hasValue = !!form.watch(name);
            return (
              <div
                key={name}
                className={cn(
                  "animate-fade-up card-lift group rounded-2xl border bg-card p-5",
                  hasValue ? "border-primary/15 bg-gradient-to-br from-primary/3 to-transparent" : "border-border",
                )}
                style={{ animationDelay: `${i * 55}ms` }}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", bg)}>
                    <Icon className={cn("h-[18px] w-[18px]", color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{label}</p>
                    <p className={cn("text-[10.5px]", hasValue ? "text-emerald-600 font-medium" : "text-muted-foreground")}>
                      {hasValue ? "Conectado" : "Não configurado"}
                    </p>
                  </div>
                  {hasValue && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
                  )}
                </div>
                <Input
                  placeholder={placeholder}
                  {...form.register(name)}
                  className="text-sm bg-background"
                />
              </div>
            );
          })}
        </div>

        <div className="mt-8 animate-fade-up delay-375">
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
