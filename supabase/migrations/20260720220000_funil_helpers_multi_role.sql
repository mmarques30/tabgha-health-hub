-- Funil helpers: com usuários multi-papel (admin+cliente), SELECT role INTO
-- pegava papel arbitrário. Preferir has_role('admin').

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

  v_my_cliente := public.current_cliente_id();

  IF NOT public.has_role(auth.uid(), 'admin')
     AND (v_my_cliente IS NULL OR v_my_cliente <> v_cliente) THEN
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
  v_my_cliente uuid;
BEGIN
  SELECT cliente_id, observacoes INTO v_cliente, v_obs
  FROM leads WHERE id = _lead_id;

  IF v_cliente IS NULL THEN
    RAISE EXCEPTION 'lead não encontrado';
  END IF;

  v_my_cliente := public.current_cliente_id();

  IF NOT public.has_role(auth.uid(), 'admin')
     AND (v_my_cliente IS NULL OR v_my_cliente <> v_cliente) THEN
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
