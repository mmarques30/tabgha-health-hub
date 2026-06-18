import { type ReactNode, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

type Props = {
  children: ReactNode
  role?: 'admin' | 'cliente'
  path?: string
}

export function ProtectedRoute({ children, role, path }: Props) {
  const { session, role: userRole, loading, hasPermission } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    if (!session) {
      navigate({ to: '/login' })
      return
    }
    if (role && userRole !== role) {
      navigate({ to: userRole === 'admin' ? '/admin/dashboard' : '/cliente/dashboard' })
      return
    }
    if (path && !hasPermission(path)) {
      navigate({ to: userRole === 'admin' ? '/admin/dashboard' : '/cliente/dashboard' })
    }
  }, [loading, session, userRole, role, path, hasPermission, navigate])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!session) return null
  if (role && userRole !== role) return null

  return <>{children}</>
}
