-- TABGHA — WhatsApp conversations & messages (META-WPP/1)

CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id       UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  lead_id          UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  contact_phone    TEXT NOT NULL,
  contact_name     TEXT,
  origem           TEXT NOT NULL DEFAULT 'desconhecido'
    CHECK (origem IN ('consulta','opme','duvida','retorno','indicacao','desconhecido')),
  state            TEXT NOT NULL DEFAULT 'greeting'
    CHECK (state IN ('greeting','qualifying','routing','handoff','agendado','closed','stalled')),
  step_count       INT NOT NULL DEFAULT 0,
  bot_score        INT DEFAULT 0,
  bot_notes        JSONB DEFAULT '{}'::jsonb,
  owner_state      TEXT DEFAULT 'bot' CHECK (owner_state IN ('bot','human_alert','human_active','closed')),
  last_inbound_at  TIMESTAMPTZ,
  last_outbound_at TIMESTAMPTZ,
  closed_at        TIMESTAMPTZ,
  closed_reason    TEXT,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wpp_conv_cliente ON public.whatsapp_conversations(cliente_id, state);
CREATE INDEX IF NOT EXISTS idx_wpp_conv_lead ON public.whatsapp_conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_wpp_conv_phone ON public.whatsapp_conversations(cliente_id, contact_phone);
CREATE UNIQUE INDEX IF NOT EXISTS uq_wpp_conv_open
  ON public.whatsapp_conversations(cliente_id, contact_phone)
  WHERE state NOT IN ('closed','stalled');

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  cliente_id       UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  direction        TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  sender_type      TEXT NOT NULL CHECK (sender_type IN ('bot','human','lead')),
  sender_user_id   UUID REFERENCES auth.users(id),
  body             TEXT NOT NULL,
  zapi_message_id  TEXT,
  delivery_status  TEXT DEFAULT 'sent' CHECK (delivery_status IN ('sent','delivered','read','failed')),
  metadata         JSONB DEFAULT '{}'::jsonb,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wpp_msg_conv ON public.whatsapp_messages(conversation_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_wpp_msg_zapi ON public.whatsapp_messages(zapi_message_id) WHERE zapi_message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_wpp_msg_zapi
  ON public.whatsapp_messages(zapi_message_id) WHERE zapi_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.webhook_errors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source      TEXT NOT NULL CHECK (source IN ('meta_lead','whatsapp_inbound','zapi_callback','meta_ads_sync')),
  cliente_id  UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  payload     JSONB,
  error       TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.phone_cache (
  telefone   TEXT PRIMARY KEY,
  exists     BOOLEAN NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automation_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  tokens_in   INT,
  tokens_out  INT,
  metadata    JSONB DEFAULT '{}'::jsonb,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_wpp_conv_updated ON public.whatsapp_conversations;
CREATE TRIGGER trg_wpp_conv_updated BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wpp_conv_admin_all ON public.whatsapp_conversations;
CREATE POLICY wpp_conv_admin_all ON public.whatsapp_conversations FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS wpp_msg_admin_all ON public.whatsapp_messages;
CREATE POLICY wpp_msg_admin_all ON public.whatsapp_messages FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS webhook_errors_admin_all ON public.webhook_errors;
CREATE POLICY webhook_errors_admin_all ON public.webhook_errors FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS phone_cache_admin_all ON public.phone_cache;
CREATE POLICY phone_cache_admin_all ON public.phone_cache FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS automation_logs_admin_all ON public.automation_logs;
CREATE POLICY automation_logs_admin_all ON public.automation_logs FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS wpp_conv_cliente_select ON public.whatsapp_conversations;
CREATE POLICY wpp_conv_cliente_select ON public.whatsapp_conversations FOR SELECT
  USING (cliente_id = public.current_cliente_id());

DROP POLICY IF EXISTS wpp_msg_cliente_select ON public.whatsapp_messages;
CREATE POLICY wpp_msg_cliente_select ON public.whatsapp_messages FOR SELECT
  USING (cliente_id = public.current_cliente_id());

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  _cliente_id UUID,
  _phone TEXT,
  _nome TEXT DEFAULT NULL,
  _origem TEXT DEFAULT 'desconhecido'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE conv_id UUID;
BEGIN
  SELECT id INTO conv_id FROM whatsapp_conversations
   WHERE cliente_id = _cliente_id AND contact_phone = _phone
     AND state NOT IN ('closed','stalled')
   LIMIT 1;

  IF conv_id IS NULL THEN
    INSERT INTO whatsapp_conversations(cliente_id, contact_phone, contact_name, origem)
      VALUES (_cliente_id, _phone, _nome, _origem)
      RETURNING id INTO conv_id;
  END IF;

  RETURN conv_id;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
  END IF;
END $$;
