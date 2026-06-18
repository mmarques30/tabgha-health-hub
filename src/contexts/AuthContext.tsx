import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { hasPermission } from '@/lib/permissions'

// Local types until schema is applied and types regenerated
type Profile = {
  id: string
  nome: string | null
  email: string | null
  avatar_url: string | null
  cliente_id: string | null
}

type AuthContextType = {
  session: Session | null
  user: User | null
  profile: Profile | null
  role: 'admin' | 'cliente' | null
  permissoes: string[]
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  hasPermission: (path: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [role, setRole] = useState<'admin' | 'cliente' | null>(null)
  const [permissoes, setPermissoes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const loadUserData = async (userId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const [profileResult, roleResult] = await Promise.all([
      db.from('profiles').select('id, nome, email, avatar_url, cliente_id').eq('id', userId).single(),
      db.from('user_roles').select('role, cliente_id, permissoes').eq('user_id', userId).single(),
    ])
    if (profileResult.data) setProfile(profileResult.data)
    if (roleResult.data) {
      setRole(roleResult.data.role)
      setPermissoes(roleResult.data.permissoes ?? [])
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) await loadUserData(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        await loadUserData(session.user.id)
      } else {
        setProfile(null)
        setRole(null)
        setPermissoes([])
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error as Error | null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setRole(null)
    setPermissoes([])
  }

  const checkPermission = (path: string) => hasPermission(permissoes, path)

  return (
    <AuthContext.Provider value={{
      session, user, profile, role, permissoes, loading,
      signIn, signOut,
      hasPermission: checkPermission,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
