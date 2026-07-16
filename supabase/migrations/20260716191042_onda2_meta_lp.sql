-- Onda 2 · Captura de leads (Meta + LP)

-- Amplia sources de webhook_errors
ALTER TABLE public.webhook_errors DROP CONSTRAINT IF EXISTS webhook_errors_source_check;
ALTER TABLE public.webhook_errors ADD CONSTRAINT webhook_errors_source_check
  CHECK (source = ANY (ARRAY[
    'meta_lead',
    'whatsapp_inbound',
    'zapi_callback',
    'meta_ads_sync',
    'meta_oauth',
    'lp_submit',
    'meta_token_refresh'
  ]));

-- Seed: mapa padrão de campos de formulário Meta → colunas leads
INSERT INTO public.app_config (chave, valor)
VALUES (
  'meta_form_map',
  '{
    "_default": {
      "nome": ["full_name", "full name", "nome", "name", "primeiro_nome"],
      "telefone": ["phone_number", "phone", "telefone", "whatsapp", "mobile"],
      "email": ["email", "e-mail", "mail"]
    }
  }'::jsonb
)
ON CONFLICT (chave) DO NOTHING;

-- Seed: cliente Tabgha bootstrap (id fixo usado pela LP)
INSERT INTO public.app_config (chave, valor)
VALUES (
  'tabgha_cliente_id',
  '"00000000-0000-0000-0000-000000000001"'::jsonb
)
ON CONFLICT (chave) DO NOTHING;

-- Índice auxiliar para lookup por page_id do Meta
CREATE INDEX IF NOT EXISTS idx_clientes_meta_page_id
  ON public.clientes ((dados_extras #>> '{meta,page_id}'))
  WHERE dados_extras #>> '{meta,page_id}' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_meta_page_id_legacy
  ON public.clientes ((dados_extras ->> 'meta_page_id'))
  WHERE dados_extras ->> 'meta_page_id' IS NOT NULL;
