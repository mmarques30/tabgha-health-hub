import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { format, isSameMonth, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cliente/calendario")({
  component: CalendarioPage,
  head: () => ({ meta: [{ title: "Calendário — Portal" }] }),
});

type EventItem = {
  id: string;
  date: string;
  title: string;
  type: "agendamento" | "conteudo";
  sub?: string;
};

function CalendarioPage() {
  const { profile } = useAuth();
  const clienteId = profile?.cliente_id;
  const [mesAtual, setMes] = useState(new Date());

  const from = startOfMonth(mesAtual).toISOString();
  const to = endOfMonth(mesAtual).toISOString();

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["cliente", "calendario", clienteId, mesAtual.toISOString().slice(0, 7)],
    enabled: !!clienteId,
    staleTime: 60_000,
    queryFn: async () => {
      const [agRes, contRes] = await Promise.all([
        supabase.from("agendamentos").select("id, titulo, inicio, tipo")
          .eq("cliente_id", clienteId!).eq("visivel_cliente", true)
          .gte("inicio", from).lte("inicio", to).order("inicio"),
        supabase.from("conteudos").select("id, titulo, data_postagem, rede, tipo")
          .eq("cliente_id", clienteId!)
          .not("data_postagem", "is", null).gte("data_postagem", from.slice(0, 10)).lte("data_postagem", to.slice(0, 10))
          .order("data_postagem"),
      ]);

      const items: EventItem[] = [];
      (agRes.data ?? []).forEach((a) => items.push({ id: a.id, date: a.inicio!, title: a.titulo ?? "Reunião", type: "agendamento", sub: a.tipo ?? undefined }));
      (contRes.data ?? []).forEach((c) => items.push({ id: c.id, date: c.data_postagem!, title: c.titulo ?? "Conteúdo", type: "conteudo", sub: `${c.rede ?? ""} ${c.tipo ?? ""}`.trim() }));
      return items.sort((a, b) => a.date.localeCompare(b.date));
    },
  });

  const navMes = (d: number) => setMes((m) => { const n = new Date(m); n.setMonth(n.getMonth() + d); return n; });

  return (
    <div className="px-8 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Agenda</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Calendário</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navMes(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-[120px] text-center text-sm font-medium capitalize">
            {format(mesAtual, "MMMM yyyy", { locale: ptBR })}
          </span>
          <Button variant="outline" size="icon" onClick={() => navMes(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : eventos.length === 0 ? (
        <EmptyState icon={<Calendar className="h-6 w-6" />} title="Nada agendado para este mês" />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {eventos.map((ev) => (
            <div key={`${ev.type}-${ev.id}`} className="flex items-center gap-4 px-5 py-4">
              <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-muted">
                <span className="text-sm font-bold leading-none">{format(new Date(ev.date), "dd")}</span>
                <span className="text-[10px] uppercase text-muted-foreground">{format(new Date(ev.date), "MMM", { locale: ptBR })}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{ev.title}</p>
                {ev.sub && <p className="text-xs text-muted-foreground">{ev.sub}</p>}
              </div>
              <Badge variant={ev.type === "agendamento" ? "default" : "secondary"} className="shrink-0 text-xs">
                {ev.type === "agendamento" ? "Reunião" : "Conteúdo"}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
