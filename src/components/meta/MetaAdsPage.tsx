import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMetaInsights } from "@/hooks/useMetaInsights";
import { useAuth } from "@/lib/auth";
import { useClientesOptions } from "@/hooks/useClientesOptions";
import { defaultRange, formatCurrency, getLeads, META_TOOLTIP_STYLE } from "@/lib/types";

type MetaAdsPageProps = {
  isAdmin?: boolean;
  fixedClienteId?: string | null;
};

type InsightRow = {
  spend?: string;
  ctr?: string;
  cpm?: string;
  actions?: Array<{ action_type?: string; value?: string }>;
  date_start?: string;
  campaign_name?: string;
};

const KPI_CARDS = [
  { rank: "01", label: "Investimento", key: "spend" as const, format: (v: number) => formatCurrency(v), accent: "bg-amber-500" },
  { rank: "02", label: "Leads", key: "leads" as const, format: (v: number) => String(v), accent: "bg-amber-500" },
  { rank: "03", label: "CTR", key: "ctr" as const, format: (v: number) => `${v.toFixed(2)}%`, accent: "bg-amber-500" },
  { rank: "04", label: "CPM", key: "cpm" as const, format: (v: number) => formatCurrency(v), accent: "bg-amber-500" },
];

export function MetaAdsPage({ isAdmin = false, fixedClienteId = null }: MetaAdsPageProps) {
  const { profile } = useAuth();
  const [range, setRange] = useState(defaultRange(7));
  const [clienteId, setClienteId] = useState<string | null>(fixedClienteId);
  const { data: clientesOptions = [] } = useClientesOptions();
  const activeClienteId = fixedClienteId ?? clienteId ?? profile?.cliente_id ?? null;

  const overview = useMetaInsights(
    activeClienteId
      ? {
          cliente_id: activeClienteId,
          action: "overview",
          since: range.since,
          until: range.until,
        }
      : null,
  );

  const daily = useMetaInsights(
    activeClienteId
      ? {
          cliente_id: activeClienteId,
          action: "daily_insights",
          since: range.since,
          until: range.until,
        }
      : null,
  );

  const accountInsight = ((overview.data as { account?: InsightRow[] })?.account ?? [])[0];
  const campaignInsights = ((overview.data as { campaigns?: InsightRow[] })?.campaigns ?? []).slice(
    0,
    5,
  );
  const dailyInsights = ((daily.data as { insights?: InsightRow[] })?.insights ?? []) as InsightRow[];

  const totals = useMemo(() => {
    const spend = Number(accountInsight?.spend ?? 0);
    const leads = getLeads(accountInsight?.actions);
    const ctr = Number(accountInsight?.ctr ?? 0);
    const cpm = Number(accountInsight?.cpm ?? 0);
    return { spend, leads, ctr, cpm };
  }, [accountInsight]);

  if (!activeClienteId && !isAdmin) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Configuração</p>
        <p className="text-sm text-muted-foreground">
          Este cliente ainda não possui credenciais Meta em automacoes.meta. Fale com a Tabgha para
          configurar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && !fixedClienteId && (
            <select
              value={clienteId ?? ""}
              onChange={(e) => setClienteId(e.target.value || null)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Selecione um cliente…</option>
              {clientesOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 p-1">
            {[7, 14, 30].map((days) => (
              <Button
                key={days}
                size="sm"
                variant={range.since === defaultRange(days).since ? "default" : "ghost"}
                className="h-7 px-3 text-xs"
                onClick={() => setRange(defaultRange(days))}
              >
                {days}d
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {overview.isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-36 w-full rounded-2xl" />
          ))}
        </div>
      ) : overview.isError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-sm text-destructive">{(overview.error as Error).message}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            {KPI_CARDS.map((card, i) => {
              const value = totals[card.key];
              return (
                <div
                  key={card.key}
                  className="card-lift animate-fade-up rounded-2xl border border-border bg-card px-5 pt-5 pb-4 shadow-[0_1px_3px_rgba(15,27,53,0.04)] flex flex-col"
                  style={{ animationDelay: `${i * 75}ms` }}
                >
                  <span className="text-[9px] font-black tracking-[0.16em] text-muted-foreground/40 mb-4">
                    {card.rank}
                  </span>
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    {card.label}
                  </p>
                  <p className="text-[2.4rem] font-black tracking-tight leading-none animate-numeric-pop mt-auto text-amber-700">
                    {card.format(value)}
                  </p>
                  <div className={`mt-3 h-0.5 w-full rounded-full ${card.accent}`} />
                </div>
              );
            })}
          </div>

          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Visão geral</TabsTrigger>
              <TabsTrigger value="daily">Diário</TabsTrigger>
            </TabsList>

            {/* Overview tab — Top Campaigns table */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)] animate-fade-up" style={{ animationDelay: "150ms" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  Top campanhas
                </p>
                {campaignInsights.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma campanha no período.</p>
                ) : (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-secondary/60">
                          <th className="px-4 py-2.5 text-left text-[10.5px] uppercase tracking-wide text-muted-foreground font-semibold w-8">#</th>
                          <th className="px-4 py-2.5 text-left text-[10.5px] uppercase tracking-wide text-muted-foreground font-semibold">Campanha</th>
                          <th className="px-4 py-2.5 text-right text-[10.5px] uppercase tracking-wide text-muted-foreground font-semibold">Investimento</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {campaignInsights.map((row, index) => (
                          <tr
                            key={`${row.campaign_name}-${index}`}
                            className="hover:bg-secondary/30 transition-colors"
                          >
                            <td className="px-4 py-3 text-[10px] font-black text-muted-foreground/30 tabular-nums">
                              {String(index + 1).padStart(2, "0")}
                            </td>
                            <td className="px-4 py-3 font-medium text-foreground">
                              {row.campaign_name ?? "Campanha"}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-amber-700">
                              {formatCurrency(Number(row.spend ?? 0))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Daily tab — Charts */}
            <TabsContent value="daily" className="space-y-4 mt-4">
              {/* Daily spend — dark chart card */}
              <div
                className="rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(11,27,62,0.18)] animate-fade-up"
                style={{
                  background: "linear-gradient(135deg, #0B1B3E 0%, #0F2550 100%)",
                  animationDelay: "75ms",
                }}
              >
                <div className="p-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">
                    Investimento diário
                  </p>
                  <div className="h-64 mt-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyInsights}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                        <XAxis
                          dataKey="date_start"
                          tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip contentStyle={META_TOOLTIP_STYLE} />
                        <Line
                          type="monotone"
                          dataKey="spend"
                          stroke="#60C3E8"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Daily leads — section panel */}
              <div
                className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)] animate-fade-up"
                style={{ animationDelay: "150ms" }}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  Leads diários
                </p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dailyInsights.map((row) => ({
                        date_start: row.date_start,
                        leads: getLeads(row.actions),
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                      <XAxis
                        dataKey="date_start"
                        tick={{ fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={META_TOOLTIP_STYLE} />
                      <Bar dataKey="leads" fill="#D97706" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
