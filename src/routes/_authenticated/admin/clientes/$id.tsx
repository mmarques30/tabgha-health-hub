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
function TabDiagnostico({ cliente }: { cliente: Cliente }) {
  const qc = useQueryClient();
  const [json, setJson] = useState(
    cliente.diagnostico ? JSON.stringify(cliente.diagnostico, null, 2) : ""
  );
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      let parsed;
      try { parsed = JSON.parse(json); } catch { throw new Error("JSON inválido."); }
      const { error } = await supabase.from("clientes").update({ diagnostico: parsed }).eq("id", cliente.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Diagnóstico salvo."); qc.invalidateQueries({ queryKey: ["admin", "cliente", cliente.id] }); setError(""); },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="max-w-lg space-y-3 py-4">
      <p className="text-xs text-muted-foreground">Edite o diagnóstico estratégico em JSON. Campos livres — molde conforme o template do cliente.</p>
      <Textarea className="font-mono text-xs" rows={18} value={json} onChange={(e) => setJson(e.target.value)} />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar diagnóstico
      </Button>
    </div>
  );
}

// ── Tab: Leads ────────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  novo: "Novo", qualificado: "Qualificado", em_atendimento: "Em atendimento",
  agendado: "Agendado", convertido: "Convertido", perdido: "Perdido",
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
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs">
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
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs">{c.status}</span>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Conexões ─────────────────────────────────────────────────────────────
function TabConexoes({ cliente }: { cliente: Cliente }) {
  const qc = useQueryClient();
  const [json, setJson] = useState(
    cliente.dados_extras ? JSON.stringify(cliente.dados_extras, null, 2) : "{}"
  );
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      let parsed;
      try { parsed = JSON.parse(json); } catch { throw new Error("JSON inválido."); }
      const { error } = await supabase.from("clientes").update({ dados_extras: parsed }).eq("id", cliente.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Conexões salvas."); qc.invalidateQueries({ queryKey: ["admin", "cliente", cliente.id] }); setError(""); },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="max-w-lg space-y-3 py-4">
      <p className="text-xs text-muted-foreground">JSON de configurações: redes, automações (meta_page_id, zapi_instance_id), GA4, etc.</p>
      <Textarea className="font-mono text-xs" rows={18} value={json} onChange={(e) => setJson(e.target.value)} />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
      </Button>
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
    <div className="px-8 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link to="/admin/clientes" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{cliente.nome}</h1>
          <p className="text-sm text-muted-foreground">{cliente.especialidade ?? "—"}</p>
        </div>
        <Badge variant="outline" className="capitalize">{cliente.status}</Badge>
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
