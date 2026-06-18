import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const schema = z.object({
  messages: z.array(messageSchema).max(10),
  role: z.enum(["admin", "cliente"]).default("admin"),
  cliente_id: z.string().uuid().optional(),
});

type Input = z.infer<typeof schema>;
type Output = { content: string; usage: { input_tokens: number; output_tokens: number } };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const chatWithAI = (createServerFn() as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .handler(async (ctx: any) => {
    const data = schema.parse(ctx.data);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let clienteContext: { especialidade?: string | null; nome?: string | null } = {};
    if (data.cliente_id) {
      const { data: cliente } = await supabaseAdmin
        .from("clientes")
        .select("nome, especialidade")
        .eq("id", data.cliente_id)
        .single();
      clienteContext = { especialidade: cliente?.especialidade, nome: cliente?.nome };
    }

    const systemPrompt = buildSystemPrompt(data.role, clienteContext);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages: data.messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error: ${err}`);
    }

    const result = (await response.json()) as {
      content: { type: string; text: string }[];
      usage: { input_tokens: number; output_tokens: number };
    };

    const text = result.content.find((b) => b.type === "text")?.text ?? "";
    return { content: text, usage: result.usage };
  }) as (input: { data: Input }) => Promise<Output>;
