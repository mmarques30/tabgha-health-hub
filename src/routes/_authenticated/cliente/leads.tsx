import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Loader2, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cliente/leads")({
  component: LeadsPage,
  head: () => ({ meta: [{ title: "Leads — Portal" }] }),
});

type Lead = Tables<"leads">;

const PIPELINE = ["novo", "em_conversa", "interessado", "agendado", "atendido", "convertido", "perdido"] as const;
type PipelineStatus = (typeof PIPELINE)[number];

const STATUS_LABELS: Record<PipelineStatus, string> = {
  novo:        "Novo",
  em_conversa: "Em conversa",
  interessado: "Interessado",
  agendado:    "Agendado",
  atendido:    "Atendido",
  convertido:  "Convertido",
  perdido:     "Perdido",
};

// Column header + card tint per spec
const COL_STYLES: Record<PipelineStatus, { header: string; col: string; badge: string }> = {
  novo:        { header: "text-blue-800",   col: "bg-gradient-to-b from-blue-50/60 to-blue-50/10",     badge: "bg-blue-100 text-blue-700" },
  em_conversa: { header: "text-amber-800",  col: "bg-gradient-to-b from-amber-50/60 to-amber-50/10",   badge: "bg-amber-100 text-amber-700" },
  interessado: { header: "text-violet-800", col: "bg-gradient-to-b from-violet-50/60 to-violet-50/10", badge: "bg-violet-100 text-violet-700" },
  agendado:    { header: "text-cyan-800",   col: "bg-gradient-to-b from-cyan-50/60 to-cyan-50/10",     badge: "bg-cyan-100 text-cyan-700" },
  atendido:    { header: "text-teal-800",   col: "bg-gradient-to-b from-teal-50/60 to-teal-50/10",     badge: "bg-teal-100 text-teal-700" },
  convertido:  { header: "text-green-800",  col: "bg-gradient-to-b from-green-50/60 to-green-50/10",   badge: "bg-green-100 text-green-700" },
  perdido:     { header: "text-slate-600",  col: "bg-gradient-to-b from-slate-50/60 to-slate-50/10",   badge: "bg-slate-100 text-slate-600" },
};

const MOTIVO_LABELS: Record<string, string> = {
  sem_plano:     "Sem plano / orçamento",
  fora_regiao:   "Fora da região",
  sem_interesse: "Sem interesse",
  por_engano:    "Entrou por engano",
  nao_respondeu: "Não respondeu",
  outro:         "Outro",
};

// ── Lead Detail Modal ────────────────────────────────────────────────────────

function LeadModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const [obs, setObs] = useState(lead.observacoes ?? "");
  const [status, setStatus] = useState(lead.status as PipelineStatus);
  const [motivo, setMotivo] = useState<string>((lead as any).motivo_perda ?? "");
  const qc = useQueryClient();
  const { profile } = useAuth();

  const save = useMutation({
    mutationFn: async () => {
      const patch = { observacoes: obs, status, motivo_perda: status === "perdido" ? (motivo || null) : null };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("leads").update(patch as any).eq("id", lead.id).eq("cliente_id", profile!.cliente_id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead atualizado.");
      qc.invalidateQueries({ queryKey: ["cliente", "leads"] });
      onClose();
    },
    onError: () => toast.error("Erro ao salvar."),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {lead.nome ?? "Lead"}
            <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", COL_STYLES[status as PipelineStatus]?.badge ?? "bg-muted text-muted-foreground")}>
              {STATUS_LABELS[status as PipelineStatus] ?? status}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-secondary/40 px-3 py-2.5">
            <div><span className="text-muted-foreground text-xs">Canal</span><p className="font-medium mt-0.5">{lead.canal ?? "—"}</p></div>
            <div><span className="text-muted-foreground text-xs">Telefone</span><p className="font-medium mt-0.5">{lead.telefone ?? "—"}</p></div>
            <div className="col-span-2"><span className="text-muted-foreground text-xs">Email</span><p className="font-medium mt-0.5">{lead.email ?? "—"}</p></div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Mover para etapa</label>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value as PipelineStatus); if (e.target.value !== "perdido") setMotivo(""); }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {PIPELINE.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>
          {status === "perdido" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Motivo da perda</label>
              <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Selecione…</option>
                {Object.entries(MOTIVO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Observações</label>
            <Textarea className="mt-1" value={obs} onChange={(e) => setObs(e.target.value)} rows={3} placeholder="Anote informações relevantes…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Kanban Card ────────────────────────────────────────────────────────────────

function KanbanCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const timeAgo = formatDistanceToNow(new Date(lead.criado_em), { addSuffix: false, locale: ptBR });

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border border-border bg-card p-3 text-left",
        "shadow-[0_1px_0_rgba(15,27,53,0.02),0_1px_3px_rgba(15,27,53,0.04)]",
        "transition-all duration-150",
        "hover:-translate-y-0.5 hover:shadow-[0_6px_16px_-6px_rgba(15,27,53,0.12)] hover:border-primary/20",
        "cursor-pointer",
        lead.status === "perdido" && "opacity-75",
      )}
    >
      <p className="text-[13px] font-bold text-foreground leading-snug truncate">{lead.nome ?? "Sem nome"}</p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground truncate">{lead.telefone ?? lead.email ?? "—"}</span>
        {lead.canal && (
          <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[9.5px] font-semibold text-muted-foreground uppercase tracking-wide">
            {lead.canal}
          </span>
        )}
      </div>
      <p className="mt-2 text-[10.5px] text-muted-foreground/70">{timeAgo} atrás</p>
    </button>
  );
}

// ── Kanban Column ──────────────────────────────────────────────────────────────

function KanbanColumn({ status, leads, onCardClick }: { status: PipelineStatus; leads: Lead[]; onCardClick: (lead: Lead) => void }) {
  const style = COL_STYLES[status];

  return (
    <div className={cn("flex shrink-0 flex-col rounded-2xl border border-border/70 p-3", style.col)} style={{ width: 236, minHeight: 360 }}>
      {/* Column header */}
      <div className="mb-3 flex items-center justify-between border-b border-black/[0.06] pb-3">
        <h3 className={cn("text-[11.5px] font-bold uppercase tracking-[0.05em]", style.header)}>
          {STATUS_LABELS[status]}
        </h3>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-foreground shadow-sm font-variant-numeric">
          {leads.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2.5 flex-1">
        {leads.map((lead) => (
          <KanbanCard key={lead.id} lead={lead} onClick={() => onCardClick(lead)} />
        ))}
        {leads.length === 0 && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-[11.5px] text-muted-foreground/50 text-center">Nenhum lead nesta etapa</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Leads Page ────────────────────────────────────────────────────────────────

function LeadsPage() {
  const { profile } = useAuth();
  const clienteId = profile?.cliente_id;
  const [selected, setSelected] = useState<Lead | null>(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["cliente", "leads", clienteId],
    enabled: !!clienteId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads").select("*").eq("cliente_id", clienteId!).order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const grouped = PIPELINE.reduce<Record<PipelineStatus, Lead[]>>((acc, s) => {
    acc[s] = leads.filter((l) => l.status === s);
    return acc;
  }, {} as Record<PipelineStatus, Lead[]>);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border">
        <span className="eyebrow-pill">Captação</span>
        <div className="mt-2 flex items-baseline gap-3">
          <h1 className="text-xl font-bold tracking-tight">Leads</h1>
          <span className="text-sm text-muted-foreground">{leads.length} no total</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">Clique em qualquer card para ver detalhes ou mover de etapa</p>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : leads.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <EmptyState icon={<Users className="h-6 w-6" />} title="Nenhum lead ainda" description="Os leads chegam automaticamente via anúncios e WhatsApp." />
        </div>
      ) : (
        /* Kanban board — horizontal scroll */
        <div
          className="flex-1 overflow-x-auto px-6 py-5"
          style={{ scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
        >
          <div className="flex gap-3.5" style={{ minWidth: "max-content" }}>
            {PIPELINE.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                leads={grouped[status]}
                onCardClick={setSelected}
              />
            ))}
          </div>
        </div>
      )}

      {selected && <LeadModal lead={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
