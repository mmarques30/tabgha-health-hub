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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Card>
        <CardHeader>
          <CardTitle>Conecte o Meta Ads</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Este cliente ainda não possui credenciais Meta em automacoes.meta. Fale com a Tabgha para
          configurar.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Meta Ads</h2>
          <p className="text-sm text-muted-foreground">Performance em tempo real via Graph API</p>
        </div>
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
          {[7, 14, 30].map((days) => (
            <Button
              key={days}
              size="sm"
              variant="outline"
              onClick={() => setRange(defaultRange(days))}
            >
              {days}d
            </Button>
          ))}
        </div>
      </div>

      {overview.isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : overview.isError ? (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            {(overview.error as Error).message}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Investimento</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {formatCurrency(totals.spend)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Leads</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{totals.leads}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">CTR</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{totals.ctr.toFixed(2)}%</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">CPM</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{formatCurrency(totals.cpm)}</CardContent>
            </Card>
          </div>

          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Visão geral</TabsTrigger>
              <TabsTrigger value="daily">Diário</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Top campanhas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {campaignInsights.length === 0 ? (
                    <p className="text-muted-foreground">Nenhuma campanha no período.</p>
                  ) : (
                    campaignInsights.map((row, index) => (
                      <div key={`${row.campaign_name}-${index}`} className="flex justify-between">
                        <span>{row.campaign_name ?? "Campanha"}</span>
                        <span>{formatCurrency(Number(row.spend ?? 0))}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="daily">
              <Card>
                <CardHeader>
                  <CardTitle>Investimento diário</CardTitle>
                </CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyInsights}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date_start" />
                      <YAxis />
                      <Tooltip contentStyle={META_TOOLTIP_STYLE} />
                      <Line type="monotone" dataKey="spend" stroke="#059669" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Leads diários</CardTitle>
                </CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dailyInsights.map((row) => ({
                        date_start: row.date_start,
                        leads: getLeads(row.actions),
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date_start" />
                      <YAxis />
                      <Tooltip contentStyle={META_TOOLTIP_STYLE} />
                      <Bar dataKey="leads" fill="#2563eb" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

    </div>
  );
}
