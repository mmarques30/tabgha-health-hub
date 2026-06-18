import { type ReactNode, Suspense, lazy, useState } from "react";
const AssistantBubble = lazy(() => import("./AssistantBubble").then((m) => ({ default: m.AssistantBubble })));
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Calendar,
  Zap,
  TrendingUp,
  UserCog,
  Stethoscope,
  FileText,
  UserCheck,
  Link2,
  LogOut,
  MessageSquare,
  Megaphone,
  Menu,
} from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  perm: string;
};

const ADMIN_NAV: NavItem[] = [
  { to: "/admin/dashboard",        label: "Dashboard",         icon: LayoutDashboard, perm: "admin.dashboard" },
  { to: "/admin/clientes",         label: "Clientes",          icon: Users,           perm: "admin.clientes" },
  { to: "/admin/estrategia",       label: "Estratégia",        icon: BarChart3,       perm: "admin.estrategia" },
  { to: "/admin/calendario",       label: "Calendário",        icon: Calendar,        perm: "admin.operacao" },
  { to: "/admin/automacoes-leads", label: "Automações Leads",  icon: Zap,             perm: "admin.operacao" },
  { to: "/admin/atendimento",      label: "Atendimento",       icon: MessageSquare,   perm: "admin.atendimento" },
  { to: "/admin/meta-ads",         label: "Meta Ads",          icon: Megaphone,       perm: "admin.meta_ads" },
  { to: "/admin/roi",              label: "ROI",               icon: TrendingUp,      perm: "admin.roi" },
  { to: "/admin/usuarios",         label: "Usuários",          icon: UserCog,         perm: "admin.usuarios" },
  { to: "/admin/diagnosticos",     label: "Diagnósticos",      icon: Stethoscope,     perm: "admin.diagnosticos" },
];

const CLIENTE_NAV: NavItem[] = [
  { to: "/cliente/dashboard",  label: "Dashboard",   icon: LayoutDashboard, perm: "cliente.dashboard" },
  { to: "/cliente/atendimento",label: "Atendimento", icon: MessageSquare,   perm: "cliente.atendimento" },
  { to: "/cliente/meta-ads",   label: "Meta Ads",    icon: Megaphone,       perm: "cliente.meta_ads" },
  { to: "/cliente/leads",      label: "Leads",       icon: Users,           perm: "cliente.leads" },
  { to: "/cliente/clientes",   label: "Clientes",    icon: UserCheck,       perm: "cliente.clientes" },
  { to: "/cliente/roi",        label: "ROI",         icon: TrendingUp,      perm: "cliente.roi" },
  { to: "/cliente/conteudo",   label: "Conteúdo",    icon: FileText,        perm: "cliente.conteudo" },
  { to: "/cliente/diagnostico",label: "Diagnóstico", icon: Stethoscope,     perm: "cliente.diagnostico" },
  { to: "/cliente/conexoes",   label: "Conexões",    icon: Link2,           perm: "cliente.conexoes" },
  { to: "/cliente/calendario", label: "Calendário",  icon: Calendar,        perm: "cliente.calendario" },
];

function SidebarNav({
  allowed,
  pathname,
  profile,
  user,
  role,
  onNavigate,
  signOut,
  navigate,
}: {
  allowed: NavItem[];
  pathname: string;
  profile: ReturnType<typeof useAuth>["profile"];
  user: ReturnType<typeof useAuth>["user"];
  role: ReturnType<typeof useAuth>["role"];
  onNavigate?: () => void;
  signOut: ReturnType<typeof useAuth>["signOut"];
  navigate: ReturnType<typeof useNavigate>;
}) {
  return (
    <>
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-sidebar-border px-4 shrink-0">
        <img
          src="https://tabghamkt.com.br/wp-content/uploads/2025/05/logo_tabgha_health_mkt_caixa_alta-04-scaled-e1747895382243.png"
          alt="Tabgha Health Marketing"
          className="h-7 w-auto brightness-0"
        />
      </div>

      {/* Role label */}
      <div className="px-4 pt-4 pb-1 shrink-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          {role === "admin" ? "Admin" : "Portal do Cliente"}
        </p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-1">
        {allowed.map((it) => {
          const active = pathname === it.to || pathname.startsWith(it.to + "/");
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              to={it.to as any}
              onClick={onNavigate}
              className={cn(
                "mx-2 mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active ? "opacity-100" : "opacity-60")} />
              {it.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3 shrink-0">
        <div className="mb-2 truncate text-xs font-medium text-sidebar-foreground/80">
          {profile?.nome ?? user?.email}
        </div>
        <button
          onClick={async () => {
            await signOut();
            navigate({ to: "/login", replace: true });
          }}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" /> Sair
        </button>
      </div>
    </>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, role, user, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = role === "admin" ? ADMIN_NAV : CLIENTE_NAV;
  // Admin sempre tem acesso total; cliente filtra por permissoes
  const allowed = role === "admin" ? items : items.filter((i) => hasPermission(profile?.permissoes, i.perm));

  const navProps = { allowed, pathname, profile, user, role, signOut, navigate };

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <SidebarNav {...navProps} />
      </aside>

      {/* ── Mobile: header bar + Sheet drawer ── */}
      <div className="flex flex-1 min-w-0 flex-col md:contents">
        {/* Mobile top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-sidebar px-4 md:hidden">
          <button
            aria-label="Abrir menu"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <img
            src="https://tabghamkt.com.br/wp-content/uploads/2025/05/logo_tabgha_health_mkt_caixa_alta-04-scaled-e1747895382243.png"
            alt="Tabgha Health Marketing"
            className="h-6 w-auto brightness-0"
          />
        </header>

        {/* Mobile drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-60 p-0 flex flex-col bg-sidebar border-sidebar-border">
            <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
            <SidebarNav {...navProps} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <main className="flex-1 min-w-0 bg-background">{children}</main>
      </div>

      {process.env.ANTHROPIC_API_KEY && (
        <Suspense fallback={null}><AssistantBubble /></Suspense>
      )}
    </div>
  );
}
