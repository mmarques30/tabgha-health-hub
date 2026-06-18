import { createFileRoute } from "@tanstack/react-router";
import { MetaAdsPage } from "@/components/meta/MetaAdsPage";

export const Route = createFileRoute("/_authenticated/admin/meta-ads")({
  component: AdminMetaAds,
  head: () => ({ meta: [{ title: "Meta Ads — Tabgha Admin" }] }),
});

function AdminMetaAds() {
  return (
    <div className="px-8 py-8">
      <MetaAdsPage isAdmin />
    </div>
  );
}
