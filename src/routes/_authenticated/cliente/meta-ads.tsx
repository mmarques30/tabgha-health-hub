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
    <div className="px-6 py-6 space-y-6">
      <div>
        <span className="eyebrow-pill">Aquisição</span>
        <h1 className="mt-2 text-xl font-bold tracking-tight">Meta Ads</h1>
      </div>
      <MetaAdsPage fixedClienteId={profile?.cliente_id ?? null} />
    </div>
  );
}
