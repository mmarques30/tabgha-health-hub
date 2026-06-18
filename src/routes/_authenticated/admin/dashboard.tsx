import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ArrowRight, ArrowUp, ArrowDown, TrendingUp } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  component: AdminDashboard,
  head: () => ({ meta: [{ title: "Dashboard — Tabgha Admin" }] }),
});

async function fetchDashboard() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const since = thirtyDaysAgo.toISOString().slice(0, 10);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [clientesRes, leadsRes, leadsMonthRes, entregasRes, leadsTimelineRes, conteudosPendentesRes, clientesSaudeRes] = await Promise.all([
    supabase.from("clientes").select("id", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("leads").select("id", { count: "exact", head: true }),
    supabase.from("leads").select("id", { count: "exact", head: true }).gte("criado_em", startOfMonth.toISOString()),
    supabase.from("entregas").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    supabase.from("leads").select("criado_em").gte("criado_em", since).order("criado_em"),
    supabase.from("conteudos").select("id, titulo, status, clientes(nome)").in("status", ["briefing", "roteiro", "producao"]).order("criado_em", { ascending: false }).limit(6),
    supabase.from("clientes").select("id, nome, especialidade, status, leads(id, status, criado_em)").in("status", ["ativo", "onboarding", "pausa"]).order("nome").limit(8),
  ]);

  const dayMap: Record<string, number> = {};
  for (const l of leadsTimelineRes.data ?? []) {
    const d = (l.criado_em as string).slice(0, 10);
    dayMap[d] = (dayMap[d] ?? 0) + 1;
  }
  const leadsTimeline = Object.entries(dayMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date: date.slice(5), count }));

  const saudeCarteira = (clientesSaudeRes.data ?? []).map((c) => {
    const leads = (Array.isArray(c.leads) ? c.leads : []) as { id: string; status: string; criado_em: string }[];
    const total = leads.length;
    const mes = leads.filter((l) => l.criado_em >= startOfMonth.toISOString()).length;
    const conv = leads.filter((l) => l.status === "convertido").length;
    const ultimoLead = leads.length > 0 ? leads.sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0].criado_em : null;
    return { id: c.id, nome: c.nome, especialidade: c.especialidade, status: c.status, total, mes, conv, ultimoLead };
  });

  return {
    clientes: clientesRes.count ?? 0,
    leads: leadsRes.count ?? 0,
    leadsMes: leadsMonthRes.count ?? 0,
    entregas_pendentes: entregasRes.count ?? 0,
    leadsTimeline,
    conteudosPendentes: (conteudosPendentesRes.data ?? []) as { id: string; titulo: string | null; status: string; clientes: { nome: string } | null }[],
    saudeCarteira,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CLIENTE_STATUS: Record<string, { dot: string; label: string; text: string }> = {
  ativo:      { dot: "bg-emerald-400", label: "Ativo",      text: "text-emerald-700" },
  onboarding: { dot: "bg-blue-400",    label: "Onboarding", text: "text-blue-700" },
  pausa:      { dot: "bg-amber-400",   label: "Pausa",      text: "text-amber-700" },
  inativo:    { dot: "bg-slate-400",   label: "Inativo",    text: "text-slate-600" },
};

function ultimoLeadColor(d: string | null) {
  if (!d) return "text-muted-foreground/40";
  const days = differenceInDays(new Date(), new Date(d));
  if (days <= 7)  return "text-emerald-600 font-semibold";
  if (days <= 30) return "text-amber-600";
  return "text-rose-500";
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-2">
      <p className="text-[10px] text-white/50 mb-0.5">{label}</p>
      <p className="text-sm font-bold text-white">{payload[0].value} leads</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: fetchDashboard,
    staleTime: 60_000,
  });

  const stageCounts = {
    briefing: data?.conteudosPendentes.filter((c) => c.status === "briefing").length ?? 0,
    roteiro:  data?.conteudosPendentes.filter((c) => c.status === "roteiro").length ?? 0,
    producao: data?.conteudosPendentes.filter((c) => c.status === "producao").length ?? 0,
  };
  const stageTotal = stageCounts.briefing + stageCounts.roteiro + stageCounts.producao;

  const KPI_CARDS = [
    {
      rank: "01",
      label: "Clientes ativos",
      value: data?.clientes ?? 0,
      delta: { value: "+2", dir: "up" as "up" | "down" | "neutral", note: "vs mês ant." },
      accent: "text-primary",
      bar: "bg-primary",
    },
    {
      rank: "02",
      label: "Leads no mês",
      value: data?.leadsMes ?? 0,
      delta: data ? { value: String(data.leads), dir: "neutral" as const, note: "total" } : undefined,
      accent: "text-violet-700",
      bar: "bg-violet-500",
    },
    {
      rank: "03",
      label: "Entregas pendentes",
      value: data?.entregas_pendentes ?? 0,
      delta: undefined,
      accent: data && data.entregas_pendentes > 0 ? "text-amber-600" : "text-foreground",
      bar: data && data.entregas_pendentes > 0 ? "bg-amber-400" : "bg-border",
    },
    {
      rank: "04",
      label: "Total de leads",
      value: data?.leads ?? 0,
      delta: undefined,
      accent: "text-foreground",
      bar: "bg-foreground/20",
    },
  ];

  return (
    <div className="px-6 py-6 space-y-4">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="animate-fade-up flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Operação ao vivo</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Indicadores em tempo real da operação Tabgha</p>
        </div>
      </header>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {KPI_CARDS.map(({ rank, label, value, delta, accent, bar }, i) => (
          <div
            key={rank}
            className="card-lift animate-fade-up rounded-2xl border border-border bg-card px-5 pt-5 pb-4 shadow-[0_1px_3px_rgba(15,27,53,0.04)] flex flex-col"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <span className="text-[9px] font-black tracking-[0.16em] text-muted-foreground/40 mb-4">{rank}</span>
            <p
              className={cn("text-[2.4rem] font-black leading-none tracking-tighter animate-numeric-pop", accent)}
              style={{ animationDelay: `${i * 70 + 100}ms` }}
            >
              {isLoading ? <span className="inline-block h-9 w-16 animate-pulse rounded-lg bg-secondary align-middle" /> : value}
            </p>
            <p className="mt-2 text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
            {delta && (
              <div className="mt-1.5 flex items-center gap-1">
                {delta.dir === "up"   && <ArrowUp   className="h-2.5 w-2.5 shrink-0 text-emerald-500" />}
                {delta.dir === "down" && <ArrowDown className="h-2.5 w-2.5 shrink-0 text-rose-500" />}
                <span className={cn("text-[10.5px]", delta.dir === "up" ? "text-emerald-600 font-medium" : "text-muted-foreground")}>
                  {delta.value} {delta.note}
                </span>
              </div>
            )}
            <div className={cn("mt-4 h-0.5 w-full rounded-full", bar)} />
          </div>
        ))}
      </div>

      {/* ── Middle row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">

        {/* Dark chart card */}
        <div
          className="animate-fade-up delay-300 rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(11,27,62,0.18)]"
          style={{ background: "linear-gradient(135deg, #0B1B3E 0%, #0F2550 100%)" }}
        >
          <div className="px-6 pt-6 pb-4 flex items-start justify-between">
            <div>
              <span className="text-[9px] font-black tracking-[0.16em] text-white/30">05</span>
              <p className="mt-1 text-base font-bold text-white">Novos leads — 30 dias</p>
              <p className="text-[11px] text-white/40 mt-0.5">Evolução diária de captação</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-white">{data?.leadsMes ?? "—"}</p>
              <p className="text-[10px] text-white/40 mt-0.5">este mês</p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-white/30" />
            </div>
          ) : (data?.leadsTimeline ?? []).length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2">
              <TrendingUp className="h-6 w-6 text-white/20" />
              <p className="text-sm text-white/30">Sem dados no período</p>
            </div>
          ) : (
            <div className="h-48 px-2 pb-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data!.leadsTimeline} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradDark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#60C3E8" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#60C3E8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="count" stroke="#60C3E8" strokeWidth={2.5} fill="url(#gradDark)" dot={false} activeDot={{ r: 5, fill: "#60C3E8", stroke: "#0B1B3E", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Pipeline editorial */}
        <div className="animate-fade-up delay-375 rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)] flex flex-col">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <span className="text-[9px] font-black tracking-[0.16em] text-muted-foreground/40">06</span>
              <p className="mt-1 text-sm font-bold">Pipeline editorial</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{stageTotal} em produção</p>
            </div>
            <Link to="/admin/estrategia" className="text-[11px] text-primary font-semibold hover:underline flex items-center gap-1">
              Ver tudo <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-4 flex-1">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-secondary/60" />)}
            </div>
          ) : (
            <div className="space-y-4 flex-1">
              {[
                { key: "briefing", label: "Briefing",  count: stageCounts.briefing, color: "bg-slate-400" },
                { key: "roteiro",  label: "Roteiro",   count: stageCounts.roteiro,  color: "bg-primary" },
                { key: "producao", label: "Produção",  count: stageCounts.producao, color: "bg-amber-400" },
              ].map(({ key, label, count, color }) => {
                const pct = stageTotal > 0 ? Math.round((count / stageTotal) * 100) : 0;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-foreground">{label}</span>
                      <span className="text-xs font-bold text-foreground tabular-nums">{count}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-700", color)}
                        style={{ width: stageTotal === 0 ? "100%" : `${pct}%`, opacity: stageTotal === 0 ? 0.2 : 1 }}
                      />
                    </div>
                  </div>
                );
              })}

              {/* Recent items */}
              {data && data.conteudosPendentes.length > 0 && (
                <div className="mt-2 pt-4 border-t border-border space-y-2">
                  {data.conteudosPendentes.slice(0, 3).map((c, i) => (
                    <div
                      key={c.id}
                      className="animate-fade-up flex items-center gap-2.5 text-xs"
                      style={{ animationDelay: `${440 + i * 50}ms` }}
                    >
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", {
                        "bg-slate-400": c.status === "briefing",
                        "bg-primary":   c.status === "roteiro",
                        "bg-amber-400": c.status === "producao",
                      })} />
                      <span className="truncate text-muted-foreground flex-1">{c.titulo ?? "Sem título"}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground/60">{c.clientes?.nome?.split(" ")[0] ?? "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Saúde da carteira ───────────────────────────────────────────────── */}
      <div className="animate-fade-up delay-450 rounded-2xl border border-border bg-card overflow-hidden shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <span className="text-[9px] font-black tracking-[0.16em] text-muted-foreground/40">07</span>
            <p className="mt-0.5 text-sm font-bold">Saúde da carteira</p>
          </div>
          <Link to="/admin/clientes" className="text-[11px] text-primary font-semibold flex items-center gap-1 hover:underline">
            Ver todos <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-11 animate-pulse rounded-xl bg-secondary/60" style={{ opacity: 1 - i * 0.25 }} />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/20 text-[9.5px] font-black uppercase tracking-[0.1em] text-muted-foreground/60">
                  <th className="px-6 py-2.5 text-left w-8">#</th>
                  <th className="px-4 py-2.5 text-left">Cliente</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-right">Leads/mês</th>
                  <th className="px-4 py-2.5 text-left">Conversão</th>
                  <th className="px-4 py-2.5 text-left">Último lead</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(data?.saudeCarteira ?? []).map((c, i) => {
                  const pct = c.total > 0 ? Math.round((c.conv / c.total) * 100) : 0;
                  const st = CLIENTE_STATUS[c.status] ?? CLIENTE_STATUS.inativo;
                  const initials = c.nome.trim().split(/\s+/).slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();

                  return (
                    <tr
                      key={c.id}
                      className="animate-fade-up group hover:bg-secondary/30 transition-colors"
                      style={{ animationDelay: `${500 + i * 50}ms` }}
                    >
                      <td className="px-6 py-3.5">
                        <span className="text-[10px] font-black text-muted-foreground/30 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <Link to={"/admin/clientes/$id" as any} params={{ id: c.id } as any} className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-extrabold text-primary">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground group-hover:text-primary transition-colors truncate text-[13px]">{c.nome}</p>
                            <p className="text-[10.5px] text-muted-foreground truncate">{c.especialidade ?? "—"}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", st.dot)} />
                          <span className={cn("text-[11px] font-semibold capitalize", st.text)}>{st.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-base font-extrabold text-primary tabular-nums">{c.mes}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary shrink-0">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-bold text-emerald-600 tabular-nums w-7 shrink-0">{pct}%</span>
                        </div>
                      </td>
                      <td className={cn("px-4 py-3.5 text-[11.5px]", ultimoLeadColor(c.ultimoLead))}>
                        {c.ultimoLead
                          ? formatDistanceToNow(new Date(c.ultimoLead), { addSuffix: true, locale: ptBR })
                          : <span className="text-muted-foreground/30">—</span>}
                      </td>
                    </tr>
                  );
                })}
                {(data?.saudeCarteira ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-muted-foreground">
                      Nenhum cliente cadastrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
