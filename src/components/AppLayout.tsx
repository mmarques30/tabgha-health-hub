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
  ChevronRight,
} from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  perm: string;
  sub?: boolean;
};

type NavGroup = {
  group: string;
  items: NavItem[];
};

const ADMIN_NAV: NavGroup[] = [
  {
    group: "Visão",
    items: [
      { to: "/admin/dashboard",        label: "Dashboard",          icon: LayoutDashboard, perm: "admin.dashboard" },
      { to: "/admin/roi",              label: "ROI da operação",    icon: TrendingUp,      perm: "admin.roi" },
    ],
  },
  {
    group: "Carteira",
    items: [
      { to: "/admin/clientes",         label: "Clientes",           icon: Users,           perm: "admin.clientes" },
      { to: "/admin/diagnosticos",     label: "Diagnósticos",       icon: Stethoscope,     perm: "admin.diagnosticos" },
      { to: "/admin/usuarios",         label: "Usuários & acessos", icon: UserCog,         perm: "admin.usuarios" },
    ],
  },
  {
    group: "Operação diária",
    items: [
      { to: "/admin/atendimento",      label: "Atendimento",        icon: MessageSquare,   perm: "admin.atendimento" },
      { to: "/admin/estrategia",       label: "Estratégia editorial",icon: FileText,       perm: "admin.estrategia" },
      { to: "/admin/calendario",       label: "Calendário",         icon: Calendar,        perm: "admin.operacao" },
    ],
  },
  {
    group: "Aquisição",
    items: [
      { to: "/admin/automacoes-leads", label: "Automações de leads", icon: Zap,            perm: "admin.operacao" },
      { to: "/admin/meta-ads",         label: "Meta Ads",           icon: Megaphone,       perm: "admin.meta_ads" },
    ],
  },
];

const CLIENTE_NAV: NavGroup[] = [
  {
    group: "Visão",
    items: [
      { to: "/cliente/dashboard",  label: "Dashboard",   icon: LayoutDashboard, perm: "cliente.dashboard" },
      { to: "/cliente/roi",        label: "ROI",         icon: TrendingUp,      perm: "cliente.roi" },
    ],
  },
  {
    group: "Relacionamento",
    items: [
      { to: "/cliente/atendimento",label: "Atendimento", icon: MessageSquare,   perm: "cliente.atendimento" },
      { to: "/cliente/leads",      label: "Leads",       icon: Users,           perm: "cliente.leads" },
      { to: "/cliente/clientes",   label: "Pacientes",   icon: UserCheck,       perm: "cliente.clientes" },
    ],
  },
  {
    group: "Marketing",
    items: [
      { to: "/cliente/conteudo",   label: "Conteúdo",    icon: FileText,        perm: "cliente.conteudo" },
      { to: "/cliente/meta-ads",   label: "Meta Ads",    icon: Megaphone,       perm: "cliente.meta_ads" },
      { to: "/cliente/calendario", label: "Calendário",  icon: Calendar,        perm: "cliente.calendario" },
    ],
  },
  {
    group: "Estratégia",
    items: [
      { to: "/cliente/diagnostico",label: "Diagnóstico", icon: Stethoscope,     perm: "cliente.diagnostico" },
      { to: "/cliente/conexoes",   label: "Conexões",    icon: Link2,           perm: "cliente.conexoes" },
    ],
  },
];

function SidebarNav({
  groups,
  pathname,
  profile,
  user,
  role,
  onNavigate,
  signOut,
  navigate,
}: {
  groups: NavGroup[];
  pathname: string;
  profile: ReturnType<typeof useAuth>["profile"];
  user: ReturnType<typeof useAuth>["user"];
  role: ReturnType<typeof useAuth>["role"];
  onNavigate?: () => void;
  signOut: ReturnType<typeof useAuth>["signOut"];
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggle(group: string) {
    setCollapsed((prev) => ({ ...prev, [group]: !prev[group] }));
  }

  return (
    <>
      {/* Logo */}
      <div className="flex h-12 items-center border-b border-sidebar-border px-3.5 shrink-0">
        <img
          src="https://tabghamkt.com.br/wp-content/uploads/2025/05/logo_tabgha_health_mkt_caixa_alta-04-scaled-e1747895382243.png"
          alt="Tabgha Health Marketing"
          className="h-6 w-auto brightness-0 invert"
        />
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-1.5">
        {groups.map((g) => {
          const key = g.group;
          const isOpen = collapsed[key] !== true;
          const hasActive = g.items.some(
            (i) => pathname === i.to || pathname.startsWith(i.to + "/"),
          );

          return (
            <div key={key} className="mb-0.5">
              {/* Group header */}
              <button
                onClick={() => toggle(key)}
                className={cn(
                  "flex w-[calc(100%-16px)] items-center justify-between mx-2 px-2.5 py-1.5 rounded-md border-0 bg-transparent cursor-pointer transition-colors",
                  "text-[9.5px] font-semibold tracking-[0.14em] uppercase",
                  hasActive
                    ? "text-sidebar-primary"
                    : "text-sidebar-foreground/35 hover:text-sidebar-foreground/60",
                )}
              >
                <span>{key}</span>
                <ChevronRight
                  className={cn(
                    "h-3 w-3 opacity-55 transition-transform duration-200",
                    isOpen && "rotate-90",
                  )}
                />
              </button>

              {/* Group items */}
              {isOpen && (
                <div>
                  {g.items.map((it) => {
                    const active = pathname === it.to || pathname.startsWith(it.to + "/");
                    const Icon = it.icon;
                    return (
                      <Link
                        key={it.to}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        to={it.to as any}
                        onClick={onNavigate}
                        className={cn(
                          "mx-2 mb-px flex items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-[12.5px] transition-all duration-150",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-[inset_3px_0_0_0_var(--color-sidebar-primary)]"
                            : "text-sidebar-foreground/55 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-3.5 w-3.5 shrink-0",
                            active ? "text-sidebar-primary opacity-100" : "opacity-50",
                          )}
                        />
                        {it.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-3.5 py-2.5 shrink-0">
        <div className="mb-1 truncate text-[11px] font-medium text-sidebar-foreground/80">
          {profile?.nome ?? user?.email}
        </div>
        <button
          onClick={async () => {
            await signOut();
            navigate({ to: "/login", replace: true });
          }}
          className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="h-3 w-3" /> Sair
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

  const allGroups = role === "admin" ? ADMIN_NAV : CLIENTE_NAV;

  const groups: NavGroup[] = allGroups.map((g) => ({
    ...g,
    items:
      role === "admin"
        ? g.items
        : g.items.filter((i) => hasPermission(profile?.permissoes, i.perm)),
  })).filter((g) => g.items.length > 0);

  const navProps = { groups, pathname, profile, user, role, signOut, navigate };

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* ── Desktop sidebar (224px conforme design system) ── */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <SidebarNav {...navProps} />
      </aside>

      {/* ── Mobile: header bar + Sheet drawer ── */}
      <div className="flex flex-1 min-w-0 flex-col md:contents">
        {/* Mobile top bar */}
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-sidebar px-4 md:hidden">
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
            className="h-6 w-auto brightness-0 invert"
          />
        </header>

        {/* Mobile drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-56 p-0 flex flex-col bg-sidebar border-sidebar-border">
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
