-- Atribuição Meta Lead Ads em colunas dedicadas (não só em observacoes).

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS meta_ad_id text,
  ADD COLUMN IF NOT EXISTS meta_ad_name text,
  ADD COLUMN IF NOT EXISTS meta_campaign_id text,
  ADD COLUMN IF NOT EXISTS meta_campaign_name text,
  ADD COLUMN IF NOT EXISTS meta_form_id text,
  ADD COLUMN IF NOT EXISTS meta_form_name text,
  ADD COLUMN IF NOT EXISTS meta_page_id text;

CREATE INDEX IF NOT EXISTS idx_leads_meta_ad_id
  ON public.leads (cliente_id, meta_ad_id)
  WHERE meta_ad_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_meta_form_id
  ON public.leads (cliente_id, meta_form_id)
  WHERE meta_form_id IS NOT NULL;

-- Backfill a partir de observacoes / utm legados.
UPDATE public.leads
SET
  meta_ad_id = COALESCE(
    meta_ad_id,
    NULLIF(SUBSTRING(observacoes FROM 'Ad[[:space:]]+([0-9]+)'), '')
  ),
  meta_form_id = COALESCE(
    meta_form_id,
    NULLIF(SUBSTRING(observacoes FROM 'form[[:space:]]+([0-9]+)'), '')
  ),
  meta_leadgen_id = COALESCE(
    meta_leadgen_id,
    NULLIF(SUBSTRING(observacoes FROM 'leadgen[[:space:]]+([0-9]+)'), '')
  ),
  meta_campaign_id = COALESCE(
    meta_campaign_id,
    NULLIF(BTRIM(utm_campaign), '')
  )
WHERE canal IN ('meta', 'facebook')
  AND (
    meta_ad_id IS NULL
    OR meta_form_id IS NULL
    OR meta_leadgen_id IS NULL
    OR meta_campaign_id IS NULL
  );

COMMENT ON COLUMN public.leads.meta_ad_id IS 'Meta Ad ID do Lead Ads';
COMMENT ON COLUMN public.leads.meta_ad_name IS 'Nome do anúncio Meta (resolvido via Graph)';
COMMENT ON COLUMN public.leads.meta_campaign_id IS 'Meta Campaign ID do Lead Ads';
COMMENT ON COLUMN public.leads.meta_campaign_name IS 'Nome da campanha Meta';
COMMENT ON COLUMN public.leads.meta_form_id IS 'ID do formulário Lead Ads';
COMMENT ON COLUMN public.leads.meta_form_name IS 'Nome do formulário Lead Ads';
COMMENT ON COLUMN public.leads.meta_page_id IS 'Page ID que capturou o lead';
