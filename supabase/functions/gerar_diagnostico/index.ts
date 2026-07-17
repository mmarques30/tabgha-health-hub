// Edge Function: gerar_diagnostico
// Prioriza a TRANSCRIÇÃO da reunião (texto/documento). Sem transcrição, usa dados do cadastro.
// mode=diagnostico → preenche o JSON do diagnóstico
// mode=acoes → transforma fala/notas em plano de ação numerado
// Requer ANTHROPIC_API_KEY no ambiente Supabase.

// @ts-expect-error Deno global
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

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

function stripFences(raw: string) {
  return raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
}

async function callClaude(prompt: string, maxTokens = 4096) {
  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!claudeRes.ok) {
    const err = await claudeRes.text();
    throw { status: 502, body: { error: "Erro na API Claude.", detail: err } };
  }

  const claudeData = (await claudeRes.json()) as { content: { text: string }[] };
  return claudeData.content?.[0]?.text ?? "";
}

// @ts-expect-error Deno global
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (!ANTHROPIC_KEY) {
    return json({ error: "ANTHROPIC_API_KEY não configurada no ambiente Supabase." }, 500);
  }

  let body: {
    mode?: "diagnostico" | "acoes";
    nome?: string;
    especialidade?: string;
    cidade?: string;
    publico_alvo?: string;
    ticket_medio?: string;
    tempo_mercado?: string;
    diferencial?: string;
    canais_aquisicao?: string;
    transcricao?: string;
    notas_acoes?: string;
    diagnostico_atual?: Record<string, unknown>;
  };

  try {
    body = await req.json();
  } catch {
    return json({ error: "Body inválido." }, 400);
  }

  const mode = body.mode === "acoes" ? "acoes" : "diagnostico";
  const transcricao = body.transcricao?.trim() ?? "";
  const notasAcoes = body.notas_acoes?.trim() ?? "";

  try {
    if (mode === "acoes") {
      const fonte = notasAcoes || transcricao;
      if (!fonte) {
        return json(
          { error: "Cole ou dite as próximas ações (texto/áudio transcrito) para estruturar." },
          400,
        );
      }

      const prompt = `Você é estrategista de marketing para clínicas de saúde da Tabgha.
Transforme as notas abaixo em um PLANO DE AÇÃO claro para a clínica "${body.nome ?? "cliente"}".

REGRAS:
- Retorne SOMENTE um JSON válido: { "plano_acao": "string" }
- plano_acao = lista numerada (1. 2. 3. …), uma ação por linha
- Cada linha: ação concreta + prazo sugerido (ex.: "2 semanas") + quem executa se der para inferir (Tabgha / clínica)
- Máximo 8 ações; priorize o que foi falado; não invente campanhas fora do contexto
- Linguagem direta em português do Brasil

NOTAS / FALA / TRANSCRIÇÃO:
"""
${fonte.slice(0, 60000)}
"""

DADOS DO CLIENTE (contexto):
- Especialidade: ${body.especialidade ?? "não informada"}
- Cidade: ${body.cidade ?? "não informada"}`;

      const raw = await callClaude(prompt, 2048);
      let parsed: { plano_acao?: string };
      try {
        parsed = JSON.parse(stripFences(raw));
      } catch {
        return json({ error: "Resposta Claude não é JSON válido.", raw }, 502);
      }
      if (!parsed.plano_acao) {
        return json({ error: "Claude não retornou plano_acao.", raw }, 502);
      }
      return json({ plano_acao: parsed.plano_acao });
    }

    // ── Diagnóstico completo ──
    const prompt = `Você é um especialista em marketing para saúde (agência Tabgha).
Sua missão: preencher o DIAGNÓSTICO ESTRATÉGICO do consultório com base principalmente na TRANSCRIÇÃO da reunião de discovery/estratégia. Os campos do cadastro são só complemento.

${
  transcricao
    ? `TRANSCRIÇÃO DA REUNIÃO (fonte principal — use fatos ditos aqui):
"""
${transcricao.slice(0, 80000)}
"""`
    : `AVISO: não há transcrição. Infira com cuidado a partir dos dados cadastrais e marque hipóteses de forma explícita quando inventar benchmarks.`
}

DADOS CADASTRAIS (complemento):
- Nome/Clínica: ${body.nome ?? "não informado"}
- Especialidade: ${body.especialidade ?? "não informada"}
- Cidade: ${body.cidade ?? "não informada"}
- Público-alvo (já preenchido): ${body.publico_alvo ?? "—"}
- Ticket médio: ${body.ticket_medio ?? "—"}
- Tempo de mercado: ${body.tempo_mercado ?? "—"}
- Diferencial declarado: ${body.diferencial ?? "—"}
- Canais atuais: ${body.canais_aquisicao ?? "—"}

REGRAS:
- Prefira o que a reunião disse; não contradiga a transcrição
- Se algo não foi dito, escreva "Não mencionado na reunião — sugerido: …" em vez de inventar como fato
- Linguagem direta, acionável, sem jargão vazio
- Retorne SOMENTE um JSON válido (sem markdown) com exatamente esta estrutura:
{
  "perfil": {
    "especialidade": "string",
    "cidade": "string",
    "tempo_mercado": "string",
    "publico_alvo": "string — avatar do paciente ideal",
    "ticket_medio": "string",
    "diferencial": "string — diferencial real, específico"
  },
  "jornada": {
    "canais_aquisicao": "string",
    "funil": "string — da descoberta à consulta",
    "objecoes": "string — 3-5 objeções",
    "taxa_agendamento": "string",
    "taxa_conversao": "string"
  },
  "dores": {
    "principais": "string",
    "marketing": "string",
    "operacional": "string"
  },
  "concorrentes": "string",
  "plano_acao": "string — 5 ações prioritárias 90 dias, numeradas, com prazo"
}`;

    const raw = await callClaude(prompt, 4096);
    let diagnostico: unknown;
    try {
      diagnostico = JSON.parse(stripFences(raw));
    } catch {
      return json({ error: "Resposta Claude não é JSON válido.", raw }, 502);
    }

    return json({ diagnostico });
  } catch (e) {
    if (e && typeof e === "object" && "status" in e && "body" in e) {
      const err = e as { status: number; body: unknown };
      return json(err.body, err.status);
    }
    return json(
      { error: e instanceof Error ? e.message : String(e) },
      500,
    );
  }
});
