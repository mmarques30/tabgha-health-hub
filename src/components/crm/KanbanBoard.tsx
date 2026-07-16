import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { converterLeadComTicket, moverLeadStatus, type Lead } from "@/hooks/useLeads";
import { supabase } from "@/integrations/supabase/client";
import {
  CANAL_COLORS,
  COL_STYLES,
  MOTIVO_LABELS,
  PIPELINE,
  STATUS_LABELS,
  maskPhone,
  parseTicket,
  type PipelineStatus,
} from "@/lib/pipeline";
import { cn } from "@/lib/utils";

type KanbanBoardProps = {
  leads: Lead[];
  isAdmin?: boolean;
};

function LeadCardContent({ lead }: { lead: Lead }) {
  const timeAgo = formatDistanceToNow(new Date(lead.atualizado_em || lead.criado_em), {
    addSuffix: false,
    locale: ptBR,
  });

  return (
    <>
      <p className="truncate text-[13px] font-bold leading-snug text-foreground">
        {lead.nome ?? "Sem nome"}
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-muted-foreground">
          {maskPhone(lead.telefone)}
        </span>
        {lead.canal ? (
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide",
              CANAL_COLORS[lead.canal] ?? "bg-secondary text-muted-foreground",
            )}
          >
            {lead.canal}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[10.5px] text-muted-foreground/70">{timeAgo} atrás</p>
    </>
  );
}

function LeadCard({ lead, onOpen }: { lead: Lead; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      type="button"
      onClick={onOpen}
      className={cn(
        "w-full rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-all",
        "hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md",
        isDragging && "opacity-40",
        lead.status === "perdido" && "opacity-75",
      )}
    >
      <LeadCardContent lead={lead} />
    </button>
  );
}

function KanbanColumn({
  status,
  leads,
  onOpen,
}: {
  status: PipelineStatus;
  leads: Lead[];
  onOpen: (lead: Lead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const style = COL_STYLES[status];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex shrink-0 flex-col rounded-2xl border p-3",
        style.col,
        isOver ? "border-sky-400 ring-2 ring-sky-200" : "border-border/70",
      )}
      style={{ width: 236, minHeight: 360 }}
    >
      <div className="mb-3 flex items-center justify-between border-b border-black/[0.06] pb-3">
        <h3 className={cn("text-[11.5px] font-bold uppercase tracking-[0.05em]", style.header)}>
          {STATUS_LABELS[status]}
        </h3>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold shadow-sm">
          {leads.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2.5">
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onOpen={() => onOpen(lead)} />
        ))}
        {leads.length === 0 ? (
          <p className="m-auto text-center text-[11.5px] text-muted-foreground/50">
            Arraste um lead aqui
          </p>
        ) : null}
      </div>
    </div>
  );
}

function MotivoPerdaDialog({
  open,
  onCancel,
  onConfirm,
  loading,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: (motivo: string) => void;
  loading: boolean;
}) {
  const [motivo, setMotivo] = useState("");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Motivo da perda</DialogTitle>
        </DialogHeader>
        <select
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Selecione…</option>
          {Object.entries(MOTIVO_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            disabled={!motivo || loading}
            onClick={() => onConfirm(motivo)}
            className="bg-rose-600 hover:bg-rose-700"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Marcar perdido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LeadDetailDialog({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"dados" | "conversas">("dados");
  const [obs, setObs] = useState(lead.observacoes ?? "");
  const [status, setStatus] = useState(lead.status as PipelineStatus);
  const [motivo, setMotivo] = useState(lead.motivo_perda ?? "");
  const [ticket, setTicket] = useState(() => String(parseTicket(lead.observacoes) ?? ""));

  const { data: messages = [], isLoading: loadingMsgs } = useQuery({
    queryKey: ["lead-messages", lead.id],
    enabled: tab === "conversas",
    queryFn: async () => {
      const { data: convs, error: convError } = await supabase
        .from("whatsapp_conversations")
        .select("id")
        .eq("lead_id", lead.id);
      if (convError) throw convError;
      const ids = (convs ?? []).map((c) => c.id);
      if (ids.length === 0) return [];

      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .in("conversation_id", ids)
        .order("sent_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (status === "convertido" && ticket.trim()) {
        await converterLeadComTicket(lead.id, Number(ticket));
      } else {
        await moverLeadStatus(lead.id, status, status === "perdido" ? motivo : null);
      }
      const { error } = await supabase
        .from("leads")
        .update({ observacoes: obs || null })
        .eq("id", lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead atualizado");
      void qc.invalidateQueries({ queryKey: ["leads-kanban"] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao salvar"),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {lead.nome ?? "Lead"}
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                COL_STYLES[status]?.badge,
              )}
            >
              {STATUS_LABELS[status]}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 border-b border-border pb-2">
          {(["dados", "conversas"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize",
                tab === item
                  ? "bg-sky-100 text-sky-800"
                  : "text-muted-foreground hover:bg-secondary",
              )}
            >
              {item}
            </button>
          ))}
        </div>

        {tab === "dados" ? (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-secondary/40 px-3 py-2.5">
              <div>
                <span className="text-xs text-muted-foreground">Canal</span>
                <p className="mt-0.5 font-medium">{lead.canal ?? "—"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Telefone</span>
                <p className="mt-0.5 font-medium">{lead.telefone ?? "—"}</p>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground">Email</span>
                <p className="mt-0.5 font-medium">{lead.email ?? "—"}</p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Mover para</label>
              <select
                value={status}
                onChange={(e) => {
                  const next = e.target.value as PipelineStatus;
                  setStatus(next);
                  if (next !== "perdido") setMotivo("");
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {PIPELINE.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            {status === "perdido" ? (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Motivo</label>
                <select
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecione…</option>
                  {Object.entries(MOTIVO_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {status === "convertido" ? (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Ticket (R$)</label>
                <Input
                  type="number"
                  min={0}
                  value={ticket}
                  onChange={(e) => setTicket(e.target.value)}
                  placeholder="ex: 450"
                />
              </div>
            ) : null}

            <div>
              <label className="text-xs font-medium text-muted-foreground">Observações</label>
              <Textarea
                className="mt-1"
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {loadingMsgs ? (
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <MessageSquare className="h-5 w-5" />
                <p className="text-sm">Nenhuma conversa WhatsApp vinculada</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm",
                    msg.direction === "outbound"
                      ? "ml-8 bg-emerald-50 text-emerald-900"
                      : "mr-8 border border-border bg-card",
                  )}
                >
                  <p>{msg.body}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(msg.sent_at).toLocaleString("pt-BR")}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          {tab === "dados" ? (
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || (status === "perdido" && !motivo) || false}
            >
              {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FunilHeader({ leads }: { leads: Lead[] }) {
  const active = leads.filter((l) => l.status !== "perdido");
  const convertidos = leads.filter((l) => l.status === "convertido");
  const taxa = active.length > 0 ? Math.round((convertidos.length / active.length) * 100) : 0;

  const tickets = convertidos
    .map((l) => parseTicket(l.observacoes))
    .filter((n): n is number => n != null && !Number.isNaN(n));
  const ticketMedio =
    tickets.length > 0 ? tickets.reduce((a, b) => a + b, 0) / tickets.length : null;

  const novos = leads.filter((l) => l.status === "novo");
  const agendados = leads.filter(
    (l) => l.status === "agendado" || l.status === "atendido" || l.status === "convertido",
  );
  // heurística: média de horas entre criado e atualizado dos que já saíram de "novo"
  const tempos = leads
    .filter((l) => l.status !== "novo")
    .map((l) => (new Date(l.atualizado_em).getTime() - new Date(l.criado_em).getTime()) / 36e5)
    .filter((h) => h >= 0);
  const tempoMedio = tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : null;

  const cards = [
    { label: "Total no funil", value: String(active.length) },
    { label: "Taxa conversão", value: `${taxa}%` },
    {
      label: "Tempo médio novo→agendado",
      value: tempoMedio != null ? `${tempoMedio.toFixed(0)}h` : "—",
    },
    {
      label: "Ticket médio",
      value:
        ticketMedio != null
          ? ticketMedio.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
          : "—",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-border bg-card px-4 py-4 shadow-sm"
        >
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            {card.label}
          </p>
          <p className="mt-2 text-2xl font-black tracking-tight">{card.value}</p>
          {card.label.startsWith("Total") ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {novos.length} novos · {agendados.length} avançados
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function KanbanBoard({ leads }: KanbanBoardProps) {
  const qc = useQueryClient();
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [pendingPerda, setPendingPerda] = useState<{
    leadId: string;
  } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const grouped = useMemo(() => {
    return PIPELINE.reduce(
      (acc, status) => {
        acc[status] = leads.filter((l) => l.status === status);
        return acc;
      },
      {} as Record<PipelineStatus, Lead[]>,
    );
  }, [leads]);

  const move = useMutation({
    mutationFn: async ({
      leadId,
      novo,
      motivo,
    }: {
      leadId: string;
      novo: PipelineStatus;
      motivo?: string | null;
    }) => moverLeadStatus(leadId, novo, motivo),
    onSuccess: () => {
      toast.success("Lead movido");
      void qc.invalidateQueries({ queryKey: ["leads-kanban"] });
      setPendingPerda(null);
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao mover lead"),
  });

  function onDragStart(event: DragStartEvent) {
    const lead = event.active.data.current?.lead as Lead | undefined;
    setActiveLead(lead ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveLead(null);
    const lead = event.active.data.current?.lead as Lead | undefined;
    const overId = event.over?.id;
    if (!lead || !overId) return;

    const novo = String(overId) as PipelineStatus;
    if (!PIPELINE.includes(novo) || lead.status === novo) return;

    if (novo === "perdido") {
      setPendingPerda({ leadId: lead.id });
      return;
    }

    move.mutate({ leadId: lead.id, novo });
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div
          className="overflow-x-auto px-1"
          style={
            { scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" } as React.CSSProperties
          }
        >
          <div className="flex gap-3.5" style={{ minWidth: "max-content" }}>
            {PIPELINE.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                leads={grouped[status]}
                onOpen={setSelected}
              />
            ))}
          </div>
        </div>
        <DragOverlay>
          {activeLead ? (
            <div className="w-[212px] rounded-xl border border-sky-300 bg-card p-3 text-left shadow-lg">
              <LeadCardContent lead={activeLead} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {pendingPerda ? (
        <MotivoPerdaDialog
          key={pendingPerda.leadId}
          open
          loading={move.isPending}
          onCancel={() => setPendingPerda(null)}
          onConfirm={(motivo) => {
            move.mutate({ leadId: pendingPerda.leadId, novo: "perdido", motivo });
          }}
        />
      ) : null}

      {selected ? <LeadDetailDialog lead={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}
