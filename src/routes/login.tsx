import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      const isAdmin = roles?.some((r) => r.role === "admin");
      throw redirect({ to: isAdmin ? "/admin/dashboard" : "/cliente/dashboard" });
    }
  },
  component: LoginPage,
  head: () => ({ meta: [{ title: "Login — Tabgha" }] }),
});

type AccessType = "equipe" | "cliente";

function LoginPage() {
  const navigate = useNavigate();
  const [access, setAccess] = useState<AccessType>("cliente");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("Email ou senha incorretos.");
      return;
    }
    const userId = data.user?.id;
    if (!userId) {
      setError("Sessão não criada.");
      return;
    }
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (rolesError) {
      setError("Login realizado, mas não foi possível carregar seu perfil.");
      return;
    }

    const isAdmin = roles?.some((r) => r.role === "admin");
    navigate({ to: isAdmin ? "/admin/dashboard" : "/cliente/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <Link to="/" className="mb-8 flex items-center gap-2.5">
          <img
            src="https://tabghamkt.com.br/wp-content/uploads/2025/05/logo_tabgha_health_mkt_caixa_alta-04-scaled-e1747895382243.png"
            alt="Tabgha Health Marketing"
            className="h-7 w-auto brightness-0"
          />
        </Link>

        {/* Access type tabs */}
        <div className="mb-4 grid grid-cols-2 rounded-xl border border-border bg-card p-1">
          {(["equipe", "cliente"] as AccessType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setAccess(t)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                access === t
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "equipe" ? "Equipe Tabgha" : "Portal do Cliente"}
            </button>
          ))}
        </div>

        {/* Login card */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h1 className="text-lg font-semibold tracking-tight">
            {access === "equipe" ? "Acesso da equipe" : "Acesso do cliente"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {access === "equipe"
              ? "Entre com suas credenciais da equipe Tabgha."
              : "Entre com o email e senha cadastrados pela Tabgha."}
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Problemas com o acesso?{" "}
          <a href="mailto:contato@tabghamkt.com.br" className="underline underline-offset-2">
            Fale com a equipe
          </a>
        </p>
      </div>
    </div>
  );
}
