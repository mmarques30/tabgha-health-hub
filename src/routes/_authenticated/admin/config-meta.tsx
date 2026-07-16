import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Link2Off, Loader2, Unplug } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useClientesOptions } from "@/hooks/useClientesOptions";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/config-meta")({
  component: ConfigMetaPage,
  head: () => ({ meta: [{ title: "Conectar Meta BM — Admin" }] }),
});

type MetaExtras = {
  access_token?: string;
  page_id?: string;
  page_name?: string;
  expires_at?: string;
  connected_at?: string;
};

const META_APP_ID = import.meta.env.VITE_META_APP_ID as string | undefined;
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL) as
  string | undefined;

function buildOAuthUrl(clienteId: string) {
  if (!META_APP_ID || !SUPABASE_URL) return null;
  const redirectUri = `${SUPABASE_URL}/functions/v1/meta-oauth-callback`;
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: redirectUri,
    scope: "leads_retrieval,ads_read,pages_manage_metadata,pages_show_list,business_management",
    response_type: "code",
    state: clienteId,
  });
  return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
}

function ConfigMetaPage() {
  const queryClient = useQueryClient();
  const { data: clientes = [], isLoading: loadingClientes } = useClientesOptions();
  const [clienteId, setClienteId] = useState<string>("");
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    if (!clienteId && clientes[0]?.id) {
      setClienteId(clientes[0].id);
    }
  }, [clientes, clienteId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const meta = params.get("meta");
    if (meta === "connected") {
      toast.success("Meta Business conectado.");
      const fromUrl = params.get("cliente_id");
      if (fromUrl) setClienteId(fromUrl);
      void queryClient.invalidateQueries({ queryKey: ["cliente-meta"] });
    } else if (meta === "error") {
      toast.error(`Falha ao conectar Meta (${params.get("reason") ?? "erro"}).`);
    }
  }, [queryClient]);

  const { data: cliente, isLoading } = useQuery({
    queryKey: ["cliente-meta", clienteId],
    enabled: Boolean(clienteId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, dados_extras")
        .eq("id", clienteId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const meta = useMemo(() => {
    const extras = (cliente?.dados_extras ?? {}) as { meta?: MetaExtras };
    return extras.meta ?? null;
  }, [cliente]);

  const oauthUrl = clienteId ? buildOAuthUrl(clienteId) : null;
  const connected = Boolean(meta?.access_token && meta?.page_id);

  async function disconnect() {
    if (!clienteId || !cliente) return;
    setDisconnecting(true);
    try {
      const extras = { ...((cliente.dados_extras as object) ?? {}) } as Record<string, Json>;
      delete extras.meta;
      const { error } = await supabase
        .from("clientes")
        .update({ dados_extras: extras as Json })
        .eq("id", clienteId);
      if (error) throw error;
      toast.success("Meta desconectado.");
      void queryClient.invalidateQueries({ queryKey: ["cliente-meta", clienteId] });
    } catch {
      toast.error("Não foi possível desconectar.");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="px-6 py-6">
      <header className="mb-8 animate-fade-up">
        <span className="eyebrow-pill">Aquisição</span>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Conectar Meta Business</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Autorize o app da IAplicada com scopes de leads e ads. O token fica só no backend — nunca
          no frontend.
        </p>
      </header>

      <div className="max-w-xl space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <Label htmlFor="cliente">Cliente</Label>
          {loadingClientes ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <select
              id="cliente"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            >
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando…
          </div>
        ) : connected ? (
          <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Conectado
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {meta?.page_name ?? "Página Meta"} · page_id {meta?.page_id}
              </p>
              {meta?.expires_at ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Expira em {new Date(meta.expires_at).toLocaleString("pt-BR")}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {oauthUrl ? (
                <Button asChild variant="outline" className="rounded-xl">
                  <a href={oauthUrl}>
                    Reconectar
                    <ExternalLink className="ml-2 h-3.5 w-3.5" />
                  </a>
                </Button>
              ) : null}
              <Button
                variant="outline"
                className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50"
                disabled={disconnecting}
                onClick={() => void disconnect()}
              >
                {disconnecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Unplug className="mr-2 h-4 w-4" />
                )}
                Desconectar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
              <Link2Off className="mb-2 h-5 w-5" />
              Nenhuma conexão Meta para este cliente. Clique em conectar e autorize a BM da clínica.
            </div>
            {oauthUrl ? (
              <Button asChild className="rounded-xl bg-sky-600 hover:bg-sky-700">
                <a href={oauthUrl}>
                  Conectar Meta Business
                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </a>
              </Button>
            ) : (
              <p className="text-sm text-amber-700">
                Configure <code>VITE_META_APP_ID</code> e os secrets <code>META_APP_ID</code> /{" "}
                <code>META_APP_SECRET</code> no Supabase para habilitar o OAuth.
              </p>
            )}
          </div>
        )}

        <div className="rounded-xl border border-border bg-secondary/20 p-4 text-xs leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">Setup Meta (Mariana)</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>App em developers.facebook.com (conta IAplicada)</li>
            <li>
              Produto Webhooks · subscribe <code>leadgen</code>
            </li>
            <li>
              Callback: <code>{SUPABASE_URL}/functions/v1/webhook_meta_lead</code>
            </li>
            <li>
              Verify token = secret <code>META_WEBHOOK_VERIFY_TOKEN</code>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
