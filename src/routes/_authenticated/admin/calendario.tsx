import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/admin/calendario")({
  component: CalendarioAdminPage,
  head: () => ({ meta: [{ title: "Calendário — Tabgha Admin" }] }),
});

const STATUS_COLORS: Record<string, string> = {
  briefing: "bg-slate-100 text-slate-600",
  roteiro: "bg-purple-100 text-purple-700",
  producao: "bg-yellow-100 text-yellow-700",
  aprovacao: "bg-orange-100 text-orange-700",
  agendado: "bg-blue-100 text-blue-700",
  postado: "bg-green-100 text-green-700",
};

const STATUS_LABELS: Record<string, string> = {
  briefing: "Briefing",
  roteiro: "Roteiro",
  producao: "Produção",
  aprovacao: "Aguard. aprovação",
  agendado: "Agendado",
  postado: "Postado",
};

function CalendarioAdminPage() {
  const { data: conteudos = [], isLoading } = useQuery({
    queryKey: ["admin", "calendario", "conteudos"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conteudos")
        .select("*, clientes(nome)")
        .order("data_postagem", { ascending: true, nullsFirst: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="px-8 py-8">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Operação
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Calendário Editorial</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pipeline de conteúdo de todos os clientes.
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : conteudos.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          title="Nenhum conteúdo agendado"
          description="Os conteúdos aparecem aqui conforme forem criados nos clientes."
        />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {conteudos.map((c) => (
            <div key={c.id} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{c.titulo ?? "Sem título"}</p>
                <p className="text-xs text-muted-foreground">
                  {(c.clientes as { nome: string } | null)?.nome ?? "—"} · {c.rede ?? "—"} · {c.tipo ?? "—"}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {c.data_postagem && (
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(c.data_postagem), "dd MMM", { locale: ptBR })}
                  </span>
                )}
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[c.status] ?? "bg-muted text-muted-foreground"}`}>
                  {STATUS_LABELS[c.status] ?? c.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
