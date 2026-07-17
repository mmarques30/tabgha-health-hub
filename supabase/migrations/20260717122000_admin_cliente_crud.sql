-- CRUD admin de clientes via RPC (SECURITY DEFINER + assert_current_admin).
-- Evita falha silenciosa de UPDATE/DELETE filtrado por RLS no client.

CREATE OR REPLACE FUNCTION public.admin_update_cliente(
  _id uuid,
  _nome text DEFAULT NULL,
  _email text DEFAULT NULL,
  _telefone text DEFAULT NULL,
  _cnpj text DEFAULT NULL,
  _razao_social text DEFAULT NULL,
  _especialidade text DEFAULT NULL,
  _status text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_current_admin();

  IF _status IS NOT NULL AND _status NOT IN ('onboarding', 'ativo', 'pausa', 'inativo') THEN
    RAISE EXCEPTION 'status inválido: %', _status USING ERRCODE = '22023';
  END IF;

  UPDATE public.clientes SET
    nome = COALESCE(NULLIF(btrim(_nome), ''), nome),
    email = CASE WHEN _email IS NULL THEN email ELSE NULLIF(btrim(_email), '') END,
    telefone = CASE WHEN _telefone IS NULL THEN telefone ELSE NULLIF(btrim(_telefone), '') END,
    cnpj = CASE WHEN _cnpj IS NULL THEN cnpj ELSE NULLIF(btrim(_cnpj), '') END,
    razao_social = CASE WHEN _razao_social IS NULL THEN razao_social ELSE NULLIF(btrim(_razao_social), '') END,
    especialidade = CASE WHEN _especialidade IS NULL THEN especialidade ELSE NULLIF(btrim(_especialidade), '') END,
    status = COALESCE(_status, status)
  WHERE id = _id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cliente não encontrado' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_cliente(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_current_admin();

  DELETE FROM public.clientes WHERE id = _id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cliente não encontrado' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

-- Também aceita especialidade na criação (evita 2º update).
CREATE OR REPLACE FUNCTION public.admin_create_cliente(
  _nome text,
  _email text,
  _cnpj text DEFAULT NULL,
  _especialidade text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  PERFORM public.assert_current_admin();

  INSERT INTO public.clientes (nome, email, cnpj, especialidade, status)
  VALUES (
    btrim(_nome),
    NULLIF(btrim(_email), ''),
    NULLIF(btrim(_cnpj), ''),
    NULLIF(btrim(_especialidade), ''),
    'onboarding'
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_cliente(
  uuid, text, text, text, text, text, text, text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.admin_delete_cliente(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.admin_create_cliente(text, text, text, text) TO authenticated;
-- Mantém assinatura antiga (3 args) compatível
GRANT EXECUTE ON FUNCTION public.admin_create_cliente(text, text, text) TO authenticated;
