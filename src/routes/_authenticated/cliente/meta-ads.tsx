import { createFileRoute } from "@tanstack/react-router";
import { MetaAdsPage } from "@/components/meta/MetaAdsPage";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/cliente/meta-ads")({
  component: ClienteMetaAds,
  head: () => ({ meta: [{ title: "Meta Ads — Tabgha" }] }),
});

function ClienteMetaAds() {
  const { profile } = useAuth();

  return (
    <div className="px-8 py-8">
      <MetaAdsPage fixedClienteId={profile?.cliente_id ?? null} />
    </div>
  );
}
