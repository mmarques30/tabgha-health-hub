import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ClienteOption = { id: string; nome: string; status: string };

export function useClientesOptions() {
  return useQuery<ClienteOption[]>({
    queryKey: ["clientes-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, status")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as ClienteOption[];
    },
    staleTime: 60_000,
  });
}
