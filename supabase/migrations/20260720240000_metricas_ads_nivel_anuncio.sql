-- Métricas por anúncio (nível ad) sem duplicar KPIs de campanha.
-- Campanha: ad_id = ''. Anúncio: ad_id preenchido.

ALTER TABLE public.metricas_ads
  ADD COLUMN IF NOT EXISTS ad_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS anuncio text,
  ADD COLUMN IF NOT EXISTS nivel text NOT NULL DEFAULT 'campaign',
  ADD COLUMN IF NOT EXISTS impressoes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cliques integer NOT NULL DEFAULT 0;

UPDATE public.metricas_ads
SET campanha = COALESCE(NULLIF(BTRIM(campanha), ''), 'Conta Meta')
WHERE campanha IS NULL OR BTRIM(campanha) = '';

ALTER TABLE public.metricas_ads
  ALTER COLUMN campanha SET DEFAULT 'Conta Meta';

ALTER TABLE public.metricas_ads
  ALTER COLUMN campanha SET NOT NULL;

DROP INDEX IF EXISTS public.ux_metricas_ads_unique;
CREATE UNIQUE INDEX ux_metricas_ads_unique
  ON public.metricas_ads (cliente_id, data, plataforma, campanha, ad_id);

-- KPIs diários só em linhas de campanha (evita somar campanha + anúncio).
CREATE OR REPLACE VIEW public.vw_kpis_cliente_diario AS
SELECT
  m.cliente_id,
  m.data,
  SUM(m.investimento)::numeric(12,2) AS investimento,
  SUM(m.leads)::int AS leads_captados,
  COUNT(l.id) FILTER (
    WHERE l.canal IN ('meta','facebook')
      AND l.status <> 'novo'
  )::int AS leads_qualificados,
  COUNT(l.id) FILTER (
    WHERE l.canal IN ('meta','facebook')
      AND l.status = 'atendido'
  )::int AS atendidos,
  COUNT(l.id) FILTER (
    WHERE l.canal IN ('meta','facebook')
      AND l.status = 'convertido'
  )::int AS convertidos,
  CASE WHEN SUM(m.leads) > 0
    THEN (SUM(m.investimento) / SUM(m.leads))::numeric(12,2)
    ELSE NULL
  END AS cpl
FROM public.metricas_ads m
LEFT JOIN public.leads l
  ON l.cliente_id = m.cliente_id
  AND l.criado_em::date = m.data
WHERE COALESCE(m.nivel, 'campaign') = 'campaign'
   OR COALESCE(m.ad_id, '') = ''
GROUP BY m.cliente_id, m.data;

GRANT SELECT ON public.vw_kpis_cliente_diario TO authenticated, service_role;
