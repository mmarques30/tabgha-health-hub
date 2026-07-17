import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { useClientesOptions } from "@/hooks/useClientesOptions";
import { supabase } from "@/integrations/supabase/client";
import { defaultRange, formatCurrency, META_TOOLTIP_STYLE } from "@/lib/types";

type MetaAdsPageProps = {
  isAdmin?: boolean;
  fixedClienteId?: string | null;
};

type Metrica = {
  data: string;
  campanha: string | null;
  investimento: number;
  leads: number;
  cpl: number | null;
};

type LeadRow = {
  criado_em: string;
  canal: string | null;
  status: string;
  observacoes: string | null;
};

type DashboardAgg = {
  investimento: number;
  leadsAds: number;
  leadsCaptados: number;
  leadsQualificados: number;
  atendidos: number;
  convertidos: number;
  cpl: number | null;
  custoAtendimento: number | null;
  ticketMedio: number | null;
  roasEstimado: number | null;
};

function parseTicket(observacoes: string | null): number | null {
  if (!observacoes) return null;
  const match = observacoes.match(/ticket:\s*([0-9]+(?:\.[0-9]+)?)/i);
  return match ? Number(match[1]) : null;
}

function percentDiff(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function aggregate(metrics: Metrica[], leads: LeadRow[]): DashboardAgg {
  const investimento = metrics.reduce((sum, m) => sum + Number(m.investimento ?? 0), 0);
  const leadsAds = metrics.reduce((sum, m) => sum + Number(m.leads ?? 0), 0);

  const leadsMeta = leads.filter((l) => ["meta", "facebook"].includes(l.canal ?? ""));
  // CRM (webhook) tem prioridade; se ainda não caiu lead, usa o total reportado pelo Ads.
  const leadsCaptados = leadsMeta.length > 0 ? leadsMeta.length : leadsAds;
  const leadsQualificados = leadsMeta.filter((l) => l.status !== "novo").length;
  const atendidos = leadsMeta.filter((l) => l.status === "atendido").length;
  const convertidos = leadsMeta.filter((l) => l.status === "convertido").length;

  const tickets = leadsMeta
    .filter((l) => l.status === "convertido")
    .map((l) => parseTicket(l.observacoes))
    .filter((n): n is number => n != null && !Number.isNaN(n));

  const ticketMedio =
    tickets.length > 0 ? tickets.reduce((a, b) => a + b, 0) / tickets.length : null;

  return {
    investimento,
    leadsAds,
    leadsCaptados,
    leadsQualificados,
    atendidos,
    convertidos,
    cpl: leadsCaptados > 0 ? investimento / leadsCaptados : null,
    custoAtendimento: atendidos > 0 ? investimento / atendidos : null,
    ticketMedio,
    roasEstimado:
      investimento > 0 && ticketMedio != null ? (ticketMedio * convertidos) / investimento : null,
  };
}

export function MetaAdsPage({ isAdmin = false, fixedClienteId = null }: MetaAdsPageProps) {
  const { profile } = useAuth();
  const [range, setRange] = useState(defaultRange(30));
  const [clienteId, setClienteId] = useState<string | null>(fixedClienteId);
  const { data: clientesOptions = [] } = useClientesOptions();
  const activeClienteId = fixedClienteId ?? clienteId ?? profile?.cliente_id ?? null;

  useEffect(() => {
    if (fixedClienteId) {
      setClienteId(fixedClienteId);
      return;
    }
    if (!isAdmin) return;
    if (clienteId) return;
    const pedro = clientesOptions.find((c) => /pedro/i.test(c.nome));
    const pick = pedro?.id ?? clientesOptions[0]?.id;
    if (pick) setClienteId(pick);
  }, [fixedClienteId, isAdmin, clienteId, clientesOptions]);

  const dataQuery = useQuery({
    queryKey: ["meta-ads-db", activeClienteId, range],
    enabled: Boolean(activeClienteId),
    queryFn: async () => {
      const start = range.since;
      const end = range.until;

      const prevStartDate = new Date(`${start}T00:00:00Z`);
      const prevEndDate = new Date(`${end}T00:00:00Z`);
      const days =
        Math.floor((prevEndDate.getTime() - prevStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const prevStart = new Date(prevStartDate);
      prevStart.setDate(prevStart.getDate() - days);
      const prevEnd = new Date(prevEndDate);
      prevEnd.setDate(prevEnd.getDate() - days);

      const [{ data: metrics, error: metricsErr }, { data: leads, error: leadsErr }] =
        await Promise.all([
          supabase
            .from("metricas_ads")
            .select("data,campanha,investimento,leads,cpl")
            .eq("cliente_id", activeClienteId!)
            .eq("plataforma", "meta")
            .gte("data", prevStart.toISOString().slice(0, 10))
            .lte("data", end)
            .order("data", { ascending: true }),
          supabase
            .from("leads")
            .select("criado_em,canal,status,observacoes")
            .eq("cliente_id", activeClienteId!)
            .gte("criado_em", prevStart.toISOString())
            .lte("criado_em", `${end}T23:59:59.999Z`),
        ]);

      if (metricsErr) throw metricsErr;
      if (leadsErr) throw leadsErr;

      const allMetrics = (metrics ?? []) as Metrica[];
      const allLeads = (leads ?? []) as LeadRow[];

      const inCurrentRange = (date: string) => date >= start && date <= end;
      const inPrevRange = (date: string) =>
        date >= prevStart.toISOString().slice(0, 10) && date <= prevEnd.toISOString().slice(0, 10);

      const currentMetrics = allMetrics.filter((m) => inCurrentRange(m.data));
      const previousMetrics = allMetrics.filter((m) => inPrevRange(m.data));

      const currentLeads = allLeads.filter((l) => {
        const d = l.criado_em.slice(0, 10);
        return inCurrentRange(d);
      });
      const previousLeads = allLeads.filter((l) => {
        const d = l.criado_em.slice(0, 10);
        return inPrevRange(d);
      });

      const current = aggregate(currentMetrics, currentLeads);
      const previous = aggregate(previousMetrics, previousLeads);

      const byDay = new Map<string, { data: string; investimento: number; leads: number }>();
      for (const row of currentMetrics) {
        const key = row.data;
        if (!byDay.has(key)) byDay.set(key, { data: key, investimento: 0, leads: 0 });
        const target = byDay.get(key)!;
        target.investimento += Number(row.investimento ?? 0);
        target.leads += Number(row.leads ?? 0);
      }

      const byCampaign = new Map<
        string,
        { campanha: string; investimento: number; leads: number }
      >();
      for (const row of currentMetrics) {
        const key = row.campanha ?? "Sem campanha";
        if (!byCampaign.has(key)) {
          byCampaign.set(key, { campanha: key, investimento: 0, leads: 0 });
        }
        const target = byCampaign.get(key)!;
        target.investimento += Number(row.investimento ?? 0);
        target.leads += Number(row.leads ?? 0);
      }

      const campaigns = [...byCampaign.values()]
        .map((c) => ({
          ...c,
          cpl: c.leads > 0 ? c.investimento / c.leads : null,
        }))
        .sort((a, b) => {
          if (a.cpl == null && b.cpl == null) return 0;
          if (a.cpl == null) return 1;
          if (b.cpl == null) return -1;
          return a.cpl - b.cpl;
        });

      return {
        current,
        previous,
        chart: [...byDay.values()],
        campaigns,
      };
    },
  });

  if (isAdmin && !fixedClienteId && clientesOptions.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
        <p className="text-sm text-muted-foreground">
          Nenhum cliente cadastrado. Crie um cliente e conecte a Meta BM primeiro.
        </p>
      </div>
    );
  }

  if (!activeClienteId) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
        <p className="text-sm text-muted-foreground">Selecione um cliente para ver os KPIs.</p>
      </div>
    );
  }

  const current = dataQuery.data?.current;
  const previous = dataQuery.data?.previous;

  const cards =
    current && previous
      ? [
          {
            label: "Investimento",
            value: formatCurrency(current.investimento),
            diff: percentDiff(current.investimento, previous.investimento),
          },
          {
            label: "Leads captados",
            value: String(current.leadsCaptados),
            diff: percentDiff(current.leadsCaptados, previous.leadsCaptados),
          },
          {
            label: "CPL",
            value: current.cpl != null ? formatCurrency(current.cpl) : "—",
            diff:
              current.cpl != null && previous.cpl != null
                ? percentDiff(current.cpl, previous.cpl)
                : 0,
          },
          {
            label: "ROAS estimado",
            value: current.roasEstimado != null ? `${current.roasEstimado.toFixed(2)}x` : "—",
            diff:
              current.roasEstimado != null && previous.roasEstimado != null
                ? percentDiff(current.roasEstimado, previous.roasEstimado)
                : 0,
          },
        ]
      : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && !fixedClienteId ? (
            <select
              value={clienteId ?? ""}
              onChange={(e) => setClienteId(e.target.value || null)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              <option value="">Selecione um cliente…</option>
              {clientesOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          ) : null}

          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 p-1">
            {[7, 30, 90].map((days) => (
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

      {dataQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-36 w-full rounded-2xl" />
          ))}
        </div>
      ) : dataQuery.isError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-sm text-destructive">{(dataQuery.error as Error).message}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            {cards.map((card, i) => (
              <div
                key={card.label}
                className="card-lift animate-fade-up rounded-2xl border border-border bg-card px-5 pb-4 pt-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)]"
                style={{ animationDelay: `${i * 75}ms` }}
              >
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {card.label}
                </p>
                <p className="mt-3 text-3xl font-black tracking-tight text-amber-700">
                  {card.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  vs período anterior: {card.diff >= 0 ? "+" : ""}
                  {card.diff.toFixed(1)}%
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Investimento x Leads (diário)
              </p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dataQuery.data?.chart ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis
                      dataKey="data"
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip contentStyle={META_TOOLTIP_STYLE} />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="investimento"
                      stroke="#D97706"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="leads"
                      stroke="#1D4ED8"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Distribuição de leads por dia
              </p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataQuery.data?.chart ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis
                      dataKey="data"
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={META_TOOLTIP_STYLE} />
                    <Bar dataKey="leads" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Campanhas por CPL
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campanha</TableHead>
                  <TableHead className="text-right">Investimento</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">CPL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(dataQuery.data?.campaigns ?? []).slice(0, 12).map((row) => (
                  <TableRow key={row.campanha}>
                    <TableCell className="font-medium">{row.campanha}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.investimento)}</TableCell>
                    <TableCell className="text-right">{row.leads}</TableCell>
                    <TableCell className="text-right">
                      {row.cpl != null ? formatCurrency(row.cpl) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
