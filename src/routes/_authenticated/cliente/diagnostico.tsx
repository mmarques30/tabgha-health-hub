import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Stethoscope, Loader2, Users, Route as RouteIcon, HeartCrack, Trophy, ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cliente/diagnostico")({
  component: DiagnosticoPage,
  head: () => ({ meta: [{ title: "Diagnóstico — Portal" }] }),
});

type DiagnosticoData = {
  perfil?: Record<string, string>;
  jornada?: Record<string, string>;
  dores?: Record<string, string>;
  concorrentes?: string;
  plano_acao?: string;
  [key: string]: unknown;
};

function Section({ icon: Icon, title, children, className }: { icon: React.ElementType; title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
      <div className="flex items-center gap-2 border-b border-border bg-secondary/30 px-4 py-3">
        <Icon className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | undefined | null }) {
  if (!value) return null;
  return (
    <div className="mb-3">
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm whitespace-pre-line">{value}</p>
    </div>
  );
}

const PERFIL_LABELS: Record<string, string> = {
  especialidade: "Especialidade", cidade: "Cidade", tempo_mercado: "Tempo de mercado",
  publico_alvo: "Público-alvo", ticket_medio: "Ticket médio", diferencial: "Diferencial",
};

const JORNADA_LABELS: Record<string, string> = {
  canais_aquisicao: "Canais de aquisição", funil: "Funil de vendas",
  objecoes: "Objeções frequentes", taxa_agendamento: "Taxa de agendamento", taxa_conversao: "Taxa de conversão",
};

const DORES_LABELS: Record<string, string> = {
  principais: "Principais dores do paciente", marketing: "Dores de marketing", operacional: "Dores operacionais",
};

function DiagnosticoPage() {
  const { profile } = useAuth();
  const clienteId = profile?.cliente_id;

  const { data: cliente, isLoading } = useQuery({
    queryKey: ["cliente", "diagnostico", clienteId],
    enabled: !!clienteId,
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes").select("nome, especialidade, diagnostico").eq("id", clienteId!).single();
      if (error) throw error;
      return data;
    },
  });

  const d = cliente?.diagnostico as DiagnosticoData | null | undefined;

  return (
    <div className="px-6 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Diagnóstico</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Análise estratégica do {cliente?.especialidade ? `consultório de ${cliente.especialidade}` : "seu consultório"}
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : !d ? (
        <EmptyState
          icon={<Stethoscope className="h-6 w-6" />}
          title="Diagnóstico não preenchido"
          description="A equipe Tabgha preencherá o diagnóstico estratégico do seu consultório em breve."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {d.perfil && (
            <Section icon={Users} title="Perfil do consultório">
              {Object.entries(PERFIL_LABELS).map(([k, l]) => (
                <Field key={k} label={l} value={d.perfil?.[k]} />
              ))}
            </Section>
          )}

          {d.jornada && (
            <Section icon={RouteIcon} title="Jornada do paciente">
              {Object.entries(JORNADA_LABELS).map(([k, l]) => (
                <Field key={k} label={l} value={d.jornada?.[k]} />
              ))}
            </Section>
          )}

          {d.dores && (
            <Section icon={HeartCrack} title="Dores identificadas">
              {Object.entries(DORES_LABELS).map(([k, l]) => (
                <Field key={k} label={l} value={d.dores?.[k]} />
              ))}
            </Section>
          )}

          {d.concorrentes && (
            <Section icon={Trophy} title="Concorrentes">
              <p className="text-sm whitespace-pre-line">{d.concorrentes}</p>
            </Section>
          )}

          {d.plano_acao && (
            <Section icon={ListChecks} title="Plano de ação" className="lg:col-span-2">
              <p className="text-sm whitespace-pre-line">{d.plano_acao}</p>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
