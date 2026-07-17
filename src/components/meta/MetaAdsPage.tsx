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
import {
  FunnelBars,
  InsightStack,
  Panel,
  RankedBarChart,
  StatusChips,
  StoryBanner,
} from "@/components/analytics/InsightPanel";
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
import {
  buildAdInsights,
  buildCampaignInsights,
  buildFunnelInsights,
  buildHeadline,
  countByStatus,
  fmtMoneyCompact,
  funnelStages,
  insightFromGap,
  percentDiff,
} from "@/lib/analytics-insights";
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
    fixedClienteId ?? filters.clienteId ?? (!isAdmin ? (profile?.cliente_id ?? null) : null);

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
        if (!byDay.has(row.data))
          byDay.set(row.data, { data: row.data, investimento: 0, leads: 0 });
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
        .map((c) => ({
          ...c,
          caq: calcCaq(c.investimento, c.leads),
          cpl: calcCaq(c.investimento, c.leads),
        }))
        .sort((a, b) => b.investimento - a.investimento);

      const byAd = new Map<string, { anuncio: string; campanha: string; leads: number }>();
      for (const l of leadsMeta) {
        const adMatch = l.observacoes?.match(/Ad\s+(\d+)/i);
        const key = adMatch?.[1] ?? l.utm_campaign ?? "sem-anuncio";
        const label = adMatch
          ? `Anúncio ${adMatch[1]}`
          : (l.utm_campaign ?? "Sem anúncio identificado");
        const prevRow = byAd.get(key) ?? {
          anuncio: label,
          campanha: l.utm_campaign ?? "—",
          leads: 0,
        };
        prevRow.leads += 1;
        byAd.set(key, prevRow);
      }
      const anuncios = [...byAd.values()].sort((a, b) => b.leads - a.leads);

      const oportunidades = {
        total: leadsMeta.length,
        novos: leadsMeta.filter((l) => l.status === "novo").length,
        qualificacao: leadsMeta.filter((l) => l.status !== "novo" && l.status !== "convertido")
          .length,
        convertidos: leadsMeta.filter((l) => l.status === "convertido").length,
        perdidos: leadsMeta.filter((l) => l.status === "perdido").length,
      };

      return {
        current: {
          investimento: cur.investimento,
          leadsCaptados,
          leadsAds: cur.leadsAds,
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
        leadStatuses: leadsMeta.map((l) => ({ status: l.status })),
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

  const headline = buildHeadline({
    invest: dataQuery.data?.current.investimento ?? 0,
    leadsCrm: dataQuery.data?.oportunidades.total ?? 0,
    leadsAds: dataQuery.data?.current.leadsAds ?? 0,
    caq: dataQuery.data?.current.caq ?? null,
    convertidos: dataQuery.data?.oportunidades.convertidos ?? 0,
    perdidos: dataQuery.data?.oportunidades.perdidos ?? 0,
  });
  const campaignInsights = buildCampaignInsights(dataQuery.data?.campaigns ?? []);
  const adInsights = buildAdInsights(dataQuery.data?.anuncios ?? []);
  const funnelInsights = buildFunnelInsights(dataQuery.data?.leadStatuses ?? []);
  const funnel = funnelStages(dataQuery.data?.leadStatuses ?? []);
  const statusBreakdown = countByStatus(dataQuery.data?.leadStatuses ?? []);
  const adsCrmGap = insightFromGap(
    dataQuery.data?.current.leadsAds ?? 0,
    dataQuery.data?.oportunidades.total ?? 0,
  );

  const campaignSpendChart = (dataQuery.data?.campaigns ?? []).slice(0, 8).map((c) => ({
    name: c.campanha.length > 22 ? `${c.campanha.slice(0, 20)}…` : c.campanha,
    value: c.investimento,
  }));
  const campaignLeadsChart = (dataQuery.data?.campaigns ?? []).slice(0, 8).map((c) => ({
    name: c.campanha.length > 22 ? `${c.campanha.slice(0, 20)}…` : c.campanha,
    value: c.leads,
  }));
  const adLeadsChart = (dataQuery.data?.anuncios ?? []).slice(0, 10).map((a) => ({
    name: a.anuncio.length > 22 ? `${a.anuncio.slice(0, 20)}…` : a.anuncio,
    value: a.leads,
  }));

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
            Em linguagem clara: o que a mídia está fazendo e onde o dinheiro rende
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
          <StoryBanner {...headline} />
          {adsCrmGap ? (
            <InsightStack items={[{ title: "Ads × funil", body: adsCrmGap, tone: "info" }]} />
          ) : null}

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
              <InsightStack items={campaignInsights} />

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel
                  title="Investimento × Leads (diário)"
                  subtitle="Linha do tempo do que foi gasto e do que entrou"
                  tone="soft"
                >
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
                          name="Investimento"
                          stroke="#0369a1"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="leads"
                          name="Leads Ads"
                          stroke="#0ea5e9"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
                <Panel title="Leads por dia" subtitle="Volume diário reportado pela Meta">
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
                        <Bar dataKey="leads" fill="#0284c7" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel
                  title="Budget por campanha"
                  subtitle="Quem está levando o investimento"
                  tone="soft"
                >
                  <RankedBarChart
                    data={campaignSpendChart}
                    formatValue={(v) => fmtMoneyCompact(v)}
                    color={["#0369a1", "#0284c7", "#0ea5e9", "#38bdf8", "#7dd3fc"]}
                  />
                </Panel>
                <Panel title="Leads por campanha" subtitle="Quem está trazendo gente">
                  <RankedBarChart
                    data={campaignLeadsChart}
                    color={["#0f766e", "#14b8a6", "#2dd4bf", "#5eead4", "#99f6e4"]}
                  />
                </Panel>
              </div>

              <Panel
                title="Tabela de campanhas"
                subtitle="Detalhe para quem quiser cruzar número a número"
              >
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
                    {(dataQuery.data?.campaigns ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                          Sem campanhas no período — sincronize a Meta BM.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (dataQuery.data?.campaigns ?? []).map((row) => (
                        <TableRow key={row.campanha}>
                          <TableCell className="font-medium">{row.campanha}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(row.investimento)}
                          </TableCell>
                          <TableCell className="text-right">{row.leads}</TableCell>
                          <TableCell className="text-right">
                            {row.caq != null ? formatCurrency(row.caq) : "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Panel>
            </>
          ) : null}

          {tab === "anuncios" ? (
            <>
              <StoryBanner
                title={
                  (dataQuery.data?.anuncios ?? []).length > 0
                    ? "Dá para ver qual peça está trabalhando"
                    : "Ainda não dá para apontar o criativo vencedor"
                }
                body={
                  (dataQuery.data?.anuncios ?? []).length > 0
                    ? "Abaixo está o ranking dos anúncios identificados nos leads do CRM. Use isso para decidir o que escalar e o que pausar — sem precisar abrir o Ads Manager."
                    : "Os leads Meta deste período não trouxeram Ad ID. O volume geral continua válido; o detalhe por criativo aparece quando o webhook gravar o identificador."
                }
                tone={(dataQuery.data?.anuncios ?? []).length > 0 ? "good" : "warn"}
              />
              <InsightStack items={adInsights} />

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Ranking de anúncios" subtitle="Quem mais gerou leads" tone="soft">
                  <RankedBarChart
                    data={adLeadsChart}
                    color={["#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd"]}
                  />
                </Panel>
                <Panel title="Leitura rápida" subtitle="Como usar este ranking">
                  <ul className="space-y-3 text-sm leading-relaxed text-foreground/85">
                    <li>
                      <strong className="text-foreground">Topo do gráfico</strong> — clone criativo
                      e publique variações semelhantes.
                    </li>
                    <li>
                      <strong className="text-foreground">Base do gráfico</strong> — pause ou teste
                      nova oferta; está ocupando entrega sem resultado.
                    </li>
                    <li>
                      <strong className="text-foreground">Investimento por anúncio</strong> — ainda
                      depende do sync criativo; por enquanto o score é por leads no funil.
                    </li>
                  </ul>
                </Panel>
              </div>

              <Panel title="Detalhe por anúncio" subtitle="Lista completa do período">
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
                        <TableRow key={row.anuncio + row.campanha}>
                          <TableCell className="font-medium">{row.anuncio}</TableCell>
                          <TableCell className="text-muted-foreground">{row.campanha}</TableCell>
                          <TableCell className="text-right font-semibold">{row.leads}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Panel>
            </>
          ) : null}

          {tab === "oportunidades" ? (
            <>
              <StoryBanner
                title={
                  (dataQuery.data?.oportunidades.convertidos ?? 0) > 0
                    ? "Parte dos leads Meta já virou paciente"
                    : "Os leads Meta ainda precisam avançar no funil"
                }
                body={
                  (dataQuery.data?.oportunidades.total ?? 0) === 0
                    ? "Nenhuma oportunidade Meta neste filtro. Confira o período, a conexão WhatsApp/Meta ou se os leads estão com canal correto."
                    : `Há ${dataQuery.data!.oportunidades.total} oportunidades vindas da mídia: ${dataQuery.data!.oportunidades.novos} novas, ${dataQuery.data!.oportunidades.qualificacao} em andamento e ${dataQuery.data!.oportunidades.convertidos} convertidas. O gráfico abaixo mostra onde a fila trava.`
                }
                tone={
                  (dataQuery.data?.oportunidades.convertidos ?? 0) > 0
                    ? "good"
                    : (dataQuery.data?.oportunidades.novos ?? 0) >
                        (dataQuery.data?.oportunidades.total ?? 0) * 0.5
                      ? "warn"
                      : "info"
                }
              />
              <InsightStack items={funnelInsights} />

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Oportunidades", value: dataQuery.data?.oportunidades.total ?? 0 },
                  { label: "Novas", value: dataQuery.data?.oportunidades.novos ?? 0 },
                  { label: "Qualificação", value: dataQuery.data?.oportunidades.qualificacao ?? 0 },
                  { label: "Convertidas", value: dataQuery.data?.oportunidades.convertidos ?? 0 },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="rounded-2xl border border-border bg-card px-5 py-4"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {card.label}
                    </p>
                    <p className="mt-2 text-3xl font-black text-sky-800">{card.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel
                  title="Funil Meta → paciente"
                  subtitle="Onde as oportunidades param"
                  tone="soft"
                >
                  <FunnelBars stages={funnel} />
                </Panel>
                <Panel title="Status dos leads Meta" subtitle="Distribuição atual no CRM">
                  <StatusChips items={statusBreakdown} />
                </Panel>
              </div>

              {isAdmin ? (
                <Link
                  to="/admin/leads"
                  search={{ periodo: 30, canal: "meta", cliente: activeClienteId ?? "", q: "" }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline"
                >
                  Abrir funil <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <Link
                  to="/cliente/leads"
                  search={{ periodo: 30, canal: "meta", q: "" }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline"
                >
                  Abrir leads <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
