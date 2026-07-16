-- Onda 3 · CRM Pipeline ao vivo

-- Cliente pode atualizar leads do próprio cliente_id (status, obs, motivo)
DROP POLICY IF EXISTS leads_cliente_update ON public.leads;
CREATE POLICY leads_cliente_update ON public.leads
  FOR UPDATE
  USING (cliente_id = public.current_cliente_id())
  WITH CHECK (cliente_id = public.current_cliente_id());

-- View de funil por cliente
CREATE OR REPLACE VIEW public.vw_funil_lead_cliente AS
SELECT
  cliente_id,
  status,
  COUNT(*)::bigint AS total,
  AVG(EXTRACT(EPOCH FROM (atualizado_em - criado_em)) / 3600.0) AS horas_no_estagio
FROM public.leads
GROUP BY cliente_id, status;

GRANT SELECT ON public.vw_funil_lead_cliente TO authenticated, service_role;

-- Move lead de status com log
CREATE OR REPLACE FUNCTION public.mover_lead_status(
  _lead_id uuid,
  _novo text,
  _motivo text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente uuid;
  v_role text;
  v_my_cliente uuid;
BEGIN
  IF _novo NOT IN ('novo','em_conversa','interessado','agendado','atendido','convertido','perdido') THEN
    RAISE EXCEPTION 'status inválido: %', _novo;
  END IF;

  IF _novo = 'perdido' AND (_motivo IS NULL OR _motivo = '') THEN
    RAISE EXCEPTION 'motivo_perda obrigatório ao mover para perdido';
  END IF;

  SELECT cliente_id INTO v_cliente FROM leads WHERE id = _lead_id;
  IF v_cliente IS NULL THEN
    RAISE EXCEPTION 'lead não encontrado';
  END IF;

  SELECT role INTO v_role FROM user_roles WHERE user_id = auth.uid();
  v_my_cliente := public.current_cliente_id();

  IF v_role IS DISTINCT FROM 'admin' AND (v_my_cliente IS NULL OR v_my_cliente <> v_cliente) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE leads SET
    status = _novo,
    motivo_perda = CASE WHEN _novo = 'perdido' THEN _motivo ELSE NULL END,
    atualizado_em = now()
  WHERE id = _lead_id;

  INSERT INTO automation_logs(cliente_id, action, metadata)
  VALUES (
    v_cliente,
    'lead_status_changed',
    jsonb_build_object(
      'lead_id', _lead_id,
      'novo', _novo,
      'motivo', _motivo,
      'by', auth.uid()
    )
  );

  IF _novo = 'convertido' THEN
    INSERT INTO automation_logs(cliente_id, action, metadata)
    VALUES (
      v_cliente,
      'lead_converted',
      jsonb_build_object('lead_id', _lead_id, 'by', auth.uid())
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mover_lead_status(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mover_lead_status(uuid, text, text) TO authenticated, service_role;

-- Converte lead com ticket (valor) em observacoes JSON-ish
CREATE OR REPLACE FUNCTION public.log_ticket_converted(
  _lead_id uuid,
  _ticket numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente uuid;
  v_obs text;
  v_role text;
  v_my_cliente uuid;
BEGIN
  SELECT cliente_id, observacoes INTO v_cliente, v_obs
  FROM leads WHERE id = _lead_id;

  IF v_cliente IS NULL THEN
    RAISE EXCEPTION 'lead não encontrado';
  END IF;

  SELECT role INTO v_role FROM user_roles WHERE user_id = auth.uid();
  v_my_cliente := public.current_cliente_id();

  IF v_role IS DISTINCT FROM 'admin' AND (v_my_cliente IS NULL OR v_my_cliente <> v_cliente) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE leads SET
    status = 'convertido',
    motivo_perda = NULL,
    observacoes = CASE
      WHEN v_obs IS NULL OR btrim(v_obs) = '' THEN 'ticket: ' || _ticket::text
      WHEN v_obs ~* 'ticket:\s*[0-9]+' THEN regexp_replace(v_obs, 'ticket:\s*[0-9.]+', 'ticket: ' || _ticket::text, 'i')
      ELSE v_obs || ' | ticket: ' || _ticket::text
    END,
    atualizado_em = now()
  WHERE id = _lead_id;

  INSERT INTO automation_logs(cliente_id, action, metadata)
  VALUES (
    v_cliente,
    'lead_converted',
    jsonb_build_object('lead_id', _lead_id, 'ticket', _ticket, 'by', auth.uid())
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_ticket_converted(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_ticket_converted(uuid, numeric) TO authenticated, service_role;

-- Realtime no funil
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'leads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
  END IF;
END $$;
