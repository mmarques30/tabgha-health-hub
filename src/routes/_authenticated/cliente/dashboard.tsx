import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, FileCheck, Calendar, TrendingUp, Loader2, MessageCircle, CheckCircle2, ArrowRight, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cliente/dashboard")({
  component: ClienteDashboard,
  head: () => ({ meta: [{ title: "Portal do Cliente — Tabgha" }] }),
});

function KpiCard({ label, value, icon: Icon, loading, accent }: {
  label: string; value: number; icon: React.ComponentType<{ className?: string }>; loading: boolean; accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-3">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <p className={cn("text-2xl font-bold tracking-tight", accent)}>{value}</p>
        )}
      </div>
    </div>
  );
}

function ClienteDashboard() {
  const { profile } = useAuth();
  const clienteId = profile?.cliente_id;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: counts, isLoading: loadingCounts } = useQuery({
    queryKey: ["cliente", "dashboard", "counts", clienteId],
    enabled: !!clienteId,
    staleTime: 60_000,
    queryFn: async () => {
      const [leadsRes, novosMesRes, entregasRes] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("cliente_id", clienteId!),
        supabase.from("leads").select("id", { count: "exact", head: true })
          .eq("cliente_id", clienteId!).gte("criado_em", startOfMonth.toISOString()),
        supabase.from("entregas").select("id", { count: "exact", head: true })
          .eq("cliente_id", clienteId!).eq("status", "pendente"),
      ]);
      return {
        leads: leadsRes.count ?? 0,
        novos_mes: novosMesRes.count ?? 0,
        entregas_pendentes: entregasRes.count ?? 0,
      };
    },
  });

  const { data: proximos, isLoading: loadingAgendamentos } = useQuery({
    queryKey: ["cliente", "dashboard", "agendamentos", clienteId],
    enabled: !!clienteId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("agendamentos")
        .select("id, titulo, inicio, tipo")
        .eq("cliente_id", clienteId!)
        .eq("visivel_cliente", true)
        .gte("inicio", new Date().toISOString())
        .order("inicio")
        .limit(3);
      return data ?? [];
    },
  });

  const { data: aprovacoes, isLoading: loadingAprovacoes } = useQuery({
    queryKey: ["cliente", "dashboard", "aprovacoes", clienteId],
    enabled: !!clienteId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("conteudos")
        .select("id, titulo, rede, tipo, data_postagem")
        .eq("cliente_id", clienteId!)
        .eq("status", "aprovacao")
        .order("data_postagem", { ascending: true, nullsFirst: false })
        .limit(4);
      return data ?? [];
    },
  });

  const { data: conversas, isLoading: loadingConversas } = useQuery({
    queryKey: ["cliente", "dashboard", "conversas", clienteId],
    enabled: !!clienteId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_conversations")
        .select("id, contact_name, contact_phone, last_inbound_at, atualizado_em")
        .eq("cliente_id", clienteId!)
        .order("atualizado_em", { ascending: false })
        .limit(4);
      return data ?? [];
    },
  });

  return (
    <div className="px-6 py-6 space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Visão geral da sua operação de marketing</p>
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label="Leads totais"       value={counts?.leads ?? 0}              icon={Users}      loading={loadingCounts} />
        <KpiCard label="Novos este mês"     value={counts?.novos_mes ?? 0}          icon={TrendingUp} loading={loadingCounts} accent="text-blue-700" />
        <KpiCard label="Entregas pendentes" value={counts?.entregas_pendentes ?? 0} icon={FileCheck}  loading={loadingCounts} accent={(counts?.entregas_pendentes ?? 0) > 0 ? "text-yellow-700" : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Aprovações pendentes */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Aprovações pendentes</p>
            </div>
            <Link to="/cliente/calendario" className="flex items-center gap-1 text-xs text-primary hover:underline">
              Ver calendário <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {loadingAprovacoes ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (aprovacoes ?? []).length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="Nenhuma aprovação pendente" />
          ) : (
            <div className="space-y-2">
              {aprovacoes!.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-lg bg-secondary/40 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.titulo ?? "Sem título"}</p>
                    <p className="text-[10px] text-muted-foreground">{[c.rede, c.tipo].filter(Boolean).join(" · ")}</p>
                  </div>
                  {c.data_postagem && (
                    <span className="shrink-0 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {format(new Date(c.data_postagem), "dd MMM", { locale: ptBR })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Conversas recentes */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Conversas recentes</p>
            </div>
            <Link to="/cliente/atendimento" className="flex items-center gap-1 text-xs text-primary hover:underline">
              Ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {loadingConversas ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (conversas ?? []).length === 0 ? (
            <EmptyState icon={<MessageCircle className="h-5 w-5" />} title="Nenhuma conversa recente" />
          ) : (
            <div className="space-y-2">
              {conversas!.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-lg bg-secondary/40 px-3 py-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                    {(c.contact_name ?? c.contact_phone ?? "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.contact_name ?? c.contact_phone}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{c.contact_phone}</p>
                  </div>
                  {c.atualizado_em && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {format(new Date(c.atualizado_em), "dd MMM", { locale: ptBR })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Próximos agendamentos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Próximos agendamentos</p>
          </div>
          <Link to="/cliente/calendario" className="flex items-center gap-1 text-xs text-primary hover:underline">
            Ver calendário <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {loadingAgendamentos ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (proximos ?? []).length === 0 ? (
          <EmptyState icon={<Calendar className="h-5 w-5" />} title="Nenhum agendamento próximo" />
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border">
            {proximos!.map((ag) => (
              <div key={ag.id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-muted text-xs font-semibold">
                  {ag.inicio ? (
                    <>
                      <span className="text-sm font-bold">{format(new Date(ag.inicio), "dd")}</span>
                      <span className="text-[10px] uppercase text-muted-foreground">{format(new Date(ag.inicio), "MMM", { locale: ptBR })}</span>
                    </>
                  ) : "—"}
                </div>
                <div>
                  <p className="text-sm font-medium">{ag.titulo}</p>
                  <p className="text-xs text-muted-foreground">{ag.tipo ?? "Reunião"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
