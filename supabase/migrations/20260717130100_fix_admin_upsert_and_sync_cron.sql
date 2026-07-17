-- Permite service role / SQL criar profiles sem sessão admin.
CREATE OR REPLACE FUNCTION public.admin_upsert_profile_role(
  _user_id   uuid,
  _role      app_role,
  _cliente_id uuid DEFAULT NULL,
  _permissoes text[] DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    PERFORM public.assert_current_admin();
  END IF;

  INSERT INTO public.profiles(id, cliente_id, permissoes)
    VALUES (_user_id, _cliente_id, COALESCE(_permissoes, ARRAY['*']))
    ON CONFLICT (id) DO UPDATE
      SET cliente_id   = EXCLUDED.cliente_id,
          permissoes   = EXCLUDED.permissoes,
          atualizado_em = now();

  INSERT INTO public.user_roles(user_id, role)
    VALUES (_user_id, _role)
    ON CONFLICT (user_id, role) DO NOTHING;
END $$;

-- Cron diário com backfill de 7 dias e timeout maior
DO $$
DECLARE
  job_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN

    SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'sync-ads-metrics' LIMIT 1;
    IF job_id IS NOT NULL THEN
      PERFORM cron.unschedule(job_id);
    END IF;

    PERFORM cron.schedule(
      'sync-ads-metrics',
      '0 9 * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://vdnxhvvkxfzuqludpmna.supabase.co/functions/v1/sync_ads_metrics',
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := '{"days":7}'::jsonb,
        timeout_milliseconds := 60000
      );
      $cron$
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'sync-ads-metrics cron not rescheduled: %', SQLERRM;
END
$$;
