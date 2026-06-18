import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Loader2 } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/cliente/leads")({
  component: LeadsPage,
  head: () => ({ meta: [{ title: "Leads — Portal" }] }),
});

type Lead = Tables<"leads">;

const STATUS_LABELS: Record<string, string> = {
  novo: "Novo", qualificado: "Qualificado", em_atendimento: "Em atendimento",
  agendado: "Agendado", convertido: "Convertido", perdido: "Perdido",
};
const STATUS_COLORS: Record<string, string> = {
  novo: "bg-blue-100 text-blue-700", qualificado: "bg-blue-100 text-blue-700",
  em_atendimento: "bg-yellow-100 text-yellow-700", agendado: "bg-yellow-100 text-yellow-700",
  convertido: "bg-green-100 text-green-700", perdido: "bg-red-100 text-red-700",
};

function LeadModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const [obs, setObs] = useState(lead.observacoes ?? "");
  const qc = useQueryClient();
  const { profile } = useAuth();

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leads").update({ observacoes: obs }).eq("id", lead.id).eq("cliente_id", profile!.cliente_id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Observação salva.");
      qc.invalidateQueries({ queryKey: ["cliente", "leads"] });
      onClose();
    },
    onError: () => toast.error("Erro ao salvar."),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{lead.nome ?? "Lead"}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-muted-foreground">Canal:</span> {lead.canal ?? "—"}</div>
            <div><span className="text-muted-foreground">Telefone:</span> {lead.telefone ?? "—"}</div>
            <div><span className="text-muted-foreground">Email:</span> {lead.email ?? "—"}</div>
            <div><span className="text-muted-foreground">Status:</span> {STATUS_LABELS[lead.status] ?? lead.status}</div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Observações</label>
            <Textarea className="mt-1" value={obs} onChange={(e) => setObs(e.target.value)} rows={4} />
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

  return (
    <div className="px-6 py-6 space-y-6">
      <div>
        <span className="eyebrow-pill">Captação</span>
        <h1 className="mt-2 text-xl font-bold tracking-tight">Leads</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">{leads.length} lead{leads.length !== 1 ? "s" : ""} no total</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : leads.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="Nenhum lead ainda" description="Os leads chegam automaticamente via anúncios e WhatsApp." />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {leads.map((lead) => (
            <button key={lead.id} onClick={() => setSelected(lead)}
              className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-muted/40 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{lead.nome ?? "Sem nome"}</p>
                <p className="text-xs text-muted-foreground">{lead.telefone ?? lead.email ?? "—"} · {lead.canal ?? "—"}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[lead.status] ?? "bg-muted text-muted-foreground"}`}>
                  {STATUS_LABELS[lead.status] ?? lead.status}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(lead.criado_em), "dd MMM", { locale: ptBR })}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && <LeadModal lead={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
