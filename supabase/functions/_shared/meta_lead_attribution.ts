/** Resolve nomes de anúncio/campanha/formulário Meta a partir dos IDs do Lead Ads. */

export type MetaAttributionIds = {
  ad_id?: string | null;
  campaign_id?: string | null;
  form_id?: string | null;
  page_id?: string | null;
  form_name?: string | null;
  page_name?: string | null;
};

export type MetaAttribution = {
  meta_ad_id: string | null;
  meta_ad_name: string | null;
  meta_campaign_id: string | null;
  meta_campaign_name: string | null;
  meta_form_id: string | null;
  meta_form_name: string | null;
  meta_page_id: string | null;
};

type Cache = {
  ad: Map<string, { name: string | null; campaignId: string | null; campaignName: string | null }>;
  form: Map<string, string | null>;
  campaign: Map<string, string | null>;
};

export function createAttributionCache(): Cache {
  return { ad: new Map(), form: new Map(), campaign: new Map() };
}

async function graphJson(
  url: string,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function resolveMetaAttribution(
  accessToken: string,
  graphVersion: string,
  ids: MetaAttributionIds,
  cache: Cache = createAttributionCache(),
): Promise<MetaAttribution> {
  const adId = ids.ad_id ? String(ids.ad_id).trim() : "";
  const campaignId = ids.campaign_id ? String(ids.campaign_id).trim() : "";
  const formId = ids.form_id ? String(ids.form_id).trim() : "";
  const pageId = ids.page_id ? String(ids.page_id).trim() : "";

  let adName: string | null = null;
  let resolvedCampaignId = campaignId || null;
  let campaignName: string | null = null;
  let formName = ids.form_name?.trim() || null;

  if (adId) {
    if (cache.ad.has(adId)) {
      const hit = cache.ad.get(adId)!;
      adName = hit.name;
      if (!resolvedCampaignId && hit.campaignId) resolvedCampaignId = hit.campaignId;
      if (hit.campaignName) campaignName = hit.campaignName;
    } else {
      const payload = await graphJson(
        `https://graph.facebook.com/${graphVersion}/${adId}` +
          `?fields=name,campaign{id,name}` +
          `&access_token=${encodeURIComponent(accessToken)}`,
      );
      const campaign = payload?.campaign as { id?: string; name?: string } | undefined;
      adName = typeof payload?.name === "string" ? payload.name : null;
      if (!resolvedCampaignId && campaign?.id) resolvedCampaignId = String(campaign.id);
      if (campaign?.name) campaignName = campaign.name;
      cache.ad.set(adId, {
        name: adName,
        campaignId: campaign?.id ? String(campaign.id) : null,
        campaignName: campaign?.name ?? null,
      });
    }
  }

  if (resolvedCampaignId && !campaignName) {
    if (cache.campaign.has(resolvedCampaignId)) {
      campaignName = cache.campaign.get(resolvedCampaignId) ?? null;
    } else {
      const payload = await graphJson(
        `https://graph.facebook.com/${graphVersion}/${resolvedCampaignId}` +
          `?fields=name` +
          `&access_token=${encodeURIComponent(accessToken)}`,
      );
      campaignName = typeof payload?.name === "string" ? payload.name : null;
      cache.campaign.set(resolvedCampaignId, campaignName);
    }
  }

  if (formId && !formName) {
    if (cache.form.has(formId)) {
      formName = cache.form.get(formId) ?? null;
    } else {
      const payload = await graphJson(
        `https://graph.facebook.com/${graphVersion}/${formId}` +
          `?fields=name` +
          `&access_token=${encodeURIComponent(accessToken)}`,
      );
      formName = typeof payload?.name === "string" ? payload.name : null;
      cache.form.set(formId, formName);
    }
  }

  return {
    meta_ad_id: adId || null,
    meta_ad_name: adName,
    meta_campaign_id: resolvedCampaignId,
    meta_campaign_name: campaignName,
    meta_form_id: formId || null,
    meta_form_name: formName,
    meta_page_id: pageId || null,
  };
}
