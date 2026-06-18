import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Zap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/automacoes-leads")({
  component: AutomacoesLeadsPage,
  head: () => ({ meta: [{ title: "Automações — Tabgha Admin" }] }),
});

type ClienteMetrics = {
  id: string;
  nome: string;
  especialidade: string | null;
  status: string;
  leads_total: number;
  leads_novos: number;
  leads_convertidos: number;
  taxa_conversao: string;
};

function AutomacoesLeadsPage() {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: metricas = [], isLoading } = useQuery({
    queryKey: ["admin", "automacoes-leads"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: clientes, error } = await supabase
        .from("clientes")
        .select("id, nome, especialidade, status, leads(id, status, criado_em)")
        .in("status", ["ativo", "onboarding"])
        .order("nome");

      if (error) throw error;

      return (clientes ?? []).map((c): ClienteMetrics => {
        const leads = Array.isArray(c.leads) ? c.leads as { id: string; status: string; criado_em: string }[] : [];
        const total = leads.length;
        const novos = leads.filter((l) => l.criado_em >= startOfMonth.toISOString()).length;
        const convertidos = leads.filter((l) => l.status === "convertido").length;
        const taxa = total > 0 ? `${((convertidos / total) * 100).toFixed(0)}%` : "—";
        return { id: c.id, nome: c.nome, especialidade: c.especialidade, status: c.status, leads_total: total, leads_novos: novos, leads_convertidos: convertidos, taxa_conversao: taxa };
      });
    },
  });

  return (
    <div className="px-8 py-8">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Operação</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Automações & Leads</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pipeline multi-cliente consolidado.</p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : metricas.length === 0 ? (
        <EmptyState icon={<Zap className="h-6 w-6" />} title="Nenhum cliente ativo" description="Clientes ativos e em onboarding aparecem aqui." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                {["Cliente", "Especialidade", "Status", "Leads totais", "Novos (mês)", "Convertidos", "% Conversão"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {metricas.map((m) => (
                <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{m.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.especialidade ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={m.status === "ativo" ? "default" : "secondary"} className="capitalize">{m.status}</Badge>
                  </td>
                  <td className="px-4 py-3 font-semibold">{m.leads_total}</td>
                  <td className="px-4 py-3 text-blue-600 font-medium">{m.leads_novos}</td>
                  <td className="px-4 py-3 text-green-600 font-medium">{m.leads_convertidos}</td>
                  <td className="px-4 py-3">{m.taxa_conversao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
