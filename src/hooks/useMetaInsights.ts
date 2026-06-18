import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth";
import { getMetaInsights } from "@/functions/ads/meta-insights.functions";

type MetaInsightsInput = {
  cliente_id: string;
  action:
    | "overview"
    | "campaigns"
    | "account_insights"
    | "campaign_insights"
    | "daily_insights"
    | "ad_insights";
  since?: string;
  until?: string;
  campaign_id?: string;
};

export function useMetaInsights(input: MetaInsightsInput | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["meta-insights", input],
    enabled: Boolean(input?.cliente_id && user),
    staleTime: 60_000,
    queryFn: async () => {
      return getMetaInsights({ data: input! });
    },
  });
}
