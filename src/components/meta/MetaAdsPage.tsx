import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
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
import { ArrowRight } from "lucide-react";

import {
  AnalyticsFilters,
  defaultAnalyticsFilters,
  type AnalyticsFiltersValue,
} from "@/components/analytics/AnalyticsFilters";
import { SubTabs } from "@/components/analytics/SubTabs";
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
import { calcCaq } from "@/lib/analytics-range";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, META_TOOLTIP_STYLE } from "@/lib/types";

type MetaAdsPageProps = {
  isAdmin?: boolean;
  fixedClienteId?: string | null;
};

type TabId = "campanhas" | "anuncios" | "oportunidades";

type Metrica = {
  data: string;
  campanha: string | null;
  investimento: number;
  leads: number;
  cpl: number | null;
};

type LeadRow = {
  id: string;
  criado_em: string;
  canal: string | null;
  status: string;
  observacoes: string | null;
  utm_campaign: string | null;
};

function percentDiff(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function MetaAdsPage({ isAdmin = false, fixedClienteId = null }: MetaAdsPageProps) {
  const { profile } = useAuth();
  const [tab, setTab] = useState<TabId>("campanhas");
  const [filters, setFilters] = useState<AnalyticsFiltersValue>(() => ({
    ...defaultAnalyticsFilters("30d"),
    clienteId: fixedClienteId,
    plataforma: "meta",
  }));
  const { data: clientesOptions = [] } = useClientesOptions();

  const activeClienteId =
    fixedClienteId ?? filters.clienteId ?? (!isAdmin ? profile?.cliente_id ?? null : null);

  useEffect(() => {
    if (fixedClienteId) {
      setFilters((f) => ({ ...f, clienteId: fixedClienteId }));
    }
  }, [fixedClienteId]);

  useEffect(() => {
    if (fixedClienteId || !isAdmin || filters.clienteId) return;
    const pedro = clientesOptions.find((c) => /pedro/i.test(c.nome));
    const pick = pedro?.id ?? clientesOptions[0]?.id ?? null;
    if (pick) setFilters((f) => ({ ...f, clienteId: pick }));
  }, [fixedClienteId, isAdmin, filters.clienteId, clientesOptions]);

  const dataQuery = useQuery({
    queryKey: ["marketing-pago", activeClienteId, filters.range],
    enabled: Boolean(activeClienteId),
    queryFn: async () => {
      const start = filters.range.since;
      const end = filters.range.until;

      const prevStartDate = new Date(`${start}T00:00:00Z`);
      const prevEndDate = new Date(`${end}T00:00:00Z`);
      const days =
        Math.floor((prevEndDate.getTime() - prevStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const prevStart = new Date(prevStartDate);
      prevStart.setDate(prevStart.getDate() - days);
      const prevEnd = new Date(prevEndDate);
      prevEnd.setDate(prevEnd.getDate() - days);
      const prevStartIso = prevStart.toISOString().slice(0, 10);
      const prevEndIso = prevEnd.toISOString().slice(0, 10);

      const [{ data: metrics, error: metricsErr }, { data: leads, error: leadsErr }] =
        await Promise.all([
          supabase
            .from("metricas_ads")
            .select("data,campanha,investimento,leads,cpl")
            .eq("cliente_id", activeClienteId!)
            .eq("plataforma", "meta")
            .gte("data", prevStartIso)
            .lte("data", end)
            .order("data", { ascending: true }),
          supabase
            .from("leads")
            .select("id,criado_em,canal,status,observacoes,utm_campaign")
            .eq("cliente_id", activeClienteId!)
            .gte("criado_em", `${prevStartIso}T00:00:00.000Z`)
            .lte("criado_em", `${end}T23:59:59.999Z`),
        ]);

      if (metricsErr) throw metricsErr;
      if (leadsErr) throw leadsErr;

      const allMetrics = (metrics ?? []) as Metrica[];
      const allLeads = (leads ?? []) as LeadRow[];

      const inCurrent = (date: string) => date >= start && date <= end;
      const inPrev = (date: string) => date >= prevStartIso && date <= prevEndIso;

      const currentMetrics = allMetrics.filter((m) => inCurrent(m.data));
      const previousMetrics = allMetrics.filter((m) => inPrev(m.data));
      const currentLeads = allLeads.filter((l) => inCurrent(l.criado_em.slice(0, 10)));
      const previousLeads = allLeads.filter((l) => inPrev(l.criado_em.slice(0, 10)));

      const sum = (rows: Metrica[]) => ({
        investimento: rows.reduce((s, m) => s + Number(m.investimento ?? 0), 0),
        leadsAds: rows.reduce((s, m) => s + Number(m.leads ?? 0), 0),
      });

      const cur = sum(currentMetrics);
      const prev = sum(previousMetrics);
      const leadsMeta = currentLeads.filter((l) => ["meta", "facebook"].includes(l.canal ?? ""));
      const prevLeadsMeta = previousLeads.filter((l) =>
        ["meta", "facebook"].includes(l.canal ?? ""),
      );
      const leadsCaptados = leadsMeta.length > 0 ? leadsMeta.length : cur.leadsAds;
      const prevLeadsCaptados = prevLeadsMeta.length > 0 ? prevLeadsMeta.length : prev.leadsAds;
      const caq = calcCaq(cur.investimento, leadsCaptados);
      const prevCaq = calcCaq(prev.investimento, prevLeadsCaptados);

      const byDay = new Map<string, { data: string; investimento: number; leads: number }>();
      for (const row of currentMetrics) {
        if (!byDay.has(row.data)) byDay.set(row.data, { data: row.data, investimento: 0, leads: 0 });
        const t = byDay.get(row.data)!;
        t.investimento += Number(row.investimento ?? 0);
        t.leads += Number(row.leads ?? 0);
      }

      const byCampaign = new Map<
        string,
        { campanha: string; investimento: number; leads: number }
      >();
      for (const row of currentMetrics) {
        const key = row.campanha ?? "Sem campanha";
        if (!byCampaign.has(key)) byCampaign.set(key, { campanha: key, investimento: 0, leads: 0 });
        const t = byCampaign.get(key)!;
        t.investimento += Number(row.investimento ?? 0);
        t.leads += Number(row.leads ?? 0);
      }

      const campaigns = [...byCampaign.values()]
        .map((c) => ({ ...c, caq: calcCaq(c.investimento, c.leads), cpl: calcCaq(c.investimento, c.leads) }))
        .sort((a, b) => b.investimento - a.investimento);

      // Sem breakdown por anúncio no sync atual — agrupamos por campanha + trecho do observações/ad id.
      const byAd = new Map<string, { anuncio: string; campanha: string; leads: number }>();
      for (const l of leadsMeta) {
        const adMatch = l.observacoes?.match(/Ad\s+(\d+)/i);
        const key = adMatch?.[1] ?? l.utm_campaign ?? "sem-anuncio";
        const label = adMatch ? `Anúncio ${adMatch[1]}` : l.utm_campaign ?? "Sem anúncio identificado";
        const prevRow = byAd.get(key) ?? { anuncio: label, campanha: l.utm_campaign ?? "—", leads: 0 };
        prevRow.leads += 1;
        byAd.set(key, prevRow);
      }
      const anuncios = [...byAd.values()].sort((a, b) => b.leads - a.leads);

      const oportunidades = {
        total: leadsMeta.length,
        novos: leadsMeta.filter((l) => l.status === "novo").length,
        qualificacao: leadsMeta.filter((l) => l.status !== "novo" && l.status !== "convertido").length,
        convertidos: leadsMeta.filter((l) => l.status === "convertido").length,
      };

      return {
        current: {
          investimento: cur.investimento,
          leadsCaptados,
          caq,
          cpl: calcCaq(cur.investimento, leadsCaptados),
        },
        previous: {
          investimento: prev.investimento,
          leadsCaptados: prevLeadsCaptados,
          caq: prevCaq,
        },
        chart: [...byDay.values()],
        campaigns,
        anuncios,
        oportunidades,
      };
    },
  });

  const cards = useMemo(() => {
    const current = dataQuery.data?.current;
    const previous = dataQuery.data?.previous;
    if (!current || !previous) return [];
    return [
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
        label: "CAQ",
        value: current.caq != null ? formatCurrency(current.caq) : "—",
        diff:
          current.caq != null && previous.caq != null ? percentDiff(current.caq, previous.caq) : 0,
      },
      {
        label: "CPL",
        value: current.cpl != null ? formatCurrency(current.cpl) : "—",
        diff: 0,
      },
    ];
  }, [dataQuery.data]);

  if (isAdmin && !fixedClienteId && clientesOptions.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">
          Nenhum cliente cadastrado. Crie um cliente e conecte a Meta BM primeiro.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="mb-2 inline-flex rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800">
            Sob ROI da operação
          </span>
          <h2 className="text-xl font-bold tracking-tight">Marketing Pago</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Performance de campanhas, anúncios e oportunidades Meta
          </p>
        </div>
        <AnalyticsFilters
          value={filters}
          onChange={setFilters}
          clientes={clientesOptions}
          showCliente={isAdmin && !fixedClienteId}
          showCategoria={false}
          showPlataforma={false}
        />
      </div>

      <SubTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "campanhas", label: "Performance por campanha" },
          { id: "anuncios", label: "Performance por anúncio" },
          { id: "oportunidades", label: "Oportunidades" },
        ]}
      />

      {!activeClienteId ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Selecione um cliente para ver os KPIs.</p>
        </div>
      ) : dataQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : dataQuery.isError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-sm text-destructive">{(dataQuery.error as Error).message}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            {cards.map((card, i) => (
              <div
                key={card.label}
                className="animate-fade-up rounded-2xl border border-border bg-card px-5 pb-4 pt-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)]"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {card.label}
                </p>
                <p className="mt-3 text-3xl font-black tracking-tight text-sky-800">{card.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  vs período anterior: {card.diff >= 0 ? "+" : ""}
                  {card.diff.toFixed(1)}%
                </p>
              </div>
            ))}
          </div>

          {tab === "campanhas" ? (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-border bg-card p-5">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Investimento × Leads (diário)
                  </p>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dataQuery.data?.chart ?? []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                        <XAxis dataKey="data" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
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
                          stroke="#0369a1"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="leads"
                          stroke="#0ea5e9"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-card p-5">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Leads por dia
                  </p>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dataQuery.data?.chart ?? []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                        <XAxis dataKey="data" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={META_TOOLTIP_STYLE} />
                        <Bar dataKey="leads" fill="#0284c7" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Campanhas
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campanha</TableHead>
                      <TableHead className="text-right">Investimento</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">CAQ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(dataQuery.data?.campaigns ?? []).map((row) => (
                      <TableRow key={row.campanha}>
                        <TableCell className="font-medium">{row.campanha}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.investimento)}</TableCell>
                        <TableCell className="text-right">{row.leads}</TableCell>
                        <TableCell className="text-right">
                          {row.caq != null ? formatCurrency(row.caq) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : null}

          {tab === "anuncios" ? (
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Performance por anúncio
              </p>
              <p className="mb-4 text-xs text-muted-foreground">
                Derivado dos leads do CRM (Ad ID no webhook). Investimento por anúncio exige sync
                criativo — em breve.
              </p>
              {(dataQuery.data?.anuncios ?? []).length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Sem anúncios identificados nos leads deste período.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Anúncio</TableHead>
                      <TableHead>Campanha / UTM</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dataQuery.data!.anuncios.map((row) => (
                      <TableRow key={row.anuncio}>
                        <TableCell className="font-medium">{row.anuncio}</TableCell>
                        <TableCell className="text-muted-foreground">{row.campanha}</TableCell>
                        <TableCell className="text-right font-semibold">{row.leads}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          ) : null}

          {tab === "oportunidades" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Oportunidades", value: dataQuery.data?.oportunidades.total ?? 0 },
                  { label: "Novas", value: dataQuery.data?.oportunidades.novos ?? 0 },
                  { label: "Qualificação", value: dataQuery.data?.oportunidades.qualificacao ?? 0 },
                  { label: "Convertidas", value: dataQuery.data?.oportunidades.convertidos ?? 0 },
                ].map((card) => (
                  <div key={card.label} className="rounded-2xl border border-border bg-card px-5 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {card.label}
                    </p>
                    <p className="mt-2 text-3xl font-black text-sky-800">{card.value}</p>
                  </div>
                ))}
              </div>
              {isAdmin ? (
                <Link
                  to="/admin/leads"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline"
                >
                  Abrir funil <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <Link
                  to="/cliente/leads"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline"
                >
                  Abrir leads <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
