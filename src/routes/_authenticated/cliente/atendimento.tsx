import { createFileRoute } from "@tanstack/react-router";
import { AtendimentoPage } from "@/components/atendimento/AtendimentoPage";

export const Route = createFileRoute("/_authenticated/cliente/atendimento")({
  component: ClienteAtendimento,
  head: () => ({ meta: [{ title: "Atendimento — Tabgha" }] }),
});

function ClienteAtendimento() {
  return (
    <div className="px-6 py-6 space-y-6">
      <div>
        <span className="eyebrow-pill">Suporte</span>
        <h1 className="mt-2 text-xl font-bold tracking-tight">Atendimento WhatsApp</h1>
      </div>
      <AtendimentoPage />
    </div>
  );
}
