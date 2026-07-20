import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "cliente";

const ACTIVE_ROLE_KEY = "tabgha_active_role";

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
  /** Papel ativo na UI (admin ou portal). */
  role: AppRole | null;
  /** Papel “principal” (admin se tiver; senão cliente). */
  realRole: AppRole | null;
  /** Todos os papéis do usuário (admin e/ou cliente). */
  roles: AppRole[];
  setActiveRole: (role: AppRole) => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  isSimulating: boolean;
  simulatedClientId: string | null;
  simulatedClientNome: string | null;
  startSimulation: (id: string, nome: string) => void;
  stopSimulation: () => void;
}

const AuthCtx = createContext<AuthState | undefined>(undefined);

function readStoredActiveRole(): AppRole | null {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(ACTIVE_ROLE_KEY);
    if (v === "admin" || v === "cliente") return v;
  } catch {
    /* ignore */
  }
  return null;
}

function storeActiveRole(role: AppRole | null) {
  if (typeof window === "undefined") return;
  try {
    if (role) sessionStorage.setItem(ACTIVE_ROLE_KEY, role);
    else sessionStorage.removeItem(ACTIVE_ROLE_KEY);
  } catch {
    /* ignore */
  }
}

async function loadProfileAndRoles(
  userId: string,
): Promise<{ profile: Profile | null; roles: AppRole[] }> {
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, cliente_id, nome, email, permissoes")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);

  const roles = (roleRows ?? [])
    .map((r) => r.role as AppRole)
    .filter((r): r is AppRole => r === "admin" || r === "cliente");

  // Ordem estável: admin primeiro
  roles.sort((a, b) => (a === b ? 0 : a === "admin" ? -1 : 1));

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
    roles,
  };
}

function pickActiveRole(roles: AppRole[], preferred: AppRole | null): AppRole | null {
  if (preferred && roles.includes(preferred)) return preferred;
  if (roles.includes("admin")) return "admin";
  return roles[0] ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [activeRole, setActiveRoleState] = useState<AppRole | null>(null);
  const [simulatedClientId, setSimulatedClientId] = useState<string | null>(null);
  const [simulatedClientNome, setSimulatedClientNome] = useState<string | null>(null);

  const hydrate = async (u: User | null) => {
    setUser(u);
    if (!u) {
      setProfile(null);
      setRoles([]);
      setActiveRoleState(null);
      setLoading(false);
      return;
    }
    const { profile: p, roles: nextRoles } = await loadProfileAndRoles(u.id);
    setProfile(p);
    setRoles(nextRoles);
    setActiveRoleState((prev) => pickActiveRole(nextRoles, prev ?? readStoredActiveRole()));
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

    const onFocus = () => {
      void supabase.auth.getUser().then(({ data }) => {
        if (mounted && data.user) void hydrate(data.user);
      });
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onFocus();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const realRole: AppRole | null = roles.includes("admin")
    ? "admin"
    : (roles[0] ?? null);

  const viewRole = pickActiveRole(roles, activeRole);
  const isSimulating = !!simulatedClientId && roles.includes("admin");

  const value: AuthState = {
    loading,
    user,
    profile: isSimulating && profile ? { ...profile, cliente_id: simulatedClientId } : profile,
    role: isSimulating ? "cliente" : viewRole,
    realRole,
    roles,
    setActiveRole: (role) => {
      if (!roles.includes(role)) return;
      storeActiveRole(role);
      setActiveRoleState(role);
      // Sair da simulação ao mudar de área
      setSimulatedClientId(null);
      setSimulatedClientNome(null);
    },
    signOut: async () => {
      storeActiveRole(null);
      await supabase.auth.signOut();
    },
    refresh: async () => {
      const { data } = await supabase.auth.getUser();
      await hydrate(data.user);
    },
    isSimulating,
    simulatedClientId,
    simulatedClientNome,
    startSimulation: (id, nome) => {
      setSimulatedClientId(id);
      setSimulatedClientNome(nome);
      storeActiveRole("cliente");
      setActiveRoleState("cliente");
    },
    stopSimulation: () => {
      setSimulatedClientId(null);
      setSimulatedClientNome(null);
      storeActiveRole("admin");
      setActiveRoleState("admin");
    },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth fora do AuthProvider");
  return ctx;
}
