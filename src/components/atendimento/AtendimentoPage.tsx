import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useWhatsappConversations } from "@/hooks/useWhatsappConversations";
import { useWhatsappMessages } from "@/hooks/useWhatsappMessages";
import { useClientesOptions } from "@/hooks/useClientesOptions";
import { supabase } from "@/integrations/supabase/client";
import type {
  ConversationFilters,
  InboxTab,
  MobilePane,
  WhatsappConversation,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { sendWhatsappMessage } from "@/functions/whatsapp/send.functions";

const FILTER_KEYS = {
  origem: "atendimento.filterOrigem",
  lastMsg: "atendimento.filterLastMsg",
  noReplyHours: "atendimento.filterNoReplyHours",
  cliente: "atendimento.filterCliente",
} as const;

type AtendimentoPageProps = {
  isAdmin?: boolean;
};

function loadStoredFilter<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}

function ChatBubble({
  direction,
  senderType,
  body,
}: {
  direction: string;
  senderType: string;
  body: string;
}) {
  const outbound = direction === "outbound";

  return (
    <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
          outbound && senderType === "human" && "bg-emerald-600 text-white",
          outbound && senderType !== "human" && "bg-muted text-foreground",
          !outbound && "border border-border bg-card text-foreground",
        )}
      >
        {body}
      </div>
    </div>
  );
}

export function AtendimentoPage({ isAdmin = false }: AtendimentoPageProps) {
  const [tab, setTab] = useState<InboxTab>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<MobilePane>("list");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [clienteFilter, setClienteFilter] = useState<string | null>(() =>
    loadStoredFilter(FILTER_KEYS.cliente, null),
  );

  const filters: ConversationFilters = useMemo(
    () => ({
      tab,
      origem: loadStoredFilter(FILTER_KEYS.origem, null),
      lastMsgSender: loadStoredFilter(FILTER_KEYS.lastMsg, null),
      noReplyHours: loadStoredFilter(FILTER_KEYS.noReplyHours, null),
      clienteId: isAdmin ? clienteFilter : null,
      search,
    }),
    [tab, search, clienteFilter, isAdmin],
  );

  useEffect(() => {
    if (isAdmin) {
      localStorage.setItem(FILTER_KEYS.cliente, JSON.stringify(clienteFilter));
    }
  }, [clienteFilter, isAdmin]);

  const { data: clientesOptions = [] } = useClientesOptions();
  const { data: conversations = [], isLoading } = useWhatsappConversations(filters);
  const selected = conversations.find((item) => item.id === selectedId) ?? null;
  const { data: messages = [], isLoading: messagesLoading } = useWhatsappMessages(selectedId);

  async function handleSend() {
    if (!selectedId || !message.trim()) {
      return;
    }

    setSending(true);
    try {
      await sendWhatsappMessage({
        data: {
          conversation_id: selectedId,
          body: message.trim(),
          sender_type: "human",
        },
      });
      setMessage("");
    } finally {
      setSending(false);
    }
  }

  async function takeConversation(conversation: WhatsappConversation) {
    await supabase
      .from("whatsapp_conversations")
      .update({ owner_state: "human_active" })
      .eq("id", conversation.id);
  }

  async function closeConversation(conversation: WhatsappConversation) {
    await supabase
      .from("whatsapp_conversations")
      .update({
        state: "closed",
        owner_state: "closed",
        closed_at: new Date().toISOString(),
      })
      .eq("id", conversation.id);
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] overflow-hidden rounded-xl border border-border bg-card">
      <aside
        className={cn(
          "flex w-full flex-col border-r border-border md:w-80",
          mobilePane !== "list" && "hidden md:flex",
        )}
      >
        <div className="space-y-2 border-b border-border p-3">
          {isAdmin && (
            <select
              value={clienteFilter ?? ""}
              onChange={(e) => setClienteFilter(e.target.value || null)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todos os clientes</option>
              {clientesOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          )}
          <Tabs value={tab} onValueChange={(value) => setTab(value as InboxTab)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="awaiting_human" className="text-xs px-1">Aguardando</TabsTrigger>
              <TabsTrigger value="active" className="text-xs px-1">Ativas</TabsTrigger>
              <TabsTrigger value="closed" className="text-xs px-1">Fechadas</TabsTrigger>
              <TabsTrigger value="all" className="text-xs px-1">Todas</TabsTrigger>
            </TabsList>
          </Tabs>
          <Input
            placeholder="Buscar nome ou telefone"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhuma conversa encontrada.</p>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => {
                  setSelectedId(conversation.id);
                  setMobilePane("chat");
                }}
                className={cn(
                  "flex w-full flex-col gap-1 border-b border-border px-3 py-3 text-left hover:bg-muted/50",
                  selectedId === conversation.id && "bg-muted",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {conversation.contact_name ?? conversation.contact_phone}
                  </span>
                  <span className="text-xs text-muted-foreground">{conversation.owner_state}</span>
                </div>
                {isAdmin && conversation.clientes?.nome ? (
                  <span className="text-xs text-muted-foreground">{conversation.clientes.nome}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </aside>

      <section
        className={cn("flex min-w-0 flex-1 flex-col", mobilePane !== "chat" && "hidden md:flex")}
      >
        {!selected ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Selecione uma conversa
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="font-medium">{selected.contact_name ?? selected.contact_phone}</p>
                <p className="text-xs text-muted-foreground">{selected.state}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => void takeConversation(selected)}>
                  Tomar conversa
                </Button>
                <Button size="sm" variant="outline" onClick={() => void closeConversation(selected)}>
                  Encerrar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="md:hidden"
                  onClick={() => setMobilePane("info")}
                >
                  Info
                </Button>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messagesLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                messages.map((item) => (
                  <ChatBubble
                    key={item.id}
                    direction={item.direction}
                    senderType={item.sender_type}
                    body={item.body}
                  />
                ))
              )}
            </div>

            <div className="border-t border-border p-3">
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Escreva uma mensagem..."
                disabled={selected.state === "closed" || selected.state === "stalled"}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <div className="mt-2 flex justify-end">
                <Button onClick={() => void handleSend()} disabled={sending || !message.trim()}>
                  {sending ? "Enviando..." : "Enviar"}
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      <aside
        className={cn(
          "hidden w-72 border-l border-border p-4 md:block",
          mobilePane === "info" && "block md:block",
        )}
      >
        {selected ? (
          <div className="space-y-3 text-sm">
            <p className="font-medium">Lead</p>
            <p>{selected.leads?.nome ?? "Sem lead vinculado"}</p>
            <p className="text-muted-foreground">
              {selected.leads?.telefone ?? selected.contact_phone}
            </p>
            <p className="font-medium">Origem</p>
            <p>{selected.origem}</p>
            <p className="font-medium">Bot score</p>
            <p>{selected.bot_score ?? 0}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Informações do lead</p>
        )}
      </aside>
    </div>
  );
}
