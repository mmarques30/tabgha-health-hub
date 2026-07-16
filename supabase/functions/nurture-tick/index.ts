// Cron: nurturing de leads frios + pedido de review Google.
//
// POST {} (opcional)
// Auth: livre (verify_jwt=false) — usa service role internamente

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

type Defaults = {
  cold_idle_days?: number;
  cold_max_steps?: number;
  cold_step_gap_hours?: number;
  cold_messages?: string[];
  review_delay_hours?: number;
  review_message?: string;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function loadDefaults(): Promise<Defaults> {
  const { data } = await supabase
    .from("app_config")
    .select("valor")
    .eq("chave", "nurture_defaults")
    .maybeSingle();
  return (data?.valor ?? {}) as Defaults;
}

async function sendBotMessage(clienteId: string, telefone: string, body: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/zapi-send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cliente_id: clienteId,
      telefone,
      body,
      sender_type: "bot",
    }),
  });
  const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok || payload.ok === false) {
    throw new Error(payload.error ?? `zapi-send ${res.status}`);
  }
  return payload;
}

function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

async function enrollColdLeads(defaults: Defaults) {
  const idleDays = defaults.cold_idle_days ?? 2;
  const since = new Date();
  since.setDate(since.getDate() - idleDays);

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, cliente_id, telefone, status, motivo_perda, atualizado_em")
    .in("status", ["novo", "em_conversa", "interessado", "perdido"])
    .not("telefone", "is", null)
    .lt("atualizado_em", since.toISOString())
    .limit(80);

  if (error) throw error;

  let enrolled = 0;
  for (const lead of leads ?? []) {
    if (!lead.telefone) continue;
    if (lead.status === "perdido" && lead.motivo_perda !== "nao_respondeu") continue;

    const { data: existing } = await supabase
      .from("nurture_jobs")
      .select("id")
      .eq("lead_id", lead.id)
      .eq("kind", "cold_followup")
      .in("status", ["pending", "sent", "done"])
      .maybeSingle();

    if (existing) continue;

    const { error: insertError } = await supabase.from("nurture_jobs").insert({
      cliente_id: lead.cliente_id,
      lead_id: lead.id,
      kind: "cold_followup",
      step: 0,
      status: "pending",
      next_run_at: new Date().toISOString(),
      metadata: { reason: "idle_or_no_reply" },
    });
    if (!insertError) enrolled += 1;
  }

  return enrolled;
}

async function processDueJobs(defaults: Defaults) {
  const maxSteps = defaults.cold_max_steps ?? 3;
  const gapHours = defaults.cold_step_gap_hours ?? 48;
  const coldMessages = defaults.cold_messages ?? [];
  const reviewMessage =
    defaults.review_message ??
    "Que bom ter você conosco! Se puder, sua avaliação no Google ajuda outras pessoas: {{review_url}}";

  const { data: jobs, error } = await supabase
    .from("nurture_jobs")
    .select("id, cliente_id, lead_id, kind, step, status, metadata")
    .eq("status", "pending")
    .lte("next_run_at", new Date().toISOString())
    .order("next_run_at", { ascending: true })
    .limit(40);

  if (error) throw error;

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const job of jobs ?? []) {
    try {
      const { data: lead } = await supabase
        .from("leads")
        .select("id, telefone, status, nome")
        .eq("id", job.lead_id)
        .maybeSingle();

      if (!lead?.telefone) {
        await supabase
          .from("nurture_jobs")
          .update({ status: "skipped", last_error: "sem_telefone" })
          .eq("id", job.id);
        skipped += 1;
        continue;
      }

      // Não nutrir se já avançou no funil
      if (
        job.kind === "cold_followup" &&
        ["agendado", "atendido", "convertido"].includes(lead.status)
      ) {
        await supabase
          .from("nurture_jobs")
          .update({ status: "done", last_error: null })
          .eq("id", job.id);
        skipped += 1;
        continue;
      }

      const { data: cliente } = await supabase
        .from("clientes")
        .select("id, nome, dados_extras")
        .eq("id", job.cliente_id)
        .single();

      const redes = ((cliente?.dados_extras as Record<string, unknown> | null)?.redes ??
        {}) as Record<string, string>;

      let message = "";
      if (job.kind === "cold_followup") {
        message = coldMessages[job.step] ?? coldMessages[coldMessages.length - 1] ?? "";
        if (!message) {
          await supabase
            .from("nurture_jobs")
            .update({ status: "skipped", last_error: "sem_template" })
            .eq("id", job.id);
          skipped += 1;
          continue;
        }
      } else {
        const reviewUrl = redes.google_review || redes.google || redes.site || "";
        if (!reviewUrl) {
          await supabase
            .from("nurture_jobs")
            .update({ status: "skipped", last_error: "sem_review_url" })
            .eq("id", job.id);
          skipped += 1;
          continue;
        }
        message = renderTemplate(reviewMessage, {
          review_url: reviewUrl,
          clinica: String(cliente?.nome ?? ""),
          nome: String(lead.nome ?? ""),
        });
      }

      await sendBotMessage(job.cliente_id, lead.telefone, message);

      if (job.kind === "review_ask") {
        await supabase
          .from("nurture_jobs")
          .update({
            status: "done",
            step: 1,
            last_sent_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", job.id);
      } else {
        const nextStep = job.step + 1;
        if (nextStep >= maxSteps) {
          await supabase
            .from("nurture_jobs")
            .update({
              status: "done",
              step: nextStep,
              last_sent_at: new Date().toISOString(),
              last_error: null,
            })
            .eq("id", job.id);
        } else {
          const next = new Date();
          next.setHours(next.getHours() + gapHours);
          await supabase
            .from("nurture_jobs")
            .update({
              status: "pending",
              step: nextStep,
              last_sent_at: new Date().toISOString(),
              next_run_at: next.toISOString(),
              last_error: null,
            })
            .eq("id", job.id);
        }
      }

      await supabase.from("automation_logs").insert({
        cliente_id: job.cliente_id,
        action: job.kind === "review_ask" ? "review_ask_sent" : "nurture_sent",
        metadata: {
          job_id: job.id,
          lead_id: job.lead_id,
          step: job.step,
          kind: job.kind,
        },
      });

      sent += 1;
    } catch (err) {
      failed += 1;
      await supabase
        .from("nurture_jobs")
        .update({
          status: "failed",
          last_error: err instanceof Error ? err.message : String(err),
        })
        .eq("id", job.id);

      await supabase.from("webhook_errors").insert({
        source: job.kind === "review_ask" ? "review_ask" : "nurture_tick",
        cliente_id: job.cliente_id,
        payload: { job_id: job.id, lead_id: job.lead_id },
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { sent, failed, skipped };
}

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  try {
    const defaults = await loadDefaults();
    const enrolled = await enrollColdLeads(defaults);
    const processed = await processDueJobs(defaults);

    return json({
      ok: true,
      enrolled_cold: enrolled,
      ...processed,
    });
  } catch (error) {
    console.error("nurture-tick error", error);
    await supabase.from("webhook_errors").insert({
      source: "nurture_tick",
      error: error instanceof Error ? error.message : String(error),
    });
    return json(
      { ok: false, error: error instanceof Error ? error.message : "nurture_tick_failed" },
      500,
    );
  }
});
