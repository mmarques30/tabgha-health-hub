import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { MessageCircle, X, Send, Loader2, Bot } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { chatWithAI } from "@/server/ai/chat";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "assistant"; content: string };

export function AssistantBubble() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const { role, profile } = useAuth();

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: "assistant", content: role === "admin"
        ? "Olá! Sou seu copiloto Tabgha. Posso ajudar com dados de clientes, métricas e conteúdo. O que precisa?"
        : "Olá! Sou seu assistente. Posso ajudar com métricas, conteúdo e estratégia do consultório. Como posso ajudar?" }]);
    }
  }, [open]);

  // Reset ao trocar de usuário
  useEffect(() => { setMessages([]); }, [profile?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useMutation({
    mutationFn: async (text: string) => {
      const newMessages: Message[] = [...messages, { role: "user" as const, content: text }];
      setMessages(newMessages);
      const history = newMessages.slice(-10);
      return chatWithAI({ data: {
        messages: history,
        role: role ?? "admin",
        cliente_id: profile?.cliente_id ?? undefined,
      }});
    },
    onSuccess: (result) => {
      setMessages((prev) => [...prev, { role: "assistant", content: result.content }]);
    },
    onError: () => {
      setMessages((prev) => [...prev, { role: "assistant", content: "Desculpe, ocorreu um erro. Tente novamente." }]);
    },
  });

  const handleSend = () => {
    const text = input.trim();
    if (!text || send.isPending) return;
    setInput("");
    send.mutate(text);
  };

  return (
    <>
      {/* Bubble */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-transform hover:scale-105 focus:outline-none"
        aria-label="Assistente IA"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-5 z-50 flex h-[480px] w-[360px] flex-col rounded-2xl border border-border bg-background shadow-xl">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Bot className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">
              {role === "admin" ? "Copiloto Tabgha" : "Assistente"}
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-foreground text-background rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                )}>
                  {msg.content}
                </div>
              </div>
            ))}
            {send.isPending && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-muted px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-3 flex gap-2">
            <input
              className="flex-1 rounded-xl bg-muted px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-border"
              placeholder="Escreva uma mensagem…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || send.isPending}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background disabled:opacity-40 transition-opacity"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
