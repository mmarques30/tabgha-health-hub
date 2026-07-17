import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Link2Off, Loader2, Save, Unplug } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClientesOptions } from "@/hooks/useClientesOptions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { Json } from "@/integrations/supabase/types";

type ClienteMetaRow = {
  id: string;
  nome: string;
  page_id: string | null;
  page_name: string | null;
  ad_account_id: string | null;
  connected_at: string | null;
  expires_at: string | null;
  connected: boolean;
};

export const Route = createFileRoute("/_authenticated/admin/config-meta")({
  component: ConfigMetaPage,
  head: () => ({ meta: [{ title: "Conectar Meta BM — Admin" }] }),
});

type MetaExtras = {
  access_token?: string;
  page_id?: string;
  page_name?: string;
  ad_account_id?: string;
  expires_at?: string;
  connected_at?: string;
};

const META_APP_ID = import.meta.env.VITE_META_APP_ID as string | undefined;
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL) as
  | string
  | undefined;

function buildOAuthUrl(clienteId: string) {
  if (!META_APP_ID || !SUPABASE_URL) return null;
  const redirectUri = `${SUPABASE_URL}/functions/v1/meta-oauth-callback`;
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: redirectUri,
    // pages_manage_metadata removed: Meta rejects it as Invalid Scope until the
    // app use-case explicitly enables it. Connection works without it (page list
    // + leads + ads). Page webhook subscription can be done in Meta UI.
    scope: "leads_retrieval,ads_read,pages_show_list,business_management",
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
  const [savingAccount, setSavingAccount] = useState(false);
  const [adAccountId, setAdAccountId] = useState("");

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
      void queryClient.invalidateQueries({ queryKey: ["admin", "meta-conexoes"] });
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

  const { data: conexoes = [], isLoading: loadingConexoes } = useQuery({
    queryKey: ["admin", "meta-conexoes"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, dados_extras")
        .order("nome");
      if (error) throw error;

      return (data ?? []).map((row) => {
        const extras = (row.dados_extras ?? {}) as { meta?: MetaExtras };
        const m = extras.meta;
        const connected = Boolean(m?.access_token && m?.page_id);
        return {
          id: row.id,
          nome: row.nome,
          page_id: m?.page_id ?? null,
          page_name: m?.page_name ?? null,
          ad_account_id: m?.ad_account_id ?? null,
          connected_at: m?.connected_at ?? null,
          expires_at: m?.expires_at ?? null,
          connected,
        } satisfies ClienteMetaRow;
      });
    },
  });

  const conectados = useMemo(() => conexoes.filter((c) => c.connected), [conexoes]);
  const pendentes = useMemo(() => conexoes.filter((c) => !c.connected), [conexoes]);

  const meta = useMemo(() => {
    const extras = (cliente?.dados_extras ?? {}) as { meta?: MetaExtras };
    return extras.meta ?? null;
  }, [cliente]);

  useEffect(() => {
    setAdAccountId(meta?.ad_account_id ?? "");
  }, [meta?.ad_account_id]);

  const oauthUrl = clienteId ? buildOAuthUrl(clienteId) : null;
  const connected = Boolean(meta?.access_token && meta?.page_id);

  async function saveAdAccount() {
    if (!clienteId || !cliente) return;
    setSavingAccount(true);
    try {
      const extras = ((cliente.dados_extras as Record<string, unknown> | null) ?? {}) as Record<
        string,
        unknown
      >;
      const nextMeta = {
        ...((extras.meta as Record<string, unknown> | undefined) ?? {}),
        ad_account_id: adAccountId.trim() || null,
      };
      const { error } = await supabase
        .from("clientes")
        .update({ dados_extras: { ...extras, meta: nextMeta } as Json })
        .eq("id", clienteId);
      if (error) throw error;
      toast.success("Ad Account ID salvo.");
      void queryClient.invalidateQueries({ queryKey: ["cliente-meta", clienteId] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "meta-conexoes"] });
    } catch {
      toast.error("Não foi possível salvar o Ad Account ID.");
    } finally {
      setSavingAccount(false);
    }
  }

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
      void queryClient.invalidateQueries({ queryKey: ["admin", "meta-conexoes"] });
    } catch {
      toast.error("Não foi possível desconectar.");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="w-full min-h-full px-6 py-6 lg:px-8">
      <header className="mb-8 w-full animate-fade-up">
        <span className="eyebrow-pill">Aquisição</span>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          Conectar Meta Business
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Autorize o app da IAplicada e informe o <strong>Ad Account ID</strong> para habilitar o
          sync diário de métricas.
        </p>
      </header>

      <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)] lg:items-start">
        <section className="w-full space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="space-y-2">
            <Label htmlFor="cliente">Cliente</Label>
            {loadingClientes ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <select
                id="cliente"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
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
            <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-5">
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

              <div className="space-y-2">
                <Label htmlFor="adAccount">Ad Account ID (sem act_)</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="adAccount"
                    value={adAccountId}
                    onChange={(e) => setAdAccountId(e.target.value)}
                    placeholder="123456789012345"
                    className="w-full"
                  />
                  <Button
                    variant="outline"
                    onClick={() => void saveAdAccount()}
                    disabled={savingAccount}
                    className="shrink-0"
                  >
                    {savingAccount ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                </div>
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
              <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-5 text-sm text-muted-foreground">
                <Link2Off className="mb-2 h-5 w-5" />
                Nenhuma conexão Meta para este cliente. Clique em conectar e autorize a BM da
                clínica.
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
        </section>

        <aside className="w-full rounded-2xl border border-border bg-card p-6 text-sm leading-relaxed text-muted-foreground shadow-sm sm:p-8">
          <p className="text-sm font-semibold text-foreground">Setup Meta</p>
          <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm">
            <li>App em developers.facebook.com (conta IAplicada)</li>
            <li>
              Casos de uso: permissões <code>leads_retrieval</code>, <code>ads_read</code>,{" "}
              <code>pages_show_list</code>, <code>business_management</code> em “Pronto para
              teste”
            </li>
            <li>
              Webhooks · Page · subscribe <code>leadgen</code>
            </li>
            <li className="break-all">
              Callback: <code>{SUPABASE_URL}/functions/v1/webhook_meta_lead</code>
            </li>
            <li>
              Verify token = secret <code>META_WEBHOOK_VERIFY_TOKEN</code>
            </li>
            <li>
              Sync diário: edge <code>sync_ads_metrics</code>
            </li>
          </ol>
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
            Se aparecer <strong>Invalid Scopes</strong>, ative a permissão citada no caso de uso
            do app Meta — ou atualize o Tabgha (não pedimos mais{" "}
            <code>pages_manage_metadata</code> no OAuth).
          </p>
        </aside>
      </div>

      <section className="mt-8 w-full rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Carteira
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">Clientes e Meta</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Visão de todas as conexões. Clique em um cliente para gerenciar acima.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-emerald-700">{conectados.length}</span> conectados
            {" · "}
            <span className="font-semibold text-slate-700">{pendentes.length}</span> pendentes
          </p>
        </div>

        {loadingConexoes ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando conexões…
          </div>
        ) : conexoes.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">Nenhum cliente cadastrado.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_auto] gap-3 border-b border-border bg-secondary/40 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground sm:grid">
              <span>Cliente</span>
              <span>Página Meta</span>
              <span>Ad Account</span>
              <span className="text-right">Status</span>
            </div>
            <ul className="divide-y divide-border">
              {conexoes.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setClienteId(row.id)}
                    className={cn(
                      "grid w-full grid-cols-1 gap-1 px-4 py-3 text-left transition-colors hover:bg-secondary/40 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_auto] sm:items-center sm:gap-3",
                      row.id === clienteId && "bg-sky-50/80 hover:bg-sky-50",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{row.nome}</p>
                      {row.connected_at ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Conectado em {new Date(row.connected_at).toLocaleDateString("pt-BR")}
                        </p>
                      ) : null}
                    </div>
                    <div className="min-w-0 text-sm text-muted-foreground">
                      {row.connected ? (
                        <>
                          <p className="truncate font-medium text-slate-800">
                            {row.page_name ?? "Página Meta"}
                          </p>
                          <p className="truncate font-mono text-[11px]">page_id {row.page_id}</p>
                        </>
                      ) : (
                        <span className="text-xs">—</span>
                      )}
                    </div>
                    <div className="min-w-0 text-sm text-muted-foreground">
                      {row.ad_account_id ? (
                        <span className="font-mono text-xs">{row.ad_account_id}</span>
                      ) : (
                        <span className="text-xs">{row.connected ? "não informado" : "—"}</span>
                      )}
                    </div>
                    <div className="sm:justify-self-end">
                      {row.connected ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Conectado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                          <Link2Off className="h-3.5 w-3.5" />
                          Pendente
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
