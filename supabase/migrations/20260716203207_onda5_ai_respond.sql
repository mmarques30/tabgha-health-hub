-- Onda 5 · Pietro Brain (ai-respond)

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
    'ai_respond'
  ]));

-- Prompt padrão do agente (override por cliente em dados_extras.agente_ia)
INSERT INTO public.app_config (chave, valor)
VALUES (
  'pietro_brain_defaults',
  '{
    "model": "claude-haiku-4-5-20251001",
    "max_history": 16,
    "handoff_score": 75,
    "metodo_qualificacao": "Avalie o lead de forma natural (sem interrogatório) em: (1) intenção — o que busca, (2) urgência — quando quer resolver, (3) fit — combina com a clínica, (4) capacidade — aberto a investir/agendar. Quando estiver qualificado ou pedir humano, faça handoff."
  }'::jsonb
)
ON CONFLICT (chave) DO NOTHING;
