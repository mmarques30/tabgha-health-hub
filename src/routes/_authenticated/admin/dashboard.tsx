import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, UserCheck, FileCheck, Loader2, AlertCircle, ArrowRight, TrendingUp, Zap } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { KpiCard } from "@/components/ui/kpi-card";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  component: AdminDashboard,
  head: () => ({ meta: [{ title: "Dashboard — Tabgha Admin" }] }),
});

async function fetchDashboard() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const since = thirtyDaysAgo.toISOString().slice(0, 10);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [clientesRes, leadsRes, leadsMonthRes, entregasRes, leadsTimelineRes, conteudosPendentesRes, clientesSaudeRes] = await Promise.all([
    supabase.from("clientes").select("id", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("leads").select("id", { count: "exact", head: true }),
    supabase.from("leads").select("id", { count: "exact", head: true }).gte("criado_em", startOfMonth.toISOString()),
    supabase.from("entregas").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    supabase.from("leads").select("criado_em").gte("criado_em", since).order("criado_em"),
    supabase.from("conteudos").select("id, titulo, status, clientes(nome)").in("status", ["briefing", "roteiro", "producao"]).order("criado_em", { ascending: false }).limit(5),
    supabase.from("clientes").select("id, nome, especialidade, status, leads(id, status, criado_em)").in("status", ["ativo", "onboarding", "pausa"]).order("nome").limit(8),
  ]);

  const dayMap: Record<string, number> = {};
  for (const l of leadsTimelineRes.data ?? []) {
    const d = (l.criado_em as string).slice(0, 10);
    dayMap[d] = (dayMap[d] ?? 0) + 1;
  }
  const leadsTimeline = Object.entries(dayMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date: date.slice(5), count }));

  const saudeCarteira = (clientesSaudeRes.data ?? []).map((c) => {
    const leads = (Array.isArray(c.leads) ? c.leads : []) as { id: string; status: string; criado_em: string }[];
    const total = leads.length;
    const mes = leads.filter((l) => l.criado_em >= startOfMonth.toISOString()).length;
    const conv = leads.filter((l) => l.status === "convertido").length;
    const ultimoLead = leads.length > 0 ? leads.sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0].criado_em : null;
    return { id: c.id, nome: c.nome, especialidade: c.especialidade, status: c.status, total, mes, conv, ultimoLead };
  });

  return {
    clientes: clientesRes.count ?? 0,
    leads: leadsRes.count ?? 0,
    leadsMes: leadsMonthRes.count ?? 0,
    entregas_pendentes: entregasRes.count ?? 0,
    leadsTimeline,
    conteudosPendentes: (conteudosPendentesRes.data ?? []) as { id: string; titulo: string | null; status: string; clientes: { nome: string } | null }[],
    saudeCarteira,
  };
}

const STATUS_COLOR: Record<string, string> = {
  briefing: "bg-slate-100 text-slate-600",
  roteiro: "bg-blue-100 text-blue-700",
  producao: "bg-yellow-100 text-yellow-700",
};

const CLIENTE_STATUS_BADGE: Record<string, string> = {
  ativo: "bg-green-100 text-green-700",
  onboarding: "bg-blue-100 text-blue-700",
  pausa: "bg-amber-100 text-amber-700",
  inativo: "bg-slate-100 text-slate-600",
};

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

      {/* KPI cards — 4 cols */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Clientes ativos"    value={data?.clientes ?? 0}           icon={UserCheck} loading={isLoading}
          delta={data ? { value: "+2", label: "vs mês ant.", direction: "up" } : undefined} />
        <KpiCard label="Leads no mês"       value={data?.leadsMes ?? 0}           icon={Zap}       loading={isLoading}
          accentColor="text-primary"
          delta={data ? { value: String(data.leads), label: "total", direction: "neutral" } : undefined} />
        <KpiCard label="Entregas pendentes" value={data?.entregas_pendentes ?? 0} icon={FileCheck}  loading={isLoading}
          accentColor={data && data.entregas_pendentes > 0 ? "text-amber-600" : undefined} />
        <KpiCard label="Total de leads"     value={data?.leads ?? 0}              icon={Users}      loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Area chart — leads 30 dias */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">Novos leads — 30 dias</p>
              <p className="text-xs text-muted-foreground mt-0.5">Evolução diária de captação</p>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary inline-block" />Leads <strong className="text-foreground">{data?.leadsMes ?? "—"}</strong></span>
            </div>
          </div>
          {isLoading ? (
            <div className="flex h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (data?.leadsTimeline ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-16 text-center">Sem dados no período</p>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data!.leadsTimeline} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1A5FAD" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#1A5FAD" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,27,53,0.05)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#9AA1B8" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: "#9AA1B8" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 10, background: "white", border: "1px solid rgba(15,27,53,0.08)", boxShadow: "0 4px 12px rgba(15,27,53,0.10)", color: "#0F1B35" }}
                    formatter={(v: number) => [v, "Leads"]}
                  />
                  <Area type="monotone" dataKey="count" name="Leads" stroke="#1A5FAD" strokeWidth={2.5} fill="url(#gradLeads)" dot={false} activeDot={{ r: 4, fill: "#1A5FAD", stroke: "white", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Conteúdos em produção */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <p className="text-sm font-bold">Conteúdos em produção</p>
            </div>
            <Link to="/admin/estrategia" className="flex items-center gap-1 text-xs text-primary hover:underline">
              Ver tudo <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {isLoading ? (
            <div className="flex h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (data?.conteudosPendentes ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-16 text-center">Nenhum conteúdo em produção</p>
          ) : (
            <div className="space-y-2">
              {data!.conteudosPendentes.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl bg-secondary/40 px-3 py-2.5">
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

      {/* Saúde da carteira */}
      <div className="rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(15,27,53,0.04)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <p className="text-sm font-bold">Saúde da carteira</p>
          </div>
          <Link to="/admin/clientes" className="flex items-center gap-1 text-xs text-primary hover:underline">
            Ver todos <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
                  {["Cliente", "Status", "Leads/mês", "Total", "Convertidos", "Último lead"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(data?.saudeCarteira ?? []).map((c) => (
                  <tr key={c.id} className="hover:bg-secondary/30 transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <Link to={"/admin/clientes/$id" as any} params={{ id: c.id } as any} className="block">
                        <p className="font-semibold text-foreground">{c.nome}</p>
                        <p className="text-[10.5px] text-muted-foreground mt-0.5">{c.especialidade ?? "—"}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold", CLIENTE_STATUS_BADGE[c.status] ?? "bg-muted text-muted-foreground")}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-primary" style={{ fontVariantNumeric: "tabular-nums" }}>{c.mes}</td>
                    <td className="px-4 py-3 text-foreground/70" style={{ fontVariantNumeric: "tabular-nums" }}>{c.total}</td>
                    <td className="px-4 py-3 font-medium text-green-700" style={{ fontVariantNumeric: "tabular-nums" }}>{c.conv}</td>
                    <td className="px-4 py-3 text-muted-foreground text-[11.5px]">
                      {c.ultimoLead ? formatDistanceToNow(new Date(c.ultimoLead), { addSuffix: true, locale: ptBR }) : "—"}
                    </td>
                  </tr>
                ))}
                {(data?.saudeCarteira ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum cliente cadastrado</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
