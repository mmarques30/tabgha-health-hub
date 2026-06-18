import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/admin/estrategia")({
  component: EstrategiaPage,
  head: () => ({ meta: [{ title: "Estratégia — Tabgha Admin" }] }),
});

function EstrategiaPage() {
  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["admin", "estrategia", "clientes"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, especialidade, status, diagnostico")
        .eq("status", "ativo")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="px-8 py-8">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Planejamento
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Estratégia</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Diagnósticos estratégicos e posicionamento por cliente.
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : clientes.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="h-6 w-6" />}
          title="Nenhum cliente ativo"
          description="Diagnósticos estratégicos aparecem aqui conforme os clientes forem ativados."
        />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {clientes.map((c) => (
            <div key={c.id} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{c.nome}</p>
                <p className="text-xs text-muted-foreground">{c.especialidade ?? "—"}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  c.diagnostico
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {c.diagnostico ? "Diagnóstico preenchido" : "Sem diagnóstico"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
