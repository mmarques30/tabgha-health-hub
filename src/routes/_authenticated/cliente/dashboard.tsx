import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, FileCheck, Calendar, TrendingUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/cliente/dashboard")({
  component: ClienteDashboard,
  head: () => ({ meta: [{ title: "Portal do Cliente — Tabgha" }] }),
});

function KpiCard({ label, value, icon: Icon, loading }: {
  label: string; value: number; icon: React.ComponentType<{ className?: string }>; loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-3">
        {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
        )}
      </div>
    </div>
  );
}

function ClienteDashboard() {
  const { profile } = useAuth();
  const clienteId = profile?.cliente_id;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: counts, isLoading: loadingCounts } = useQuery({
    queryKey: ["cliente", "dashboard", "counts", clienteId],
    enabled: !!clienteId,
    staleTime: 60_000,
    queryFn: async () => {
      const [leadsRes, novosMesRes, entregasRes] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("cliente_id", clienteId!),
        supabase.from("leads").select("id", { count: "exact", head: true })
          .eq("cliente_id", clienteId!).gte("criado_em", startOfMonth.toISOString()),
        supabase.from("entregas").select("id", { count: "exact", head: true })
          .eq("cliente_id", clienteId!).eq("status", "pendente"),
      ]);
      return {
        leads: leadsRes.count ?? 0,
        novos_mes: novosMesRes.count ?? 0,
        entregas_pendentes: entregasRes.count ?? 0,
      };
    },
  });

  const { data: proximos, isLoading: loadingAgendamentos } = useQuery({
    queryKey: ["cliente", "dashboard", "agendamentos", clienteId],
    enabled: !!clienteId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("agendamentos")
        .select("id, titulo, inicio, tipo")
        .eq("cliente_id", clienteId!)
        .eq("visivel_cliente", true)
        .gte("inicio", new Date().toISOString())
        .order("inicio")
        .limit(3);
      return data ?? [];
    },
  });

  return (
    <div className="px-8 py-8">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Portal do cliente</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão geral da sua operação de marketing.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Leads totais"         value={counts?.leads ?? 0}              icon={Users}      loading={loadingCounts} />
        <KpiCard label="Novos este mês"       value={counts?.novos_mes ?? 0}          icon={TrendingUp} loading={loadingCounts} />
        <KpiCard label="Entregas pendentes"   value={counts?.entregas_pendentes ?? 0} icon={FileCheck}  loading={loadingCounts} />
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Próximos agendamentos</h2>
        {loadingAgendamentos ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : proximos?.length === 0 ? (
          <EmptyState icon={<Calendar className="h-5 w-5" />} title="Nenhum agendamento próximo" />
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border">
            {proximos?.map((ag) => (
              <div key={ag.id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-muted text-xs font-semibold">
                  {ag.inicio ? format(new Date(ag.inicio), "dd\nMMM", { locale: ptBR }).split("\n").map((l, i) => (
                    <span key={i} className={i === 0 ? "text-sm font-bold" : "text-[10px] uppercase text-muted-foreground"}>{l}</span>
                  )) : "—"}
                </div>
                <div>
                  <p className="text-sm font-medium">{ag.titulo}</p>
                  <p className="text-xs text-muted-foreground">{ag.tipo ?? "Reunião"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
