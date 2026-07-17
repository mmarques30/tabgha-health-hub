import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { PipelineStatus } from "@/lib/pipeline";

export type Lead = Tables<"leads">;

export type LeadFilters = {
  clienteId?: string | null;
  periodoDias?: number | null;
  canal?: string | null;
  search?: string;
};

export function useLeads(filters: LeadFilters) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["leads-kanban", filters] as const, [filters]);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      let request = supabase.from("leads").select("*").order("atualizado_em", { ascending: false });

      if (filters.clienteId) {
        request = request.eq("cliente_id", filters.clienteId);
      }

      if (filters.canal) {
        request = request.eq("canal", filters.canal);
      }

      if (filters.periodoDias) {
        const since = new Date();
        since.setDate(since.getDate() - filters.periodoDias);
        request = request.gte("criado_em", since.toISOString());
      }

      if (filters.search?.trim()) {
        const term = filters.search.trim();
        request = request.or(`nome.ilike.%${term}%,telefone.ilike.%${term}%,email.ilike.%${term}%`);
      }

      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`leads-rt-${filters.clienteId ?? "all"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
          ...(filters.clienteId ? { filter: `cliente_id=eq.${filters.clienteId}` } : {}),
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["leads-kanban"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [filters.clienteId, queryClient]);

  return query;
}

export function useFunilStats(clienteId?: string | null) {
  return useQuery({
    queryKey: ["funil-stats", clienteId],
    queryFn: async () => {
      let request = supabase.from("vw_funil_lead_cliente").select("*");
      if (clienteId) {
        request = request.eq("cliente_id", clienteId);
      }
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []) as Array<{
        cliente_id: string;
        status: PipelineStatus;
        total: number;
        horas_no_estagio: number | null;
      }>;
    },
  });
}

export async function moverLeadStatus(
  leadId: string,
  novo: PipelineStatus,
  motivo?: string | null,
) {
  const { error } = await supabase.rpc("mover_lead_status", {
    _lead_id: leadId,
    _novo: novo,
    _motivo: motivo ?? undefined,
  });
  if (error) throw error;
}

export async function converterLeadComTicket(leadId: string, ticket: number) {
  const { error } = await supabase.rpc("log_ticket_converted", {
    _lead_id: leadId,
    _ticket: ticket,
  });
  if (error) throw error;
}
