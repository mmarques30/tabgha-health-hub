// Edge Function: gerar_diagnostico
// Recebe dados básicos do cliente e gera um diagnóstico de marketing estruturado
// usando a API Claude (Anthropic). Requer ANTHROPIC_API_KEY no ambiente Supabase.

// @ts-expect-error Deno global
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
// @ts-expect-error Deno global
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// @ts-expect-error Deno global
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// @ts-expect-error Deno global
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (!ANTHROPIC_KEY) {
    return json({ error: "ANTHROPIC_API_KEY não configurada no ambiente Supabase." }, 500);
  }

  let body: {
    nome?: string;
    especialidade?: string;
    cidade?: string;
    publico_alvo?: string;
    ticket_medio?: string;
    tempo_mercado?: string;
    diferencial?: string;
    canais_aquisicao?: string;
    diagnostico_atual?: Record<string, unknown>;
  };

  try {
    body = await req.json();
  } catch {
    return json({ error: "Body inválido." }, 400);
  }

  const prompt = `Você é um especialista em marketing para saúde. Com base nos dados do consultório abaixo, gere um diagnóstico de marketing completo e estruturado, com linguagem direta e acionável.

DADOS DO CLIENTE:
- Nome/Clínica: ${body.nome ?? "não informado"}
- Especialidade: ${body.especialidade ?? "não informada"}
- Cidade: ${body.cidade ?? "não informada"}
- Público-alvo: ${body.publico_alvo ?? "não informado"}
- Ticket médio: ${body.ticket_medio ?? "não informado"}
- Tempo de mercado: ${body.tempo_mercado ?? "não informado"}
- Diferencial declarado: ${body.diferencial ?? "não informado"}
- Canais de aquisição atuais: ${body.canais_aquisicao ?? "não informados"}

Retorne SOMENTE um JSON válido (sem markdown, sem \`\`\`json, apenas o objeto) com exatamente esta estrutura:
{
  "perfil": {
    "especialidade": "string — especialidade confirmada ou refinada",
    "cidade": "string — cidade",
    "tempo_mercado": "string — tempo de mercado com contexto",
    "publico_alvo": "string — descrição detalhada do paciente ideal (avatar)",
    "ticket_medio": "string — ticket médio estimado ou confirmado",
    "diferencial": "string — diferencial competitivo real, específico, não genérico"
  },
  "jornada": {
    "canais_aquisicao": "string — canais prioritários recomendados baseado na especialidade",
    "funil": "string — descrição da jornada do paciente desde a descoberta até a consulta",
    "objecoes": "string — 3-5 objeções frequentes específicas para essa especialidade",
    "taxa_agendamento": "string — benchmark do setor para taxa de agendamento",
    "taxa_conversao": "string — benchmark do setor para taxa de conversão"
  },
  "dores": {
    "principais": "string — 3 principais dores do paciente que essa especialidade resolve",
    "marketing": "string — desafios de marketing típicos dessa especialidade (visibilidade, trust, etc.)",
    "operacional": "string — gargalos operacionais comuns que impactam o marketing"
  },
  "concorrentes": "string — análise do cenário competitivo para essa especialidade e cidade, estratégias de diferenciação",
  "plano_acao": "string — 5 ações prioritárias de marketing para os próximos 90 dias, numeradas, com prazo estimado"
}`;

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!claudeRes.ok) {
    const err = await claudeRes.text();
    return json({ error: "Erro na API Claude.", detail: err }, 502);
  }

  const claudeData = await claudeRes.json() as { content: { text: string }[] };
  const raw = claudeData.content?.[0]?.text ?? "";

  let diagnostico: unknown;
  try {
    // Strip any accidental markdown fences
    const clean = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    diagnostico = JSON.parse(clean);
  } catch {
    return json({ error: "Resposta Claude não é JSON válido.", raw }, 502);
  }

  return json({ diagnostico });
});
