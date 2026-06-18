import { createFileRoute } from "@tanstack/react-router";
import { AtendimentoPage } from "@/components/atendimento/AtendimentoPage";

export const Route = createFileRoute("/_authenticated/admin/atendimento")({
  component: AdminAtendimento,
  head: () => ({ meta: [{ title: "Atendimento — Tabgha Admin" }] }),
});

function AdminAtendimento() {
  return (
    <div className="px-8 py-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Operação</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Atendimento WhatsApp</h1>
      </header>
      <AtendimentoPage isAdmin />
    </div>
  );
}
