import { createFileRoute } from "@tanstack/react-router";
import { MetaAdsPage } from "@/components/meta/MetaAdsPage";

export const Route = createFileRoute("/_authenticated/admin/meta-ads")({
  component: AdminMetaAds,
  head: () => ({ meta: [{ title: "Marketing Pago — Tabgha Admin" }] }),
});

function AdminMetaAds() {
  return (
    <div className="space-y-4 px-6 py-6">
      <MetaAdsPage isAdmin />
    </div>
  );
}
