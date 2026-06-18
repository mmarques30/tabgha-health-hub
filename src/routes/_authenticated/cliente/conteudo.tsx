import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/cliente/conteudo")({
  component: ConteudoPage,
  head: () => ({ meta: [{ title: "Conteúdo — Portal" }] }),
});

type Conteudo = Tables<"conteudo"> & { entregas: { id: string; status: string }[] | null };

// @ts-expect-error table name from schema
type ConteudoRow = Tables<"conteudos">;

const STATUS_LABELS: Record<string, string> = {
  briefing: "Briefing", roteiro: "Roteiro", producao: "Produção",
  aprovacao: "Aguardando aprovação", agendado: "Agendado", postado: "Postado",
};
const STATUS_COLORS: Record<string, string> = {
  briefing: "bg-slate-100 text-slate-600", roteiro: "bg-purple-100 text-purple-700",
  producao: "bg-yellow-100 text-yellow-700", aprovacao: "bg-orange-100 text-orange-700 font-semibold",
  agendado: "bg-blue-100 text-blue-700", postado: "bg-green-100 text-green-700",
};

function AprovacaoModal({ conteudo, onClose }: { conteudo: ConteudoRow; onClose: () => void }) {
  const [feedback, setFeedback] = useState("");
  const qc = useQueryClient();
  const { profile } = useAuth();

  const aprovar = useMutation({
    mutationFn: async (aprovado: boolean) => {
      // Atualiza o conteudo diretamente (RLS valida que é do próprio cliente)
      const { error } = await supabase.from("conteudos")
        .update({ status: aprovado ? "agendado" : "roteiro" })
        .eq("id", conteudo.id).eq("cliente_id", profile!.cliente_id!);
      if (error) throw error;
    },
    onSuccess: (_, aprovado) => {
      toast.success(aprovado ? "Conteúdo aprovado!" : "Conteúdo devolvido para revisão.");
      qc.invalidateQueries({ queryKey: ["cliente", "conteudos"] });
      onClose();
    },
    onError: () => toast.error("Erro ao processar resposta."),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{conteudo.titulo}</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-2 text-muted-foreground">
            <div>Rede: <span className="text-foreground">{conteudo.rede ?? "—"}</span></div>
            <div>Tipo: <span className="text-foreground">{conteudo.tipo ?? "—"}</span></div>
            {conteudo.data_postagem && (
              <div>Postagem: <span className="text-foreground">{format(new Date(conteudo.data_postagem), "dd MMM yyyy", { locale: ptBR })}</span></div>
            )}
          </div>
          {conteudo.roteiro && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Roteiro</p>
              <p className="rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">{conteudo.roteiro}</p>
            </div>
          )}
          {conteudo.url_briefing && (
            <a href={conteudo.url_briefing} target="_blank" rel="noreferrer"
              className="text-xs text-primary underline">Ver briefing</a>
          )}
          {conteudo.url_arquivo && (
            <a href={conteudo.url_arquivo} target="_blank" rel="noreferrer"
              className="text-xs text-primary underline">Ver arquivo</a>
          )}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Feedback (opcional ao rejeitar)</p>
            <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} placeholder="Descreva o que precisa ser ajustado…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={aprovar.isPending}>Cancelar</Button>
          <Button variant="outline" className="gap-1 text-destructive hover:bg-destructive/10"
            onClick={() => aprovar.mutate(false)} disabled={aprovar.isPending}>
            <XCircle className="h-4 w-4" /> Rejeitar
          </Button>
          <Button className="gap-1" onClick={() => aprovar.mutate(true)} disabled={aprovar.isPending}>
            {aprovar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            Aprovar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConteudoPage() {
  const { profile } = useAuth();
  const clienteId = profile?.cliente_id;
  const [selected, setSelected] = useState<ConteudoRow | null>(null);

  const { data: conteudos = [], isLoading } = useQuery({
    queryKey: ["cliente", "conteudos", clienteId],
    enabled: !!clienteId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conteudos").select("*").eq("cliente_id", clienteId!)
        .order("data_postagem", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const pendentes = conteudos.filter((c) => c.status === "aprovacao");

  return (
    <div className="px-8 py-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Editorial</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Conteúdo</h1>
        {pendentes.length > 0 && (
          <p className="mt-1 text-sm font-medium text-orange-600">
            {pendentes.length} {pendentes.length === 1 ? "conteúdo aguarda" : "conteúdos aguardam"} sua aprovação
          </p>
        )}
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : conteudos.length === 0 ? (
        <EmptyState icon={<FileText className="h-6 w-6" />} title="Nenhum conteúdo ainda"
          description="Os conteúdos aparecem aqui conforme a equipe produzir." />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {conteudos.map((c) => (
            <div key={c.id} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{c.titulo ?? "Sem título"}</p>
                <p className="text-xs text-muted-foreground">
                  {c.rede ?? "—"} · {c.tipo ?? "—"}
                  {c.data_postagem && ` · ${format(new Date(c.data_postagem), "dd MMM", { locale: ptBR })}`}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[c.status] ?? "bg-muted text-muted-foreground"}`}>
                  {STATUS_LABELS[c.status] ?? c.status}
                </span>
                {c.status === "aprovacao" && (
                  <Button size="sm" onClick={() => setSelected(c)}>Revisar</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && <AprovacaoModal conteudo={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
