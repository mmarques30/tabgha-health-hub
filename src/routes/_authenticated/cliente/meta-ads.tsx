import { createFileRoute } from "@tanstack/react-router";
import { MetaAdsPage } from "@/components/meta/MetaAdsPage";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/cliente/meta-ads")({
  component: ClienteMetaAds,
  head: () => ({ meta: [{ title: "Marketing Pago — Tabgha" }] }),
});

function ClienteMetaAds() {
  const { profile } = useAuth();

  return (
    <div className="space-y-4 px-6 py-6">
      <MetaAdsPage fixedClienteId={profile?.cliente_id ?? null} />
    </div>
  );
}
