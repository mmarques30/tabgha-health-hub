import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  nome: z.string().min(2),
  role: z.enum(['admin', 'cliente']),
  cliente_id: z.string().uuid().nullable(),
  permissoes: z.array(z.string()),
})

export const createUserWithRole = createServerFn()
  .validator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      email_confirm: true,
      // Temporary random password — admin should send password reset email
      password: `${crypto.randomUUID()}-Tmp1!`,
    })
    if (authError) throw new Error(authError.message)

    const userId = authData.user.id

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabaseAdmin as any).rpc('admin_upsert_profile_role', {
      p_user_id: userId,
      p_nome: data.nome,
      p_role: data.role,
      p_cliente_id: data.cliente_id,
      p_permissoes: data.permissoes,
    })
    if (rpcError) throw new Error(rpcError.message)

    return { user_id: userId }
  })
