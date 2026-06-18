import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Json } from "@/integrations/supabase/types";
import type { AuthContext } from "@/server/auth";

const META_API_VERSION = "v20.0";
const INSIGHT_FIELDS =
  "impressions,clicks,spend,reach,cpc,cpm,ctr,actions,cost_per_action_type,frequency";
const CAMPAIGN_FIELDS =
  "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time";

const metaInsightsInput = z.object({
  cliente_id: z.string().uuid(),
  action: z.enum([
    "overview",
    "campaigns",
    "account_insights",
    "campaign_insights",
    "daily_insights",
    "ad_insights",
  ]),
  since: z.string().optional(),
  until: z.string().optional(),
  campaign_id: z.string().optional(),
});

type MetaCreds = {
  access_token: string;
  ad_account_id: string;
  api_version?: string;
};

async function metaGet(accessToken: string, path: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/${path}`);
  url.searchParams.set("access_token", accessToken);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Meta API ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

async function loadCreds(
  supabase: AuthContext["supabase"],
  clienteId: string,
): Promise<MetaCreds> {
  const { data, error } = await supabase
    .from("clientes")
    .select("dados_extras")
    .eq("id", clienteId)
    .single();

  if (error) {
    throw error;
  }

  const extras = data?.dados_extras as Json;
  const creds = (extras as { automacoes?: { meta?: MetaCreds } })?.automacoes?.meta;

  if (!creds?.access_token || !creds?.ad_account_id) {
    throw new Error("Meta Ads não configurado para este cliente");
  }

  return creds;
}

type MetaInput = z.infer<typeof metaInsightsInput>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getMetaInsights = ((createServerFn({ method: "POST" }) as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .handler(async (ctx: any): Promise<any> => {
    const data = metaInsightsInput.parse(ctx.data);
    const { requireAuth, assertClienteAccess } = await import("@/server/auth");
    const auth = await requireAuth();
    assertClienteAccess(auth, data.cliente_id);

    const creds = await loadCreds(auth.supabase, data.cliente_id);
    const timeRange =
      data.since && data.until ? JSON.stringify({ since: data.since, until: data.until }) : undefined;
    const timeParams: Record<string, string> = timeRange ? { time_range: timeRange } : {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any = {};

    switch (data.action) {
      case "campaigns": {
        const campaigns = await metaGet(creds.access_token, `${creds.ad_account_id}/campaigns`, {
          fields: CAMPAIGN_FIELDS,
          limit: "100",
          filtering: JSON.stringify([
            { field: "effective_status", operator: "IN", value: ["ACTIVE", "PAUSED"] },
          ]),
        });
        result = { campaigns: campaigns.data ?? [] };
        break;
      }
      case "account_insights": {
        const insights = await metaGet(creds.access_token, `${creds.ad_account_id}/insights`, {
          fields: INSIGHT_FIELDS,
          level: "account",
          ...timeParams,
        });
        result = { insights: insights.data ?? [] };
        break;
      }
      case "campaign_insights": {
        const [insights, campaigns] = await Promise.all([
          metaGet(creds.access_token, `${creds.ad_account_id}/insights`, {
            fields: `${INSIGHT_FIELDS},campaign_id,campaign_name`,
            level: "campaign",
            limit: "100",
            ...timeParams,
          }),
          metaGet(creds.access_token, `${creds.ad_account_id}/campaigns`, {
            fields: CAMPAIGN_FIELDS,
            limit: "100",
          }),
        ]);

        const statusById = new Map<string, string>(
          (campaigns.data ?? []).map((campaign: { id: string; status: string }) => [
            campaign.id,
            campaign.status,
          ]),
        );

        result = {
          insights: (insights.data ?? []).map((row: { campaign_id?: string; [key: string]: unknown }) => ({
            ...row,
            status: row.campaign_id ? statusById.get(row.campaign_id) : undefined,
          })),
        };
        break;
      }
      case "daily_insights": {
        const path = data.campaign_id ?? creds.ad_account_id;
        const insights = await metaGet(creds.access_token, `${path}/insights`, {
          fields: INSIGHT_FIELDS,
          time_increment: "1",
          level: data.campaign_id ? "campaign" : "account",
          limit: "90",
          ...timeParams,
        });
        result = { insights: insights.data ?? [] };
        break;
      }
      case "ad_insights": {
        const params: Record<string, string> = {
          fields: `${INSIGHT_FIELDS},ad_id,ad_name,adset_name,campaign_name`,
          level: "ad",
          limit: "100",
          ...timeParams,
        };

        if (data.campaign_id) {
          params.filtering = JSON.stringify([
            { field: "campaign.id", operator: "IN", value: [data.campaign_id] },
          ]);
        }

        const insights = await metaGet(creds.access_token, `${creds.ad_account_id}/insights`, params);
        result = { insights: insights.data ?? [] };
        break;
      }
      case "overview":
      default: {
        const [account, campaigns] = await Promise.all([
          metaGet(creds.access_token, `${creds.ad_account_id}/insights`, {
            fields: INSIGHT_FIELDS,
            level: "account",
            ...timeParams,
          }),
          metaGet(creds.access_token, `${creds.ad_account_id}/insights`, {
            fields: `${INSIGHT_FIELDS},campaign_id,campaign_name`,
            level: "campaign",
            limit: "50",
            ...timeParams,
          }),
        ]);

        result = {
          account: account.data ?? [],
          campaigns: campaigns.data ?? [],
        };
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (auth.supabase as any).from("automation_logs").insert({
      cliente_id: data.cliente_id,
      action: "meta_insights",
      tokens_in: 1,
      metadata: { action: data.action, since: data.since, until: data.until },
    });

    return result;
  })) as (input: { data: MetaInput }) => Promise<any>;
