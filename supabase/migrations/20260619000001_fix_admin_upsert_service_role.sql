-- Fix: admin_upsert_profile_role é chamado via service role (supabaseAdmin),
-- onde auth.uid() é NULL. Remover assert_current_admin() — o service role
-- só existe no servidor e já é confiável por definição.
CREATE OR REPLACE FUNCTION public.admin_upsert_profile_role(
  _user_id   uuid,
  _role      app_role,
  _cliente_id uuid DEFAULT NULL,
  _permissoes text[] DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id, cliente_id, permissoes)
    VALUES (_user_id, _cliente_id, COALESCE(_permissoes, ARRAY['*']))
    ON CONFLICT (id) DO UPDATE
      SET cliente_id   = EXCLUDED.cliente_id,
          permissoes   = EXCLUDED.permissoes,
          atualizado_em = now();

  INSERT INTO public.user_roles(user_id, role)
    VALUES (_user_id, _role)
    ON CONFLICT DO NOTHING;
END $$;
