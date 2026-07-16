export const PIPELINE = [
  "novo",
  "em_conversa",
  "interessado",
  "agendado",
  "atendido",
  "convertido",
  "perdido",
] as const;

export type PipelineStatus = (typeof PIPELINE)[number];

export const STATUS_LABELS: Record<PipelineStatus, string> = {
  novo: "Novo",
  em_conversa: "Em conversa",
  interessado: "Interessado",
  agendado: "Agendado",
  atendido: "Atendido",
  convertido: "Convertido",
  perdido: "Perdido",
};

export const COL_STYLES: Record<PipelineStatus, { header: string; col: string; badge: string }> = {
  novo: {
    header: "text-blue-800",
    col: "bg-gradient-to-b from-blue-50/60 to-blue-50/10",
    badge: "bg-blue-100 text-blue-700",
  },
  em_conversa: {
    header: "text-amber-800",
    col: "bg-gradient-to-b from-amber-50/60 to-amber-50/10",
    badge: "bg-amber-100 text-amber-700",
  },
  interessado: {
    header: "text-violet-800",
    col: "bg-gradient-to-b from-violet-50/60 to-violet-50/10",
    badge: "bg-violet-100 text-violet-700",
  },
  agendado: {
    header: "text-cyan-800",
    col: "bg-gradient-to-b from-cyan-50/60 to-cyan-50/10",
    badge: "bg-cyan-100 text-cyan-700",
  },
  atendido: {
    header: "text-teal-800",
    col: "bg-gradient-to-b from-teal-50/60 to-teal-50/10",
    badge: "bg-teal-100 text-teal-700",
  },
  convertido: {
    header: "text-green-800",
    col: "bg-gradient-to-b from-green-50/60 to-green-50/10",
    badge: "bg-green-100 text-green-700",
  },
  perdido: {
    header: "text-slate-600",
    col: "bg-gradient-to-b from-slate-50/60 to-slate-50/10",
    badge: "bg-slate-100 text-slate-600",
  },
};

export const MOTIVO_LABELS: Record<string, string> = {
  sem_plano: "Sem plano / orçamento",
  fora_regiao: "Fora da região",
  sem_interesse: "Sem interesse",
  por_engano: "Entrou por engano",
  nao_respondeu: "Não respondeu",
  outro: "Outro",
};

export const CANAL_COLORS: Record<string, string> = {
  meta: "bg-blue-100 text-blue-700",
  facebook: "bg-blue-100 text-blue-700",
  whatsapp: "bg-emerald-100 text-emerald-700",
  lp: "bg-sky-100 text-sky-700",
  site: "bg-violet-100 text-violet-700",
};

export function maskPhone(phone: string | null | undefined) {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return phone;
  return `${digits.slice(0, 2)}•••••${digits.slice(-4)}`;
}

export function parseTicket(observacoes: string | null | undefined): number | null {
  if (!observacoes) return null;
  const match = observacoes.match(/ticket:\s*([0-9]+(?:\.[0-9]+)?)/i);
  return match ? Number(match[1]) : null;
}
