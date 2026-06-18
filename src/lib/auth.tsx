import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "cliente";

export interface Profile {
  id: string;
  cliente_id: string | null;
  nome: string | null;
  email: string | null;
  permissoes: string[];
}

interface AuthState {
  loading: boolean;
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | undefined>(undefined);

async function loadProfileAndRole(userId: string): Promise<{ profile: Profile | null; role: AppRole | null }> {
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("id, cliente_id, nome, email, permissoes").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  const role =
    (roles?.find((r) => r.role === "admin")?.role as AppRole | undefined) ??
    (roles?.[0]?.role as AppRole | undefined) ??
    null;
  return {
    profile: profile
      ? {
          id: profile.id,
          cliente_id: profile.cliente_id,
          nome: profile.nome,
          email: profile.email,
          permissoes: profile.permissoes ?? [],
        }
      : null,
    role,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);

  const hydrate = async (u: User | null) => {
    setUser(u);
    if (!u) {
      setProfile(null);
      setRole(null);
      setLoading(false);
      return;
    }
    const { profile: p, role: r } = await loadProfileAndRole(u.id);
    setProfile(p);
    setRole(r);
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) hydrate(data.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      hydrate(session?.user ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthState = {
    loading,
    user,
    profile,
    role,
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refresh: async () => {
      const { data } = await supabase.auth.getUser();
      await hydrate(data.user);
    },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth fora do AuthProvider");
  return ctx;
}
