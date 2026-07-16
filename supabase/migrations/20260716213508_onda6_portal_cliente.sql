-- Onda 6 · Portal do Cliente (aprovações + self-service)

-- Feedback do cliente em conteúdos
ALTER TABLE public.conteudos
  ADD COLUMN IF NOT EXISTS feedback_cliente text;

-- RPC: cliente aprova/rejeita conteúdo em status 'aprovacao'
CREATE OR REPLACE FUNCTION public.responder_conteudo(
  _id uuid,
  _aprovada boolean,
  _feedback text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_cliente_id() IS NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;

  UPDATE public.conteudos
  SET
    status = CASE WHEN _aprovada THEN 'agendado' ELSE 'roteiro' END,
    feedback_cliente = CASE
      WHEN _aprovada THEN NULL
      ELSE NULLIF(trim(COALESCE(_feedback, '')), '')
    END,
    atualizado_em = now()
  WHERE id = _id
    AND status = 'aprovacao'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR cliente_id = public.current_cliente_id()
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'conteúdo não encontrado ou não está aguardando aprovação';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.responder_conteudo(uuid, boolean, text) TO authenticated;

-- RPC: cliente atualiza apenas dados_extras.redes
CREATE OR REPLACE FUNCTION public.atualizar_redes_cliente(_redes jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cid uuid := public.current_cliente_id();
BEGIN
  IF cid IS NULL THEN
    RAISE EXCEPTION 'cliente não vinculado ao perfil';
  END IF;

  IF jsonb_typeof(_redes) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'redes inválidas';
  END IF;

  UPDATE public.clientes
  SET
    dados_extras = jsonb_set(
      COALESCE(dados_extras, '{}'::jsonb),
      '{redes}',
      _redes,
      true
    ),
    atualizado_em = now()
  WHERE id = cid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.atualizar_redes_cliente(jsonb) TO authenticated;

-- Cliente pode assumir/devolver/encerrar conversas do próprio cliente_id
DROP POLICY IF EXISTS wpp_conv_cliente_update ON public.whatsapp_conversations;
CREATE POLICY wpp_conv_cliente_update ON public.whatsapp_conversations
  FOR UPDATE
  USING (cliente_id = public.current_cliente_id())
  WITH CHECK (cliente_id = public.current_cliente_id());
