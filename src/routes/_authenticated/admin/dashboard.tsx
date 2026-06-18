import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Users, UserCheck, FileCheck, Loader2, ArrowRight, TrendingUp,
  Zap, ArrowUp, ArrowDown, FileText, PenTool, Film, Activity,
} from "lucide-react";
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

// ── KPI Card ──────────────────────────────────────────────────────────────────
function DashKpiCard({
  label, value, delta, icon: Icon, iconBg, iconColor, valueColor, loading, delay = 0,
}: {
  label: string;
  value: number | string;
  delta?: { value: string; label?: string; direction?: "up" | "down" | "neutral" };
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  valueColor?: string;
  loading?: boolean;
  delay?: number;
}) {
  return (
    <div
      className="card-lift animate-fade-up group relative rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)] overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground leading-tight">{label}</p>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110", iconBg)}>
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-9 w-24 animate-pulse rounded-lg bg-secondary" />
          <div className="h-3 w-16 animate-pulse rounded bg-secondary/60" />
        </div>
      ) : (
        <>
          <p
            className={cn("text-[2rem] font-extrabold leading-none tracking-tight animate-numeric-pop", valueColor ?? "text-foreground")}
            style={{ animationDelay: `${delay + 80}ms` }}
          >
            {value}
          </p>
          {delta && (
            <div className="mt-2 flex items-center gap-1">
              {delta.direction === "up"      && <ArrowUp   className="h-3 w-3 text-emerald-500 shrink-0" />}
              {delta.direction === "down"    && <ArrowDown className="h-3 w-3 text-rose-500 shrink-0" />}
              <p className={cn(
                "text-[11px] font-medium",
                delta.direction === "up"   ? "text-emerald-600"
                : delta.direction === "down" ? "text-rose-600"
                : "text-muted-foreground",
              )}>
                {delta.value}{delta.label ? ` ${delta.label}` : ""}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Content stage config ──────────────────────────────────────────────────────
const STAGE_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; pill: string; dot: string }> = {
  briefing: { label: "Briefing",  icon: FileText, pill: "bg-slate-100 text-slate-600",   dot: "bg-slate-400" },
  roteiro:  { label: "Roteiro",   icon: PenTool,  pill: "bg-blue-100 text-blue-700",     dot: "bg-blue-500" },
  producao: { label: "Produção",  icon: Film,     pill: "bg-amber-100 text-amber-700",   dot: "bg-amber-500" },
};

const CLIENTE_STATUS: Record<string, { pill: string; dot: string; label: string }> = {
  ativo:       { pill: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-400", label: "ativo" },
  onboarding:  { pill: "bg-blue-100 text-blue-700 border-blue-200",          dot: "bg-blue-400",    label: "onboarding" },
  pausa:       { pill: "bg-amber-100 text-amber-700 border-amber-200",        dot: "bg-amber-400",   label: "pausa" },
  inativo:     { pill: "bg-slate-100 text-slate-600 border-slate-200",        dot: "bg-slate-400",   label: "inativo" },
};

function ultimoLeadClass(d: string | null): string {
  if (!d) return "text-muted-foreground/50";
  const days = differenceInDays(new Date(), new Date(d));
  if (days <= 7)  return "text-emerald-600 font-medium";
  if (days <= 30) return "text-amber-600";
  return "text-rose-500";
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-bold text-primary">{payload[0].value} leads</p>
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

  const stageCounts = data?.conteudosPendentes.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="px-6 py-6 space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="animate-fade-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="eyebrow-pill">Operação ao vivo</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Indicadores em tempo real da operação Tabgha</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">{data?.clientes ?? "—"} clientes</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-xs text-muted-foreground">{data?.leads ?? "—"} leads totais</span>
        </div>
      </header>

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <DashKpiCard
          label="Clientes ativos"
          value={data?.clientes ?? 0}
          icon={UserCheck}
          iconBg="bg-primary/10"
          iconColor="text-primary"
          loading={isLoading}
          delay={0}
          delta={data ? { value: "+2", label: "vs mês ant.", direction: "up" } : undefined}
        />
        <DashKpiCard
          label="Leads no mês"
          value={data?.leadsMes ?? 0}
          icon={Zap}
          iconBg="bg-violet-100"
          iconColor="text-violet-600"
          valueColor="text-violet-700"
          loading={isLoading}
          delay={75}
          delta={data ? { value: String(data.leads), label: "total", direction: "neutral" } : undefined}
        />
        <DashKpiCard
          label="Entregas pendentes"
          value={data?.entregas_pendentes ?? 0}
          icon={FileCheck}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
          valueColor={data && data.entregas_pendentes > 0 ? "text-amber-600" : undefined}
          loading={isLoading}
          delay={150}
        />
        <DashKpiCard
          label="Total de leads"
          value={data?.leads ?? 0}
          icon={Users}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
          valueColor="text-emerald-700"
          loading={isLoading}
          delay={225}
          delta={data && data.leads > 0 ? { value: `${data.clientes > 0 ? Math.round(data.leads / data.clientes) : 0}`, label: "leads/cliente", direction: "neutral" } : undefined}
        />
      </div>

      {/* ── Chart + Pipeline ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">

        {/* Area chart */}
        <div className="animate-fade-up delay-300 rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold">Novos leads — 30 dias</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Evolução diária de captação</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-2.5 w-5 rounded-sm bg-primary opacity-70 inline-block" />
                <span>Leads</span>
              </div>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                {data?.leadsMes ?? 0} este mês
              </span>
            </div>
          </div>
          {isLoading ? (
            <div className="flex h-56 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (data?.leadsTimeline ?? []).length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Sem dados no período</p>
              <p className="text-[11px] text-muted-foreground/70">Os leads aparecem aqui conforme chegarem</p>
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data!.leadsTimeline} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradLeadsDash" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#1A5FAD" stopOpacity={0.35} />
                      <stop offset="70%"  stopColor="#1A5FAD" stopOpacity={0.08} />
                      <stop offset="100%" stopColor="#1A5FAD" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,27,53,0.05)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: "#9AA1B8" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "#9AA1B8" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Leads"
                    stroke="#1A5FAD"
                    strokeWidth={2.5}
                    fill="url(#gradLeadsDash)"
                    dot={false}
                    activeDot={{ r: 5, fill: "#1A5FAD", stroke: "white", strokeWidth: 2.5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Content pipeline */}
        <div className="animate-fade-up delay-375 rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">Conteúdos em produção</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Pipeline editorial ativo</p>
            </div>
            <Link to="/admin/estrategia" className="flex items-center gap-1 text-[11px] text-primary font-medium hover:underline">
              Ver tudo <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Stage pills */}
          {!isLoading && stageCounts && Object.keys(stageCounts).length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {Object.entries(STAGE_CONFIG).map(([key, cfg]) => {
                const count = stageCounts[key] ?? 0;
                if (!count) return null;
                return (
                  <div key={key} className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-2.5 py-1">
                    <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
                    <span className="text-[10.5px] font-semibold text-muted-foreground">{cfg.label}</span>
                    <span className="text-[11px] font-bold text-foreground">{count}</span>
                  </div>
                );
              })}
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2.5">
              {[1,2,3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-secondary/60" style={{ opacity: 1 - i * 0.2 }} />
              ))}
            </div>
          ) : (data?.conteudosPendentes ?? []).length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                <Film className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Nenhum conteúdo em produção</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data!.conteudosPendentes.map((c, i) => {
                const cfg = STAGE_CONFIG[c.status];
                const StageIcon = cfg?.icon ?? FileText;
                return (
                  <div
                    key={c.id}
                    className="animate-fade-up flex items-center gap-3 rounded-xl border border-border/60 bg-secondary/30 px-3.5 py-2.5 hover:bg-secondary/60 transition-colors"
                    style={{ animationDelay: `${420 + i * 50}ms` }}
                  >
                    <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", cfg ? cfg.pill.replace("text-", "bg-").split(" ")[0] + "/30" : "bg-secondary")}>
                      <StageIcon className={cn("h-3.5 w-3.5", cfg ? cfg.pill.split(" ")[1] : "text-muted-foreground")} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-semibold">{c.titulo ?? "Sem título"}</p>
                      <p className="text-[10.5px] text-muted-foreground">{c.clientes?.nome ?? "—"}</p>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide", cfg?.pill ?? "bg-muted text-muted-foreground")}>
                      {cfg?.label ?? c.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Saúde da carteira ───────────────────────────────────────────────── */}
      <div className="animate-fade-up delay-450 rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(15,27,53,0.04)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-secondary/20">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">Saúde da carteira</p>
              <p className="text-[10.5px] text-muted-foreground">Performance por cliente</p>
            </div>
          </div>
          <Link to="/admin/clientes" className="flex items-center gap-1 text-[11px] text-primary font-medium hover:underline">
            Ver todos <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1,2,3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-secondary/60" style={{ opacity: 1 - i * 0.25 }} />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/30 text-[10px] uppercase tracking-[0.08em] text-muted-foreground border-b border-border">
                  {["Cliente", "Status", "Leads/mês", "Taxa conv.", "Total", "Último lead"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(data?.saudeCarteira ?? []).map((c, i) => {
                  const pct = c.total > 0 ? Math.round((c.conv / c.total) * 100) : 0;
                  const statusCfg = CLIENTE_STATUS[c.status] ?? CLIENTE_STATUS.inativo;
                  const initials = c.nome.trim().split(/\s+/).slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();

                  return (
                    <tr
                      key={c.id}
                      className="animate-fade-up hover:bg-secondary/40 transition-colors cursor-pointer group"
                      style={{ animationDelay: `${500 + i * 55}ms` }}
                    >
                      <td className="px-4 py-3">
                        <Link to={"/admin/clientes/$id" as any} params={{ id: c.id } as any} className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-extrabold text-primary">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">{c.nome}</p>
                            <p className="text-[10.5px] text-muted-foreground truncate">{c.especialidade ?? "—"}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold", statusCfg.pill)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", statusCfg.dot)} />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-base font-extrabold text-primary" style={{ fontVariantNumeric: "tabular-nums" }}>{c.mes}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-bold text-emerald-600 tabular-nums">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground/80 tabular-nums">{c.total}</td>
                      <td className={cn("px-4 py-3 text-[11.5px]", ultimoLeadClass(c.ultimoLead))}>
                        {c.ultimoLead
                          ? formatDistanceToNow(new Date(c.ultimoLead), { addSuffix: true, locale: ptBR })
                          : <span className="text-muted-foreground/40">—</span>}
                      </td>
                    </tr>
                  );
                })}
                {(data?.saudeCarteira ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
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
