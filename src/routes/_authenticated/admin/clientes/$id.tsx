import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Sparkles, Save, RefreshCw, ChevronDown, Stethoscope } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Json, Tables } from "@/integrations/supabase/types";
import { WhatsappConnectCard } from "@/components/whatsapp/WhatsappConnectCard";

export const Route = createFileRoute("/_authenticated/admin/clientes/$id")({
  component: ClienteFichaPage,
  head: () => ({ meta: [{ title: "Ficha do Cliente — Tabgha Admin" }] }),
});

type Cliente = Tables<"clientes">;
type Lead = Tables<"leads">;
type Conteudo = Tables<"conteudos">;

// ── Helpers ────────────────────────────────────────────────────────────────────

function SectionHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("mt-6 mb-3 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-1.5", className)}>
      {children}
    </p>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

// ── Tab: Cadastro ─────────────────────────────────────────────────────────────
function TabCadastro({ cliente }: { cliente: Cliente }) {
  const qc = useQueryClient();
  const [diagOpen, setDiagOpen] = useState(false);

  const form = useForm({
    defaultValues: {
      nome: cliente.nome,
      email: cliente.email ?? "",
      telefone: cliente.telefone ?? "",
      cnpj: cliente.cnpj ?? "",
      razao_social: cliente.razao_social ?? "",
      especialidade: cliente.especialidade ?? "",
      status: cliente.status,
    },
  });

  const { data: quickStats } = useQuery({
    queryKey: ["admin", "cliente", cliente.id, "quick-stats"],
    staleTime: 120_000,
    queryFn: async () => {
      const [leadsTotal, leadsConv, conteudosTotal, conteudosAprov] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("cliente_id", cliente.id),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("cliente_id", cliente.id).eq("status", "convertido"),
        supabase.from("conteudos").select("id", { count: "exact", head: true }).eq("cliente_id", cliente.id),
        supabase.from("conteudos").select("id", { count: "exact", head: true }).eq("cliente_id", cliente.id).eq("status", "aprovacao"),
      ]);
      return {
        leads: leadsTotal.count ?? 0,
        convertidos: leadsConv.count ?? 0,
        conteudos: conteudosTotal.count ?? 0,
        aprovacao: conteudosAprov.count ?? 0,
      };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const values = form.getValues();
      const { error } = await supabase
        .from("clientes")
        .update({
          nome: values.nome.trim(),
          email: values.email.trim() || null,
          telefone: values.telefone.trim() || null,
          cnpj: values.cnpj.trim() || null,
          razao_social: values.razao_social.trim() || null,
          especialidade: values.especialidade.trim() || null,
          status: values.status,
        })
        .eq("id", cliente.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados atualizados.");
      qc.invalidateQueries({ queryKey: ["admin", "cliente", cliente.id] });
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao salvar."),
  });

  const extras = (cliente.dados_extras ?? {}) as Record<string, unknown>;
  const redesData = extras.redes as Record<string, string> | undefined;
  const redesConectadas = redesData ? Object.values(redesData).filter(Boolean).length : 0;
  const diagPreenchido = !!cliente.diagnostico;

  return (
    <div className="py-5 space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_268px]">
        {/* ── Campos em card estilizado ── */}
        <form onSubmit={form.handleSubmit(() => save.mutate())}>
          <div className="rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(15,27,53,0.04)] overflow-hidden">
            {/* Identificação */}
            <div className="px-5 pt-5 pb-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Identificação</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Nome">
                  <Input {...form.register("nome")} />
                </Field>
                <Field label="Email">
                  <Input type="email" {...form.register("email")} />
                </Field>
                <Field label="Telefone">
                  <Input {...form.register("telefone")} />
                </Field>
                <Field label="Especialidade">
                  <Input {...form.register("especialidade")} />
                </Field>
              </div>
            </div>

            {/* Dados fiscais */}
            <div className="border-t border-border px-5 py-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Dados fiscais</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="CNPJ">
                  <Input {...form.register("cnpj")} />
                </Field>
                <Field label="Razão Social">
                  <Input {...form.register("razao_social")} />
                </Field>
              </div>
            </div>

            {/* Status + ação */}
            <div className="border-t border-border px-5 py-4 flex items-end gap-4">
              <div className="w-48">
                <Field label="Status">
                  <Select value={form.watch("status")} onValueChange={(v) => form.setValue("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["onboarding", "ativo", "pausa", "inativo"].map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Button type="submit" disabled={save.isPending} className="mb-0.5">
                {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar
              </Button>
            </div>
          </div>
        </form>

        {/* ── Sidebar de resumo ── */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Resumo da conta</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-secondary/60 p-3 text-center">
                <p className="text-2xl font-extrabold tracking-tight">{quickStats?.leads ?? "—"}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">leads total</p>
              </div>
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
                <p className="text-2xl font-extrabold tracking-tight text-emerald-600">{quickStats?.convertidos ?? "—"}</p>
                <p className="mt-0.5 text-[10px] text-emerald-700">convertidos</p>
              </div>
              <div className="rounded-xl bg-secondary/60 p-3 text-center">
                <p className="text-2xl font-extrabold tracking-tight">{quickStats?.conteudos ?? "—"}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">conteúdos</p>
              </div>
              {(quickStats?.aprovacao ?? 0) > 0 ? (
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-center">
                  <p className="text-2xl font-extrabold tracking-tight text-amber-600">{quickStats!.aprovacao}</p>
                  <p className="mt-0.5 text-[10px] text-amber-700">aguard. aprovação</p>
                </div>
              ) : (
                <div className="rounded-xl bg-secondary/60 p-3 text-center">
                  <p className="text-2xl font-extrabold tracking-tight text-emerald-500">✓</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">sem pendências</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Informações</p>
            <div className="space-y-2.5 text-xs">
              {cliente.criado_em && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cadastro</span>
                  <span className="font-medium">{format(new Date(cliente.criado_em), "dd MMM yyyy", { locale: ptBR })}</span>
                </div>
              )}
              {redesConectadas > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Redes conectadas</span>
                  <span className="font-medium text-emerald-600">{redesConectadas}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">ID</span>
                <span className="font-mono text-[10px] text-muted-foreground">{cliente.id.slice(0, 8)}…</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Diagnóstico colapsável ── */}
      <div className="rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(15,27,53,0.04)] overflow-hidden">
        <button
          type="button"
          onClick={() => setDiagOpen((v) => !v)}
          className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-secondary/30 transition-colors"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Stethoscope className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Diagnóstico estratégico</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {diagPreenchido ? "Preenchido — clique para editar ou regenerar" : "Não preenchido — gere com IA em segundos"}
            </p>
          </div>
          <span className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
            diagPreenchido ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
          )}>
            {diagPreenchido ? "Preenchido" : "Pendente"}
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", diagOpen && "rotate-180")} />
        </button>
        <div className={cn("border-t border-border px-5", diagOpen ? "block" : "hidden")}>
          <TabDiagnostico cliente={cliente} />
        </div>
      </div>
    </div>
  );
}

// ── DiagnosticoData types ─────────────────────────────────────────────────────
type DiagnosticoData = {
  perfil: { especialidade: string; cidade: string; tempo_mercado: string; publico_alvo: string; ticket_medio: string; diferencial: string };
  jornada: { canais_aquisicao: string; funil: string; objecoes: string; taxa_agendamento: string; taxa_conversao: string };
  dores: { principais: string; marketing: string; operacional: string };
  concorrentes: string;
  plano_acao: string;
};

const EMPTY_DIAG: DiagnosticoData = {
  perfil: { especialidade: "", cidade: "", tempo_mercado: "", publico_alvo: "", ticket_medio: "", diferencial: "" },
  jornada: { canais_aquisicao: "", funil: "", objecoes: "", taxa_agendamento: "", taxa_conversao: "" },
  dores: { principais: "", marketing: "", operacional: "" },
  concorrentes: "",
  plano_acao: "",
};

function parseDiag(raw: unknown): DiagnosticoData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY_DIAG;
  const r = raw as Record<string, unknown>;
  const perfil = (r.perfil && typeof r.perfil === "object" && !Array.isArray(r.perfil)) ? r.perfil as Record<string, unknown> : {};
  const jornada = (r.jornada && typeof r.jornada === "object" && !Array.isArray(r.jornada)) ? r.jornada as Record<string, unknown> : {};
  const dores = (r.dores && typeof r.dores === "object" && !Array.isArray(r.dores)) ? r.dores as Record<string, unknown> : {};
  return {
    perfil: { especialidade: String(perfil.especialidade ?? ""), cidade: String(perfil.cidade ?? ""), tempo_mercado: String(perfil.tempo_mercado ?? ""), publico_alvo: String(perfil.publico_alvo ?? ""), ticket_medio: String(perfil.ticket_medio ?? ""), diferencial: String(perfil.diferencial ?? "") },
    jornada: { canais_aquisicao: String(jornada.canais_aquisicao ?? ""), funil: String(jornada.funil ?? ""), objecoes: String(jornada.objecoes ?? ""), taxa_agendamento: String(jornada.taxa_agendamento ?? ""), taxa_conversao: String(jornada.taxa_conversao ?? "") },
    dores: { principais: String(dores.principais ?? ""), marketing: String(dores.marketing ?? ""), operacional: String(dores.operacional ?? "") },
    concorrentes: typeof r.concorrentes === "string" ? r.concorrentes : (Array.isArray(r.concorrentes) ? r.concorrentes.join("\n") : ""),
    plano_acao: typeof r.plano_acao === "string" ? r.plano_acao : (Array.isArray(r.plano_acao) ? r.plano_acao.map((a: unknown) => typeof a === "object" ? JSON.stringify(a) : String(a)).join("\n") : ""),
  };
}

// ── Tab: Diagnóstico ──────────────────────────────────────────────────────────
function TabDiagnostico({ cliente }: { cliente: Cliente }) {
  const qc = useQueryClient();
  const [d, setD] = useState<DiagnosticoData>(() => parseDiag(cliente.diagnostico));
  const [generating, setGenerating] = useState(false);

  function setField(sec: keyof DiagnosticoData, key?: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setD((prev) => {
        if (key) return { ...prev, [sec]: { ...(prev[sec] as object), [key]: e.target.value } };
        return { ...prev, [sec]: e.target.value };
      });
    };
  }

  function get(sec: keyof DiagnosticoData, key?: string): string {
    if (key) return ((d[sec] as Record<string, string>)[key]) ?? "";
    return (d[sec] as string) ?? "";
  }

  async function gerarComIA() {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar_diagnostico", {
        body: {
          nome: cliente.nome,
          especialidade: cliente.especialidade ?? d.perfil.especialidade,
          cidade: d.perfil.cidade || undefined,
          publico_alvo: d.perfil.publico_alvo || undefined,
          ticket_medio: d.perfil.ticket_medio || undefined,
          tempo_mercado: d.perfil.tempo_mercado || undefined,
          diferencial: d.perfil.diferencial || undefined,
          canais_aquisicao: d.jornada.canais_aquisicao || undefined,
        },
      });
      if (error) throw error;
      if (data?.diagnostico) {
        setD(parseDiag(data.diagnostico));
        toast.success("Diagnóstico gerado! Revise e salve.");
      }
    } catch (e) {
      toast.error("Erro ao gerar diagnóstico. Verifique a ANTHROPIC_API_KEY no Supabase.");
      console.error(e);
    } finally {
      setGenerating(false);
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("clientes").update({ diagnostico: d as any }).eq("id", cliente.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Diagnóstico salvo.");
      qc.invalidateQueries({ queryKey: ["admin", "cliente", cliente.id] });
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao salvar."),
  });

  const hasData = !!(cliente.especialidade || cliente.nome);

  return (
    <div className="py-5 space-y-4">
      {/* ── AI generation bar ── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 to-transparent p-5 sm:flex-row sm:items-center">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-primary">Gerar diagnóstico com IA</p>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
            Claude analisa os dados do cliente e preenche automaticamente todas as seções.
            {!hasData && " Preencha o Cadastro primeiro para um resultado mais preciso."}
          </p>
        </div>
        <Button onClick={gerarComIA} disabled={generating} className="shrink-0 gap-2">
          {generating
            ? <><Loader2 className="h-4 w-4 animate-spin" />Gerando…</>
            : <><Sparkles className="h-4 w-4" />{d.perfil.especialidade ? "Regenerar" : "Gerar diagnóstico"}</>
          }
        </Button>
      </div>

      {/* ── Row 1: Perfil + Jornada ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Perfil */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
          <div className="flex items-center gap-2.5 border-b border-blue-100 bg-blue-50/60 px-5 py-3">
            <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
            <p className="text-[10.5px] font-bold uppercase tracking-widest text-blue-700">Perfil do consultório</p>
          </div>
          <div className="p-5 grid grid-cols-2 gap-4">
            <Field label="Especialidade"><Input value={get("perfil", "especialidade")} onChange={setField("perfil", "especialidade")} /></Field>
            <Field label="Cidade"><Input value={get("perfil", "cidade")} onChange={setField("perfil", "cidade")} /></Field>
            <Field label="Tempo de mercado"><Input value={get("perfil", "tempo_mercado")} onChange={setField("perfil", "tempo_mercado")} /></Field>
            <Field label="Ticket médio"><Input value={get("perfil", "ticket_medio")} onChange={setField("perfil", "ticket_medio")} /></Field>
            <div className="col-span-2">
              <Field label="Público-alvo"><Textarea rows={2} value={get("perfil", "publico_alvo")} onChange={setField("perfil", "publico_alvo")} /></Field>
            </div>
            <div className="col-span-2">
              <Field label="Diferencial competitivo"><Textarea rows={2} value={get("perfil", "diferencial")} onChange={setField("perfil", "diferencial")} /></Field>
            </div>
          </div>
        </div>

        {/* Jornada */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
          <div className="flex items-center gap-2.5 border-b border-violet-100 bg-violet-50/60 px-5 py-3">
            <span className="h-2 w-2 rounded-full bg-violet-500 shrink-0" />
            <p className="text-[10.5px] font-bold uppercase tracking-widest text-violet-700">Jornada do paciente</p>
          </div>
          <div className="p-5 space-y-4">
            <Field label="Canais de aquisição">
              <Input value={get("jornada", "canais_aquisicao")} onChange={setField("jornada", "canais_aquisicao")} placeholder="Meta Ads, Indicação, Orgânico…" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Taxa agendamento"><Input value={get("jornada", "taxa_agendamento")} onChange={setField("jornada", "taxa_agendamento")} placeholder="ex: 40%" /></Field>
              <Field label="Taxa conversão"><Input value={get("jornada", "taxa_conversao")} onChange={setField("jornada", "taxa_conversao")} placeholder="ex: 25%" /></Field>
            </div>
            <Field label="Descrição do funil"><Textarea rows={3} value={get("jornada", "funil")} onChange={setField("jornada", "funil")} /></Field>
            <Field label="Objeções frequentes"><Textarea rows={3} value={get("jornada", "objecoes")} onChange={setField("jornada", "objecoes")} /></Field>
          </div>
        </div>
      </div>

      {/* ── Row 2: Dores + Concorrentes ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Dores */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
          <div className="flex items-center gap-2.5 border-b border-rose-100 bg-rose-50/60 px-5 py-3">
            <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
            <p className="text-[10.5px] font-bold uppercase tracking-widest text-rose-700">Dores identificadas</p>
          </div>
          <div className="p-5 space-y-4">
            <Field label="Principais dores do paciente"><Textarea rows={3} value={get("dores", "principais")} onChange={setField("dores", "principais")} /></Field>
            <Field label="Dores de marketing"><Textarea rows={3} value={get("dores", "marketing")} onChange={setField("dores", "marketing")} /></Field>
            <Field label="Dores operacionais"><Textarea rows={3} value={get("dores", "operacional")} onChange={setField("dores", "operacional")} /></Field>
          </div>
        </div>

        {/* Concorrentes */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
          <div className="flex items-center gap-2.5 border-b border-amber-100 bg-amber-50/60 px-5 py-3">
            <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
            <p className="text-[10.5px] font-bold uppercase tracking-widest text-amber-700">Concorrentes & posicionamento</p>
          </div>
          <div className="p-5">
            <Field label="Cenário competitivo e estratégia de diferenciação">
              <Textarea rows={11} value={get("concorrentes")} onChange={setField("concorrentes")} className="resize-none" />
            </Field>
          </div>
        </div>
      </div>

      {/* ── Row 3: Plano de ação (full-width, destaque) ── */}
      <div className="rounded-2xl border border-primary/20 overflow-hidden shadow-[0_2px_8px_rgba(26,95,173,0.10)]"
        style={{ background: "linear-gradient(135deg, rgba(26,95,173,0.04) 0%, rgba(26,95,173,0.01) 100%)" }}>
        <div className="flex items-center gap-2.5 border-b border-primary/15 bg-primary/8 px-5 py-3">
          <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
          <p className="text-[10.5px] font-bold uppercase tracking-widest text-primary">Plano de ação — 90 dias</p>
        </div>
        <div className="p-5">
          <Field label="Ações prioritárias com prazo e responsável">
            <Textarea
              rows={6}
              value={get("plano_acao")}
              onChange={setField("plano_acao")}
              placeholder={"1. Criar campanha no Meta Ads — 2 semanas\n2. Configurar automação WhatsApp — 1 mês\n…"}
              className="resize-none font-mono text-sm"
            />
          </Field>
        </div>
      </div>

      {/* ── Save bar ── */}
      <div className="flex items-center gap-3 border-t border-border pt-4">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar diagnóstico
        </Button>
        {generating && (
          <p className="text-xs text-muted-foreground animate-pulse">Claude está analisando os dados…</p>
        )}
      </div>
    </div>
  );
}

// ── Tab: Leads ────────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  novo: "Novo", em_conversa: "Em conversa", interessado: "Interessado",
  agendado: "Agendado", atendido: "Atendido", convertido: "Convertido", perdido: "Perdido",
};

const STATUS_BADGE: Record<string, string> = {
  novo: "bg-blue-100 text-blue-700", em_conversa: "bg-amber-100 text-amber-700",
  interessado: "bg-violet-100 text-violet-700", agendado: "bg-cyan-100 text-cyan-700",
  atendido: "bg-teal-100 text-teal-700", convertido: "bg-green-100 text-green-700",
  perdido: "bg-slate-100 text-slate-600",
};

const LEADS_PIPELINE = ["novo", "em_conversa", "interessado", "agendado", "atendido", "convertido", "perdido"] as const;

function TabLeads({ clienteId }: { clienteId: string }) {
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["admin", "cliente", clienteId, "leads"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*")
        .eq("cliente_id", clienteId).order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (leads.length === 0) return <div className="py-8"><EmptyState title="Nenhum lead" description="Leads chegam via Meta Ads e WhatsApp." /></div>;

  const funnelStats = LEADS_PIPELINE
    .map((s) => ({ s, label: STATUS_LABELS[s], count: leads.filter((l) => l.status === s).length, color: STATUS_BADGE[s] }))
    .filter(({ count }) => count > 0);

  return (
    <div className="py-5">
      <div className="mb-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{leads.length} leads</span>
          <span className="text-xs text-muted-foreground">— {leads.filter((l) => l.status === "convertido").length} convertidos</span>
        </div>
        {funnelStats.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {funnelStats.map(({ s, label, count, color }) => (
              <div key={s} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 shadow-[0_1px_2px_rgba(15,27,53,0.04)]">
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", color)}>{label}</span>
                <span className="text-sm font-bold">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary/60 text-[10.5px] uppercase tracking-wide text-muted-foreground">
              {["Nome", "Contato", "Canal", "Status", "Data"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {leads.map((l) => (
              <tr key={l.id} className="hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-2.5 font-medium">{l.nome ?? "Sem nome"}</td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs">{l.telefone ?? l.email ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs capitalize">{l.canal ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium", STATUS_BADGE[l.status] ?? "bg-slate-100 text-slate-600")}>
                    {STATUS_LABELS[l.status] ?? l.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs">
                  {format(new Date(l.criado_em), "dd MMM yyyy", { locale: ptBR })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab: Conteúdo ─────────────────────────────────────────────────────────────
const CONTEUDO_STATUS_BADGE: Record<string, string> = {
  briefing: "bg-slate-100 text-slate-600", roteiro: "bg-blue-100 text-blue-700",
  producao: "bg-yellow-100 text-yellow-700", aprovacao: "bg-orange-100 text-orange-700",
  agendado: "bg-indigo-100 text-indigo-700", postado: "bg-green-100 text-green-700",
};

const CONTEUDO_PIPELINE = ["briefing", "roteiro", "producao", "aprovacao", "agendado", "postado"] as const;

const CONTEUDO_STATUS_LABEL: Record<string, string> = {
  briefing: "Briefing", roteiro: "Roteiro", producao: "Produção",
  aprovacao: "Aprovação", agendado: "Agendado", postado: "Postado",
};

function TabConteudo({ clienteId }: { clienteId: string }) {
  const { data: conteudos = [], isLoading } = useQuery({
    queryKey: ["admin", "cliente", clienteId, "conteudos"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("conteudos").select("*")
        .eq("cliente_id", clienteId).order("data_postagem", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (conteudos.length === 0) return <div className="py-8"><EmptyState title="Nenhum conteúdo" description="Crie conteúdos em Estratégia > Calendário." /></div>;

  const pipelineStats = CONTEUDO_PIPELINE
    .map((s) => ({ s, label: CONTEUDO_STATUS_LABEL[s], count: conteudos.filter((c) => c.status === s).length, color: CONTEUDO_STATUS_BADGE[s] }))
    .filter(({ count }) => count > 0);

  return (
    <div className="py-5">
      <div className="mb-4 space-y-3">
        <span className="text-sm font-semibold">{conteudos.length} conteúdos</span>
        {pipelineStats.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pipelineStats.map(({ s, label, count, color }) => (
              <div key={s} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 shadow-[0_1px_2px_rgba(15,27,53,0.04)]">
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", color)}>{label}</span>
                <span className="text-sm font-bold">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary/60 text-[10.5px] uppercase tracking-wide text-muted-foreground">
              {["Título", "Rede", "Tipo", "Status", "Postagem"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {conteudos.map((c) => (
              <tr key={c.id} className="hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-2.5 font-medium max-w-[260px] truncate">{c.titulo ?? "Sem título"}</td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs capitalize">{c.rede ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs capitalize">{c.tipo ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize", CONTEUDO_STATUS_BADGE[c.status] ?? "bg-slate-100 text-slate-600")}>
                    {CONTEUDO_STATUS_LABEL[c.status] ?? c.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs">
                  {c.data_postagem ? format(new Date(c.data_postagem), "dd MMM yyyy", { locale: ptBR }) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab: Conexões ─────────────────────────────────────────────────────────────
function TabConexoes({ cliente }: { cliente: Cliente }) {
  const qc = useQueryClient();
  const extras = (cliente.dados_extras ?? {}) as Record<string, unknown>;
  const agenteIa = (extras.agente_ia ?? {}) as Record<string, string>;
  const automacoes = (extras.automacoes ?? {}) as Record<string, unknown>;
  const zapi = (automacoes.zapi ?? {}) as Record<string, unknown>;

  const [metodo, setMetodo] = useState(agenteIa.metodo_qualificacao ?? "");
  const [agenteAtivo, setAgenteAtivo] = useState(
    zapi.agente_ativo === true || zapi.agente_ativo === "true",
  );
  const [json, setJson] = useState(JSON.stringify(extras, null, 2));
  const [jsonError, setJsonError] = useState("");

  const saveMetodo = useMutation({
    mutationFn: async () => {
      let base: Record<string, unknown>;
      try {
        base = JSON.parse(json);
      } catch {
        throw new Error("JSON inválido.");
      }
      const baseAutomacoes = (base.automacoes ?? {}) as Record<string, unknown>;
      const baseZapi = (baseAutomacoes.zapi ?? {}) as Record<string, unknown>;
      const novoExtras = {
        ...base,
        agente_ia: {
          ...((base.agente_ia as object) ?? {}),
          metodo_qualificacao: metodo || null,
        },
        automacoes: {
          ...baseAutomacoes,
          zapi: {
            ...baseZapi,
            agente_ativo: agenteAtivo,
          },
        },
      };

      const { error } = await supabase
        .from("clientes")
        .update({ dados_extras: novoExtras as Json })
        .eq("id", cliente.id);
      if (error) throw error;

      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("id, dados_extras")
        .eq("cliente_id", cliente.id)
        .eq("status", "connected")
        .maybeSingle();

      if (instance) {
        const instanceExtras = {
          ...((instance.dados_extras as Record<string, unknown> | null) ?? {}),
          agente_ativo: agenteAtivo,
        };
        const { error: instanceError } = await supabase
          .from("whatsapp_instances")
          .update({ dados_extras: instanceExtras as Json })
          .eq("id", instance.id);
        if (instanceError) throw instanceError;
      }

      setJson(JSON.stringify(novoExtras, null, 2));
    },
    onSuccess: () => {
      toast.success("Agente salvo.");
      qc.invalidateQueries({ queryKey: ["admin", "cliente", cliente.id] });
      setJsonError("");
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setJsonError(e.message);
    },
  });

  const saveJson = useMutation({
    mutationFn: async () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        throw new Error("JSON inválido.");
      }
      const { error } = await supabase
        .from("clientes")
        .update({ dados_extras: parsed as Json })
        .eq("id", cliente.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("JSON salvo.");
      qc.invalidateQueries({ queryKey: ["admin", "cliente", cliente.id] });
      setJsonError("");
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setJsonError(e.message);
    },
  });

  const [instanceId, setInstanceId] = useState("");
  const [instanceToken, setInstanceToken] = useState("");
  const [clientToken, setClientToken] = useState("");

  const { data: wppInstance } = useQuery({
    queryKey: ["admin", "cliente", cliente.id, "wpp-instance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_id, token, status, dados_extras")
        .eq("cliente_id", cliente.id)
        .order("atualizado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!wppInstance) return;
    setInstanceId(wppInstance.instance_id ?? "");
    setInstanceToken(wppInstance.token ?? "");
    const extras = (wppInstance.dados_extras ?? {}) as Record<string, string>;
    setClientToken(extras.client_token ?? "");
  }, [wppInstance]);

  const saveInstance = useMutation({
    mutationFn: async () => {
      const payload = {
        cliente_id: cliente.id,
        provider: "zapi" as const,
        instance_id: instanceId.trim() || null,
        token: instanceToken.trim() || null,
        status: instanceId.trim() && instanceToken.trim() ? "disconnected" : "disconnected",
        dados_extras: {
          ...((wppInstance?.dados_extras as object) ?? {}),
          client_token: clientToken.trim() || null,
        },
      };
      if (wppInstance?.id) {
        const { error } = await supabase.from("whatsapp_instances").update(payload).eq("id", wppInstance.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("whatsapp_instances").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Instância WhatsApp salva.");
      qc.invalidateQueries({ queryKey: ["admin", "cliente", cliente.id, "wpp-instance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="py-5 space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <WhatsappConnectCard clienteId={cliente.id} />
          <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)] space-y-3">
            <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
              Provisionar Z-API (admin)
            </p>
            <div className="space-y-2">
              <Label>Instance ID</Label>
              <Input value={instanceId} onChange={(e) => setInstanceId(e.target.value)} placeholder="3A..." />
            </div>
            <div className="space-y-2">
              <Label>Token</Label>
              <Input value={instanceToken} onChange={(e) => setInstanceToken(e.target.value)} placeholder="token da instância" />
            </div>
            <div className="space-y-2">
              <Label>Client-Token (opcional)</Label>
              <Input value={clientToken} onChange={(e) => setClientToken(e.target.value)} placeholder="security token da conta Z-API" />
            </div>
            <Button size="sm" onClick={() => saveInstance.mutate()} disabled={saveInstance.isPending} className="gap-2">
              {saveInstance.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar instância
            </Button>
          </div>
        </div>

        {/* ── Método de qualificação ── */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
          <div className="flex items-center gap-2.5 border-b border-sky-100 bg-sky-50/60 px-5 py-3">
            <span className="h-2 w-2 rounded-full bg-sky-500 shrink-0" />
            <p className="text-[10.5px] font-bold uppercase tracking-widest text-sky-700">Pietro · Agente WhatsApp</p>
          </div>
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Agente ativo</p>
                <p className="text-xs text-muted-foreground">
                  Quando ligado, o bot responde conversas com owner_state=bot.
                </p>
              </div>
              <Switch checked={agenteAtivo} onCheckedChange={setAgenteAtivo} />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Cole a metodologia que o agente deve seguir nas conversas.
              Se vazio, usa o padrão genérico (intenção, urgência, fit, capacidade financeira).
            </p>
            <Textarea
              rows={10}
              placeholder={"Ex: Avalie o lead com base em:\n(1) Urgência — já tem pacientes interessados?\n(2) Volume — quantos atendimentos por semana?\n(3) Disposição — aberto a investir em marketing?\nConduza de forma natural, sem parecer interrogatório."}
              value={metodo}
              onChange={(e) => setMetodo(e.target.value)}
              className="text-sm resize-none"
            />
            {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
            <Button size="sm" onClick={() => saveMetodo.mutate()} disabled={saveMetodo.isPending} className="gap-2">
              {saveMetodo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar agente
            </Button>
          </div>
        </div>
      </div>

      {/* ── JSON avançado ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
        <div className="flex items-center gap-2.5 border-b border-slate-200 bg-slate-50/60 px-5 py-3">
          <span className="h-2 w-2 rounded-full bg-slate-400 shrink-0" />
          <p className="text-[10.5px] font-bold uppercase tracking-widest text-slate-600">JSON Avançado</p>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Redes sociais, automações (<span className="font-mono text-[11px]">meta_page_id</span>, <span className="font-mono text-[11px]">zapi_instance_id</span>), GA4, webhooks, etc.
          </p>
          <Textarea
            className="font-mono text-xs resize-none"
            rows={8}
            value={json}
            onChange={(e) => { setJson(e.target.value); setJsonError(""); }}
          />
          {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
          <Button size="sm" variant="outline" onClick={() => saveJson.mutate()} disabled={saveJson.isPending} className="gap-2">
            {saveJson.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar JSON
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function ClienteFichaPage() {
  const { id } = Route.useParams();

  const { data: cliente, isLoading } = useQuery({
    queryKey: ["admin", "cliente", id],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (!cliente) return <EmptyState title="Cliente não encontrado" />;

  const statusColor: Record<string, string> = {
    ativo: "bg-green-100 text-green-700 border-green-200",
    onboarding: "bg-blue-100 text-blue-700 border-blue-200",
    pausa: "bg-amber-100 text-amber-700 border-amber-200",
    inativo: "bg-slate-100 text-slate-600 border-slate-200",
  };

  return (
    <div className="px-6 py-6">
      {/* Page header */}
      <div className="mb-6 flex items-center gap-4">
        <Link to="/admin/clientes" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold tracking-tight truncate">{cliente.nome}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{cliente.especialidade ?? "—"}</p>
        </div>
        <span className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-semibold capitalize", statusColor[cliente.status] ?? "bg-muted text-muted-foreground")}>
          {cliente.status}
        </span>
      </div>

      <Tabs defaultValue="cadastro">
        <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent h-auto p-0 gap-0">
          {["cadastro", "leads", "conteudo", "conexoes"].map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="rounded-none border-b-2 border-transparent px-4 pb-3 pt-1 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent capitalize"
            >
              {tab === "conexoes" ? "Conexões" : tab === "conteudo" ? "Conteúdo" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="cadastro"><TabCadastro cliente={cliente} /></TabsContent>
        <TabsContent value="leads"><TabLeads clienteId={cliente.id} /></TabsContent>
        <TabsContent value="conteudo"><TabConteudo clienteId={cliente.id} /></TabsContent>
        <TabsContent value="conexoes"><TabConexoes cliente={cliente} /></TabsContent>
      </Tabs>
    </div>
  );
}
