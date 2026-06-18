import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserCheck, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/cliente/clientes")({
  component: ClientesPage,
  head: () => ({ meta: [{ title: "Pacientes — Portal" }] }),
});

function ClientesPage() {
  const { profile } = useAuth();
  const clienteId = profile?.cliente_id;
  const [search, setSearch] = useState("");

  const { data: pacientes = [], isLoading } = useQuery({
    queryKey: ["cliente", "pacientes", clienteId],
    enabled: !!clienteId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, nome, email, telefone, canal, criado_em")
        .eq("cliente_id", clienteId!)
        .eq("status", "convertido")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = pacientes.filter((p) => {
    const q = search.toLowerCase();
    return !q || p.nome?.toLowerCase().includes(q) || p.telefone?.includes(q) || p.email?.toLowerCase().includes(q);
  });

  return (
    <div className="px-8 py-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Carteira</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Pacientes</h1>
        <p className="mt-1 text-sm text-muted-foreground">Leads convertidos em pacientes do consultório.</p>
      </header>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome, telefone…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<UserCheck className="h-6 w-6" />} title={search ? "Nenhum resultado" : "Nenhum paciente ainda"}
          description={search ? "Tente outro termo." : "Pacientes aparecem quando um lead é convertido."} />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {filtered.map((p) => (
            <div key={p.id} className="flex items-center gap-4 px-5 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                {(p.nome ?? "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.nome ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{p.telefone ?? p.email ?? "—"}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {format(new Date(p.criado_em), "dd MMM yyyy", { locale: ptBR })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
