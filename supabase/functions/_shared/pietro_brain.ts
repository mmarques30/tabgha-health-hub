export type PietroDecision = {
  reply: string;
  state: "greeting" | "qualifying" | "routing" | "handoff" | "agendado" | "closed";
  bot_score: number;
  bot_notes: Record<string, unknown>;
  handoff: boolean;
  handoff_reason: string | null;
  lead_status: "novo" | "em_conversa" | "interessado" | "agendado" | null;
};

export type PietroCliente = {
  nome?: string | null;
  especialidade?: string | null;
  dados_extras?: {
    agente_ia?: {
      metodo_qualificacao?: string | null;
      tom?: string | null;
      nome_agente?: string | null;
    };
  } | null;
};

const DEFAULT_METODO =
  "Avalie o lead de forma natural (sem interrogatório) em: (1) intenção — o que busca, (2) urgência — quando quer resolver, (3) fit — combina com a clínica, (4) capacidade — aberto a investir/agendar. Quando estiver qualificado ou pedir humano, faça handoff.";

const ALLOWED_STATES = new Set([
  "greeting",
  "qualifying",
  "routing",
  "handoff",
  "agendado",
  "closed",
]);

const ALLOWED_LEAD_STATUS = new Set(["novo", "em_conversa", "interessado", "agendado"]);

export function buildPietroSystemPrompt(
  cliente: PietroCliente,
  defaults?: { metodo_qualificacao?: string },
): string {
  const clinica = cliente.nome ?? "a clínica";
  const especialidade = cliente.especialidade ?? "saúde";
  const agenteNome = cliente.dados_extras?.agente_ia?.nome_agente ?? "assistente";
  const tom = cliente.dados_extras?.agente_ia?.tom ?? "acolhedor, claro e profissional";
  const metodo =
    cliente.dados_extras?.agente_ia?.metodo_qualificacao?.trim() ||
    defaults?.metodo_qualificacao?.trim() ||
    DEFAULT_METODO;

  return `Você é o ${agenteNome} virtual de WhatsApp da clínica "${clinica}" (${especialidade}), parte do cérebro Pietro / Tabgha.

Objetivo: qualificar o lead e conduzir até agendamento ou handoff para humano.
Tom: ${tom}. Responda sempre em português brasileiro.
Mensagens curtas (1–3 frases), naturais para WhatsApp. Sem markdown, sem listas longas.

Método de qualificação:
${metodo}

Regras de segurança:
- Nunca faça diagnóstico médico nem indique tratamento.
- Em emergência, dor intensa, risco ou pedido explícito de humano: handoff=true.
- Se o lead já estiver qualificado (score alto) e pronto para agenda: handoff=true e state=handoff ou agendado.
- Não invente preços, horários ou disponibilidade — diga que a equipe confirma.

Responda APENAS com JSON válido (sem markdown) neste formato:
{
  "reply": "texto da mensagem para o lead",
  "state": "greeting|qualifying|routing|handoff|agendado",
  "bot_score": 0,
  "bot_notes": {
    "intencao": "",
    "urgencia": "",
    "fit": "",
    "capacidade": "",
    "resumo": ""
  },
  "handoff": false,
  "handoff_reason": null,
  "lead_status": "novo|em_conversa|interessado|agendado|null"
}`;
}

export function wantsHuman(text: string): boolean {
  const t = text.toLowerCase();
  const patterns = [
    "falar com humano",
    "falar com uma pessoa",
    "atendente",
    "atendimento humano",
    "quero uma pessoa",
    "pessoa de verdade",
    "não quero robô",
    "nao quero robo",
    "falar com alguém",
    "falar com alguem",
    "secretaria",
  ];
  return patterns.some((p) => t.includes(p));
}

export function parsePietroDecision(raw: string): PietroDecision {
  const clean = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  let parsed: Partial<PietroDecision>;
  try {
    parsed = JSON.parse(clean) as Partial<PietroDecision>;
  } catch {
    return {
      reply:
        raw.trim().slice(0, 900) ||
        "Recebi sua mensagem. Em instantes alguém da equipe te responde.",
      state: "qualifying",
      bot_score: 10,
      bot_notes: { resumo: "fallback_non_json" },
      handoff: false,
      handoff_reason: null,
      lead_status: "em_conversa",
    };
  }

  const state = ALLOWED_STATES.has(String(parsed.state))
    ? (parsed.state as PietroDecision["state"])
    : "qualifying";

  const leadStatusRaw = parsed.lead_status as string | null | undefined;
  const lead_status =
    leadStatusRaw && ALLOWED_LEAD_STATUS.has(leadStatusRaw)
      ? (leadStatusRaw as PietroDecision["lead_status"])
      : null;

  const score = Number(parsed.bot_score ?? 0);
  const bot_score = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;

  return {
    reply: String(parsed.reply ?? "")
      .trim()
      .slice(0, 1200),
    state,
    bot_score,
    bot_notes:
      parsed.bot_notes && typeof parsed.bot_notes === "object"
        ? (parsed.bot_notes as Record<string, unknown>)
        : {},
    handoff: Boolean(parsed.handoff) || state === "handoff",
    handoff_reason: parsed.handoff_reason ? String(parsed.handoff_reason) : null,
    lead_status,
  };
}
