-- Onda 1 · Fundação de mensagens
-- Isola credenciais ZAPI (e futuros providers) em tabela própria.

CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('zapi', 'cloud_api', 'evolution')),
  instance_id text,
  token text,
  phone text,
  status text NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected', 'connecting', 'connected', 'error')),
  last_connected_at timestamptz,
  dados_extras jsonb DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wpp_instances_cliente
  ON public.whatsapp_instances(cliente_id);

CREATE INDEX IF NOT EXISTS idx_wpp_instances_instance_id
  ON public.whatsapp_instances(instance_id)
  WHERE instance_id IS NOT NULL;

-- No máximo uma instância ATIVA (connected) por cliente
CREATE UNIQUE INDEX IF NOT EXISTS ux_wpp_instance_ativa
  ON public.whatsapp_instances(cliente_id)
  WHERE status = 'connected';

DROP TRIGGER IF EXISTS trg_wpp_instances_updated ON public.whatsapp_instances;
CREATE TRIGGER trg_wpp_instances_updated
  BEFORE UPDATE ON public.whatsapp_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wpp_instances_admin_all ON public.whatsapp_instances;
CREATE POLICY wpp_instances_admin_all ON public.whatsapp_instances
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS wpp_instances_cliente_select ON public.whatsapp_instances;
CREATE POLICY wpp_instances_cliente_select ON public.whatsapp_instances
  FOR SELECT
  USING (cliente_id = public.current_cliente_id());

-- Migra credenciais existentes de clientes.dados_extras.automacoes.zapi
INSERT INTO public.whatsapp_instances (
  cliente_id,
  provider,
  instance_id,
  token,
  phone,
  status,
  last_connected_at,
  dados_extras
)
SELECT
  c.id,
  'zapi',
  c.dados_extras #>> '{automacoes,zapi,instance_id}',
  c.dados_extras #>> '{automacoes,zapi,token}',
  NULLIF(c.dados_extras #>> '{automacoes,zapi,phone}', ''),
  CASE
    WHEN NULLIF(c.dados_extras #>> '{automacoes,zapi,instance_id}', '') IS NOT NULL
     AND NULLIF(c.dados_extras #>> '{automacoes,zapi,token}', '') IS NOT NULL
    THEN 'connected'
    ELSE 'disconnected'
  END,
  CASE
    WHEN NULLIF(c.dados_extras #>> '{automacoes,zapi,instance_id}', '') IS NOT NULL
     AND NULLIF(c.dados_extras #>> '{automacoes,zapi,token}', '') IS NOT NULL
    THEN now()
    ELSE NULL
  END,
  jsonb_strip_nulls(
    jsonb_build_object(
      'client_token', c.dados_extras #>> '{automacoes,zapi,client_token}',
      'base_url', c.dados_extras #>> '{automacoes,zapi,base_url}',
      'agente_ativo', c.dados_extras #> '{automacoes,zapi,agente_ativo}',
      'migrated_from', 'dados_extras.automacoes.zapi'
    )
  )
FROM public.clientes c
WHERE NULLIF(c.dados_extras #>> '{automacoes,zapi,instance_id}', '') IS NOT NULL
  AND NULLIF(c.dados_extras #>> '{automacoes,zapi,token}', '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.whatsapp_instances wi WHERE wi.cliente_id = c.id
  );

-- Fecha conversas paradas (>4h sem resposta outbound)
CREATE OR REPLACE FUNCTION public.close_stalled_conversations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  closed_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.whatsapp_conversations
    SET
      state = 'stalled',
      closed_at = now(),
      closed_reason = 'sem resposta 4h',
      atualizado_em = now()
    WHERE state IN ('greeting', 'qualifying', 'routing')
      AND last_inbound_at IS NOT NULL
      AND last_inbound_at < now() - interval '4 hours'
      AND (
        last_outbound_at IS NULL
        OR last_outbound_at < now() - interval '4 hours'
      )
    RETURNING id
  )
  SELECT COUNT(*)::integer INTO closed_count FROM updated;

  RETURN closed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.close_stalled_conversations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_stalled_conversations() TO service_role;

-- Agenda cron a cada 30min quando pg_cron + pg_net estiverem disponíveis.
-- Sem isso a edge function close-stalled-conversations pode ser agendada
-- pelo Dashboard (Scheduled Functions).
DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT jobid INTO existing_job_id
    FROM cron.job
    WHERE jobname = 'close-stalled-conversations'
    LIMIT 1;

    IF existing_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(existing_job_id);
    END IF;

    PERFORM cron.schedule(
      'close-stalled-conversations',
      '*/30 * * * *',
      $cron$SELECT public.close_stalled_conversations();$cron$
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'close-stalled-conversations cron not scheduled: %', SQLERRM;
END;
$$;
