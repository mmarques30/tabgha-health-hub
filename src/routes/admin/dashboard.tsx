import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Users, UserCheck, FileCheck, Loader2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { EmptyState } from '@/components/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/admin/dashboard')({
  component: AdminDashboard,
})

type Counts = {
  clientes: number
  leads: number
  entregas_pendentes: number
}

async function fetchCounts(): Promise<Counts> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [clientesRes, leadsRes, entregasRes] = await Promise.all([
    db.from('clientes').select('id', { count: 'exact', head: true }).eq('status', 'ativo'),
    db.from('leads').select('id', { count: 'exact', head: true }),
    db.from('entregas').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
  ])

  return {
    clientes: clientesRes.count ?? 0,
    leads: leadsRes.count ?? 0,
    entregas_pendentes: entregasRes.count ?? 0,
  }
}

function StatCard({
  title,
  value,
  icon,
  loading,
}: {
  title: string
  value: number
  icon: React.ReactNode
  loading: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <div className="text-3xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  )
}

function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'dashboard', 'counts'],
    queryFn: fetchCounts,
    staleTime: 60_000,
  })

  return (
    <ProtectedRoute role="admin" path="/admin/dashboard">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral da operação</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            title="Clientes ativos"
            value={data?.clientes ?? 0}
            icon={<UserCheck className="h-4 w-4" />}
            loading={isLoading}
          />
          <StatCard
            title="Total de leads"
            value={data?.leads ?? 0}
            icon={<Users className="h-4 w-4" />}
            loading={isLoading}
          />
          <StatCard
            title="Entregas pendentes"
            value={data?.entregas_pendentes ?? 0}
            icon={<FileCheck className="h-4 w-4" />}
            loading={isLoading}
          />
        </div>

        {!isLoading && data?.clientes === 0 && (
          <EmptyState
            icon={<UserCheck className="h-6 w-6" />}
            title="Nenhum cliente cadastrado ainda"
            description="Adicione o primeiro cliente para começar a ver métricas aqui."
          />
        )}
      </div>
    </ProtectedRoute>
  )
}
