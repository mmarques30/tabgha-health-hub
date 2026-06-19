import { createFileRoute } from "@tanstack/react-router";
import { AtendimentoPage } from "@/components/atendimento/AtendimentoPage";

export const Route = createFileRoute("/_authenticated/cliente/atendimento")({
  component: ClienteAtendimento,
  head: () => ({ meta: [{ title: "Atendimento — Tabgha" }] }),
});

function ClienteAtendimento() {
  return (
    <div className="px-6 py-6 space-y-6">
      <header className="animate-fade-up">
        <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-sky-700 mb-2">
          Suporte
        </span>
        <h1 className="text-xl font-bold tracking-tight">Atendimento WhatsApp</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">Conversas e suporte em tempo real</p>
      </header>
      <AtendimentoPage />
    </div>
  );
}
