import { createFileRoute } from "@tanstack/react-router";
import { MetaAdsPage } from "@/components/meta/MetaAdsPage";

export const Route = createFileRoute("/_authenticated/admin/meta-ads")({
  component: AdminMetaAds,
  head: () => ({ meta: [{ title: "Meta Ads — Tabgha Admin" }] }),
});

function AdminMetaAds() {
  return (
    <div className="px-6 py-6 space-y-6">
      <div>
        <span className="eyebrow-pill">Aquisição</span>
        <h1 className="mt-2 text-xl font-bold tracking-tight">Meta Ads</h1>
      </div>
      <MetaAdsPage isAdmin />
    </div>
  );
}
