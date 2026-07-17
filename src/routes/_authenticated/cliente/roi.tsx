import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Loader2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import { subDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/cliente/roi")({
  component: RoiPage,
  head: () => ({ meta: [{ title: "ROI — Portal" }] }),
});

const PERIODOS = [
  { label: "7d",  days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

function fmtCurrency(n: number) {
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function RoiPage() {
  const { profile } = useAuth();
  const clienteId = profile?.cliente_id;
  const [periodo, setPeriodo] = useState(30);

  const { data: metricas = [], isLoading } = useQuery({
    queryKey: ["cliente", "roi", clienteId, periodo],
    enabled: !!clienteId,
    staleTime: 60_000,
    queryFn: async () => {
      const from = subDays(new Date(), periodo).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("metricas_ads")
        .select("data, investimento, leads, conversoes, cpl, cpa, roas, plataforma")
        .eq("cliente_id", clienteId!)
        .gte("data", from)
        .order("data");
      if (error) throw error;
      return data ?? [];
    },
  });

  const totais = metricas.reduce(
    (acc, m) => ({ investimento: acc.investimento + m.investimento, leads: acc.leads + m.leads, conversoes: acc.conversoes + m.conversoes }),
    { investimento: 0, leads: 0, conversoes: 0 },
  );
  const cpl = totais.leads > 0 ? totais.investimento / totais.leads : null;
  const caq = cpl;

  const chartData = Object.values(
    metricas.reduce<Record<string, { data: string; investimento: number; leads: number }>>((acc, m) => {
      const key = m.data;
      if (!acc[key]) acc[key] = { data: format(new Date(m.data), "dd/MM", { locale: ptBR }), investimento: 0, leads: 0 };
      acc[key].investimento += m.investimento;
      acc[key].leads += m.leads;
      return acc;
    }, {}),
  );

  const kpis = [
    { rank: "01", label: "Investimento", value: fmtCurrency(totais.investimento) },
    { rank: "02", label: "Leads gerados", value: String(totais.leads) },
    { rank: "03", label: "CPL médio", value: cpl != null ? fmtCurrency(cpl) : "—" },
    {
      rank: "04",
      label: "CAQ",
      value: caq != null ? fmtCurrency(caq) : "—",
      badge: { label: "investimento ÷ leads", color: "bg-sky-100 text-sky-800" },
    },
  ];

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Header */}
      <div className="animate-fade-up flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow-pill">Performance</span>
          <h1 className="mt-3 text-xl font-bold tracking-tight">ROI de Campanhas</h1>
        </div>
        <div className="flex gap-1 rounded-xl border border-border bg-secondary/40 p-1">
          {PERIODOS.map((p) => (
            <button
              key={p.days}
              onClick={() => setPeriodo(p.days)}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-150",
                periodo === p.days ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
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
          title="Sem dados para o período"
          description="As métricas aparecem aqui conforme os dados forem sincronizados."
        />
      ) : (
        <>
          {/* KPI Cards — large 4-col */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpis.map(({ rank, label, value, badge }, i) => (
              <div
                key={label}
                className="card-lift animate-fade-up rounded-2xl border border-border bg-card px-5 pt-5 pb-4 shadow-[0_1px_3px_rgba(15,27,53,0.04)] flex flex-col"
                style={{ animationDelay: `${i * 75}ms` }}
              >
                <span className="text-[9px] font-black tracking-[0.16em] text-muted-foreground/40 mb-4">{rank}</span>
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
                <p className="text-[2.4rem] font-black tracking-tight leading-none animate-numeric-pop mt-auto text-sky-800">{value}</p>
                {badge && (
                  <span className={cn("mt-2 self-start rounded-full px-2.5 py-0.5 text-[11px] font-semibold", badge.color)}>
                    {badge.label}
                  </span>
                )}
                <div className="mt-3 h-0.5 w-full rounded-full bg-sky-500" />
              </div>
            ))}
          </div>

          <div className="animate-fade-up delay-300 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-slate-50 via-white to-sky-50/70 shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
            <div className="flex items-baseline justify-between px-6 pb-2 pt-5">
              <div>
                <p className="text-sm font-bold text-foreground">Investimento × Leads</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Últimos {periodo} dias</p>
              </div>
            </div>
            <div className="h-56 px-2 pb-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradInvestRoi" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0284c7" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#0284c7" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradLeadsRoi" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,27,53,0.06)" vertical={false} />
                  <XAxis dataKey="data" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0" }}
                    formatter={(v: number, name: string) => [name === "Investimento (R$)" ? fmtCurrency(v) : v, name]}
                  />
                  <Area yAxisId="left" type="monotone" dataKey="investimento" name="Investimento (R$)" stroke="#0369a1" strokeWidth={2.5} fill="url(#gradInvestRoi)" dot={false} />
                  <Area yAxisId="right" type="monotone" dataKey="leads" name="Leads" stroke="#0ea5e9" strokeWidth={2} fill="url(#gradLeadsRoi)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="animate-fade-up delay-450 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
            <div className="border-b border-border px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Registros do período (5 primeiros)
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary/60 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                    <th className="w-8 px-4 py-3 text-left font-semibold">#</th>
                    {["Data", "Plataforma", "Investimento", "Leads", "CAQ"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {metricas.slice(0, 5).map((m, idx) => {
                    const rowCaq = m.leads > 0 ? Number(m.investimento) / m.leads : null;
                    return (
                      <tr key={m.data + m.plataforma} className="transition-colors hover:bg-secondary/30">
                        <td className="px-4 py-2.5 text-[10px] font-black tabular-nums text-muted-foreground/30">
                          {String(idx + 1).padStart(2, "0")}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{m.data}</td>
                        <td className="px-4 py-2.5 capitalize">{m.plataforma}</td>
                        <td className="px-4 py-2.5 font-medium tabular-nums">{fmtCurrency(Number(m.investimento))}</td>
                        <td className="px-4 py-2.5 tabular-nums">{m.leads}</td>
                        <td className="px-4 py-2.5 font-semibold tabular-nums text-sky-800">
                          {rowCaq != null ? fmtCurrency(rowCaq) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {metricas.length > 5 ? (
              <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
                +{metricas.length - 5} registros — abra Marketing Pago para aprofundar.
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
