-- ============================================================
-- Ajustes call 18/06 — pipeline em linguagem leiga + captura LP
-- ============================================================

-- 1. Garantir cliente Tabgha (para leads vindos da landing)
INSERT INTO clientes (id, nome, especialidade, status, dados_extras)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Tabgha Health Marketing',
  'Agência',
  'ativo',
  '{"is_tabgha":true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 2. Adicionar coluna motivo_perda (nullable)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS motivo_perda text;

-- 3. Migrar status existentes para o novo funil
UPDATE leads SET status = CASE
  WHEN status IN ('lead', 'novo')            THEN 'novo'
  WHEN status IN ('mql', 'qualificado')      THEN 'em_conversa'
  WHEN status IN ('sql', 'em_atendimento')   THEN 'interessado'
  WHEN status IN ('sal')                     THEN 'agendado'
  WHEN status IN ('atendido')                THEN 'atendido'
  WHEN status IN ('ganho', 'cliente', 'convertido') THEN 'convertido'
  WHEN status IN ('perdido', 'perdida')      THEN 'perdido'
  ELSE 'novo'
END;

-- 4. Substituir constraint de status
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check
  CHECK (status IN ('novo','em_conversa','interessado','agendado','atendido','convertido','perdido'));

-- 5. Constraint de motivo_perda
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_motivo_perda_check;
ALTER TABLE leads ADD CONSTRAINT leads_motivo_perda_check
  CHECK (
    motivo_perda IN ('sem_plano','fora_regiao','sem_interesse','por_engano','nao_respondeu','outro')
    OR motivo_perda IS NULL
  );
