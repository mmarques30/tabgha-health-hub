-- ----- EXTENSIONS -----
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----- ENUMS -----
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin','cliente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- TABELAS
-- ============================================================================

-- 1) profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id   uuid,
  nome         text,
  email        text,
  permissoes   text[] DEFAULT ARRAY['*']::text[],
  criado_em    timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2) user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role     app_role NOT NULL,
  PRIMARY KEY (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3) clientes
CREATE TABLE IF NOT EXISTS public.clientes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text NOT NULL,
  razao_social  text,
  cnpj          text,
  email         text,
  telefone      text,
  status        text NOT NULL DEFAULT 'ativo',
  especialidade text,
  diagnostico   jsonb,
  dados_extras  jsonb DEFAULT '{}'::jsonb,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clientes_status ON public.clientes(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL
  NOT VALID;

-- 4) leads
CREATE TABLE IF NOT EXISTS public.leads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nome          text,
  telefone      text,
  email         text,
  icp           text,
  status        text NOT NULL DEFAULT 'novo',
  canal         text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  observacoes   text,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leads_cliente ON public.leads(cliente_id);
CREATE INDEX IF NOT EXISTS idx_leads_status  ON public.leads(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- 5) entregas
CREATE TABLE IF NOT EXISTS public.entregas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id        uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo              text,
  titulo            text,
  status            text NOT NULL DEFAULT 'pendente',
  resposta_cliente  text,
  url_briefing      text,
  url_arquivo_bruto text,
  url_arquivo_final text,
  url_arquivo       text,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_entregas_cliente ON public.entregas(cliente_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entregas TO authenticated;
GRANT ALL ON public.entregas TO service_role;
ALTER TABLE public.entregas ENABLE ROW LEVEL SECURITY;

-- 6) agendamentos
CREATE TABLE IF NOT EXISTS public.agendamentos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id       uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo             text,
  titulo           text,
  descricao        text,
  inicio           timestamptz,
  fim              timestamptz,
  visivel_cliente  boolean NOT NULL DEFAULT true,
  criado_em        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agendamentos_cliente ON public.agendamentos(cliente_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agendamentos TO authenticated;
GRANT ALL ON public.agendamentos TO service_role;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

-- 7) conteudos
CREATE TABLE IF NOT EXISTS public.conteudos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id     uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  titulo         text,
  rede           text,
  tipo           text,
  status         text NOT NULL DEFAULT 'briefing',
  roteiro        text,
  data_postagem  date,
  url_briefing   text,
  url_arquivo    text,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conteudos_cliente ON public.conteudos(cliente_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conteudos TO authenticated;
GRANT ALL ON public.conteudos TO service_role;
ALTER TABLE public.conteudos ENABLE ROW LEVEL SECURITY;

-- 8) metricas_ads
CREATE TABLE IF NOT EXISTS public.metricas_ads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  data          date NOT NULL,
  plataforma    text NOT NULL,
  campanha      text,
  investimento  numeric(12,2) NOT NULL DEFAULT 0,
  leads         integer NOT NULL DEFAULT 0,
  conversoes    integer NOT NULL DEFAULT 0,
  cpl           numeric(12,2),
  cpa           numeric(12,2),
  roas          numeric(12,2),
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_metricas_ads_cliente_data ON public.metricas_ads(cliente_id, data);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.metricas_ads TO authenticated;
GRANT ALL ON public.metricas_ads TO service_role;
ALTER TABLE public.metricas_ads ENABLE ROW LEVEL SECURITY;

-- 9) app_config
CREATE TABLE IF NOT EXISTS public.app_config (
  chave         text PRIMARY KEY,
  valor         jsonb NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_config TO authenticated;
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TRIGGER GENÉRICO: atualiza atualizado_em
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.atualizado_em := now(); RETURN NEW; END $$;

DO $$ DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY['profiles','clientes','leads','entregas','conteudos','app_config'])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_updated ON public.%I;
       CREATE TRIGGER trg_%I_updated BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();',
      t,t,t,t);
  END LOOP;
END $$;

-- ============================================================================
-- FUNÇÕES DE PERMISSÃO (SECURITY DEFINER)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_cliente_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT cliente_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.assert_current_admin()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'apenas admin' USING ERRCODE='42501';
  END IF;
END $$;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- profiles
CREATE POLICY profiles_self ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY profiles_admin_all ON public.profiles FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- user_roles
CREATE POLICY user_roles_self ON public.user_roles FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY user_roles_admin_all ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- clientes
CREATE POLICY clientes_admin_all ON public.clientes FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY clientes_self ON public.clientes FOR SELECT
  USING (id = public.current_cliente_id());

-- leads / entregas / conteudos / metricas_ads (admin all + cliente select)
DO $$ DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['leads','entregas','conteudos','metricas_ads']) LOOP
    EXECUTE format(
      'CREATE POLICY %I_admin_all ON public.%I FOR ALL
        USING (public.has_role(auth.uid(),''admin'')) WITH CHECK (public.has_role(auth.uid(),''admin''));', t, t);
    EXECUTE format(
      'CREATE POLICY %I_cliente_select ON public.%I FOR SELECT
        USING (cliente_id = public.current_cliente_id());', t, t);
  END LOOP;
END $$;

-- agendamentos
CREATE POLICY agendamentos_admin_all ON public.agendamentos FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY agendamentos_cliente_select ON public.agendamentos FOR SELECT
  USING (cliente_id = public.current_cliente_id() AND visivel_cliente = true);

-- entregas: cliente responde
CREATE POLICY entregas_cliente_respond ON public.entregas FOR UPDATE
  USING (cliente_id = public.current_cliente_id() AND status IN ('pendente','em_revisao'))
  WITH CHECK (cliente_id = public.current_cliente_id());

-- app_config
CREATE POLICY app_config_admin ON public.app_config FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY app_config_auth_read ON public.app_config FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- RPCs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.bootstrap_admin(_email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role='admin') THEN
    RAISE EXCEPTION 'admin já existe — use admin_upsert_profile_role';
  END IF;
  SELECT id INTO uid FROM auth.users WHERE email = _email;
  IF uid IS NULL THEN RAISE EXCEPTION 'usuário com email % não existe — criar pelo Auth primeiro', _email; END IF;
  INSERT INTO public.user_roles(user_id,role) VALUES (uid,'admin') ON CONFLICT DO NOTHING;
  INSERT INTO public.profiles(id,email,permissoes) VALUES (uid,_email,ARRAY['*'])
    ON CONFLICT (id) DO UPDATE SET permissoes = ARRAY['*'];
  RETURN uid;
END $$;

CREATE OR REPLACE FUNCTION public.responder_entrega(_id uuid, _resposta text, _aprovada boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.entregas SET
    resposta_cliente = _resposta,
    status = CASE WHEN _aprovada THEN 'aprovada' ELSE 'rejeitada' END,
    atualizado_em = now()
  WHERE id = _id AND cliente_id = public.current_cliente_id() AND status IN ('pendente','em_revisao');
  IF NOT FOUND THEN RAISE EXCEPTION 'entrega não encontrada ou já respondida'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_create_cliente(_nome text, _email text, _cnpj text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE new_id uuid;
BEGIN
  PERFORM public.assert_current_admin();
  INSERT INTO public.clientes(nome,email,cnpj) VALUES (_nome,_email,_cnpj) RETURNING id INTO new_id;
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_upsert_profile_role(_user_id uuid, _role app_role, _cliente_id uuid DEFAULT NULL, _permissoes text[] DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.assert_current_admin();
  INSERT INTO public.profiles(id,cliente_id,permissoes)
    VALUES (_user_id,_cliente_id,COALESCE(_permissoes,ARRAY['*']))
    ON CONFLICT (id) DO UPDATE SET cliente_id = EXCLUDED.cliente_id,
                                   permissoes = EXCLUDED.permissoes,
                                   atualizado_em = now();
  INSERT INTO public.user_roles(user_id,role) VALUES (_user_id,_role) ON CONFLICT DO NOTHING;
END $$;

-- ============================================================================
-- TEMPLATE do diagnóstico
-- ============================================================================
INSERT INTO public.app_config(chave,valor) VALUES
('diagnostico_template', $${
  "secoes": [
    {"id":"perfil","titulo":"Perfil do cliente","campos":["especialidade","tempo_mercado","numero_consultas_mes","ticket_medio"]},
    {"id":"jornada","titulo":"Jornada do paciente","campos":["origem_leads","canais_atuais","funil_atual"]},
    {"id":"dor","titulo":"Dores principais","campos":["nao_consigo_provar_resultado","operacao_manual","sem_jornada","redrive_sem_retorno"]},
    {"id":"objetivos","titulo":"Objetivos de marketing","campos":["meta_leads_mes","meta_cac","posicionamento"]}
  ]
}$$::jsonb)
ON CONFLICT (chave) DO NOTHING;
