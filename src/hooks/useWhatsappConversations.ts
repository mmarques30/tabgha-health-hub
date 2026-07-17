import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { ConversationFilters, WhatsappConversation } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyTabFilter(query: any, tab: ConversationFilters["tab"]): any {
  switch (tab) {
    case "awaiting_human":
      return query.eq("owner_state", "human_alert");
    case "active":
      return query.eq("owner_state", "human_active");
    case "closed":
      return query.eq("state", "closed");
    default:
      return query;
  }
}

export function useWhatsappConversations(filters: ConversationFilters) {
  const queryClient = useQueryClient();
  const { role } = useAuth();

  const query = useQuery({
    queryKey: ["wpp-conversations", filters, role],
    queryFn: async () => {
      let request = supabase
        .from("whatsapp_conversations")
        .select("*, clientes(id, nome), leads(id, nome, telefone, status)")
        .order("last_inbound_at", { ascending: false, nullsFirst: false });

      request = applyTabFilter(request, filters.tab);

      if (filters.clienteId) {
        request = request.eq("cliente_id", filters.clienteId);
      }

      if (filters.origem) {
        request = request.eq("origem", filters.origem);
      }

      if (filters.search.trim()) {
        const term = filters.search.trim();
        request = request.or(`contact_name.ilike.%${term}%,contact_phone.ilike.%${term}%`);
      }

      const { data, error } = await request;
      if (error) {
        throw error;
      }

      return (data ?? []) as unknown as WhatsappConversation[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("wpp-conv")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversations" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["wpp-conversations"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}
