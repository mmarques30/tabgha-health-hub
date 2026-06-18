import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft } from "lucide-react";
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
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/clientes/$id")({
  component: ClienteFichaPage,
  head: () => ({ meta: [{ title: "Ficha do Cliente — Tabgha Admin" }] }),
});

type Cliente = Tables<"clientes">;
type Lead = Tables<"leads">;
type Conteudo = Tables<"conteudos">;

// ── Tab: Cadastro ─────────────────────────────────────────────────────────────
function TabCadastro({ cliente }: { cliente: Cliente }) {
  const qc = useQueryClient();
  const form = useForm({ defaultValues: {
    nome: cliente.nome, email: cliente.email ?? "", telefone: cliente.telefone ?? "",
    cnpj: cliente.cnpj ?? "", razao_social: cliente.razao_social ?? "",
    especialidade: cliente.especialidade ?? "", status: cliente.status,
  }});

  const save = useMutation({
    mutationFn: async () => {
      const data = form.getValues();
      const { error } = await supabase.from("clientes").update(data).eq("id", cliente.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Dados atualizados."); qc.invalidateQueries({ queryKey: ["admin", "cliente", cliente.id] }); },
    onError: () => toast.error("Erro ao salvar."),
  });

  return (
    <form onSubmit={form.handleSubmit(() => save.mutate())} className="max-w-lg space-y-4 py-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1"><Label>Nome</Label><Input {...form.register("nome")} /></div>
        <div className="space-y-1"><Label>Email</Label><Input type="email" {...form.register("email")} /></div>
        <div className="space-y-1"><Label>Telefone</Label><Input {...form.register("telefone")} /></div>
        <div className="space-y-1"><Label>CNPJ</Label><Input {...form.register("cnpj")} /></div>
        <div className="space-y-1"><Label>Razão Social</Label><Input {...form.register("razao_social")} /></div>
        <div className="space-y-1"><Label>Especialidade</Label><Input {...form.register("especialidade")} /></div>
        <div className="space-y-1">
          <Label>Status</Label>
          <Select value={form.watch("status")} onValueChange={(v) => form.setValue("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["onboarding", "ativo", "pausa", "inativo"].map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" disabled={save.isPending}>
        {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
      </Button>
    </form>
  );
}

// ── Tab: Diagnóstico ──────────────────────────────────────────────────────────
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

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <p className="mt-5 mb-2 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-1">{children}</p>;
}

function TabDiagnostico({ cliente }: { cliente: Cliente }) {
  const qc = useQueryClient();
  const [d, setD] = useState<DiagnosticoData>(() => parseDiag(cliente.diagnostico));

  const field = (path: string) => {
    const [sec, key] = path.split(".") as [keyof DiagnosticoData, string];
    const value = key ? (d[sec] as Record<string, string>)[key] ?? "" : (d[sec] as string);
    const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setD((prev) => {
        if (key) {
          return { ...prev, [sec]: { ...(prev[sec] as object), [key]: e.target.value } };
        }
        return { ...prev, [sec]: e.target.value };
      });
    };
    return { value, onChange };
  };

  const save = useMutation({
    mutationFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("clientes").update({ diagnostico: d as any }).eq("id", cliente.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Diagnóstico salvo."); qc.invalidateQueries({ queryKey: ["admin", "cliente", cliente.id] }); },
    onError: () => toast.error("Erro ao salvar."),
  });

  return (
    <div className="max-w-xl py-4 space-y-1">
      <SectionHeader>Perfil do consultório</SectionHeader>
      <div className="grid grid-cols-2 gap-3">
        {([ ["especialidade", "Especialidade"], ["cidade", "Cidade"], ["tempo_mercado", "Tempo de mercado"], ["publico_alvo", "Público-alvo"], ["ticket_medio", "Ticket médio"], ] as [string, string][]).map(([k, l]) => (
          <div key={k} className="space-y-1"><Label className="text-xs">{l}</Label><Input className="text-sm" {...field(`perfil.${k}`)} /></div>
        ))}
        <div className="col-span-2 space-y-1"><Label className="text-xs">Diferencial</Label><Textarea rows={2} className="text-sm" {...field("perfil.diferencial")} /></div>
      </div>

      <SectionHeader>Jornada do paciente</SectionHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1"><Label className="text-xs">Canais de aquisição</Label><Input className="text-sm" placeholder="Meta Ads, Indicação, Orgânico..." {...field("jornada.canais_aquisicao")} /></div>
        <div className="col-span-2 space-y-1"><Label className="text-xs">Descrição do funil</Label><Textarea rows={2} className="text-sm" {...field("jornada.funil")} /></div>
        <div className="col-span-2 space-y-1"><Label className="text-xs">Objeções frequentes</Label><Textarea rows={2} className="text-sm" {...field("jornada.objecoes")} /></div>
        <div className="space-y-1"><Label className="text-xs">Taxa de agendamento</Label><Input className="text-sm" placeholder="ex: 40%" {...field("jornada.taxa_agendamento")} /></div>
        <div className="space-y-1"><Label className="text-xs">Taxa de conversão</Label><Input className="text-sm" placeholder="ex: 25%" {...field("jornada.taxa_conversao")} /></div>
      </div>

      <SectionHeader>Dores identificadas</SectionHeader>
      <div className="space-y-3">
        <div className="space-y-1"><Label className="text-xs">Principais dores do paciente</Label><Textarea rows={2} className="text-sm" {...field("dores.principais")} /></div>
        <div className="space-y-1"><Label className="text-xs">Dores de marketing</Label><Textarea rows={2} className="text-sm" {...field("dores.marketing")} /></div>
        <div className="space-y-1"><Label className="text-xs">Dores operacionais</Label><Textarea rows={2} className="text-sm" {...field("dores.operacional")} /></div>
      </div>

      <SectionHeader>Concorrentes</SectionHeader>
      <div className="space-y-1"><Label className="text-xs">Descreva os principais concorrentes e seu posicionamento</Label><Textarea rows={3} className="text-sm" {...field("concorrentes")} /></div>

      <SectionHeader>Plano de ação</SectionHeader>
      <div className="space-y-1"><Label className="text-xs">Ações, prazos e responsáveis</Label><Textarea rows={4} className="text-sm" placeholder="1. Criar campanha no Meta Ads — prazo: 2 semanas&#10;2. Configurar automação de WhatsApp — prazo: 1 mês" {...field("plano_acao")} /></div>

      <div className="pt-4">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar diagnóstico
        </Button>
      </div>
    </div>
  );
}

// ── Tab: Leads ────────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  novo:        "Novo",
  em_conversa: "Em conversa",
  interessado: "Interessado",
  agendado:    "Agendado",
  atendido:    "Atendido",
  convertido:  "Convertido",
  perdido:     "Perdido",
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

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return leads.length === 0 ? (
    <EmptyState title="Nenhum lead" description="Leads chegam via Meta Ads e WhatsApp." />
  ) : (
    <div className="divide-y divide-border rounded-xl border border-border mt-4">
      {leads.map((l) => (
        <div key={l.id} className="flex items-center gap-4 px-4 py-3 text-sm">
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{l.nome ?? "Sem nome"}</p>
            <p className="text-xs text-muted-foreground">{l.telefone ?? l.email ?? "—"} · {l.canal ?? "—"}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            { novo: "bg-blue-100 text-blue-700", em_conversa: "bg-amber-100 text-amber-700", interessado: "bg-violet-100 text-violet-700", agendado: "bg-cyan-100 text-cyan-700", atendido: "bg-teal-100 text-teal-700", convertido: "bg-green-100 text-green-700", perdido: "bg-slate-100 text-slate-600" }[l.status] ?? "bg-slate-100 text-slate-600"
          }`}>
            {STATUS_LABELS[l.status] ?? l.status}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {format(new Date(l.criado_em), "dd MMM", { locale: ptBR })}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Conteúdo ─────────────────────────────────────────────────────────────
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

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return conteudos.length === 0 ? (
    <EmptyState title="Nenhum conteúdo" description="Crie conteúdos em Estratégia > Calendário." />
  ) : (
    <div className="divide-y divide-border rounded-xl border border-border mt-4">
      {conteudos.map((c) => (
        <div key={c.id} className="flex items-center gap-4 px-4 py-3 text-sm">
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{c.titulo ?? "Sem título"}</p>
            <p className="text-xs text-muted-foreground">{c.rede ?? "—"} · {c.tipo ?? "—"}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            { briefing: "bg-slate-100 text-slate-600", roteiro: "bg-blue-100 text-blue-700", producao: "bg-yellow-100 text-yellow-700", aprovacao: "bg-yellow-100 text-yellow-700", agendado: "bg-blue-100 text-blue-700", postado: "bg-green-100 text-green-700" }[c.status] ?? "bg-slate-100 text-slate-600"
          }`}>{c.status}</span>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Conexões + Agente IA ─────────────────────────────────────────────────
function TabConexoes({ cliente }: { cliente: Cliente }) {
  const qc = useQueryClient();

  const extras = (cliente.dados_extras ?? {}) as Record<string, unknown>;
  const agenteIa = (extras.agente_ia ?? {}) as Record<string, string>;

  const [metodo, setMetodo] = useState<string>(agenteIa.metodo_qualificacao ?? "");
  const [json, setJson] = useState(JSON.stringify(extras, null, 2));
  const [jsonError, setJsonError] = useState("");

  const saveAgente = useMutation({
    mutationFn: async () => {
      let base: Record<string, unknown>;
      try { base = JSON.parse(json); } catch { throw new Error("JSON inválido."); }
      const novoExtras = { ...base, agente_ia: { ...(base.agente_ia as object ?? {}), metodo_qualificacao: metodo || null } };
      const { error } = await supabase.from("clientes").update({ dados_extras: novoExtras }).eq("id", cliente.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Configurações salvas."); qc.invalidateQueries({ queryKey: ["admin", "cliente", cliente.id] }); setJsonError(""); },
    onError: (e: Error) => setJsonError(e.message),
  });

  return (
    <div className="max-w-lg space-y-6 py-4">
      {/* Método de qualificação do agente IA */}
      <div className="space-y-2 rounded-xl border border-border bg-card p-4">
        <div>
          <p className="text-sm font-semibold">Método de qualificação do agente</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Cole aqui a metodologia que o agente deve seguir nas conversas. Se deixar vazio, ele usa um padrão genérico (avalia intenção, urgência, fit e capacidade financeira de forma natural).
          </p>
        </div>
        <Textarea
          rows={6}
          placeholder="Ex: Avalie o lead com base em: (1) Urgência — já tem pacientes interessados? (2) Volume — quantos atendimentos por semana? (3) Disposição — aberto a investir em marketing? Conduza de forma natural, sem parecer interrogatório."
          value={metodo}
          onChange={(e) => setMetodo(e.target.value)}
        />
        {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
        <Button size="sm" onClick={() => saveAgente.mutate()} disabled={saveAgente.isPending}>
          {saveAgente.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar método
        </Button>
      </div>

      {/* JSON bruto de configurações */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">JSON avançado</p>
        <p className="text-xs text-muted-foreground">Redes, automações (meta_page_id, zapi_instance_id), GA4, etc.</p>
        <Textarea className="font-mono text-xs" rows={14} value={json} onChange={(e) => setJson(e.target.value)} />
        <Button size="sm" variant="outline" onClick={() => saveAgente.mutate()} disabled={saveAgente.isPending}>
          {saveAgente.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar JSON
        </Button>
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

  return (
    <div className="px-6 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/clientes" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold tracking-tight truncate">{cliente.nome}</h1>
          <p className="text-xs text-muted-foreground">{cliente.especialidade ?? "—"}</p>
        </div>
        <Badge variant="outline" className="capitalize shrink-0">{cliente.status}</Badge>
      </div>

      <Tabs defaultValue="cadastro">
        <TabsList>
          <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
          <TabsTrigger value="diagnostico">Diagnóstico</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="conteudo">Conteúdo</TabsTrigger>
          <TabsTrigger value="conexoes">Conexões</TabsTrigger>
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
