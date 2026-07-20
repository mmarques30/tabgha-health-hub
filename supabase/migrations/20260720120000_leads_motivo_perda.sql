-- Coluna esperada por mover_lead_status / log_ticket_converted
-- (migration 20260618194242 existia no repo mas não estava aplicada no remoto)

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS motivo_perda text;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_motivo_perda_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_motivo_perda_check
  CHECK (
    motivo_perda IN ('sem_plano','fora_regiao','sem_interesse','por_engano','nao_respondeu','outro')
    OR motivo_perda IS NULL
  );

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check
  CHECK (status IN ('novo','em_conversa','interessado','agendado','atendido','convertido','perdido'));
