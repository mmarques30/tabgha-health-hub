import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Stethoscope, Loader2, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/admin/diagnosticos")({
  component: DiagnosticosPage,
  head: () => ({ meta: [{ title: "Diagnósticos — Tabgha Admin" }] }),
});

function DiagnosticosPage() {
  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["admin", "diagnosticos", "clientes"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, especialidade, status, diagnostico")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const comDiagnostico = clientes.filter((c) => c.diagnostico);
  const semDiagnostico = clientes.filter((c) => !c.diagnostico);

  return (
    <div className="px-6 py-6 space-y-6">
      <div>
        <span className="eyebrow-pill">Estratégia</span>
        <h1 className="mt-2 text-xl font-bold tracking-tight">Diagnósticos</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">Diagnósticos estratégicos por cliente. Edite via ficha do cliente.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Total</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{clientes.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Preenchidos</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-green-700">{comDiagnostico.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Pendentes</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-yellow-700">{semDiagnostico.length}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : clientes.length === 0 ? (
        <EmptyState
          icon={<Stethoscope className="h-6 w-6" />}
          title="Nenhum cliente cadastrado"
          description="Os clientes aparecem aqui conforme forem adicionados."
        />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {clientes.map((c) => (
            <Link
              key={c.id}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              to={"/admin/clientes/$id" as any}
              params={{ id: c.id } as any}
              className="flex items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{c.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {c.especialidade ?? "—"} · {c.status}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    c.diagnostico
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {c.diagnostico ? "Preenchido" : "Pendente"}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
