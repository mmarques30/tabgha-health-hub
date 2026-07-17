import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { differenceInDays, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  AnalyticsFilters,
  defaultAnalyticsFilters,
  type AnalyticsFiltersValue,
} from "@/components/analytics/AnalyticsFilters";
import {
  FunnelBars,
  InsightStack,
  Panel,
  RankedBarChart,
  StatusChips,
  StoryBanner,
} from "@/components/analytics/InsightPanel";
import { SubTabs } from "@/components/analytics/SubTabs";
import { useClientesOptions } from "@/hooks/useClientesOptions";
import {
  buildFunnelInsights,
  buildHeadline,
  buildRankingInsights,
  countByStatus,
  fmtMoneyCompact,
  funnelStages,
  insightFromGap,
} from "@/lib/analytics-insights";
import { calcCaq } from "@/lib/analytics-range";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  component: AdminDashboard,
  head: () => ({ meta: [{ title: "Dashboard — Tabgha Admin" }] }),
});

type TabId = "visao" | "performance" | "entregas" | "oportunidades";

const CLIENTE_STATUS: Record<string, { dot: string; label: string; text: string }> = {
  ativo: { dot: "bg-emerald-400", label: "Ativo", text: "text-emerald-700" },
  onboarding: { dot: "bg-sky-400", label: "Onboarding", text: "text-sky-700" },
  pausa: { dot: "bg-amber-400", label: "Pausa", text: "text-amber-700" },
  inativo: { dot: "bg-slate-400", label: "Inativo", text: "text-slate-600" },
};

function ultimoLeadColor(d: string | null) {
  if (!d) return "text-muted-foreground/40";
  const days = differenceInDays(new Date(), new Date(d));
  if (days <= 7) return "font-semibold text-emerald-600";
  if (days <= 30) return "text-amber-600";
  return "text-rose-500";
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
      <p className="mb-0.5 text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-foreground">{payload[0].value} leads</p>
    </div>
  );
}

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function AdminDashboard() {
  const [tab, setTab] = useState<TabId>("visao");
  const [filters, setFilters] = useState<AnalyticsFiltersValue>(defaultAnalyticsFilters("30d"));
  const { data: clientesOptions = [] } = useClientesOptions();

  const { data: clientesFull = [] } = useQuery({
    queryKey: ["admin", "dashboard", "clientes-cat"],
    staleTime: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, especialidade, status")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const categorias = useMemo(
    () => [...new Set(clientesFull.map((c) => c.especialidade).filter(Boolean) as string[])].sort(),
    [clientesFull],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "dashboard", filters],
    staleTime: 60_000,
    queryFn: async () => {
      const { since, until } = filters.range;
      const sinceIso = `${since}T00:00:00.000Z`;
      const untilIso = `${until}T23:59:59.999Z`;

      let leadsQ = supabase
        .from("leads")
        .select("id, cliente_id, status, canal, criado_em, clientes(nome, especialidade)")
        .gte("criado_em", sinceIso)
        .lte("criado_em", untilIso);
      if (filters.clienteId) leadsQ = leadsQ.eq("cliente_id", filters.clienteId);

      let metricasQ = supabase
        .from("metricas_ads")
        .select(
          "cliente_id, data, investimento, leads, plataforma, campanha, clientes(nome, especialidade)",
        )
        .gte("data", since)
        .lte("data", until);
      if (filters.clienteId) metricasQ = metricasQ.eq("cliente_id", filters.clienteId);
      if (filters.plataforma) metricasQ = metricasQ.eq("plataforma", filters.plataforma);

      let entregasQ = supabase
        .from("entregas")
        .select("id, cliente_id, status, titulo, criado_em, clientes(nome, especialidade)")
        .order("criado_em", { ascending: false })
        .limit(40);
      if (filters.clienteId) entregasQ = entregasQ.eq("cliente_id", filters.clienteId);

      const [clientesRes, leadsRes, metricasRes, entregasRes, conteudosRes, saudeRes] =
        await Promise.all([
          supabase
            .from("clientes")
            .select("id", { count: "exact", head: true })
            .eq("status", "ativo"),
          leadsQ,
          metricasQ,
          entregasQ,
          supabase
            .from("conteudos")
            .select("id, titulo, status, clientes(nome)")
            .in("status", ["briefing", "roteiro", "producao"])
            .order("criado_em", { ascending: false })
            .limit(8),
          supabase
            .from("clientes")
            .select("id, nome, especialidade, status, leads(id, status, criado_em)")
            .in("status", ["ativo", "onboarding", "pausa"])
            .order("nome")
            .limit(20),
        ]);

      let leads = leadsRes.data ?? [];
      let metricas = metricasRes.data ?? [];
      let entregas = entregasRes.data ?? [];

      if (filters.categoria) {
        leads = leads.filter(
          (l) =>
            (l.clientes as { especialidade?: string } | null)?.especialidade === filters.categoria,
        );
        metricas = metricas.filter(
          (m) =>
            (m.clientes as { especialidade?: string } | null)?.especialidade === filters.categoria,
        );
        entregas = entregas.filter(
          (e) =>
            (e.clientes as { especialidade?: string } | null)?.especialidade === filters.categoria,
        );
      }

      const dayMap: Record<string, number> = {};
      for (const l of leads) {
        const d = (l.criado_em as string).slice(0, 10);
        dayMap[d] = (dayMap[d] ?? 0) + 1;
      }
      const leadsTimeline = Object.entries(dayMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => ({ date: date.slice(5), count }));

      const investDayMap: Record<string, { investimento: number; leadsAds: number }> = {};
      for (const m of metricas) {
        const d = String(m.data).slice(0, 10);
        const prev = investDayMap[d] ?? { investimento: 0, leadsAds: 0 };
        prev.investimento += Number(m.investimento ?? 0);
        prev.leadsAds += Number(m.leads ?? 0);
        investDayMap[d] = prev;
      }
      const investTimeline = Object.entries(investDayMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, row]) => ({
          date: date.slice(5),
          investimento: Math.round(row.investimento),
          leadsAds: row.leadsAds,
        }));

      const invest = metricas.reduce((s, m) => s + Number(m.investimento ?? 0), 0);
      const leadsAds = metricas.reduce((s, m) => s + Number(m.leads ?? 0), 0);

      const perfMap = new Map<
        string,
        { nome: string; investimento: number; leadsAds: number; leadsCrm: number }
      >();
      for (const m of metricas) {
        const nome =
          (m.clientes as { nome?: string } | null)?.nome ?? String(m.cliente_id).slice(0, 8);
        const prev = perfMap.get(m.cliente_id as string) ?? {
          nome,
          investimento: 0,
          leadsAds: 0,
          leadsCrm: 0,
        };
        prev.investimento += Number(m.investimento ?? 0);
        prev.leadsAds += Number(m.leads ?? 0);
        perfMap.set(m.cliente_id as string, prev);
      }
      for (const l of leads) {
        const nome =
          (l.clientes as { nome?: string } | null)?.nome ?? String(l.cliente_id).slice(0, 8);
        const prev = perfMap.get(l.cliente_id) ?? {
          nome,
          investimento: 0,
          leadsAds: 0,
          leadsCrm: 0,
        };
        prev.leadsCrm += 1;
        perfMap.set(l.cliente_id, prev);
      }

      const performance = Array.from(perfMap.entries())
        .map(([id, row]) => ({
          id,
          ...row,
          caq: calcCaq(row.investimento, row.leadsCrm > 0 ? row.leadsCrm : row.leadsAds),
        }))
        .sort((a, b) => b.investimento - a.investimento);

      const entregasByCliente = new Map<
        string,
        { nome: string; pendente: number; total: number }
      >();
      for (const e of entregas) {
        const nome =
          (e.clientes as { nome?: string } | null)?.nome ?? String(e.cliente_id).slice(0, 8);
        const prev = entregasByCliente.get(e.cliente_id as string) ?? {
          nome,
          pendente: 0,
          total: 0,
        };
        prev.total += 1;
        if (e.status === "pendente" || e.status === "em_revisao") prev.pendente += 1;
        entregasByCliente.set(e.cliente_id as string, prev);
      }

      const oportunidades = leads.reduce(
        (acc, l) => {
          acc.total += 1;
          if (l.status === "novo") acc.novos += 1;
          else if (l.status === "convertido") acc.convertidos += 1;
          else acc.qualificacao += 1;
          return acc;
        },
        { total: 0, novos: 0, qualificacao: 0, convertidos: 0 },
      );

      const saudeCarteira = (saudeRes.data ?? []).map((c) => {
        const leadsC = (Array.isArray(c.leads) ? c.leads : []) as {
          id: string;
          status: string;
          criado_em: string;
        }[];
        const total = leadsC.length;
        const mes = leadsC.filter((l) => l.criado_em >= sinceIso).length;
        const conv = leadsC.filter((l) => l.status === "convertido").length;
        const ultimoLead =
          leadsC.length > 0
            ? leadsC.sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0].criado_em
            : null;
        return {
          id: c.id,
          nome: c.nome,
          especialidade: c.especialidade,
          status: c.status,
          total,
          mes,
          conv,
          ultimoLead,
        };
      });

      return {
        clientesAtivos: clientesRes.count ?? 0,
        leadsPeriodo: leads.length,
        invest,
        leadsAds,
        caq: calcCaq(invest, leads.length > 0 ? leads.length : leadsAds),
        entregasPendentes: entregas.filter((e) => e.status === "pendente").length,
        leadsTimeline,
        conteudosPendentes: (conteudosRes.data ?? []) as {
          id: string;
          titulo: string | null;
          status: string;
          clientes: { nome: string } | null;
        }[],
        performance,
        entregasByCliente: Array.from(entregasByCliente.entries()).map(([id, row]) => ({
          id,
          ...row,
        })),
        oportunidades,
        saudeCarteira,
        leadStatuses: leads.map((l) => ({
          status: l.status as string,
          canal: l.canal as string | null,
        })),
        investTimeline,
        perdidos: leads.filter((l) => l.status === "perdido").length,
        convertidos: leads.filter((l) => l.status === "convertido").length,
      };
    },
  });

  const headline = buildHeadline({
    invest: data?.invest ?? 0,
    leadsCrm: data?.leadsPeriodo ?? 0,
    leadsAds: data?.leadsAds ?? 0,
    caq: data?.caq ?? null,
    convertidos: data?.convertidos ?? 0,
    perdidos: data?.perdidos ?? 0,
  });
  const funnel = funnelStages(data?.leadStatuses ?? []);
  const statusBreakdown = countByStatus(data?.leadStatuses ?? []);
  const funnelInsights = buildFunnelInsights(data?.leadStatuses ?? []);
  const rankingInsights = buildRankingInsights(
    (data?.performance ?? []).map((r) => ({
      nome: r.nome,
      investimento: r.investimento,
      leads: r.leadsCrm > 0 ? r.leadsCrm : r.leadsAds,
      caq: r.caq,
    })),
  );
  const adsCrmGap = insightFromGap(data?.leadsAds ?? 0, data?.leadsPeriodo ?? 0);

  const stageCounts = {
    briefing: data?.conteudosPendentes.filter((c) => c.status === "briefing").length ?? 0,
    roteiro: data?.conteudosPendentes.filter((c) => c.status === "roteiro").length ?? 0,
    producao: data?.conteudosPendentes.filter((c) => c.status === "producao").length ?? 0,
  };
  const stageTotal = stageCounts.briefing + stageCounts.roteiro + stageCounts.producao;

  return (
    <div className="space-y-4 px-6 py-6">
      <header className="animate-fade-up flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Visão gerencial em linguagem clara — o que está acontecendo na operação
          </p>
        </div>
        <AnalyticsFilters
          value={filters}
          onChange={setFilters}
          clientes={clientesOptions}
          categorias={categorias}
          showPlataforma
        />
      </header>

      <SubTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "visao", label: "Visão geral" },
          { id: "performance", label: "Performance por cliente" },
          { id: "entregas", label: "Entregas por cliente" },
          { id: "oportunidades", label: "Oportunidades" },
        ]}
      />

      {tab === "visao" ? (
        <>
          {!isLoading ? <StoryBanner {...headline} /> : null}
          {adsCrmGap ? (
            <InsightStack items={[{ title: "Ads × funil", body: adsCrmGap, tone: "info" }]} />
          ) : null}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                rank: "01",
                label: "Clientes ativos",
                value: data?.clientesAtivos ?? 0,
                accent: "text-primary",
                bar: "bg-primary",
              },
              {
                rank: "02",
                label: "Leads no período",
                value: data?.leadsPeriodo ?? 0,
                accent: "text-sky-700",
                bar: "bg-sky-500",
              },
              {
                rank: "03",
                label: "Investimento mídia",
                value: data ? fmtMoney(data.invest) : "—",
                accent: "text-foreground",
                bar: "bg-slate-400",
              },
              {
                rank: "04",
                label: "CAQ",
                value: data?.caq != null ? fmtMoney(data.caq) : "—",
                accent: "text-sky-800",
                bar: "bg-sky-600",
              },
            ].map((card, i) => (
              <div
                key={card.rank}
                className="card-lift animate-fade-up flex flex-col rounded-2xl border border-border bg-card px-5 pb-4 pt-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)]"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <span className="mb-4 text-[9px] font-black tracking-[0.16em] text-muted-foreground/40">
                  {card.rank}
                </span>
                <p
                  className={cn(
                    "text-[2rem] font-black leading-none tracking-tighter",
                    card.accent,
                  )}
                >
                  {isLoading ? (
                    <span className="inline-block h-9 w-16 animate-pulse rounded-lg bg-secondary align-middle" />
                  ) : (
                    card.value
                  )}
                </p>
                <p className="mt-2 text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {card.label}
                </p>
                <div className={cn("mt-4 h-0.5 w-full rounded-full", card.bar)} />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel
              title="Investimento × leads Ads"
              subtitle="Quanto entrou de mídia e quantos leads o Ads reportou"
              tone="soft"
            >
              {(data?.investTimeline ?? []).length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Sem mídia no período
                </p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data!.investTimeline}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(15,27,53,0.06)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 9, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 9, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 9, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip />
                      <Legend />
                      <Bar
                        yAxisId="left"
                        dataKey="investimento"
                        name="Invest. (R$)"
                        fill="#0369a1"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        yAxisId="right"
                        dataKey="leadsAds"
                        name="Leads Ads"
                        fill="#7dd3fc"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
            <Panel title="Funil em uma olhada" subtitle="Para explicar ao médico sem jargão">
              <FunnelBars stages={funnel} />
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
            <div className="animate-fade-up overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-slate-50 via-white to-sky-50/70 shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
              <div className="flex items-start justify-between px-6 pb-2 pt-5">
                <div>
                  <p className="text-base font-bold text-foreground">Novos leads</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Evolução diária no período filtrado
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-sky-800">{data?.leadsPeriodo ?? "—"}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">no filtro</p>
                </div>
              </div>

              {isLoading ? (
                <div className="flex h-48 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (data?.leadsTimeline ?? []).length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center gap-2">
                  <TrendingUp className="h-6 w-6 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Sem dados no período</p>
                </div>
              ) : (
                <div className="h-48 px-2 pb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={data!.leadsTimeline}
                      margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="gradLeadsLight" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0284c7" stopOpacity={0.28} />
                          <stop offset="100%" stopColor="#0284c7" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(15,27,53,0.06)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 9, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 9, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#0369a1"
                        strokeWidth={2.5}
                        fill="url(#gradLeadsLight)"
                        dot={false}
                        activeDot={{ r: 4, fill: "#0369a1", stroke: "#fff", strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="animate-fade-up flex flex-col rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold">Pipeline editorial</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {stageTotal} em produção
                  </p>
                </div>
                <Link
                  to="/admin/estrategia"
                  className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                >
                  Ver tudo <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="flex-1 space-y-4">
                {[
                  {
                    key: "briefing",
                    label: "Briefing",
                    count: stageCounts.briefing,
                    color: "bg-slate-400",
                  },
                  {
                    key: "roteiro",
                    label: "Roteiro",
                    count: stageCounts.roteiro,
                    color: "bg-primary",
                  },
                  {
                    key: "producao",
                    label: "Produção",
                    count: stageCounts.producao,
                    color: "bg-amber-400",
                  },
                ].map(({ key, label, count, color }) => {
                  const pct = stageTotal > 0 ? Math.round((count / stageTotal) * 100) : 0;
                  return (
                    <div key={key}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs font-semibold">{label}</span>
                        <span className="text-xs font-bold tabular-nums">{count}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className={cn("h-full rounded-full transition-all duration-700", color)}
                          style={{
                            width: stageTotal === 0 ? "100%" : `${pct}%`,
                            opacity: stageTotal === 0 ? 0.2 : 1,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <p className="text-sm font-bold">Saúde da carteira</p>
              <Link
                to="/admin/clientes"
                className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
              >
                Ver todos <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/20 text-[9.5px] font-black uppercase tracking-[0.1em] text-muted-foreground/60">
                    <th className="px-6 py-2.5 text-left">Cliente</th>
                    <th className="px-4 py-2.5 text-left">Status</th>
                    <th className="px-4 py-2.5 text-right">Leads/filtro</th>
                    <th className="px-4 py-2.5 text-left">Conversão</th>
                    <th className="px-4 py-2.5 text-left">Último lead</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(data?.saudeCarteira ?? []).slice(0, 8).map((c) => {
                    const pct = c.total > 0 ? Math.round((c.conv / c.total) * 100) : 0;
                    const st = CLIENTE_STATUS[c.status] ?? CLIENTE_STATUS.inativo;
                    return (
                      <tr key={c.id} className="transition-colors hover:bg-secondary/30">
                        <td className="px-6 py-3.5">
                          <Link
                            to={"/admin/clientes/$id" as never}
                            params={{ id: c.id } as never}
                            className="font-semibold text-[13px] hover:text-primary"
                          >
                            {c.nome}
                          </Link>
                          <p className="text-[10.5px] text-muted-foreground">
                            {c.especialidade ?? "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", st.dot)} />
                            <span className={cn("text-[11px] font-semibold", st.text)}>
                              {st.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right text-base font-extrabold tabular-nums text-sky-800">
                          {c.mes}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-[11px] font-bold tabular-nums text-emerald-600">
                            {pct}%
                          </span>
                        </td>
                        <td
                          className={cn("px-4 py-3.5 text-[11.5px]", ultimoLeadColor(c.ultimoLead))}
                        >
                          {c.ultimoLead
                            ? formatDistanceToNow(new Date(c.ultimoLead), {
                                addSuffix: true,
                                locale: ptBR,
                              })
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {tab === "performance" ? (
        <div className="space-y-4">
          <InsightStack items={rankingInsights} />
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="Investimento por clínica"
              subtitle="Quem está recebendo mais mídia"
              tone="soft"
            >
              <RankedBarChart
                data={(data?.performance ?? []).slice(0, 8).map((r) => ({
                  name: r.nome.length > 18 ? `${r.nome.slice(0, 16)}…` : r.nome,
                  value: Math.round(r.investimento),
                }))}
                formatValue={(v) => fmtMoneyCompact(v)}
              />
            </Panel>
            <Panel
              title="CAQ por clínica"
              subtitle="Quanto custa cada lead — menor é melhor"
              tone="soft"
            >
              <RankedBarChart
                data={(data?.performance ?? [])
                  .filter((r) => r.caq != null)
                  .sort((a, b) => (a.caq ?? 0) - (b.caq ?? 0))
                  .slice(0, 8)
                  .map((r) => ({
                    name: r.nome.length > 18 ? `${r.nome.slice(0, 16)}…` : r.nome,
                    value: Math.round(r.caq ?? 0),
                  }))}
                color={["#10b981", "#34d399", "#60a5fa", "#0369a1", "#f59e0b", "#f43f5e"]}
                formatValue={(v) => fmtMoneyCompact(v)}
              />
            </Panel>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/50 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 text-left">Cliente</th>
                  <th className="px-4 py-2.5 text-right">Investimento</th>
                  <th className="px-4 py-2.5 text-right">Leads Ads</th>
                  <th className="px-4 py-2.5 text-right">Leads CRM</th>
                  <th className="px-4 py-2.5 text-right">CAQ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(data?.performance ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      Sem performance no filtro. Sincronize Marketing Pago.
                    </td>
                  </tr>
                ) : (
                  data!.performance.map((row) => (
                    <tr key={row.id} className="hover:bg-secondary/30">
                      <td className="px-4 py-3 font-medium">{row.nome}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmtMoney(row.investimento)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.leadsAds}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.leadsCrm}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.caq != null ? fmtMoney(row.caq) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "entregas" ? (
        <div className="space-y-4">
          <InsightStack
            items={[
              {
                title:
                  (data?.entregasPendentes ?? 0) > 0
                    ? "Há entregas esperando resposta"
                    : "Fila de entregas sob controle",
                body:
                  (data?.entregasPendentes ?? 0) > 0
                    ? `${data!.entregasPendentes} itens pendentes ou em revisão. Clínicas com backlog alto precisam de prioridade da operação.`
                    : "Nenhuma entrega crítica no filtro atual — bom momento para acelerar novos conteúdos.",
                tone: (data?.entregasPendentes ?? 0) > 0 ? "warn" : "good",
              },
            ]}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Backlog por clínica" subtitle="Pendentes + em revisão" tone="soft">
              <RankedBarChart
                data={(data?.entregasByCliente ?? [])
                  .sort((a, b) => b.pendente - a.pendente)
                  .slice(0, 8)
                  .map((r) => ({
                    name: r.nome.length > 18 ? `${r.nome.slice(0, 16)}…` : r.nome,
                    value: r.pendente,
                  }))}
                color="#f59e0b"
              />
            </Panel>
            <Panel title="Volume recente" subtitle="Total de entregas no recorte">
              <RankedBarChart
                data={(data?.entregasByCliente ?? [])
                  .sort((a, b) => b.total - a.total)
                  .slice(0, 8)
                  .map((r) => ({
                    name: r.nome.length > 18 ? `${r.nome.slice(0, 16)}…` : r.nome,
                    value: r.total,
                  }))}
                color="#0284c7"
              />
            </Panel>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/50 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 text-left">Cliente</th>
                  <th className="px-4 py-2.5 text-right">Pendentes</th>
                  <th className="px-4 py-2.5 text-right">Total recentes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(data?.entregasByCliente ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                      Nenhuma entrega no filtro.
                    </td>
                  </tr>
                ) : (
                  data!.entregasByCliente.map((row) => (
                    <tr key={row.id} className="hover:bg-secondary/30">
                      <td className="px-4 py-3 font-medium">{row.nome}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-amber-700">
                        {row.pendente}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.total}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "oportunidades" ? (
        <div className="space-y-4">
          <StoryBanner
            title={
              (data?.oportunidades.total ?? 0) === 0
                ? "Nenhuma oportunidade no filtro"
                : `${data!.oportunidades.total} oportunidades em jogo`
            }
            body={
              (data?.oportunidades.total ?? 0) === 0
                ? "Sem leads neste recorte. Ajuste período ou confirme captura (Meta/WhatsApp)."
                : `${data!.oportunidades.novos} ainda novos, ${data!.oportunidades.qualificacao} em conversa/qualificação e ${data!.oportunidades.convertidos} já convertidos. O funil abaixo mostra onde a equipe deve agir.`
            }
            tone={
              (data?.oportunidades.novos ?? 0) > (data?.oportunidades.convertidos ?? 0) * 3
                ? "warn"
                : "info"
            }
          />
          <InsightStack items={funnelInsights} />
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Funil completo" subtitle="Da entrada ao paciente" tone="soft">
              <FunnelBars stages={funnel} />
            </Panel>
            <Panel title="Distribuição por status" subtitle="Onde cada lead está agora">
              <StatusChips items={statusBreakdown} />
            </Panel>
          </div>
          <Link
            to="/admin/leads"
            search={{
              periodo: 30,
              canal: "",
              cliente: filters.clienteId ?? "",
              q: "",
            }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline"
          >
            Abrir funil de leads <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
