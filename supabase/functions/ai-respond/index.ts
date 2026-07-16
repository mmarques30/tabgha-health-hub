// Pietro Brain — responde conversas WhatsApp com owner_state=bot.
//
// POST {
//   conversation_id: uuid,
//   cliente_id: uuid,
//   trigger_message_id?: uuid
// }
// Auth: Authorization Bearer = service_role

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildPietroSystemPrompt,
  parsePietroDecision,
  wantsHuman,
  type PietroCliente,
} from "../_shared/pietro_brain.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const GRAPH_MODEL_DEFAULT = "claude-haiku-4-5-20251001";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type RequestBody = {
  conversation_id?: string;
  cliente_id?: string;
  trigger_message_id?: string;
};

async function loadDefaults() {
  const { data } = await supabase
    .from("app_config")
    .select("valor")
    .eq("chave", "pietro_brain_defaults")
    .maybeSingle();

  return (data?.valor ?? {}) as {
    model?: string;
    max_history?: number;
    handoff_score?: number;
    metodo_qualificacao?: string;
  };
}

async function callClaude(
  model: string,
  system: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 700,
      system,
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic ${response.status}: ${await response.text()}`);
  }

  const result = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  const text = result.content.find((b) => b.type === "text")?.text ?? "";
  return {
    text,
    tokensIn: result.usage?.input_tokens ?? 0,
    tokensOut: result.usage?.output_tokens ?? 0,
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token !== SERVICE_KEY) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const conversationId = body.conversation_id;
  const clienteId = body.cliente_id;
  if (!conversationId || !clienteId) {
    return json({ ok: false, error: "missing_fields" }, 400);
  }

  if (!ANTHROPIC_KEY) {
    await supabase.from("webhook_errors").insert({
      source: "ai_respond",
      cliente_id: clienteId,
      payload: body,
      error: "ANTHROPIC_API_KEY não configurada",
    });
    return json({ ok: false, error: "missing_anthropic_key" }, 500);
  }

  try {
    const defaults = await loadDefaults();
    const maxHistory = Math.max(6, Math.min(defaults.max_history ?? 16, 24));
    const handoffScore = defaults.handoff_score ?? 75;

    const { data: conversation, error: convError } = await supabase
      .from("whatsapp_conversations")
      .select(
        "id, cliente_id, lead_id, contact_phone, contact_name, state, owner_state, bot_score, bot_notes, step_count",
      )
      .eq("id", conversationId)
      .eq("cliente_id", clienteId)
      .maybeSingle();

    if (convError) throw convError;
    if (!conversation) {
      return json({ ok: false, error: "conversation_not_found" }, 404);
    }

    if (conversation.owner_state !== "bot") {
      return json({
        ok: true,
        skipped: true,
        reason: "owner_not_bot",
        owner_state: conversation.owner_state,
      });
    }

    const { data: cliente, error: clienteError } = await supabase
      .from("clientes")
      .select("id, nome, especialidade, dados_extras")
      .eq("id", clienteId)
      .single();

    if (clienteError) throw clienteError;

    const { data: history, error: historyError } = await supabase
      .from("whatsapp_messages")
      .select("direction, sender_type, body, sent_at")
      .eq("conversation_id", conversationId)
      .order("sent_at", { ascending: false })
      .limit(maxHistory);

    if (historyError) throw historyError;

    const chronological = [...(history ?? [])].reverse();
    const lastInbound = [...chronological].reverse().find((m) => m.direction === "inbound");
    const lastText = String(lastInbound?.body ?? "");

    const forceHandoff = wantsHuman(lastText);

    const claudeMessages = chronological
      .filter((m) => m.body && m.body.trim().length > 0)
      .map((m) => ({
        role: (m.direction === "inbound" ? "user" : "assistant") as "user" | "assistant",
        content: m.body,
      }));

    // Anthropic exige começar com user
    while (claudeMessages.length && claudeMessages[0].role !== "user") {
      claudeMessages.shift();
    }

    if (!claudeMessages.length) {
      return json({ ok: true, skipped: true, reason: "no_user_messages" });
    }

    const system = buildPietroSystemPrompt(cliente as PietroCliente, {
      metodo_qualificacao: defaults.metodo_qualificacao,
    });

    const model = defaults.model ?? GRAPH_MODEL_DEFAULT;
    const { text, tokensIn, tokensOut } = await callClaude(model, system, claudeMessages);
    const decision = parsePietroDecision(text);

    if (!decision.reply) {
      decision.reply =
        "Obrigada pela mensagem! Em instantes alguém da equipe continua o atendimento com você.";
      decision.handoff = true;
      decision.handoff_reason = decision.handoff_reason ?? "empty_reply";
      decision.state = "handoff";
    }

    if (forceHandoff) {
      decision.handoff = true;
      decision.state = "handoff";
      decision.handoff_reason = decision.handoff_reason ?? "pedido_humano";
      decision.bot_score = Math.max(decision.bot_score, 80);
    }

    if (!decision.handoff && decision.bot_score >= handoffScore && conversation.step_count >= 3) {
      decision.handoff = true;
      decision.state = "handoff";
      decision.handoff_reason = decision.handoff_reason ?? "score_qualificado";
    }

    const nextOwner = decision.handoff ? "human_alert" : "bot";
    const nextState = decision.handoff
      ? "handoff"
      : decision.state === "greeting" && conversation.step_count > 0
        ? "qualifying"
        : decision.state;

    const mergedNotes = {
      ...((conversation.bot_notes as Record<string, unknown> | null) ?? {}),
      ...decision.bot_notes,
      last_handoff_reason: decision.handoff_reason,
      updated_at: new Date().toISOString(),
    };

    await supabase
      .from("whatsapp_conversations")
      .update({
        state: nextState,
        owner_state: nextOwner,
        bot_score: decision.bot_score,
        bot_notes: mergedNotes,
      })
      .eq("id", conversationId);

    if (conversation.lead_id && decision.lead_status) {
      await supabase
        .from("leads")
        .update({ status: decision.lead_status })
        .eq("id", conversation.lead_id)
        .eq("cliente_id", clienteId);
    }

    // Envia resposta via zapi-send (grava outbound sender_type=bot)
    const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/zapi-send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cliente_id: clienteId,
        telefone: conversation.contact_phone,
        body: decision.reply,
        conversation_id: conversationId,
        sender_type: "bot",
      }),
    });

    const sendJson = (await sendRes.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      message_id?: string;
    };

    if (!sendRes.ok || sendJson.ok === false) {
      throw new Error(`zapi-send failed: ${sendJson.error ?? sendRes.status}`);
    }

    await supabase.from("automation_logs").insert({
      cliente_id: clienteId,
      action: "ai_respond",
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      metadata: {
        conversation_id: conversationId,
        trigger_message_id: body.trigger_message_id ?? null,
        handoff: decision.handoff,
        handoff_reason: decision.handoff_reason,
        bot_score: decision.bot_score,
        state: nextState,
        owner_state: nextOwner,
        model,
        zapi_message_id: sendJson.message_id ?? null,
      },
    });

    return json({
      ok: true,
      handoff: decision.handoff,
      bot_score: decision.bot_score,
      state: nextState,
      owner_state: nextOwner,
      message_id: sendJson.message_id ?? null,
    });
  } catch (error) {
    console.error("ai-respond error", error);

    await supabase.from("webhook_errors").insert({
      source: "ai_respond",
      cliente_id: clienteId,
      payload: body,
      error: error instanceof Error ? error.message : String(error),
    });

    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "ai_respond_failed",
      },
      500,
    );
  }
});
