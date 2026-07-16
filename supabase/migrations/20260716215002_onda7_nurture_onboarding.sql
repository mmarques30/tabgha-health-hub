-- Onda 7 · Nurturing + reviews + onboarding self-service

ALTER TABLE public.webhook_errors DROP CONSTRAINT IF EXISTS webhook_errors_source_check;
ALTER TABLE public.webhook_errors ADD CONSTRAINT webhook_errors_source_check
  CHECK (source = ANY (ARRAY[
    'meta_lead',
    'whatsapp_inbound',
    'zapi_callback',
    'meta_ads_sync',
    'meta_oauth',
    'lp_submit',
    'meta_token_refresh',
    'ai_respond',
    'whatsapp_connect',
    'nurture_tick',
    'review_ask'
  ]));

-- Jobs de nurturing (drip por lead)
CREATE TABLE IF NOT EXISTS public.nurture_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('cold_followup', 'review_ask')),
  step int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'skipped', 'failed', 'done')),
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_nurture_jobs_active
  ON public.nurture_jobs (cliente_id, lead_id, kind)
  WHERE status IN ('pending', 'sent');

CREATE INDEX IF NOT EXISTS idx_nurture_jobs_due
  ON public.nurture_jobs (status, next_run_at);

DROP TRIGGER IF EXISTS trg_nurture_jobs_updated ON public.nurture_jobs;
CREATE TRIGGER trg_nurture_jobs_updated
  BEFORE UPDATE ON public.nurture_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.nurture_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nurture_jobs_admin_all ON public.nurture_jobs;
CREATE POLICY nurture_jobs_admin_all ON public.nurture_jobs
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS nurture_jobs_cliente_select ON public.nurture_jobs;
CREATE POLICY nurture_jobs_cliente_select ON public.nurture_jobs
  FOR SELECT
  USING (cliente_id = public.current_cliente_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nurture_jobs TO authenticated;
GRANT ALL ON public.nurture_jobs TO service_role;

-- Templates padrão
INSERT INTO public.app_config (chave, valor)
VALUES (
  'nurture_defaults',
  '{
    "cold_idle_days": 2,
    "cold_max_steps": 3,
    "cold_step_gap_hours": 48,
    "cold_messages": [
      "Oi! Vi que conversamos e fiquei na dúvida se ainda faz sentido te ajudar. Posso te explicar rapidinho as opções?",
      "Passando para saber se ficou alguma dúvida. Se preferir, me diz o melhor horário que a equipe te chama.",
      "Última mensagem por aqui 🙂 Se quiser retomar, é só responder esta conversa."
    ],
    "review_delay_hours": 24,
    "review_message": "Que bom ter você conosco! Se puder, sua avaliação no Google ajuda outras pessoas a nos encontrar: {{review_url}}"
  }'::jsonb
)
ON CONFLICT (chave) DO NOTHING;

-- Ao converter/atender, agenda pedido de review
CREATE OR REPLACE FUNCTION public.enqueue_review_ask()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('atendido', 'convertido')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.nurture_jobs
      WHERE lead_id = NEW.id
        AND kind = 'review_ask'
        AND status IN ('pending', 'sent', 'done')
    ) THEN
      INSERT INTO public.nurture_jobs (cliente_id, lead_id, kind, step, status, next_run_at, metadata)
      VALUES (
        NEW.cliente_id,
        NEW.id,
        'review_ask',
        0,
        'pending',
        now() + interval '24 hours',
        jsonb_build_object('from_status', NEW.status)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_enqueue_review ON public.leads;
CREATE TRIGGER trg_leads_enqueue_review
  AFTER INSERT OR UPDATE OF status ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_review_ask();

-- Cron nurture-tick (quando pg_cron + pg_net disponíveis)
DO $$
DECLARE
  job_id bigint;
  fn_url text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN

    SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'nurture-tick' LIMIT 1;
    IF job_id IS NOT NULL THEN
      PERFORM cron.unschedule(job_id);
    END IF;

    fn_url := 'https://vdnxhvvkxfzuqludpmna.functions.supabase.co/nurture-tick';

    PERFORM cron.schedule(
      'nurture-tick',
      '15 * * * *',
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
    RAISE NOTICE 'nurture-tick cron not scheduled: %', SQLERRM;
END
$$;
