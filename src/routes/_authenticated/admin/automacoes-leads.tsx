import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Zap, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/automacoes-leads")({
  component: AutomacoesLeadsPage,
  head: () => ({ meta: [{ title: "Automações de leads — Tabgha Admin" }] }),
});

type Lead = { id: string; status: string; canal: string | null; criado_em: string };
type ClienteMetrics = {
  id: string;
  nome: string;
  especialidade: string | null;
  status: string;
  leads: Lead[];
  leads_total: number;
  leads_novos: number;
  leads_qualificados: number;
  leads_convertidos: number;
  taxa_conversao: number;
};

const LEAD_STATUSES = ["novo", "qualificado", "em_atendimento", "agendado", "convertido", "perdido"] as const;
const STATUS_LABEL: Record<string, string> = {
  novo: "Novo", qualificado: "Qualificado", em_atendimento: "Em atend.",
  agendado: "Agendado", convertido: "Convertido", perdido: "Perdido",
};
const STATUS_COLOR: Record<string, string> = {
  novo: "bg-slate-100 text-slate-600",
  qualificado: "bg-blue-100 text-blue-700",
  em_atendimento: "bg-yellow-100 text-yellow-700",
  agendado: "bg-accent text-accent-foreground",
  convertido: "bg-green-100 text-green-700",
  perdido: "bg-red-100 text-red-700",
};

const CANAIS = ["WhatsApp", "Meta Ads", "Indicação", "Orgânico", "Outro"];

const TABS = ["Pipeline", "Evolução"] as const;
type Tab = (typeof TABS)[number];

function AutomacoesLeadsPage() {
  const [tab, setTab] = useState<Tab>("Pipeline");
  const [filterCanal, setFilterCanal] = useState("");

  const startOfMonth = useMemo(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const { data: metricas = [], isLoading } = useQuery<ClienteMetrics[]>({
    queryKey: ["admin", "automacoes-leads"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: clientes, error } = await supabase
        .from("clientes")
        .select("id, nome, especialidade, status, leads(id, status, canal, criado_em)")
        .in("status", ["ativo", "onboarding"])
        .order("nome");
      if (error) throw error;

      return (clientes ?? []).map((c): ClienteMetrics => {
        const leads = (Array.isArray(c.leads) ? c.leads : []) as Lead[];
        const total = leads.length;
        const novos = leads.filter((l) => l.criado_em >= startOfMonth.toISOString()).length;
        const qualificados = leads.filter((l) => ["qualificado", "em_atendimento", "agendado", "convertido"].includes(l.status)).length;
        const convertidos = leads.filter((l) => l.status === "convertido").length;
        const taxa = total > 0 ? (convertidos / total) * 100 : 0;
        return { id: c.id, nome: c.nome, especialidade: c.especialidade, status: c.status, leads, leads_total: total, leads_novos: novos, leads_qualificados: qualificados, leads_convertidos: convertidos, taxa_conversao: taxa };
      });
    },
  });

  // Agregados globais
  const totais = useMemo(() => {
    const total = metricas.reduce((s, m) => s + m.leads_total, 0);
    const novos = metricas.reduce((s, m) => s + m.leads_novos, 0);
    const conv = metricas.reduce((s, m) => s + m.leads_convertidos, 0);
    const taxa = total > 0 ? ((conv / total) * 100).toFixed(0) : "—";
    return { total, novos, conv, taxa };
  }, [metricas]);

  // Funil global de status
  const funil = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of metricas) {
      for (const l of m.leads) {
        if (filterCanal && l.canal !== filterCanal) continue;
        map[l.status] = (map[l.status] ?? 0) + 1;
      }
    }
    return LEAD_STATUSES.map((s) => ({ status: s, label: STATUS_LABEL[s], count: map[s] ?? 0 }));
  }, [metricas, filterCanal]);

  const maxFunil = Math.max(...funil.map((f) => f.count), 1);

  // Evolução: leads por dia (últimos 30d)
  const evolucao = useMemo(() => {
    const days: Record<string, number> = {};
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 29);
    for (const m of metricas) {
      for (const l of m.leads) {
        if (filterCanal && l.canal !== filterCanal) continue;
        const d = l.criado_em.slice(0, 10);
        if (d >= cutoff.toISOString().slice(0, 10)) days[d] = (days[d] ?? 0) + 1;
      }
    }
    return Object.entries(days).sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({
      date: date.slice(5), count,
    }));
  }, [metricas, filterCanal]);

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Automações de leads</h1>
          <p className="text-xs text-muted-foreground mt-0.5">CPL · CPA · jornada de captação por cliente</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterCanal}
            onChange={(e) => setFilterCanal(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="">Todos canais</option>
            {CANAIS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : metricas.length === 0 ? (
        <EmptyState icon={<Zap className="h-6 w-6" />} title="Nenhum cliente ativo" />
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Leads totais", value: String(totais.total) },
              { label: "Novos (mês)", value: String(totais.novos), color: "text-blue-700" },
              { label: "Convertidos", value: String(totais.conv), color: "text-green-700" },
              { label: "% Conversão", value: `${totais.taxa}%`, color: "text-green-700" },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-border bg-card p-4">
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{k.label}</p>
                <p className={cn("mt-1.5 text-2xl font-bold tracking-tight", k.color)}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-0.5 border-b border-border">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-4 py-2 text-sm transition-colors border-b-2 -mb-px",
                  tab === t ? "border-primary text-foreground font-semibold" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "Pipeline" && (
            <div className="space-y-6">
              {/* Funil visual */}
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-semibold mb-4">Funil global de leads</p>
                <div className="flex flex-col gap-2">
                  {funil.map((f) => (
                    <div key={f.status} className="flex items-center gap-3">
                      <span className="w-28 text-xs text-muted-foreground text-right shrink-0">{f.label}</span>
                      <div className="flex-1 h-7 rounded-md bg-secondary overflow-hidden">
                        <div
                          className={cn("h-full rounded-md transition-all", STATUS_COLOR[f.status] ?? "bg-muted")}
                          style={{ width: `${(f.count / maxFunil) * 100}%`, minWidth: f.count > 0 ? 32 : 0 }}
                        />
                      </div>
                      <span className="w-8 text-xs font-semibold text-right shrink-0">{f.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabela por cliente */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-semibold">Por cliente</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-secondary text-[10.5px] uppercase tracking-wide text-muted-foreground">
                        {["Cliente", "Especialidade", "Total", "Novos/mês", "Qualificados", "Convertidos", "% Conv."].map((h) => (
                          <th key={h} className="px-4 py-2 text-left font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {metricas.map((m) => (
                        <tr key={m.id} className="hover:bg-secondary/40">
                          <td className="px-4 py-2.5 font-medium">{m.nome}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{m.especialidade ?? "—"}</td>
                          <td className="px-4 py-2.5">{m.leads_total}</td>
                          <td className="px-4 py-2.5 font-medium text-blue-700">{m.leads_novos}</td>
                          <td className="px-4 py-2.5">{m.leads_qualificados}</td>
                          <td className="px-4 py-2.5 font-medium text-green-700">{m.leads_convertidos}</td>
                          <td className="px-4 py-2.5 font-semibold">{m.taxa_conversao > 0 ? `${m.taxa_conversao.toFixed(0)}%` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === "Evolução" && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold mb-3">Leads por dia — últimos 30 dias</p>
              {evolucao.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Sem dados para o período</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={evolucao} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, background: "var(--color-card)", border: "1px solid var(--color-border)", color: "var(--color-foreground)" }} />
                      <Bar dataKey="count" name="Leads" fill="#1E5CC8" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
