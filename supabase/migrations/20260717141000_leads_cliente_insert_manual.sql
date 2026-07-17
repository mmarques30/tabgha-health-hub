-- Cliente pode criar leads manuais do próprio consultório
CREATE POLICY leads_cliente_insert
  ON public.leads
  FOR INSERT
  TO authenticated
  WITH CHECK (cliente_id = public.current_cliente_id());
