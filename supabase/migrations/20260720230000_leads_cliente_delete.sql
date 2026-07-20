-- Portal do médico pode excluir leads do próprio consultório.
DROP POLICY IF EXISTS leads_cliente_delete ON public.leads;
CREATE POLICY leads_cliente_delete ON public.leads
  FOR DELETE
  USING (cliente_id = public.current_cliente_id());
