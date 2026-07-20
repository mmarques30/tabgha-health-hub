-- Deduplicação de leads importados da Meta (webhook + sync histórico)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS meta_leadgen_id text;

CREATE UNIQUE INDEX IF NOT EXISTS leads_meta_leadgen_id_uidx
  ON public.leads (meta_leadgen_id)
  WHERE meta_leadgen_id IS NOT NULL;
