-- Onda 4 · Métricas Ads + KPIs

CREATE UNIQUE INDEX IF NOT EXISTS ux_metricas_ads_unique
  ON public.metricas_ads (cliente_id, data, plataforma, campanha);

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
GROUP BY m.cliente_id, m.data;

GRANT SELECT ON public.vw_kpis_cliente_diario TO authenticated, service_role;

-- Agenda sync diário 09:00 UTC (06:00 BRT) quando pg_cron e pg_net estiverem habilitados
DO $$
DECLARE
  job_id bigint;
  fn_url text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN

    SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'sync-ads-metrics' LIMIT 1;
    IF job_id IS NOT NULL THEN
      PERFORM cron.unschedule(job_id);
    END IF;

    fn_url := 'https://vdnxhvvkxfzuqludpmna.functions.supabase.co/sync_ads_metrics';

    PERFORM cron.schedule(
      'sync-ads-metrics',
      '0 9 * * *',
      format($sql$
        SELECT net.http_post(
          url := %L,
          headers := '{"Content-Type":"application/json"}'::jsonb,
          body := '{}'::jsonb
        );
      $sql$, fn_url)
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'sync-ads-metrics cron not scheduled: %', SQLERRM;
END
$$;
