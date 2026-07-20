import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/meta-ads")({
  component: AdminMetaAdsRedirect,
  head: () => ({ meta: [{ title: "Marketing pago — Tabgha Admin" }] }),
});

function AdminMetaAdsRedirect() {
  return <Navigate to="/admin/roi" search={{ tab: "marketing" }} replace />;
}
