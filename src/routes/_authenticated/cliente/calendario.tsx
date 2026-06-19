import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { startOfMonth, endOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CalendarGrid, type CalEvent } from "@/components/CalendarGrid";

export const Route = createFileRoute("/_authenticated/cliente/calendario")({
  component: CalendarioPage,
  head: () => ({ meta: [{ title: "Calendário — Portal" }] }),
});

function CalendarioPage() {
  const { profile } = useAuth();
  const clienteId = profile?.cliente_id;
  const [refMonth, setRefMonth] = useState(new Date());

  const from = startOfMonth(refMonth).toISOString().slice(0, 10);
  const to = endOfMonth(refMonth).toISOString().slice(0, 10);

  const { data: events = [], isLoading } = useQuery<CalEvent[]>({
    queryKey: ["cliente", "calendario", clienteId, from, to],
    enabled: !!clienteId,
    staleTime: 60_000,
    queryFn: async () => {
      const [agRes, contRes] = await Promise.all([
        supabase
          .from("agendamentos")
          .select("id, titulo, inicio, tipo")
          .eq("cliente_id", clienteId!)
          .eq("visivel_cliente", true)
          .gte("inicio", from)
          .lte("inicio", to)
          .order("inicio"),
        supabase
          .from("conteudos")
          .select("id, titulo, data_postagem, rede, tipo")
          .eq("cliente_id", clienteId!)
          .not("data_postagem", "is", null)
          .gte("data_postagem", from)
          .lte("data_postagem", to)
          .order("data_postagem"),
      ]);

      const items: CalEvent[] = [];

      (agRes.data ?? []).forEach((a) =>
        items.push({
          id: a.id,
          date: a.inicio!.slice(0, 10),
          title: a.titulo ?? "Reunião",
          type: a.tipo?.toLowerCase().includes("grav") ? "gravacao" : "agendamento",
          sub: a.tipo ?? undefined,
        }),
      );

      (contRes.data ?? []).forEach((c) =>
        items.push({
          id: c.id,
          date: c.data_postagem!,
          title: c.titulo ?? "Conteúdo",
          type: "conteudo",
          sub: [c.rede, c.tipo].filter(Boolean).join(" · "),
        }),
      );

      return items.sort((a, b) => a.date.localeCompare(b.date));
    },
  });

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Page header */}
      <header className="animate-fade-up">
        <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-widest text-sky-700 mb-3">
          Agenda
        </span>
        <h1 className="text-xl font-bold tracking-tight">Calendário</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Gravações, reuniões e conteúdos agendados
        </p>
      </header>

      {/* Calendar panel */}
      <div
        className="animate-fade-up rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(11,27,62,0.18)]"
        style={{
          background: "linear-gradient(135deg, #0B1B3E 0%, #0F2550 100%)",
          animationDelay: "75ms",
        }}
      >
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-white/50" />
          </div>
        ) : (
          <CalendarGrid events={events} onMonthChange={setRefMonth} />
        )}
      </div>
    </div>
  );
}
