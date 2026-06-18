import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tabgha Health Marketing — Plataforma" },
      {
        name: "description",
        content:
          "Plataforma de operação da Tabgha Health Marketing: gestão de clientes, conteúdo, leads e ROI para clínicas e médicos.",
      },
      { property: "og:title", content: "Tabgha Health Marketing" },
      {
        property: "og:description",
        content: "Plataforma de operação da Tabgha Health Marketing.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-foreground text-background grid place-items-center text-xs font-semibold">
            T
          </div>
          <span className="text-sm font-semibold tracking-tight">Tabgha Health Marketing</span>
        </div>
        <Link
          to="/login"
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
        >
          Entrar
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Operação editorial e comercial</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
          A plataforma de marketing médico da Tabgha.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">
          Carteira de clientes, diagnóstico, pipeline editorial, leads e ROI — em um portal só, com acesso separado
          para a agência e para cada clínica.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-90"
          >
            Acessar plataforma
          </Link>
        </div>
      </main>
    </div>
  );
}
