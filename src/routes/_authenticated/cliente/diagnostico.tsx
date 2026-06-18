import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Stethoscope, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/cliente/diagnostico")({
  component: DiagnosticoPage,
  head: () => ({ meta: [{ title: "Diagnóstico — Portal" }] }),
});

function renderJson(value: Json, depth = 0): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <span className="text-foreground">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    return (
      <ul className="mt-1 space-y-1">
        {value.map((item, i) => <li key={i} className="ml-4 list-disc text-sm">{renderJson(item, depth + 1)}</li>)}
      </ul>
    );
  }
  if (typeof value === "object") {
    return (
      <div className={depth > 0 ? "mt-2 pl-4 border-l border-border" : ""}>
        {Object.entries(value as Record<string, Json>).map(([k, v]) => (
          <div key={k} className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{k.replace(/_/g, " ")}</p>
            <div className="mt-0.5 text-sm">{renderJson(v, depth + 1)}</div>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

function DiagnosticoPage() {
  const { profile } = useAuth();
  const clienteId = profile?.cliente_id;

  const { data: cliente, isLoading } = useQuery({
    queryKey: ["cliente", "diagnostico", clienteId],
    enabled: !!clienteId,
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes").select("nome, especialidade, diagnostico").eq("id", clienteId!).single();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="px-8 py-8">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Estratégia</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Diagnóstico</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Análise estratégica do {cliente?.especialidade ? `consultório de ${cliente.especialidade}` : "seu consultório"}.
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : !cliente?.diagnostico ? (
        <EmptyState icon={<Stethoscope className="h-6 w-6" />} title="Diagnóstico não preenchido"
          description="A equipe Tabgha preencherá o diagnóstico estratégico do seu consultório em breve." />
      ) : (
        <div className="max-w-2xl rounded-xl border border-border bg-card p-6">
          {renderJson(cliente.diagnostico)}
        </div>
      )}
    </div>
  );
}
