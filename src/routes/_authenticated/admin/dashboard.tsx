import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, UserCheck, FileCheck, Loader2, AlertCircle, ArrowRight, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  component: AdminDashboard,
  head: () => ({ meta: [{ title: "Dashboard — Tabgha Admin" }] }),
});

async function fetchDashboard() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const since = thirtyDaysAgo.toISOString().slice(0, 10);

  const [clientesRes, leadsRes, entregasRes, leadsTimelineRes, conteudosPendentesRes] = await Promise.all([
    supabase.from("clientes").select("id", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("leads").select("id", { count: "exact", head: true }),
    supabase.from("entregas").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    supabase.from("leads").select("criado_em").gte("criado_em", since).order("criado_em"),
    supabase.from("conteudos").select("id, titulo, status, clientes(nome)").in("status", ["briefing", "roteiro", "producao"]).order("criado_em", { ascending: false }).limit(5),
  ]);

  // Aggregate leads per day
  const dayMap: Record<string, number> = {};
  for (const l of leadsTimelineRes.data ?? []) {
    const d = (l.criado_em as string).slice(0, 10);
    dayMap[d] = (dayMap[d] ?? 0) + 1;
  }
  const leadsTimeline = Object.entries(dayMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date: date.slice(5), count }));

  return {
    clientes: clientesRes.count ?? 0,
    leads: leadsRes.count ?? 0,
    entregas_pendentes: entregasRes.count ?? 0,
    leadsTimeline,
    conteudosPendentes: (conteudosPendentesRes.data ?? []) as { id: string; titulo: string | null; status: string; clientes: { nome: string } | null }[],
  };
}

const STATUS_COLOR: Record<string, string> = {
  briefing: "bg-slate-100 text-slate-600",
  roteiro: "bg-blue-100 text-blue-700",
  producao: "bg-yellow-100 text-yellow-700",
};

function KpiCard({ label, value, icon: Icon, loading }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; loading: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-3">
        {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <p className="text-2xl font-bold tracking-tight">{value}</p>}
      </div>
    </div>
  );
}

function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: fetchDashboard,
    staleTime: 60_000,
  });

  return (
    <div className="px-6 py-6 space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Indicadores em tempo real da operação Tabgha</p>
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label="Clientes ativos"    value={data?.clientes ?? 0}           icon={UserCheck} loading={isLoading} />
        <KpiCard label="Total de leads"     value={data?.leads ?? 0}              icon={Users}     loading={isLoading} />
        <KpiCard label="Entregas pendentes" value={data?.entregas_pendentes ?? 0} icon={FileCheck} loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Leads trend sparkline */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Novos leads — 30 dias</p>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (data?.leadsTimeline ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sem dados no período</p>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data!.leadsTimeline} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, background: "var(--color-card)", border: "1px solid var(--color-border)", color: "var(--color-foreground)" }} />
                  <Line type="monotone" dataKey="count" name="Leads" stroke="#1E5CC8" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Priority actions */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <p className="text-sm font-semibold">Conteúdos em produção</p>
            </div>
            <Link to="/admin/estrategia" className="flex items-center gap-1 text-xs text-primary hover:underline">
              Ver tudo <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (data?.conteudosPendentes ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum conteúdo em produção</p>
          ) : (
            <div className="space-y-2">
              {data!.conteudosPendentes.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-lg bg-secondary/40 px-3 py-2">
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_COLOR[c.status] ?? "bg-muted text-muted-foreground")}>
                    {c.status}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.titulo ?? "Sem título"}</p>
                    <p className="text-[10px] text-muted-foreground">{c.clientes?.nome ?? "—"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
