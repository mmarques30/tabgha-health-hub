import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2 } from "lucide-react";

import {
  AnalyticsFilters,
  defaultAnalyticsFilters,
  type AnalyticsFiltersValue,
} from "@/components/analytics/AnalyticsFilters";
import { FunnelBars, InsightStack, Panel, StoryBanner } from "@/components/analytics/InsightPanel";
import { useClientesOptions } from "@/hooks/useClientesOptions";
import { calcCaq } from "@/lib/analytics-range";
import { funnelStages, insightFromGap } from "@/lib/analytics-insights";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/dashboard-clientes")({
  component: DashboardClientesPage,
  head: () => ({ meta: [{ title: "Dashboard Clientes — Admin" }] }),
});

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function DashboardClientesPage() {
  const [filters, setFilters] = useState<AnalyticsFiltersValue>(defaultAnalyticsFilters("30d"));
  const { data: clientesOptions = [] } = useClientesOptions();

  const { data: clientesFull = [] } = useQuery({
    queryKey: ["admin", "dashboard-clientes", "clientes-cat"],
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
    queryKey: ["admin", "dashboard-clientes", filters],
    staleTime: 60_000,
    queryFn: async () => {
      const { since, until } = filters.range;
      const sinceIso = `${since}T00:00:00.000Z`;
      const untilIso = `${until}T23:59:59.999Z`;

      let leadsQ = supabase
        .from("leads")
        .select("id, cliente_id, status, canal, criado_em, clientes(nome, especialidade, status)")
        .gte("criado_em", sinceIso)
        .lte("criado_em", untilIso);
      if (filters.clienteId) leadsQ = leadsQ.eq("cliente_id", filters.clienteId);

      let metricasQ = supabase
        .from("metricas_ads")
        .select("cliente_id, investimento, leads, clientes(nome, especialidade)")
        .gte("data", since)
        .lte("data", until);
      if (filters.clienteId) metricasQ = metricasQ.eq("cliente_id", filters.clienteId);
      if (filters.plataforma) metricasQ = metricasQ.eq("plataforma", filters.plataforma);

      const [leadsRes, metricasRes, carteiraRes] = await Promise.all([
        leadsQ,
        metricasQ,
        supabase
          .from("clientes")
          .select("id, nome, especialidade, status")
          .in("status", ["ativo", "onboarding", "pausa"])
          .order("nome"),
      ]);

      let leads = leadsRes.data ?? [];
      let metricas = metricasRes.data ?? [];
      if (filters.categoria) {
        leads = leads.filter(
          (l) =>
            (l.clientes as { especialidade?: string } | null)?.especialidade === filters.categoria,
        );
        metricas = metricas.filter(
          (m) =>
            (m.clientes as { especialidade?: string } | null)?.especialidade === filters.categoria,
        );
      }

      const byCliente = new Map<
        string,
        {
          id: string;
          nome: string;
          status: string;
          leadsCrm: number;
          leadsMeta: number;
          leadsAds: number;
          investimento: number;
          convertidos: number;
          novos: number;
        }
      >();

      for (const c of carteiraRes.data ?? []) {
        if (filters.clienteId && c.id !== filters.clienteId) continue;
        if (filters.categoria && (c.especialidade ?? "") !== filters.categoria) {
          continue;
        }
        byCliente.set(c.id, {
          id: c.id,
          nome: c.nome,
          status: c.status,
          leadsCrm: 0,
          leadsMeta: 0,
          leadsAds: 0,
          investimento: 0,
          convertidos: 0,
          novos: 0,
        });
      }

      for (const l of leads) {
        const nome =
          (l.clientes as { nome?: string } | null)?.nome ?? String(l.cliente_id).slice(0, 8);
        const status = (l.clientes as { status?: string } | null)?.status ?? "ativo";
        const prev = byCliente.get(l.cliente_id) ?? {
          id: l.cliente_id,
          nome,
          status,
          leadsCrm: 0,
          leadsMeta: 0,
          leadsAds: 0,
          investimento: 0,
          convertidos: 0,
          novos: 0,
        };
        prev.leadsCrm += 1;
        if (["meta", "facebook"].includes(l.canal ?? "")) prev.leadsMeta += 1;
        if (l.status === "convertido") prev.convertidos += 1;
        if (l.status === "novo") prev.novos += 1;
        byCliente.set(l.cliente_id, prev);
      }

      for (const m of metricas) {
        const nome =
          (m.clientes as { nome?: string } | null)?.nome ?? String(m.cliente_id).slice(0, 8);
        const prev = byCliente.get(m.cliente_id as string) ?? {
          id: m.cliente_id as string,
          nome,
          status: "ativo",
          leadsCrm: 0,
          leadsMeta: 0,
          leadsAds: 0,
          investimento: 0,
          convertidos: 0,
          novos: 0,
        };
        prev.investimento += Number(m.investimento ?? 0);
        prev.leadsAds += Number(m.leads ?? 0);
        byCliente.set(m.cliente_id as string, prev);
      }

      const rows = Array.from(byCliente.values())
        .map((r) => ({
          ...r,
          caq: calcCaq(r.investimento, r.leadsCrm > 0 ? r.leadsCrm : r.leadsAds),
          gap: Math.max(0, r.leadsAds - r.leadsMeta),
        }))
        .sort((a, b) => b.leadsCrm - a.leadsCrm || b.investimento - a.investimento);

      const leadsAds = rows.reduce((s, r) => s + r.leadsAds, 0);
      const leadsMeta = rows.reduce((s, r) => s + r.leadsMeta, 0);
      const leadsCrm = rows.reduce((s, r) => s + r.leadsCrm, 0);

      return {
        rows,
        leadsCrm,
        leadsMeta,
        leadsAds,
        leadStatuses: leads.map((l) => ({
          status: l.status as string,
          canal: l.canal as string | null,
        })),
      };
    },
  });

  const funnel = funnelStages(data?.leadStatuses ?? []);
  const adsCrmGap = insightFromGap(data?.leadsAds ?? 0, data?.leadsMeta ?? 0);

  return (
    <div className="space-y-4 px-6 py-6">
      <header className="animate-fade-up flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="eyebrow-pill">Visão Clientes</span>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Dashboard Clientes</h1>
          <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
            Resumo por clínica: o que entrou no CRM e onde há gap com a Meta. Detalhe de campanha
            fica em Marketing Pago.
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

      {!isLoading ? (
        <StoryBanner
          title={`${data?.leadsCrm ?? 0} leads no CRM · ${data?.leadsMeta ?? 0} via Meta`}
          body={
            (data?.leadsAds ?? 0) > (data?.leadsMeta ?? 0)
              ? `A Meta reportou ${data!.leadsAds} leads em Ads, mas só ${data!.leadsMeta} estão no funil. Sincronize formulários em Conectar Meta BM.`
              : "Captura Meta alinhada com o funil no período — ou ainda sem volume de Ads."
          }
          tone={(data?.leadsAds ?? 0) > (data?.leadsMeta ?? 0) ? "warn" : "info"}
        />
      ) : null}

      {adsCrmGap ? (
        <InsightStack
          items={[
            {
              title: "Ads × funil Meta",
              body: `${adsCrmGap} Use “Importar leads dos formulários” em Conectar Meta BM para preencher o pipeline.`,
              tone: "info",
            },
          ]}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <p className="text-sm font-bold">Por clínica</p>
            <Link
              to="/admin/leads"
              search={{ periodo: 30, canal: "", cliente: filters.clienteId ?? "", q: "" }}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 hover:underline"
            >
              Abrir funil <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 text-left">Cliente</th>
                  <th className="px-3 py-2.5 text-right">CRM</th>
                  <th className="px-3 py-2.5 text-right">Meta</th>
                  <th className="px-3 py-2.5 text-right">Ads</th>
                  <th className="px-3 py-2.5 text-right">Gap</th>
                  <th className="px-3 py-2.5 text-right">Invest.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    </td>
                  </tr>
                ) : (data?.rows ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      Sem clínicas no filtro.
                    </td>
                  </tr>
                ) : (
                  data!.rows.map((row) => (
                    <tr key={row.id} className="hover:bg-secondary/30">
                      <td className="px-4 py-3">
                        <Link
                          to={"/admin/clientes/$id" as never}
                          params={{ id: row.id } as never}
                          className="font-medium hover:text-primary"
                        >
                          {row.nome}
                        </Link>
                        <p className="text-[10px] capitalize text-muted-foreground">{row.status}</p>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">
                        {row.leadsCrm}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-sky-800">
                        {row.leadsMeta}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                        {row.leadsAds}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-3 text-right tabular-nums",
                          row.gap > 0 ? "font-semibold text-amber-700" : "text-muted-foreground",
                        )}
                      >
                        {row.gap}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-[12px]">
                        {row.investimento > 0 ? fmtMoney(row.investimento) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Panel title="Funil CRM" subtitle="Todas as clínicas do filtro" tone="soft">
          <FunnelBars stages={funnel} />
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/admin/config-meta"
              className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold hover:bg-secondary"
            >
              Importar leads Meta
            </Link>
            <Link
              to="/admin/meta-ads"
              className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold hover:bg-secondary"
            >
              Marketing Pago
            </Link>
            <Link
              to="/admin/roi"
              className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold hover:bg-secondary"
            >
              ROI
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}
