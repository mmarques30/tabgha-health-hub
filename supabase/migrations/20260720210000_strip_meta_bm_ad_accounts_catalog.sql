-- Privacidade Meta BM: remove catálogo de ad accounts / pages da BM
-- (nomes e gasto histórico de outras contas) de clientes.dados_extras.meta.
-- Mantém apenas a conta/página vinculada ao cliente (ad_account_id, page_id, etc.).

UPDATE public.clientes
SET dados_extras = jsonb_set(
  dados_extras,
  '{meta}',
  (COALESCE(dados_extras->'meta', '{}'::jsonb) - 'ad_accounts' - 'pages'),
  true
)
WHERE dados_extras ? 'meta'
  AND (
    (dados_extras->'meta') ? 'ad_accounts'
    OR (dados_extras->'meta') ? 'pages'
  );

-- Remove catálogo de contas também de logs antigos (metadata).
UPDATE public.automation_logs
SET metadata = metadata - 'ad_accounts'
WHERE metadata ? 'ad_accounts';
