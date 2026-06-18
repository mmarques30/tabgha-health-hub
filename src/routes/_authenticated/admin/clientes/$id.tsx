import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Sparkles, Save, RefreshCw } from "lucide-react";
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
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

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

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clientes").update(form.getValues()).eq("id", cliente.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados atualizados.");
      qc.invalidateQueries({ queryKey: ["admin", "cliente", cliente.id] });
    },
    onError: () => toast.error("Erro ao salvar."),
  });

  return (
    <form onSubmit={form.handleSubmit(() => save.mutate())} className="py-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <Field label="CNPJ">
          <Input {...form.register("cnpj")} />
        </Field>
        <Field label="Razão Social">
          <Input {...form.register("razao_social")} />
        </Field>
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
      <div className="mt-6">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar
        </Button>
      </div>
    </form>
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
    onError: () => toast.error("Erro ao salvar."),
  });

  const hasData = !!(cliente.especialidade || cliente.nome);

  return (
    <div className="py-5">
      {/* AI generation bar */}
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary">Gerar diagnóstico com IA</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Claude analisa os dados do cliente e preenche automaticamente perfil, jornada, dores, concorrentes e plano de ação.
            {!hasData && " Preencha o Cadastro primeiro para um resultado mais preciso."}
          </p>
        </div>
        <Button
          onClick={gerarComIA}
          disabled={generating}
          className="shrink-0 gap-2"
        >
          {generating
            ? <><Loader2 className="h-4 w-4 animate-spin" />Gerando…</>
            : <><Sparkles className="h-4 w-4" />{d.perfil.especialidade ? "Regenerar" : "Gerar diagnóstico"}</>
          }
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-0 lg:grid-cols-2">
        {/* Left column */}
        <div>
          <SectionHeader className="mt-0">Perfil do consultório</SectionHeader>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Especialidade"><Input value={get("perfil", "especialidade")} onChange={setField("perfil", "especialidade")} /></Field>
            <Field label="Cidade"><Input value={get("perfil", "cidade")} onChange={setField("perfil", "cidade")} /></Field>
            <Field label="Tempo de mercado"><Input value={get("perfil", "tempo_mercado")} onChange={setField("perfil", "tempo_mercado")} /></Field>
            <Field label="Ticket médio"><Input value={get("perfil", "ticket_medio")} onChange={setField("perfil", "ticket_medio")} /></Field>
            <Field label="Público-alvo"><Textarea className="col-span-2" rows={2} value={get("perfil", "publico_alvo")} onChange={setField("perfil", "publico_alvo")} /></Field>
            <Field label="Diferencial competitivo"><Textarea rows={2} value={get("perfil", "diferencial")} onChange={setField("perfil", "diferencial")} /></Field>
          </div>

          <SectionHeader>Jornada do paciente</SectionHeader>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Canais de aquisição">
              <Input value={get("jornada", "canais_aquisicao")} onChange={setField("jornada", "canais_aquisicao")} placeholder="Meta Ads, Indicação, Orgânico…" />
            </Field>
            <div className="grid grid-cols-2 gap-3 col-span-1">
              <Field label="Taxa agendamento"><Input value={get("jornada", "taxa_agendamento")} onChange={setField("jornada", "taxa_agendamento")} placeholder="ex: 40%" /></Field>
              <Field label="Taxa conversão"><Input value={get("jornada", "taxa_conversao")} onChange={setField("jornada", "taxa_conversao")} placeholder="ex: 25%" /></Field>
            </div>
            <div className="col-span-2">
              <Field label="Descrição do funil"><Textarea rows={3} value={get("jornada", "funil")} onChange={setField("jornada", "funil")} /></Field>
            </div>
            <div className="col-span-2">
              <Field label="Objeções frequentes"><Textarea rows={3} value={get("jornada", "objecoes")} onChange={setField("jornada", "objecoes")} /></Field>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div>
          <SectionHeader className="mt-0">Dores identificadas</SectionHeader>
          <div className="space-y-4">
            <Field label="Principais dores do paciente"><Textarea rows={3} value={get("dores", "principais")} onChange={setField("dores", "principais")} /></Field>
            <Field label="Dores de marketing"><Textarea rows={3} value={get("dores", "marketing")} onChange={setField("dores", "marketing")} /></Field>
            <Field label="Dores operacionais"><Textarea rows={3} value={get("dores", "operacional")} onChange={setField("dores", "operacional")} /></Field>
          </div>

          <SectionHeader>Concorrentes & posicionamento</SectionHeader>
          <Field label="Cenário competitivo e estratégia de diferenciação">
            <Textarea rows={5} value={get("concorrentes")} onChange={setField("concorrentes")} />
          </Field>

          <SectionHeader>Plano de ação 90 dias</SectionHeader>
          <Field label="Ações prioritárias com prazo e responsável">
            <Textarea rows={7} value={get("plano_acao")} onChange={setField("plano_acao")}
              placeholder={"1. Criar campanha no Meta Ads — 2 semanas\n2. Configurar automação WhatsApp — 1 mês\n…"} />
          </Field>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3 border-t border-border pt-5">
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

  return (
    <div className="py-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold">{leads.length} leads</span>
        <span className="text-xs text-muted-foreground">— {leads.filter((l) => l.status === "convertido").length} convertidos</span>
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

  return (
    <div className="py-5">
      <div className="mb-3 text-sm font-semibold">{conteudos.length} conteúdos</div>
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
                    {c.status}
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

  const [metodo, setMetodo] = useState(agenteIa.metodo_qualificacao ?? "");
  const [json, setJson] = useState(JSON.stringify(extras, null, 2));
  const [jsonError, setJsonError] = useState("");

  const saveMetodo = useMutation({
    mutationFn: async () => {
      let base: Record<string, unknown>;
      try { base = JSON.parse(json); } catch { throw new Error("JSON inválido."); }
      const novoExtras = { ...base, agente_ia: { ...(base.agente_ia as object ?? {}), metodo_qualificacao: metodo || null } };
      const { error } = await supabase.from("clientes").update({ dados_extras: novoExtras }).eq("id", cliente.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Método salvo."); qc.invalidateQueries({ queryKey: ["admin", "cliente", cliente.id] }); setJsonError(""); },
    onError: (e: Error) => { toast.error(e.message); setJsonError(e.message); },
  });

  const saveJson = useMutation({
    mutationFn: async () => {
      let parsed: unknown;
      try { parsed = JSON.parse(json); } catch { throw new Error("JSON inválido."); }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("clientes").update({ dados_extras: parsed as any }).eq("id", cliente.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("JSON salvo."); qc.invalidateQueries({ queryKey: ["admin", "cliente", cliente.id] }); setJsonError(""); },
    onError: (e: Error) => { toast.error(e.message); setJsonError(e.message); },
  });

  return (
    <div className="py-5">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Método de qualificação do agente IA */}
        <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <div>
            <p className="text-sm font-semibold">Método de qualificação do agente</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Cole aqui a metodologia que o agente deve seguir nas conversas.
              Se vazio, usa um padrão genérico (avalia intenção, urgência, fit e capacidade financeira).
            </p>
          </div>
          <Textarea
            rows={8}
            placeholder={"Ex: Avalie o lead com base em:\n(1) Urgência — já tem pacientes interessados?\n(2) Volume — quantos atendimentos por semana?\n(3) Disposição — aberto a investir em marketing?\nConduza de forma natural, sem parecer interrogatório."}
            value={metodo}
            onChange={(e) => setMetodo(e.target.value)}
          />
          {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
          <Button size="sm" onClick={() => saveMetodo.mutate()} disabled={saveMetodo.isPending} className="gap-2">
            {saveMetodo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar método
          </Button>
        </div>

        {/* JSON avançado */}
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">JSON avançado</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Redes sociais, automações (meta_page_id, zapi_instance_id), GA4, webhooks, etc.
            </p>
          </div>
          <Textarea className="font-mono text-xs" rows={16} value={json} onChange={(e) => { setJson(e.target.value); setJsonError(""); }} />
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
          {["cadastro", "diagnostico", "leads", "conteudo", "conexoes"].map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="rounded-none border-b-2 border-transparent px-4 pb-3 pt-1 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent capitalize"
            >
              {tab === "diagnostico" ? "Diagnóstico" : tab === "conexoes" ? "Conexões" : tab === "conteudo" ? "Conteúdo" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="cadastro"><TabCadastro cliente={cliente} /></TabsContent>
        <TabsContent value="diagnostico"><TabDiagnostico cliente={cliente} /></TabsContent>
        <TabsContent value="leads"><TabLeads clienteId={cliente.id} /></TabsContent>
        <TabsContent value="conteudo"><TabConteudo clienteId={cliente.id} /></TabsContent>
        <TabsContent value="conexoes"><TabConexoes cliente={cliente} /></TabsContent>
      </Tabs>
    </div>
  );
}
