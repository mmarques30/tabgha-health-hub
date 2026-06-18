import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Users, Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { EmptyState } from '@/components/EmptyState'
import { PermissionPicker } from '@/components/PermissionPicker'
import { createUserWithRole } from '@/server/usuarios/createUserWithRole'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export const Route = createFileRoute('/admin/usuarios')({
  component: UsuariosPage,
})

type TeamMember = {
  id: string
  nome: string | null
  email: string | null
  avatar_url: string | null
  role: 'admin' | 'cliente' | null
  permissoes: string[]
}

async function fetchTeam(): Promise<TeamMember[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data, error } = await db
    .from('profiles')
    .select('id, nome, email, avatar_url, user_roles(role, permissoes)')
    .order('nome')

  if (error) throw new Error(error.message)

  return (data ?? []).map((p: any) => ({
    id: p.id,
    nome: p.nome,
    email: p.email,
    avatar_url: p.avatar_url,
    role: p.user_roles?.[0]?.role ?? null,
    permissoes: p.user_roles?.[0]?.permissoes ?? [],
  }))
}

const addUserSchema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  email: z.string().email('Email inválido'),
  role: z.enum(['admin', 'cliente']),
  cliente_id: z.string().nullable().default(null),
})

type AddUserForm = z.infer<typeof addUserSchema>

function initials(nome: string | null): string {
  if (!nome) return '?'
  return nome
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

function AddUserDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [permissoes, setPermissoes] = useState<string[]>(['*'])
  const queryClient = useQueryClient()

  const form = useForm<AddUserForm>({
    resolver: zodResolver(addUserSchema),
    defaultValues: { nome: '', email: '', role: 'admin', cliente_id: null },
  })

  const mutation = useMutation({
    mutationFn: (data: AddUserForm) =>
      createUserWithRole({ data: { ...data, permissoes } }),
    onSuccess: () => {
      toast.success('Usuário criado. Um email de definição de senha foi enviado.')
      queryClient.invalidateQueries({ queryKey: ['admin', 'team'] })
      onClose()
      form.reset()
      setPermissoes(['*'])
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const onSubmit = (data: AddUserForm) => mutation.mutate(data)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar membro da equipe</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input placeholder="Nome completo" {...form.register('nome')} />
            {form.formState.errors.nome && (
              <p className="text-xs text-destructive">{form.formState.errors.nome.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" placeholder="email@exemplo.com" {...form.register('email')} />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Perfil</Label>
            <Select
              value={form.watch('role')}
              onValueChange={(v) => form.setValue('role', v as 'admin' | 'cliente')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin (equipe interna)</SelectItem>
                <SelectItem value="cliente">Cliente (médico)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.watch('role') === 'admin' && (
            <div className="space-y-2">
              <Label>Permissões</Label>
              <PermissionPicker value={permissoes} onChange={setPermissoes} />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar usuário
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function UsuariosPage() {
  const [showAdd, setShowAdd] = useState(false)

  const { data: team = [], isLoading } = useQuery({
    queryKey: ['admin', 'team'],
    queryFn: fetchTeam,
    staleTime: 60_000,
  })

  return (
    <ProtectedRoute role="admin" path="/admin/usuarios">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Equipe</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Gerencie os membros e suas permissões
            </p>
          </div>
          <Button onClick={() => setShowAdd(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Adicionar membro
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : team.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="Nenhum membro cadastrado"
            description="Adicione o primeiro membro da equipe."
            action={{ label: 'Adicionar membro', onClick: () => setShowAdd(true) }}
          />
        ) : (
          <div className="grid gap-3">
            {team.map((member) => (
              <Card key={member.id}>
                <CardContent className="flex items-center gap-4 py-4">
                  <Avatar>
                    <AvatarFallback>{initials(member.nome)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{member.nome ?? '—'}</p>
                    <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                      {member.role === 'admin' ? 'Admin' : 'Cliente'}
                    </Badge>
                    {member.permissoes.includes('*') && (
                      <Badge variant="outline" className="text-xs">
                        Acesso total
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <AddUserDialog open={showAdd} onClose={() => setShowAdd(false)} />
      </div>
    </ProtectedRoute>
  )
}
