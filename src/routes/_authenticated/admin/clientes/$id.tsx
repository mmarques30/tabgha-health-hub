import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  ArrowLeft,
  Sparkles,
  Save,
  RefreshCw,
  ChevronDown,
  Stethoscope,
  Trash2,
  Mic,
  MicOff,
  FileText,
  Upload,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";
import {
  deleteClienteAdmin,
  updateClienteAdmin,
} from "@/functions/clientes/createClientWithAccess.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
    <p
      className={cn(
        "mt-6 mb-3 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-1.5",
        className,
      )}
    >
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

  useEffect(() => {
    form.reset({
      nome: cliente.nome,
      email: cliente.email ?? "",
      telefone: cliente.telefone ?? "",
      cnpj: cliente.cnpj ?? "",
      razao_social: cliente.razao_social ?? "",
      especialidade: cliente.especialidade ?? "",
      status: cliente.status,
    });
  }, [cliente, form]);

  const { data: quickStats } = useQuery({
    queryKey: ["admin", "cliente", cliente.id, "quick-stats"],
    staleTime: 120_000,
    queryFn: async () => {
      const [leadsTotal, leadsConv, conteudosTotal, conteudosAprov] = await Promise.all([
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("cliente_id", cliente.id),
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("cliente_id", cliente.id)
          .eq("status", "convertido"),
        supabase
          .from("conteudos")
          .select("id", { count: "exact", head: true })
          .eq("cliente_id", cliente.id),
        supabase
          .from("conteudos")
          .select("id", { count: "exact", head: true })
          .eq("cliente_id", cliente.id)
          .eq("status", "aprovacao"),
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
      if (!values.nome.trim()) throw new Error("Nome é obrigatório.");
      await updateClienteAdmin({
        id: cliente.id,
        nome: values.nome,
        email: values.email,
        telefone: values.telefone,
        cnpj: values.cnpj,
        razao_social: values.razao_social,
        especialidade: values.especialidade,
        status: values.status,
      });
    },
    onSuccess: () => {
      toast.success("Dados atualizados.");
      void qc.invalidateQueries({ queryKey: ["admin", "cliente", cliente.id] });
      void qc.invalidateQueries({ queryKey: ["admin", "clientes"] });
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
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Identificação
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Nome">
                  <Input {...form.register("nome")} />
                </Field>
                <Field label="Email do consultório">
                  <Input type="email" {...form.register("email")} />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Se existir login de portal com o email antigo, ele também é atualizado no Auth —
                    assim você consegue liberar o email certo para outro usuário.
                  </p>
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
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Dados fiscais
              </p>
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
                  <Select
                    value={form.watch("status")}
                    onValueChange={(v) => form.setValue("status", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["onboarding", "ativo", "pausa", "inativo"].map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Button type="submit" disabled={save.isPending} className="mb-0.5">
                {save.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar
              </Button>
            </div>
          </div>
        </form>

        {/* ── Sidebar de resumo ── */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Resumo da conta
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-secondary/60 p-3 text-center">
                <p className="text-2xl font-extrabold tracking-tight">{quickStats?.leads ?? "—"}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">leads total</p>
              </div>
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
                <p className="text-2xl font-extrabold tracking-tight text-emerald-600">
                  {quickStats?.convertidos ?? "—"}
                </p>
                <p className="mt-0.5 text-[10px] text-emerald-700">convertidos</p>
              </div>
              <div className="rounded-xl bg-secondary/60 p-3 text-center">
                <p className="text-2xl font-extrabold tracking-tight">
                  {quickStats?.conteudos ?? "—"}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">conteúdos</p>
              </div>
              {(quickStats?.aprovacao ?? 0) > 0 ? (
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-center">
                  <p className="text-2xl font-extrabold tracking-tight text-amber-600">
                    {quickStats!.aprovacao}
                  </p>
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
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Informações
            </p>
            <div className="space-y-2.5 text-xs">
              {cliente.criado_em && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cadastro</span>
                  <span className="font-medium">
                    {format(new Date(cliente.criado_em), "dd MMM yyyy", { locale: ptBR })}
                  </span>
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
                <span className="font-mono text-[10px] text-muted-foreground">
                  {cliente.id.slice(0, 8)}…
                </span>
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
              {diagPreenchido
                ? "Publicado no portal — envie nova fonte para regenerar"
                : "Cole a transcrição ou anexe arquivo para gerar e publicar"}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
              diagPreenchido ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700",
            )}
          >
            {diagPreenchido ? "Publicado" : "Pendente"}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              diagOpen && "rotate-180",
            )}
          />
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
  resumo: string;
  perfil: {
    especialidade: string;
    cidade: string;
    tempo_mercado: string;
    publico_alvo: string;
    ticket_medio: string;
    diferencial: string;
  };
  jornada: {
    canais_aquisicao: string;
    funil: string;
    objecoes: string;
    taxa_agendamento: string;
    taxa_conversao: string;
  };
  dores: { principais: string; marketing: string; operacional: string };
  concorrentes: string;
  /** Interno Tabgha — sugestões de demanda; NÃO exibir no portal do médico */
  demandas_sugeridas: string;
  gerado_em?: string;
};

const EMPTY_DIAG: DiagnosticoData = {
  resumo: "",
  perfil: {
    especialidade: "",
    cidade: "",
    tempo_mercado: "",
    publico_alvo: "",
    ticket_medio: "",
    diferencial: "",
  },
  jornada: {
    canais_aquisicao: "",
    funil: "",
    objecoes: "",
    taxa_agendamento: "",
    taxa_conversao: "",
  },
  dores: { principais: "", marketing: "", operacional: "" },
  concorrentes: "",
  demandas_sugeridas: "",
};

function parseDiag(raw: unknown): DiagnosticoData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY_DIAG;
  const r = raw as Record<string, unknown>;
  const perfil =
    r.perfil && typeof r.perfil === "object" && !Array.isArray(r.perfil)
      ? (r.perfil as Record<string, unknown>)
      : {};
  const jornada =
    r.jornada && typeof r.jornada === "object" && !Array.isArray(r.jornada)
      ? (r.jornada as Record<string, unknown>)
      : {};
  const dores =
    r.dores && typeof r.dores === "object" && !Array.isArray(r.dores)
      ? (r.dores as Record<string, unknown>)
      : {};
  const demandasRaw = r.demandas_sugeridas ?? r.plano_acao;
  return {
    resumo: typeof r.resumo === "string" ? r.resumo : "",
    perfil: {
      especialidade: String(perfil.especialidade ?? ""),
      cidade: String(perfil.cidade ?? ""),
      tempo_mercado: String(perfil.tempo_mercado ?? ""),
      publico_alvo: String(perfil.publico_alvo ?? ""),
      ticket_medio: String(perfil.ticket_medio ?? ""),
      diferencial: String(perfil.diferencial ?? ""),
    },
    jornada: {
      canais_aquisicao: String(jornada.canais_aquisicao ?? ""),
      funil: String(jornada.funil ?? ""),
      objecoes: String(jornada.objecoes ?? ""),
      taxa_agendamento: String(jornada.taxa_agendamento ?? ""),
      taxa_conversao: String(jornada.taxa_conversao ?? ""),
    },
    dores: {
      principais: String(dores.principais ?? ""),
      marketing: String(dores.marketing ?? ""),
      operacional: String(dores.operacional ?? ""),
    },
    concorrentes:
      typeof r.concorrentes === "string"
        ? r.concorrentes
        : Array.isArray(r.concorrentes)
          ? r.concorrentes.join("\n")
          : "",
    demandas_sugeridas:
      typeof demandasRaw === "string"
        ? demandasRaw
        : Array.isArray(demandasRaw)
          ? demandasRaw
              .map((a: unknown) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
              .join("\n")
          : "",
    gerado_em: typeof r.gerado_em === "string" ? r.gerado_em : undefined,
  };
}

function diagPreenchidoCheck(d: DiagnosticoData) {
  return Boolean(d.resumo.trim() || d.perfil.especialidade.trim() || d.dores.principais.trim());
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult:
    | ((ev: {
        resultIndex: number;
        results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
      }) => void)
    | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

async function invokeDiagnosticoEdge(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("gerar_diagnostico", { body });
  const payload = data as {
    error?: string;
    detail?: string;
    diagnostico?: unknown;
    plano_acao?: string;
    demandas_sugeridas?: string;
  } | null;

  if (error) {
    let fromContext: string | undefined;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) {
        const bodyJson = (await ctx.clone().json()) as { error?: string };
        fromContext = bodyJson?.error;
      }
    } catch {
      /* ignore */
    }
    const msg = payload?.error || fromContext || error.message || "Falha ao chamar a IA.";
    if (msg.includes("ANTHROPIC_API_KEY")) {
      throw new Error("IA indisponível: configure ANTHROPIC_API_KEY no Supabase.");
    }
    throw new Error(msg);
  }
  if (payload?.error) {
    throw new Error(payload.error);
  }
  return payload;
}

function PreviewField({ label, value }: { label: string; value: string }) {
  if (!value?.trim()) return null;
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{value}</p>
    </div>
  );
}

// ── Tab: Diagnóstico ──────────────────────────────────────────────────────────
function TabDiagnostico({ cliente }: { cliente: Cliente }) {
  const qc = useQueryClient();
  const [d, setD] = useState<DiagnosticoData>(() => parseDiag(cliente.diagnostico));
  const [generating, setGenerating] = useState(false);
  const [structuringActions, setStructuringActions] = useState(false);
  const [transcricao, setTranscricao] = useState("");
  const [fonteUrl, setFonteUrl] = useState("");
  const [genError, setGenError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [acoesError, setAcoesError] = useState<string | null>(null);
  const [notasBrutas, setNotasBrutas] = useState("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const notasBrutasRef = useRef("");
  const autoEstruturarRef = useRef(false);

  function appendNotasBrutas(chunk: string) {
    const text = chunk.trim();
    if (!text) return;
    const next = notasBrutasRef.current.trim() ? `${notasBrutasRef.current.trim()} ${text}` : text;
    notasBrutasRef.current = next;
    setNotasBrutas(next);
  }

  async function persistDiagnostico(next: DiagnosticoData) {
    const toSave = {
      ...next,
      plano_acao: next.demandas_sugeridas,
    };
    const { error } = await supabase
      .from("clientes")
      .update({ diagnostico: toSave as never })
      .eq("id", cliente.id);
    if (error) throw error;
    void qc.invalidateQueries({ queryKey: ["admin", "cliente", cliente.id] });
    void qc.invalidateQueries({ queryKey: ["cliente", "diagnostico"] });
  }

  async function gerarEPublicar(opts?: { transcricaoOverride?: string; urlOverride?: string }) {
    const fonte = (opts?.transcricaoOverride ?? transcricao).trim();
    const url = (opts?.urlOverride ?? fonteUrl).trim();
    if (!fonte && !url) {
      setGenError("Cole a transcrição, anexe um arquivo ou informe um link HTML.");
      return;
    }
    setGenerating(true);
    setGenError(null);
    try {
      const payload = await invokeDiagnosticoEdge({
        mode: "diagnostico",
        nome: cliente.nome,
        especialidade: cliente.especialidade ?? undefined,
        cidade: d.perfil.cidade || undefined,
        transcricao: fonte || undefined,
        fonte_url: url || undefined,
      });
      if (!payload?.diagnostico) {
        throw new Error("A IA não retornou o diagnóstico.");
      }
      const next = {
        ...parseDiag(payload.diagnostico),
        demandas_sugeridas: d.demandas_sugeridas,
        gerado_em: new Date().toISOString(),
      };
      setD(next);
      await persistDiagnostico(next);
      toast.success("Diagnóstico gerado e publicado no portal do cliente.");
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "Erro ao gerar diagnóstico. Verifique a ANTHROPIC_API_KEY no Supabase.";
      setGenError(msg);
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }

  async function onTranscriptFile(file: File | null) {
    if (!file) return;
    const ok =
      file.type.startsWith("text/") ||
      file.type.includes("html") ||
      /\.(txt|md|markdown|csv|json|html|htm)$/i.test(file.name);
    if (!ok) {
      toast.error("Envie texto ou HTML (.txt, .md, .html). PDF/Word em breve.");
      return;
    }
    try {
      const text = await file.text();
      const merged = transcricao ? `${transcricao.trim()}\n\n${text.trim()}` : text.trim();
      setTranscricao(merged);
      toast.message(`Arquivo “${file.name}” carregado — gerando diagnóstico…`);
      await gerarEPublicar({ transcricaoOverride: merged });
    } catch {
      toast.error("Não foi possível ler o arquivo.");
    }
  }

  async function estruturarDemandasComIA(notasOverride?: string) {
    const notas = notasOverride?.trim() || notasBrutasRef.current.trim() || notasBrutas.trim();
    if (!diagPreenchidoCheck(d) && !notas) {
      const msg = "Gere o diagnóstico antes (ou digite notas) para sugerir demandas.";
      setAcoesError(msg);
      toast.error(msg);
      return;
    }
    setStructuringActions(true);
    setAcoesError(null);
    try {
      const payload = await invokeDiagnosticoEdge({
        mode: "acoes",
        nome: cliente.nome,
        especialidade: cliente.especialidade ?? d.perfil.especialidade,
        cidade: d.perfil.cidade || undefined,
        notas_acoes: notas || undefined,
        diagnostico_atual: d,
        transcricao: transcricao.trim() || undefined,
      });
      const demandas = payload?.demandas_sugeridas || payload?.plano_acao;
      if (!demandas) throw new Error("A IA não retornou demandas.");
      const next = { ...d, demandas_sugeridas: demandas };
      setD(next);
      setNotasBrutas("");
      notasBrutasRef.current = "";
      await persistDiagnostico(next);
      toast.success("Sugestões de demanda salvas (só visão Tabgha — não vão ao portal).");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao sugerir demandas.";
      setAcoesError(msg);
      toast.error(msg);
    } finally {
      setStructuringActions(false);
    }
  }

  function stopDictation(shouldEstruturar: boolean) {
    autoEstruturarRef.current = shouldEstruturar;
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }

  function startDictation() {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      toast.error("Seu navegador não suporta ditado por áudio. Use Chrome ou Edge.");
      return;
    }
    if (listening && recRef.current) {
      stopDictation(true);
      return;
    }

    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (ev) => {
      let chunk = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const row = ev.results[i];
        if (row.isFinal) chunk += row[0].transcript;
      }
      appendNotasBrutas(chunk);
    };
    rec.onerror = (ev) => {
      setListening(false);
      if (ev.error !== "aborted" && ev.error !== "no-speech") {
        toast.error(`Áudio: ${ev.error}`);
      }
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      if (autoEstruturarRef.current) {
        autoEstruturarRef.current = false;
        const notas = notasBrutasRef.current.trim();
        if (notas) {
          toast.message("Gerando sugestões de demanda…");
          void estruturarDemandasComIA(notas);
        } else {
          toast.error("Não captamos áudio. Tente de novo ou digite as notas.");
        }
      }
    };
    recRef.current = rec;
    autoEstruturarRef.current = false;
    rec.start();
    setListening(true);
    setAcoesError(null);
    toast.message("Ouvindo… ao parar, sugerimos demandas internas com base no diagnóstico.");
  }

  const filled = diagPreenchidoCheck(d);

  return (
    <div className="space-y-5 py-5">
      <div className="space-y-3 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 to-transparent p-5">
        <div>
          <p className="text-sm font-bold text-primary">Fonte → diagnóstico publicado</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Cole a transcrição, anexe .txt/.html ou informe um link. A IA gera o diagnóstico
            consolidado e já publica no portal do médico. Campos manuais redundantes foram
            removidos.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="flex items-center gap-1.5 text-xs font-semibold">
              <FileText className="h-3.5 w-3.5 text-primary" />
              Transcrição ou texto
            </Label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-secondary/50">
              <Upload className="h-3.5 w-3.5" />
              Anexar arquivo
              <input
                type="file"
                accept=".txt,.md,.markdown,.csv,.html,.htm,text/plain,text/html"
                className="hidden"
                onChange={(e) => void onTranscriptFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <Textarea
            rows={6}
            value={transcricao}
            onChange={(e) => setTranscricao(e.target.value)}
            placeholder="Cole aqui a transcrição da reunião / discovery…"
            className="resize-y font-mono text-xs leading-relaxed"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Link HTML (opcional)</Label>
          <Input
            value={fonteUrl}
            onChange={(e) => setFonteUrl(e.target.value)}
            placeholder="https://… página ou export com o conteúdo da reunião"
            className="text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void gerarEPublicar()} disabled={generating} className="gap-2">
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando e publicando…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {filled ? "Regenerar e publicar" : "Gerar e publicar no portal"}
              </>
            )}
          </Button>
        </div>

        {genError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {genError}
          </div>
        ) : null}
      </div>

      {filled ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[10.5px] font-bold uppercase tracking-widest text-sky-700">
                Visão do cliente (publicada)
              </p>
              {d.gerado_em ? (
                <p className="text-[10px] text-muted-foreground">
                  Gerado em {new Date(d.gerado_em).toLocaleString("pt-BR")}
                </p>
              ) : null}
            </div>
            {d.resumo ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                {d.resumo}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sem resumo narrativo — regenere para consolidar a leitura do médico.
              </p>
            )}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <PreviewField label="Público-alvo" value={d.perfil.publico_alvo} />
              <PreviewField label="Diferencial" value={d.perfil.diferencial} />
              <PreviewField label="Canais" value={d.jornada.canais_aquisicao} />
              <PreviewField label="Funil" value={d.jornada.funil} />
              <PreviewField label="Dores (paciente)" value={d.dores.principais} />
              <PreviewField label="Dores (marketing)" value={d.dores.marketing} />
              <div className="sm:col-span-2">
                <PreviewField label="Concorrentes & posicionamento" value={d.concorrentes} />
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-amber-200/80 bg-amber-50/40 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/70 px-5 py-3">
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-widest text-amber-800">
                  Sugestões de demanda (interno Tabgha)
                </p>
                <p className="mt-0.5 text-[11px] text-amber-900/70">
                  Não aparece no portal do médico — use para incluir demandas neste cliente.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={listening ? "destructive" : "default"}
                  className="gap-1.5"
                  disabled={structuringActions}
                  onClick={() => {
                    if (listening) stopDictation(true);
                    else startDictation();
                  }}
                >
                  {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  {listening ? "Parar e sugerir" : "Falar notas"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="gap-1.5"
                  disabled={structuringActions || listening}
                  onClick={() => void estruturarDemandasComIA()}
                >
                  {structuringActions ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Sugerir a partir do diagnóstico
                </Button>
              </div>
            </div>
            <div className="space-y-3 p-5">
              <Textarea
                rows={3}
                value={notasBrutas}
                onChange={(e) => {
                  setNotasBrutas(e.target.value);
                  notasBrutasRef.current = e.target.value;
                }}
                placeholder="Notas opcionais da equipe (ex.: priorizar joelho, revisar WhatsApp)…"
                className="resize-none text-sm"
              />
              <Textarea
                rows={6}
                value={d.demandas_sugeridas}
                onChange={(e) => setD((prev) => ({ ...prev, demandas_sugeridas: e.target.value }))}
                placeholder={"1. …\n2. …"}
                className="resize-none font-mono text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  void persistDiagnostico(d)
                    .then(() => toast.success("Demandas internas atualizadas."))
                    .catch((err: Error) => toast.error(err.message));
                }}
              >
                <Save className="h-3.5 w-3.5" />
                Salvar demandas
              </Button>
              {listening ? (
                <p className="animate-pulse text-xs font-medium text-rose-700">Gravando…</p>
              ) : null}
              {acoesError ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {acoesError}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Ainda sem diagnóstico publicado. Envie a fonte acima para gerar.
        </p>
      )}
    </div>
  );
}

// ── Tab: Leads ────────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  novo: "Novo",
  em_conversa: "Em conversa",
  interessado: "Interessado",
  agendado: "Agendado",
  atendido: "Atendido",
  convertido: "Convertido",
  perdido: "Perdido",
};

const STATUS_BADGE: Record<string, string> = {
  novo: "bg-blue-100 text-blue-700",
  em_conversa: "bg-amber-100 text-amber-700",
  interessado: "bg-violet-100 text-violet-700",
  agendado: "bg-cyan-100 text-cyan-700",
  atendido: "bg-teal-100 text-teal-700",
  convertido: "bg-green-100 text-green-700",
  perdido: "bg-slate-100 text-slate-600",
};

const LEADS_PIPELINE = [
  "novo",
  "em_conversa",
  "interessado",
  "agendado",
  "atendido",
  "convertido",
  "perdido",
] as const;

function TabLeads({ clienteId }: { clienteId: string }) {
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["admin", "cliente", clienteId, "leads"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  if (leads.length === 0)
    return (
      <div className="py-8">
        <EmptyState title="Nenhum lead" description="Leads chegam via Meta Ads e WhatsApp." />
      </div>
    );

  const funnelStats = LEADS_PIPELINE.map((s) => ({
    s,
    label: STATUS_LABELS[s],
    count: leads.filter((l) => l.status === s).length,
    color: STATUS_BADGE[s],
  })).filter(({ count }) => count > 0);

  return (
    <div className="py-5">
      <div className="mb-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{leads.length} leads</span>
          <span className="text-xs text-muted-foreground">
            — {leads.filter((l) => l.status === "convertido").length} convertidos
          </span>
        </div>
        {funnelStats.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {funnelStats.map(({ s, label, count, color }) => (
              <div
                key={s}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 shadow-[0_1px_2px_rgba(15,27,53,0.04)]"
              >
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", color)}>
                  {label}
                </span>
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
                <th key={h} className="px-4 py-2.5 text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {leads.map((l) => (
              <tr key={l.id} className="hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-2.5 font-medium">{l.nome ?? "Sem nome"}</td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs">
                  {l.telefone ?? l.email ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs capitalize">
                  {l.canal ?? "—"}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                      STATUS_BADGE[l.status] ?? "bg-slate-100 text-slate-600",
                    )}
                  >
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
  briefing: "bg-slate-100 text-slate-600",
  roteiro: "bg-blue-100 text-blue-700",
  producao: "bg-yellow-100 text-yellow-700",
  aprovacao: "bg-orange-100 text-orange-700",
  agendado: "bg-indigo-100 text-indigo-700",
  postado: "bg-green-100 text-green-700",
};

const CONTEUDO_PIPELINE = [
  "briefing",
  "roteiro",
  "producao",
  "aprovacao",
  "agendado",
  "postado",
] as const;

const CONTEUDO_STATUS_LABEL: Record<string, string> = {
  briefing: "Briefing",
  roteiro: "Roteiro",
  producao: "Produção",
  aprovacao: "Aprovação",
  agendado: "Agendado",
  postado: "Postado",
};

function TabConteudo({ clienteId }: { clienteId: string }) {
  const { data: conteudos = [], isLoading } = useQuery({
    queryKey: ["admin", "cliente", clienteId, "conteudos"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conteudos")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("data_postagem", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  if (conteudos.length === 0)
    return (
      <div className="py-8">
        <EmptyState
          title="Nenhum conteúdo"
          description="Crie conteúdos em Estratégia > Calendário."
        />
      </div>
    );

  const pipelineStats = CONTEUDO_PIPELINE.map((s) => ({
    s,
    label: CONTEUDO_STATUS_LABEL[s],
    count: conteudos.filter((c) => c.status === s).length,
    color: CONTEUDO_STATUS_BADGE[s],
  })).filter(({ count }) => count > 0);

  return (
    <div className="py-5">
      <div className="mb-4 space-y-3">
        <span className="text-sm font-semibold">{conteudos.length} conteúdos</span>
        {pipelineStats.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pipelineStats.map(({ s, label, count, color }) => (
              <div
                key={s}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 shadow-[0_1px_2px_rgba(15,27,53,0.04)]"
              >
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", color)}>
                  {label}
                </span>
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
                <th key={h} className="px-4 py-2.5 text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {conteudos.map((c) => (
              <tr key={c.id} className="hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-2.5 font-medium max-w-[260px] truncate">
                  {c.titulo ?? "Sem título"}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs capitalize">
                  {c.rede ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs capitalize">
                  {c.tipo ?? "—"}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize",
                      CONTEUDO_STATUS_BADGE[c.status] ?? "bg-slate-100 text-slate-600",
                    )}
                  >
                    {CONTEUDO_STATUS_LABEL[c.status] ?? c.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs">
                  {c.data_postagem
                    ? format(new Date(c.data_postagem), "dd MMM yyyy", { locale: ptBR })
                    : "—"}
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

      const { data: instances } = await supabase
        .from("whatsapp_instances")
        .select("id, dados_extras")
        .eq("cliente_id", cliente.id);

      for (const instance of instances ?? []) {
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

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-inbound`;

  const saveInstance = useMutation({
    mutationFn: async () => {
      if (!instanceId.trim() || !instanceToken.trim()) {
        throw new Error("Instance ID e Token são obrigatórios.");
      }
      const keepStatus =
        wppInstance?.status === "connected" || wppInstance?.status === "connecting"
          ? wppInstance.status
          : "disconnected";
      const payload = {
        cliente_id: cliente.id,
        provider: "zapi" as const,
        instance_id: instanceId.trim(),
        token: instanceToken.trim(),
        status: keepStatus,
        dados_extras: {
          ...((wppInstance?.dados_extras as object) ?? {}),
          client_token: clientToken.trim() || null,
        },
      };
      if (wppInstance?.id) {
        const { error } = await supabase
          .from("whatsapp_instances")
          .update(payload)
          .eq("id", wppInstance.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("whatsapp_instances").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Instância WhatsApp salva. Gere o QR ao lado para conectar.");
      qc.invalidateQueries({ queryKey: ["admin", "cliente", cliente.id, "wpp-instance"] });
      qc.invalidateQueries({ queryKey: ["whatsapp-connect", cliente.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hasZapiInstance = Boolean(wppInstance?.instance_id && wppInstance?.token);
  const wppStatus = wppInstance?.status ?? "none";
  const metaExtras = (extras.meta ?? null) as Record<string, unknown> | null;
  const hasMeta = Boolean(metaExtras?.page_id || metaExtras?.ad_account_id);

  return (
    <div className="space-y-4 py-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Meta Ads
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {hasMeta ? "Conectado (dados reais no JSON)" : "Ainda não conectado"}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {hasMeta
              ? `Página: ${String(metaExtras?.page_name ?? metaExtras?.page_id ?? "—")}`
              : "Conecte em Config Meta / Marketing Pago."}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            WhatsApp / Pietro
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {!hasZapiInstance
              ? "Sem instância Z-API"
              : wppStatus === "connected"
                ? agenteAtivo
                  ? "Conectado + agente ligado"
                  : "Conectado (agente desligado)"
                : "Instância salva — falta escanear QR"}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            O agente só responde depois: instância salva → QR conectado → Agente ativo ligado.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4 text-sm text-amber-950">
        <p className="text-[10.5px] font-bold uppercase tracking-widest text-amber-800">
          Como conectar a automação WhatsApp (é real — não é mock)
        </p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed">
          <li>
            Na Z-API, crie/abra a instância do consultório e copie Instance ID + Token (+
            Client-Token se houver).
          </li>
          <li>Cole os dados em “Provisionar Z-API” abaixo e salve.</li>
          <li>
            Na Z-API, configure o webhook de recebimento (Receive) para:
            <code className="mt-1 block break-all rounded-md bg-white/80 px-2 py-1.5 text-[11px] text-slate-800">
              {webhookUrl}
            </code>
          </li>
          <li>
            Clique em “Gerar QR Code” no card ao lado e escaneie com o celular do consultório.
          </li>
          <li>
            Ative “Agente ativo”, salve a metodologia — aí o inbound chama o Pietro (
            <span className="font-mono">ai-respond</span>) nas conversas com o bot.
          </li>
        </ol>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <WhatsappConnectCard clienteId={cliente.id} />
          <div className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
            <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
              Provisionar Z-API (admin)
            </p>
            <p className="text-xs text-muted-foreground">
              {hasZapiInstance
                ? "Instância já salva neste cliente. Atualize só se trocar na Z-API."
                : "Ainda não há instância neste cliente — por isso o card diz “Aguardando provisionamento”. Isso é o estado real."}
            </p>
            <div className="space-y-2">
              <Label>Instance ID</Label>
              <Input
                value={instanceId}
                onChange={(e) => setInstanceId(e.target.value)}
                placeholder="3A..."
              />
            </div>
            <div className="space-y-2">
              <Label>Token</Label>
              <Input
                value={instanceToken}
                onChange={(e) => setInstanceToken(e.target.value)}
                placeholder="token da instância"
              />
            </div>
            <div className="space-y-2">
              <Label>Client-Token (opcional)</Label>
              <Input
                value={clientToken}
                onChange={(e) => setClientToken(e.target.value)}
                placeholder="security token da conta Z-API"
              />
            </div>
            <Button
              size="sm"
              onClick={() => saveInstance.mutate()}
              disabled={saveInstance.isPending}
              className="gap-2"
            >
              {saveInstance.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar instância
            </Button>
          </div>
        </div>

        {/* ── Método de qualificação ── */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
          <div className="flex items-center gap-2.5 border-b border-sky-100 bg-sky-50/60 px-5 py-3">
            <span className="h-2 w-2 rounded-full bg-sky-500 shrink-0" />
            <p className="text-[10.5px] font-bold uppercase tracking-widest text-sky-700">
              Pietro · Agente WhatsApp
            </p>
          </div>
          <div className="space-y-3 p-5">
            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Agente ativo</p>
                <p className="text-xs text-muted-foreground">
                  Só faz efeito com WhatsApp conectado. Liga o Pietro nas conversas do bot.
                </p>
              </div>
              <Switch checked={agenteAtivo} onCheckedChange={setAgenteAtivo} />
            </div>
            {!hasZapiInstance ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
                Ainda não há instância Z-API. Salvar o agente agora só guarda a configuração — ele{" "}
                <strong>não</strong> fala no WhatsApp até provisionar + QR.
              </p>
            ) : null}
            <p className="text-xs leading-relaxed text-muted-foreground">
              Metodologia do Pietro neste cliente. Campo vazio = usa o padrão genérico. O texto
              cinza no campo é só exemplo (placeholder), não é dado salvo.
            </p>
            <Textarea
              rows={10}
              placeholder={
                "Exemplo (não é dado real até você digitar e salvar):\n(1) Urgência — já tem pacientes interessados?\n(2) Volume — quantos atendimentos por semana?\n(3) Disposição — aberto a investir em marketing?\nConduza de forma natural, sem parecer interrogatório."
              }
              value={metodo}
              onChange={(e) => setMetodo(e.target.value)}
              className="resize-none text-sm"
            />
            {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
            <Button
              size="sm"
              onClick={() => saveMetodo.mutate()}
              disabled={saveMetodo.isPending}
              className="gap-2"
            >
              {saveMetodo.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar agente
            </Button>
          </div>
        </div>
      </div>

      {/* ── JSON avançado (sempre visível — dados reais do cliente) ── */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
        <div className="flex items-center gap-2.5 border-b border-slate-200 bg-slate-50/60 px-5 py-3">
          <span className="h-2 w-2 shrink-0 rounded-full bg-slate-400" />
          <p className="text-[10.5px] font-bold uppercase tracking-widest text-slate-600">
            JSON Avançado
          </p>
        </div>
        <div className="space-y-3 p-5">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Isto <strong className="font-semibold text-foreground">não é inventado</strong>: é o{" "}
            <span className="font-mono text-[11px]">dados_extras</span> real deste cliente no banco.
            O bloco <span className="font-mono text-[11px]">meta</span> veio da conexão Meta BM
            (página DR. Pedro, ad accounts, tokens). WhatsApp / Z-API entra aqui depois de
            provisionar. Não ocultamos este painel — é a visão técnica da operação.
          </p>
          <Textarea
            className="font-mono text-xs resize-none"
            rows={8}
            value={json}
            onChange={(e) => {
              setJson(e.target.value);
              setJsonError("");
            }}
          />
          {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
          <Button
            size="sm"
            variant="outline"
            onClick={() => saveJson.mutate()}
            disabled={saveJson.isPending}
            className="gap-2"
          >
            {saveJson.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
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
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: cliente, isLoading } = useQuery({
    queryKey: ["admin", "cliente", id],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const excluir = useMutation({
    mutationFn: () => deleteClienteAdmin(id),
    onSuccess: () => {
      toast.success("Cliente excluído.");
      void qc.invalidateQueries({ queryKey: ["admin", "clientes"] });
      void navigate({ to: "/admin/clientes" });
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível excluir."),
  });

  if (isLoading)
    return (
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
        <Link
          to="/admin/clientes"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold tracking-tight truncate">{cliente.nome}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{cliente.especialidade ?? "—"}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold capitalize",
            statusColor[cliente.status] ?? "bg-muted text-muted-foreground",
          )}
        >
          {cliente.status}
        </span>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-rose-200 text-rose-700 hover:bg-rose-50"
              disabled={excluir.isPending}
            >
              {excluir.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Excluir
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso remove <strong>{cliente.nome}</strong> e dados vinculados (leads, conteúdos,
                etc.). Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-rose-600 hover:bg-rose-700"
                onClick={() => excluir.mutate()}
              >
                Excluir definitivamente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Tabs defaultValue="cadastro">
        <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent h-auto p-0 gap-0">
          {["cadastro", "leads", "conteudo", "conexoes"].map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="rounded-none border-b-2 border-transparent px-4 pb-3 pt-1 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent capitalize"
            >
              {tab === "conexoes"
                ? "Conexões"
                : tab === "conteudo"
                  ? "Conteúdo"
                  : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="cadastro">
          <TabCadastro cliente={cliente} />
        </TabsContent>
        <TabsContent value="leads">
          <TabLeads clienteId={cliente.id} />
        </TabsContent>
        <TabsContent value="conteudo">
          <TabConteudo clienteId={cliente.id} />
        </TabsContent>
        <TabsContent value="conexoes">
          <TabConexoes cliente={cliente} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
