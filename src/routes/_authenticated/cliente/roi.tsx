import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Loader2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";
import { KpiCard } from "@/components/ui/kpi-card";
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
function fmtDecimal(n: number | null) {
  if (n == null) return "—";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
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
  const roasArr = metricas.filter((m) => m.roas != null);
  const roasMedia = roasArr.length > 0 ? roasArr.reduce((a, m) => a + (m.roas ?? 0), 0) / roasArr.length : null;

  const chartData = Object.values(
    metricas.reduce<Record<string, { data: string; investimento: number; leads: number }>>((acc, m) => {
      const key = m.data;
      if (!acc[key]) acc[key] = { data: format(new Date(m.data), "dd/MM", { locale: ptBR }), investimento: 0, leads: 0 };
      acc[key].investimento += m.investimento;
      acc[key].leads += m.leads;
      return acc;
    }, {}),
  );

  return (
    <div className="px-6 py-6 space-y-6">
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
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : metricas.length === 0 ? (
        <EmptyState icon={<TrendingUp className="h-6 w-6" />} title="Sem dados para o período" description="As métricas aparecem aqui conforme os dados forem sincronizados." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Investimento", v: fmtCurrency(totais.investimento), fmt: "raw" as const, i: 0 },
              { label: "Leads gerados", v: totais.leads, fmt: "number" as const, i: 1 },
              { label: "CPL médio", v: cpl != null ? fmtCurrency(cpl) : "—", fmt: "raw" as const, i: 2 },
            ].map(({ label, v, fmt, i }) => (
              <div key={label} className="animate-fade-up" style={{ animationDelay: `${i * 75}ms` }}>
                <KpiCard label={label} value={v as string | number} format={fmt} />
              </div>
            ))}
            <div className="animate-fade-up delay-225">
              <KpiCard
                label="ROAS médio"
                value={roasMedia != null ? roasMedia : "—"}
                format={roasMedia != null ? "multiplier" : "raw"}
                delta={roasMedia != null ? {
                  value: roasMedia >= 3.5 ? "acima da meta" : "abaixo da meta",
                  direction: roasMedia >= 3.5 ? "up" : "down",
                } : undefined}
              />
            </div>
          </div>

          <div className="animate-fade-up delay-300 card-lift rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
            <div className="mb-4 flex items-baseline justify-between">
              <div>
                <p className="text-sm font-bold">Investimento × Leads</p>
                <p className="text-xs text-muted-foreground mt-0.5">Últimos {periodo} dias</p>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded bg-primary" />Invest.</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded bg-sky-400" />Leads</span>
              </div>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradInvestRoi" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1A5FAD" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#1A5FAD" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradLeadsRoi" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#60C3E8" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#60C3E8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,27,53,0.05)" vertical={false} />
                  <XAxis dataKey="data" tick={{ fontSize: 10, fill: "#9AA1B8" }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left"  tick={{ fontSize: 10, fill: "#9AA1B8" }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#9AA1B8" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 10, background: "white", border: "1px solid rgba(15,27,53,0.08)", boxShadow: "0 4px 12px rgba(15,27,53,0.10)", color: "#0F1B35" }}
                    formatter={(v: number, name: string) => [name === "Investimento (R$)" ? fmtCurrency(v) : v, name]}
                  />
                  <Area yAxisId="left"  type="monotone" dataKey="investimento" name="Investimento (R$)" stroke="#1A5FAD" strokeWidth={2.5} fill="url(#gradInvestRoi)" dot={false} activeDot={{ r: 4, fill: "#1A5FAD", stroke: "white", strokeWidth: 2 }} />
                  <Area yAxisId="right" type="monotone" dataKey="leads"        name="Leads"             stroke="#60C3E8" strokeWidth={2}   fill="url(#gradLeadsRoi)"  dot={false} activeDot={{ r: 4, fill: "#60C3E8", stroke: "white", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="animate-fade-up delay-375 rounded-2xl border border-border bg-card overflow-hidden shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
            <div className="px-5 py-3.5 border-b border-border">
              <p className="text-sm font-bold">Registros do período</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
                    {["Data", "Plataforma", "Investimento", "Leads", "CPL", "ROAS"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {metricas.map((m) => (
                    <tr key={m.data + m.plataforma} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{m.data}</td>
                      <td className="px-4 py-2.5 capitalize">{m.plataforma}</td>
                      <td className="px-4 py-2.5 font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(Number(m.investimento))}</td>
                      <td className="px-4 py-2.5" style={{ fontVariantNumeric: "tabular-nums" }}>{m.leads}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{m.cpl != null ? fmtCurrency(Number(m.cpl)) : "—"}</td>
                      <td className="px-4 py-2.5 font-semibold text-primary">{m.roas != null ? `${fmtDecimal(Number(m.roas))}×` : "—"}</td>
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
