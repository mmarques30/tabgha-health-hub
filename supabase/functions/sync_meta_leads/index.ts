// Importa leads históricos dos formulários Lead Ads da Meta para a tabela leads.
// Body opcional: { cliente_id?: string, days?: number }
// Usa page_id + access_token em dados_extras.meta.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") ?? "v19.0";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

type FieldData = { name?: string; values?: string[] };
type FormMap = Record<string, string[] | string>;

type MetaConfig = {
  access_token?: string;
  user_access_token?: string;
  page_id?: string;
  page_name?: string;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function pickField(fieldData: FieldData[], aliases: string[]): string | null {
  const lowered = aliases.map((a) => a.toLowerCase());
  for (const field of fieldData) {
    const name = (field.name ?? "").toLowerCase();
    if (lowered.includes(name)) {
      const value = field.values?.[0]?.trim();
      if (value) return value;
    }
  }
  return null;
}

function aliasesFor(map: FormMap, key: string): string[] {
  const raw = map[key];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

async function loadFormMap(formId: string | undefined): Promise<FormMap> {
  const { data } = await supabase
    .from("app_config")
    .select("valor")
    .eq("chave", "meta_form_map")
    .maybeSingle();

  const maps = (data?.valor ?? {}) as Record<string, FormMap>;
  if (formId && maps[formId]) return maps[formId];
  return (
    maps._default ?? {
      nome: ["full_name", "name", "nome"],
      telefone: ["phone_number", "phone", "telefone"],
      email: ["email"],
    }
  );
}

async function graphGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Meta API ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

async function fetchAllPages<T extends { id?: string }>(
  firstUrl: string,
): Promise<T[]> {
  const out: T[] = [];
  let url: string | null = firstUrl;
  let guard = 0;
  while (url && guard < 40) {
    guard += 1;
    const payload = await graphGet<{ data?: T[]; paging?: { next?: string } }>(url);
    out.push(...(payload.data ?? []));
    url = payload.paging?.next ?? null;
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  let body: { cliente_id?: string; days?: number } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const days = Math.min(Math.max(Number(body.days) || 90, 1), 365);
  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;

  let clientesQ = supabase.from("clientes").select("id, nome, dados_extras");
  if (body.cliente_id) clientesQ = clientesQ.eq("id", body.cliente_id);

  const { data: clientes, error: clientesError } = await clientesQ;
  if (clientesError) return json({ ok: false, error: clientesError.message }, 500);

  const resultados: Array<Record<string, unknown>> = [];

  for (const cliente of clientes ?? []) {
    const meta = (cliente.dados_extras as { meta?: MetaConfig } | null)?.meta;
    const pageId = meta?.page_id;
    const tokens = [meta?.user_access_token, meta?.access_token].filter(
      (t): t is string => Boolean(t),
    );
    if (!pageId || tokens.length === 0) {
      resultados.push({
        cliente_id: cliente.id,
        nome: cliente.nome,
        skipped: true,
        motivo: "meta_page_or_token_missing",
      });
      continue;
    }

    try {
      let forms: Array<{
        id: string;
        name?: string;
        status?: string;
        leads_count?: number;
      }> = [];
      let token = tokens[0];
      let lastFormsError: string | null = null;

      for (const candidate of tokens) {
        try {
          const formsUrl =
            `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/leadgen_forms` +
            `?fields=id,name,status,leads_count` +
            `&access_token=${encodeURIComponent(candidate)}` +
            `&limit=100`;
          forms = await fetchAllPages(formsUrl);
          token = candidate;
          lastFormsError = null;
          break;
        } catch (err) {
          lastFormsError = err instanceof Error ? err.message : String(err);
        }
      }

      if (lastFormsError) {
        throw new Error(lastFormsError);
      }

      let inseridos = 0;
      let ignorados = 0;
      let erros = 0;
      const formErrors: string[] = [];

      for (const form of forms) {
        if (!form.id) continue;
        try {
          const leadsUrl =
            `https://graph.facebook.com/${GRAPH_VERSION}/${form.id}/leads` +
            `?fields=created_time,id,ad_id,campaign_id,field_data,form_id` +
            `&access_token=${encodeURIComponent(token)}` +
            `&limit=100`;

          const leads = await fetchAllPages<{
            id: string;
            created_time?: string;
            ad_id?: string;
            campaign_id?: string;
            form_id?: string;
            field_data?: FieldData[];
          }>(leadsUrl);

          const formMap = await loadFormMap(form.id);

          for (const lead of leads) {
            if (!lead.id) continue;
            const created = lead.created_time ? Date.parse(lead.created_time) : Date.now();
            if (Number.isFinite(created) && created < sinceMs) {
              ignorados += 1;
              continue;
            }

            const { data: existing } = await supabase
              .from("leads")
              .select("id")
              .eq("meta_leadgen_id", lead.id)
              .maybeSingle();
            if (existing) {
              ignorados += 1;
              continue;
            }

            // Fallback dedupe for rows inserted before meta_leadgen_id existia
            const { data: legacy } = await supabase
              .from("leads")
              .select("id")
              .eq("cliente_id", cliente.id)
              .eq("canal", "meta")
              .ilike("observacoes", `%leadgen ${lead.id}%`)
              .maybeSingle();
            if (legacy) {
              await supabase
                .from("leads")
                .update({ meta_leadgen_id: lead.id })
                .eq("id", legacy.id);
              ignorados += 1;
              continue;
            }

            const fieldData = lead.field_data ?? [];
            const nome =
              pickField(fieldData, aliasesFor(formMap, "nome")) ?? "Lead Meta";
            const telefoneRaw = pickField(fieldData, aliasesFor(formMap, "telefone"));
            const email = pickField(fieldData, aliasesFor(formMap, "email"));
            const telefone = telefoneRaw ? normalizePhone(telefoneRaw) : null;

            const { error: insertError } = await supabase.from("leads").insert({
              cliente_id: cliente.id,
              nome,
              telefone,
              email,
              canal: "meta",
              utm_source: "facebook",
              utm_campaign: lead.campaign_id ?? null,
              status: "novo",
              meta_leadgen_id: lead.id,
              criado_em: lead.created_time ?? new Date().toISOString(),
              observacoes: [
                lead.ad_id ? `Ad ${lead.ad_id}` : null,
                `form ${form.id}`,
                `leadgen ${lead.id}`,
                "sync_meta_leads",
              ]
                .filter(Boolean)
                .join(" | "),
            });

            if (insertError) {
              erros += 1;
              formErrors.push(`${form.id}: ${insertError.message}`);
              continue;
            }

            await supabase.from("automation_logs").insert({
              cliente_id: cliente.id,
              action: "meta_lead_synced",
              metadata: {
                leadgen_id: lead.id,
                form_id: form.id,
                page_id: pageId,
                source: "sync_meta_leads",
              },
            });
            inseridos += 1;
          }
        } catch (formErr) {
          erros += 1;
          formErrors.push(
            `${form.id}: ${formErr instanceof Error ? formErr.message : String(formErr)}`,
          );
        }
      }

      resultados.push({
        cliente_id: cliente.id,
        nome: cliente.nome,
        forms: forms.length,
        inseridos,
        ignorados,
        erros,
        formErrors: formErrors.slice(0, 5),
      });
    } catch (err) {
      resultados.push({
        cliente_id: cliente.id,
        nome: cliente.nome,
        erro: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return json({ ok: true, days, resultados });
});
