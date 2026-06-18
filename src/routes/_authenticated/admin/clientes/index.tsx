import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Loader2, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";
import { createClientWithAccess } from "@/server/clientes/createClientWithAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/clientes/")({
  component: ClientesAdminPage,
  head: () => ({ meta: [{ title: "Clientes — Tabgha Admin" }] }),
});

type Cliente = Tables<"clientes"> & { leads_count: number };

const STATUS_LABELS: Record<string, string> = {
  onboarding: "Onboarding", ativo: "Ativo", pausa: "Pausa", inativo: "Inativo",
};
const STATUS_COLORS: Record<string, string> = {
  onboarding: "bg-blue-100 text-blue-700", ativo: "bg-green-100 text-green-700",
  pausa: "bg-yellow-100 text-yellow-700", inativo: "bg-slate-100 text-slate-600",
};

const newClientSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  email: z.string().email("Email inválido"),
  cnpj: z.string().optional(),
  especialidade: z.string().optional(),
});
type NewClientForm = z.infer<typeof newClientSchema>;

function NovoClienteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const form = useForm<NewClientForm>({ resolver: zodResolver(newClientSchema) });

  const criar = useMutation({
    mutationFn: (data: NewClientForm) => createClientWithAccess({ data }),
    onSuccess: () => {
      toast.success("Cliente criado.");
      qc.invalidateQueries({ queryKey: ["admin", "clientes"] });
      onClose(); form.reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit((d) => criar.mutate(d))} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Nome do consultório / médico</Label>
            <Input placeholder="Dr. Pedro Souza" {...form.register("nome")} />
            {form.formState.errors.nome && <p className="text-xs text-destructive">{form.formState.errors.nome.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" placeholder="dr.pedro@email.com" {...form.register("email")} />
            {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Especialidade</Label>
              <Input placeholder="Ortopedia" {...form.register("especialidade")} />
            </div>
            <div className="space-y-1">
              <Label>CNPJ</Label>
              <Input placeholder="00.000.000/0000-00" {...form.register("cnpj")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={criar.isPending}>
              {criar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar cliente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ClientesAdminPage() {
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["admin", "clientes"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes").select("*, leads(id)").order("nome");
      if (error) throw error;
      return (data ?? []).map((c) => ({
        ...c,
        leads_count: Array.isArray(c.leads) ? c.leads.length : 0,
      })) as Cliente[];
    },
  });

  const filtered = clientes.filter((c) => {
    const matchStatus = filtroStatus === "todos" || c.status === filtroStatus;
    const q = search.toLowerCase();
    const matchSearch = !q || c.nome.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div className="px-8 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">CRM</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Clientes</h1>
        </div>
        <Button onClick={() => setShowNew(true)}><Plus className="mr-2 h-4 w-4" />Novo cliente</Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1">
          {["todos", "onboarding", "ativo", "pausa", "inativo"].map((s) => (
            <button key={s} onClick={() => setFiltroStatus(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${filtroStatus === s ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
              {s === "todos" ? "Todos" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="Nenhum cliente encontrado"
          action={clientes.length === 0 ? { label: "Criar primeiro cliente", onClick: () => setShowNew(true) } : undefined} />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {filtered.map((c) => (
            <Link key={c.id} to={`/admin/clientes/${c.id}` as any}
              className="flex items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{c.nome}</p>
                <p className="text-xs text-muted-foreground">{c.especialidade ?? "—"} · {c.email ?? "—"}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-muted-foreground">{c.leads_count} leads</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status] ?? "bg-muted"}`}>
                  {STATUS_LABELS[c.status] ?? c.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <NovoClienteDialog open={showNew} onClose={() => setShowNew(false)} />
    </div>
  );
}
