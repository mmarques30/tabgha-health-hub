import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/roi")({
  component: RoiAdminPage,
  head: () => ({ meta: [{ title: "ROI da operação — Tabgha Admin" }] }),
});

const PERIODS: { label: string; days: number }[] = [
  { label: "7d",  days: 7  },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "YTD", days: 0  },
];

function fromDate(days: number) {
  if (days === 0) {
    const y = new Date().getFullYear();
    return `${y}-01-01`;
  }
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function fmt(v: number) {
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
}

type Metrica = {
  id: string;
  cliente_id: string;
  data: string;
  plataforma: string;
  campanha: string | null;
  investimento: number;
  leads: number;
  conversoes: number;
  cpl: number | null;
  cpa: number | null;
  roas: number | null;
  clientes: { nome: string } | null;
};

function KpiCard({ label, value, sub, up }: { label: string; value: string; sub?: string; up?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tracking-tight">{value}</p>
      {sub && (
        <p className={cn("mt-1 flex items-center gap-1 text-xs", up === true ? "text-green-700" : up === false ? "text-red-700" : "text-muted-foreground")}>
          {up === true && <ArrowUp className="h-3 w-3" />}
          {up === false && <ArrowDown className="h-3 w-3" />}
          {sub}
        </p>
      )}
    </div>
  );
}

function RoiAdminPage() {
  const [periodIdx, setPeriodIdx] = useState(1);
  const period = PERIODS[periodIdx];
  const since = fromDate(period.days);

  const { data: metricas = [], isLoading } = useQuery<Metrica[]>({
    queryKey: ["admin", "roi", "metricas", since],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metricas_ads")
        .select("*, clientes(nome)")
        .gte("data", since)
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Metrica[];
    },
  });

  const kpis = useMemo(() => {
    if (!metricas.length) return null;
    const totalInvest = metricas.reduce((s, m) => s + Number(m.investimento), 0);
    const totalLeads = metricas.reduce((s, m) => s + m.leads, 0);
    const totalConv = metricas.reduce((s, m) => s + m.conversoes, 0);
    const roasArr = metricas.filter((m) => m.roas != null).map((m) => Number(m.roas));
    const roasMed = roasArr.length ? roasArr.reduce((a, b) => a + b, 0) / roasArr.length : null;
    const cplArr = metricas.filter((m) => m.cpl != null).map((m) => Number(m.cpl));
    const cplMed = cplArr.length ? cplArr.reduce((a, b) => a + b, 0) / cplArr.length : null;
    return { totalInvest, totalLeads, totalConv, roasMed, cplMed };
  }, [metricas]);

  // Group by client for bar chart
  const byCliente = useMemo(() => {
    const map = new Map<string, { nome: string; investimento: number; leads: number; conversoes: number }>();
    for (const m of metricas) {
      const nome = m.clientes?.nome ?? m.cliente_id.slice(0, 8);
      const prev = map.get(m.cliente_id) ?? { nome, investimento: 0, leads: 0, conversoes: 0 };
      map.set(m.cliente_id, {
        nome,
        investimento: prev.investimento + Number(m.investimento),
        leads: prev.leads + m.leads,
        conversoes: prev.conversoes + m.conversoes,
      });
    }
    return Array.from(map.values()).sort((a, b) => b.investimento - a.investimento);
  }, [metricas]);

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">ROI da operação</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Receita gerada vs. investimento em mídia</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-1 bg-secondary/30">
          {PERIODS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setPeriodIdx(i)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                i === periodIdx
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : metricas.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-6 w-6" />}
          title="Nenhuma métrica registrada"
          description="As métricas de ROI aparecem aqui conforme as campanhas forem rodando."
        />
      ) : (
        <>
          {/* KPIs */}
          {kpis && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard label="ROAS médio" value={kpis.roasMed != null ? `${kpis.roasMed.toFixed(1)}×` : "—"} sub="meta 3,5×" up={kpis.roasMed != null && kpis.roasMed >= 3.5} />
              <KpiCard label="Investido" value={fmt(kpis.totalInvest)} />
              <KpiCard label="Leads" value={String(kpis.totalLeads)} up />
              <KpiCard label="CPL médio" value={kpis.cplMed != null ? fmt(kpis.cplMed) : "—"} />
            </div>
          )}

          {/* Bar chart por cliente */}
          {byCliente.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold mb-3">Investimento × Leads por cliente</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byCliente} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, background: "var(--color-card)", border: "1px solid var(--color-border)", color: "var(--color-foreground)" }}
                      formatter={(v: number, name: string) =>
                        name === "Investimento" ? [fmt(v), name] : [v, name]
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="left" dataKey="investimento" name="Investimento" fill="#1A5FAD" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="leads" name="Leads" fill="#F6A623" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Tabela detalhada */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold">Registros do período</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary text-[10.5px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 text-left font-semibold">Cliente</th>
                    <th className="px-4 py-2 text-left font-semibold">Data</th>
                    <th className="px-4 py-2 text-left font-semibold">Plataforma</th>
                    <th className="px-4 py-2 text-right font-semibold">Investimento</th>
                    <th className="px-4 py-2 text-right font-semibold">Leads</th>
                    <th className="px-4 py-2 text-right font-semibold">CPL</th>
                    <th className="px-4 py-2 text-right font-semibold">ROAS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {metricas.map((m) => (
                    <tr key={m.id} className="hover:bg-secondary/40">
                      <td className="px-4 py-2.5 font-medium">{m.clientes?.nome ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{m.data}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{m.plataforma}</td>
                      <td className="px-4 py-2.5 text-right">{fmt(Number(m.investimento))}</td>
                      <td className="px-4 py-2.5 text-right">{m.leads}</td>
                      <td className="px-4 py-2.5 text-right">{m.cpl != null ? fmt(Number(m.cpl)) : "—"}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{m.roas != null ? `${Number(m.roas).toFixed(1)}×` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
