import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { subDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/cliente/roi")({
  component: RoiPage,
  head: () => ({ meta: [{ title: "ROI — Portal" }] }),
});

const PERIODOS = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
];

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function fmtCurrency(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function fmtDecimal(n: number | null) {
  if (n == null) return "—";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    (acc, m) => ({
      investimento: acc.investimento + m.investimento,
      leads: acc.leads + m.leads,
      conversoes: acc.conversoes + m.conversoes,
    }),
    { investimento: 0, leads: 0, conversoes: 0 }
  );
  const cpl = totais.leads > 0 ? totais.investimento / totais.leads : null;
  const cpa = totais.conversoes > 0 ? totais.investimento / totais.conversoes : null;
  const roasMedia = metricas.length > 0
    ? metricas.filter((m) => m.roas != null).reduce((a, m) => a + (m.roas ?? 0), 0) / metricas.filter((m) => m.roas != null).length
    : null;

  const chartData = metricas.reduce<Record<string, { data: string; investimento: number; leads: number }>>((acc, m) => {
    const key = m.data;
    if (!acc[key]) acc[key] = { data: format(new Date(m.data), "dd/MM", { locale: ptBR }), investimento: 0, leads: 0 };
    acc[key].investimento += m.investimento;
    acc[key].leads += m.leads;
    return acc;
  }, {});

  return (
    <div className="px-8 py-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Performance</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">ROI de Campanhas</h1>
      </header>

      <div className="mb-6 flex gap-2">
        {PERIODOS.map((p) => (
          <button key={p.days} onClick={() => setPeriodo(p.days)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${periodo === p.days ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {p.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : metricas.length === 0 ? (
        <EmptyState icon={<TrendingUp className="h-6 w-6" />} title="Sem dados para o período"
          description="As métricas de campanha aparecem aqui conforme os dados forem sincronizados." />
      ) : (
        <>
          <section className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Investimento total" value={fmtCurrency(totais.investimento)} />
            <KpiCard label="CPL" value={cpl != null ? fmtCurrency(cpl) : "—"} />
            <KpiCard label="CPA" value={cpa != null ? fmtCurrency(cpa) : "—"} />
            <KpiCard label="ROAS médio" value={roasMedia != null ? `${fmtDecimal(roasMedia)}×` : "—"} />
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Investimento × Leads</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={Object.values(chartData)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line yAxisId="left" type="monotone" dataKey="investimento" name="Investimento (R$)" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="leads" name="Leads" stroke="hsl(var(--muted-foreground))" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </section>
        </>
      )}
    </div>
  );
}
