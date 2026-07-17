import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Users } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { FunilHeader, KanbanBoard } from "@/components/crm/KanbanBoard";
import { Input } from "@/components/ui/input";
import { useLeads } from "@/hooks/useLeads";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/cliente/leads")({
  component: LeadsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    periodo: Number(search.periodo) || 30,
    canal: typeof search.canal === "string" ? search.canal : "",
    q: typeof search.q === "string" ? search.q : "",
  }),
  head: () => ({ meta: [{ title: "Leads — Portal" }] }),
});

function LeadsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const clienteId = profile?.cliente_id;
  const [localSearch, setLocalSearch] = useState(search.q);

  const filters = useMemo(
    () => ({
      clienteId,
      periodoDias: search.periodo || null,
      canal: search.canal || null,
      search: search.q || "",
    }),
    [clienteId, search],
  );

  const { data: leads = [], isLoading } = useLeads(filters);

  function updateSearch(patch: Partial<typeof search>) {
    void navigate({
      to: ".",
      search: (prev: typeof search) => ({ ...prev, ...patch }),
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 py-5">
        <span className="eyebrow-pill">Captação</span>
        <div className="mt-2 flex items-baseline gap-3">
          <h1 className="text-xl font-bold tracking-tight">Leads</h1>
          <span className="text-sm text-muted-foreground">{leads.length} no período</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Arraste cards entre colunas. Motivo é obrigatório ao marcar como perdido.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <select
            value={search.periodo}
            onChange={(e) => updateSearch({ periodo: Number(e.target.value) })}
            className="rounded-xl border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value={7}>7 dias</option>
            <option value={30}>30 dias</option>
            <option value={90}>90 dias</option>
            <option value={365}>1 ano</option>
          </select>
          <select
            value={search.canal}
            onChange={(e) => updateSearch({ canal: e.target.value })}
            className="rounded-xl border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="">Todos os canais</option>
            <option value="meta">Meta</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="lp">Landing page</option>
            <option value="site">Site</option>
          </select>
          <Input
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            onBlur={() => updateSearch({ q: localSearch })}
            onKeyDown={(e) => {
              if (e.key === "Enter") updateSearch({ q: localSearch });
            }}
            placeholder="Buscar nome ou telefone"
            className="max-w-xs rounded-xl"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : leads.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="Nenhum lead no filtro"
            description="Os leads chegam via anúncios Meta, LP e WhatsApp."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-5 px-6 py-5 pb-8">
          <FunilHeader leads={leads} />
          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Pipeline
            </p>
            <KanbanBoard leads={leads} />
          </div>
        </div>
      )}
    </div>
  );
}
