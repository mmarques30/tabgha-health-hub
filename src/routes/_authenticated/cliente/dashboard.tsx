import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/cliente/dashboard")({
  component: ClienteDashboard,
  head: () => ({ meta: [{ title: "Portal do Cliente — Tabgha" }] }),
});

function ClienteDashboard() {
  return (
    <div className="px-8 py-8">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Portal do cliente</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Leads, conteúdos e entregas aparecem aqui conforme a operação avançar.
        </p>
      </header>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Leads", value: "—" },
          { label: "Conteúdos", value: "—" },
          { label: "Entregas", value: "—" },
          { label: "Próximas ações", value: "—" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border bg-card p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{kpi.label}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">{kpi.value}</div>
          </div>
        ))}
      </section>
    </div>
  );
}