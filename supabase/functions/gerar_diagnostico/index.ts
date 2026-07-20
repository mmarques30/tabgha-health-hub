// Edge Function: gerar_diagnostico
// mode=diagnostico → diagnóstico consolidado (visível ao cliente; sem plano/demandas)
// mode=acoes → sugestões internas de demanda (NÃO publicar no portal do médico)
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

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchFonteUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "TabghaDiagnosticoBot/1.0" },
  });
  if (!res.ok) {
    throw new Error(`Não foi possível abrir o link (${res.status}).`);
  }
  const ctype = res.headers.get("content-type") ?? "";
  const raw = await res.text();
  if (ctype.includes("html") || raw.trimStart().startsWith("<")) {
    return stripHtml(raw);
  }
  return raw.trim();
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
    fonte_url?: string;
    notas_acoes?: string;
    diagnostico_atual?: Record<string, unknown>;
  };

  try {
    body = await req.json();
  } catch {
    return json({ error: "Body inválido." }, 400);
  }

  const mode = body.mode === "acoes" ? "acoes" : "diagnostico";
  let transcricao = body.transcricao?.trim() ?? "";
  const notasAcoes = body.notas_acoes?.trim() ?? "";
  const fonteUrl = body.fonte_url?.trim() ?? "";

  try {
    if (fonteUrl) {
      try {
        const fetched = await fetchFonteUrl(fonteUrl);
        if (fetched) {
          transcricao = transcricao
            ? `${transcricao}\n\n--- Conteúdo do link ---\n${fetched}`
            : fetched;
        }
      } catch (e) {
        return json(
          { error: e instanceof Error ? e.message : "Falha ao ler o link HTML." },
          400,
        );
      }
    }

    if (mode === "acoes") {
      const diag = body.diagnostico_atual ?? {};
      const resumo =
        typeof diag.resumo === "string" ? diag.resumo : "";
      const fonte = notasAcoes || transcricao;
      if (!fonte && !resumo) {
        return json(
          {
            error:
              "Gere o diagnóstico primeiro (ou cole notas) para sugerir demandas internas.",
          },
          400,
        );
      }

      const prompt = `Você é estrategista de marketing da Tabgha (agência).
Com base no DIAGNÓSTICO do cliente "${body.nome ?? "cliente"}", sugira DEMANDAS INTERNAS para a operação Tabgha incluir no backlog deste cliente.

IMPORTANTE:
- Isso NÃO é um plano mostrado ao médico
- São sugestões de trabalho/demanda para a equipe Tabgha
- Retorne SOMENTE JSON: { "demandas_sugeridas": "string" }
- demandas_sugeridas = lista numerada (1. 2. 3. …), máx. 8 itens
- Cada item: demanda concreta + prazo sugerido + responsável (Tabgha / clínica) se fizer sentido
- Priorize o diagnóstico; use as notas extras só como complemento
- Português do Brasil, direto

DIAGNÓSTICO (resumo e contexto):
"""
${resumo.slice(0, 12000)}
"""

JSON do diagnóstico (trechos):
${JSON.stringify(diag).slice(0, 20000)}

NOTAS EXTRAS / FALA DA EQUIPE:
"""
${(fonte || "—").slice(0, 20000)}
"""

Especialidade: ${body.especialidade ?? "não informada"}
Cidade: ${body.cidade ?? "não informada"}`;

      const raw = await callClaude(prompt, 2048);
      let parsed: { demandas_sugeridas?: string; plano_acao?: string };
      try {
        parsed = JSON.parse(stripFences(raw));
      } catch {
        return json({ error: "Resposta Claude não é JSON válido.", raw }, 502);
      }
      const demandas = parsed.demandas_sugeridas || parsed.plano_acao;
      if (!demandas) {
        return json({ error: "Claude não retornou demandas_sugeridas.", raw }, 502);
      }
      return json({ demandas_sugeridas: demandas, plano_acao: demandas });
    }

    // ── Diagnóstico consolidado (portal do cliente) ──
    if (!transcricao) {
      return json(
        {
          error:
            "Cole a transcrição, anexe um arquivo ou informe um link HTML antes de gerar.",
        },
        400,
      );
    }

    const prompt = `Você é especialista em marketing para saúde (agência Tabgha).
Gere um DIAGNÓSTICO ESTRATÉGICO CONSOLIDADO do consultório, pronto para o MÉDICO ler no portal.
Fonte principal: TRANSCRIÇÃO / documento / conteúdo do link.
Cadastro é só complemento.

TRANSCRIÇÃO / FONTE:
"""
${transcricao.slice(0, 80000)}
"""

DADOS CADASTRAIS:
- Nome/Clínica: ${body.nome ?? "não informado"}
- Especialidade: ${body.especialidade ?? "não informada"}
- Cidade: ${body.cidade ?? "não informada"}
- Público-alvo: ${body.publico_alvo ?? "—"}
- Ticket médio: ${body.ticket_medio ?? "—"}
- Tempo de mercado: ${body.tempo_mercado ?? "—"}
- Diferencial: ${body.diferencial ?? "—"}
- Canais: ${body.canais_aquisicao ?? "—"}

REGRAS:
- Prefira o que a reunião/documento disse; não contradiga a fonte
- Se algo não foi dito: "Não mencionado — sugerido: …"
- Linguagem clara para o médico (sem jargão de agência)
- NÃO inclua plano de ação nem demandas internas da Tabgha neste JSON
- Retorne SOMENTE JSON válido:
{
  "resumo": "string — 2 a 4 parágrafos consolidados: situação atual, oportunidades e foco estratégico (o médico lê isto primeiro)",
  "perfil": {
    "especialidade": "string",
    "cidade": "string",
    "tempo_mercado": "string",
    "publico_alvo": "string",
    "ticket_medio": "string",
    "diferencial": "string"
  },
  "jornada": {
    "canais_aquisicao": "string",
    "funil": "string",
    "objecoes": "string",
    "taxa_agendamento": "string",
    "taxa_conversao": "string"
  },
  "dores": {
    "principais": "string",
    "marketing": "string",
    "operacional": "string"
  },
  "concorrentes": "string"
}`;

    const raw = await callClaude(prompt, 4096);
    let diagnostico: unknown;
    try {
      diagnostico = JSON.parse(stripFences(raw));
    } catch {
      return json({ error: "Resposta Claude não é JSON válido.", raw }, 502);
    }

    return json({ diagnostico, fonte_chars: transcricao.length });
  } catch (e) {
    if (e && typeof e === "object" && "status" in e && "body" in e) {
      const err = e as { status: number; body: unknown };
      return json(err.body, err.status);
    }
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
