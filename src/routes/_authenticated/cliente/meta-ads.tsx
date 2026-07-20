import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/cliente/meta-ads")({
  component: ClienteMetaAdsRedirect,
  head: () => ({ meta: [{ title: "Marketing pago — Tabgha" }] }),
});

function ClienteMetaAdsRedirect() {
  return <Navigate to="/cliente/roi" search={{ tab: "marketing" }} replace />;
}
