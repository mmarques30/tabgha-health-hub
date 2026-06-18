import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, UserCheck, FileCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  component: AdminDashboard,
  head: () => ({ meta: [{ title: "Dashboard — Tabgha Admin" }] }),
});

async function fetchCounts() {
  const [clientesRes, leadsRes, entregasRes] = await Promise.all([
    supabase.from("clientes").select("id", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("leads").select("id", { count: "exact", head: true }),
    supabase.from("entregas").select("id", { count: "exact", head: true }).eq("status", "pendente"),
  ]);
  return {
    clientes: clientesRes.count ?? 0,
    leads: leadsRes.count ?? 0,
    entregas_pendentes: entregasRes.count ?? 0,
  };
}

type KpiCardProps = {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
};

function KpiCard({ label, value, icon: Icon, loading }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-3">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
        )}
      </div>
    </div>
  );
}

function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "dashboard", "counts"],
    queryFn: fetchCounts,
    staleTime: 60_000,
  });

  return (
    <div className="px-8 py-8">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Visão executiva</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Indicadores em tempo real da operação Tabgha.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Clientes ativos"     value={data?.clientes ?? 0}           icon={UserCheck} loading={isLoading} />
        <KpiCard label="Total de leads"      value={data?.leads ?? 0}              icon={Users}     loading={isLoading} />
        <KpiCard label="Entregas pendentes"  value={data?.entregas_pendentes ?? 0} icon={FileCheck} loading={isLoading} />
      </section>

      {!isLoading && data?.clientes === 0 && (
        <div className="mt-12">
          <EmptyState
            icon={<UserCheck className="h-6 w-6" />}
            title="Nenhum cliente cadastrado ainda"
            description="Adicione o primeiro cliente para começar a ver métricas aqui."
          />
        </div>
      )}
    </div>
  );
}
