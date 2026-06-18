import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/admin/roi")({
  component: RoiAdminPage,
  head: () => ({ meta: [{ title: "ROI — Tabgha Admin" }] }),
});

function RoiAdminPage() {
  const { data: metricas = [], isLoading } = useQuery({
    queryKey: ["admin", "roi", "metricas"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metricas_ads")
        .select("*, clientes(nome)")
        .order("data", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="px-8 py-8">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Resultados
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">ROI</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Métricas de retorno sobre investimento por cliente.
        </p>
      </header>

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
        <div className="divide-y divide-border rounded-xl border border-border">
          {metricas.map((m) => (
            <div key={m.id} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                  {(m.clientes as { nome: string } | null)?.nome ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {m.plataforma} · {m.campanha ?? "—"} · {m.data}
                </p>
              </div>
              <div className="flex items-center gap-6 shrink-0 text-right">
                <div>
                  <p className="text-xs text-muted-foreground">Investimento</p>
                  <p className="text-sm font-semibold">
                    {m.investimento != null
                      ? `R$ ${Number(m.investimento).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ROAS</p>
                  <p className="text-sm font-semibold">
                    {m.roas != null ? `${Number(m.roas).toFixed(1)}x` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Leads</p>
                  <p className="text-sm font-semibold">{m.leads}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
