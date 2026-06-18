import { type ReactNode, Suspense, lazy, useState } from "react";
const AssistantBubble = lazy(() => import("./AssistantBubble").then((m) => ({ default: m.AssistantBubble })));
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LayoutDashboard,
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
  PanelLeft,
  Users,
} from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  perm: string;
};

type NavGroup = {
  group: string;
  items: NavItem[];
};

const ADMIN_NAV: NavGroup[] = [
  {
    group: "Visão",
    items: [
      { to: "/admin/dashboard",        label: "Dashboard",           icon: LayoutDashboard, perm: "admin.dashboard" },
      { to: "/admin/roi",              label: "ROI da operação",     icon: TrendingUp,      perm: "admin.roi" },
    ],
  },
  {
    group: "Carteira",
    items: [
      { to: "/admin/clientes",         label: "Clientes",            icon: Users,           perm: "admin.clientes" },
      { to: "/admin/diagnosticos",     label: "Diagnósticos",        icon: Stethoscope,     perm: "admin.diagnosticos" },
      { to: "/admin/usuarios",         label: "Usuários & acessos",  icon: UserCog,         perm: "admin.usuarios" },
    ],
  },
  {
    group: "Operação diária",
    items: [
      { to: "/admin/atendimento",      label: "Atendimento",         icon: MessageSquare,   perm: "admin.atendimento" },
      { to: "/admin/estrategia",       label: "Estratégia editorial", icon: FileText,       perm: "admin.estrategia" },
      { to: "/admin/calendario",       label: "Calendário",          icon: Calendar,        perm: "admin.operacao" },
    ],
  },
  {
    group: "Aquisição",
    items: [
      { to: "/admin/automacoes-leads", label: "Automações de leads", icon: Zap,             perm: "admin.operacao" },
      { to: "/admin/meta-ads",         label: "Meta Ads",            icon: Megaphone,       perm: "admin.meta_ads" },
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
      { to: "/cliente/atendimento", label: "Atendimento", icon: MessageSquare,  perm: "cliente.atendimento" },
      { to: "/cliente/leads",       label: "Leads",       icon: Users,           perm: "cliente.leads" },
      { to: "/cliente/clientes",    label: "Pacientes",   icon: UserCheck,       perm: "cliente.clientes" },
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
      { to: "/cliente/diagnostico", label: "Diagnóstico", icon: Stethoscope,   perm: "cliente.diagnostico" },
      { to: "/cliente/conexoes",    label: "Conexões",    icon: Link2,          perm: "cliente.conexoes" },
    ],
  },
];

// ── Sidebar Nav ───────────────────────────────────────────────────────────────

function SidebarNav({
  groups,
  pathname,
  profile,
  user,
  onNavigate,
  signOut,
  navigate,
  collapsed = false,
  onToggleCollapse,
}: {
  groups: NavGroup[];
  pathname: string;
  profile: ReturnType<typeof useAuth>["profile"];
  user: ReturnType<typeof useAuth>["user"];
  onNavigate?: () => void;
  signOut: ReturnType<typeof useAuth>["signOut"];
  navigate: ReturnType<typeof useNavigate>;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  function toggleGroup(group: string) {
    setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  }

  function isGroupOpen(key: string): boolean {
    return openGroups[key] !== false; // default open
  }

  return (
    <TooltipProvider delayDuration={0}>
      {/* ── Logo / Toggle ── */}
      <div className={cn(
        "flex h-12 items-center border-b border-sidebar-border shrink-0",
        collapsed ? "justify-center px-0" : "justify-between px-3.5",
      )}>
        {!collapsed && (
          <img
            src="https://tabghamkt.com.br/wp-content/uploads/2025/05/logo_tabgha_health_mkt_caixa_alta-04-scaled-e1747895382243.png"
            alt="Tabgha Health Marketing"
            className="h-6 w-auto brightness-0 invert"
          />
        )}
        {collapsed && (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sidebar-primary/20">
            <span className="text-[11px] font-bold text-sidebar-primary">T</span>
          </div>
        )}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/40 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
              collapsed && "absolute right-0 translate-x-full -mr-px rounded-l-none rounded-r-md border border-l-0 border-sidebar-border bg-sidebar",
            )}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            <PanelLeft className={cn("h-3.5 w-3.5 transition-transform duration-300", collapsed && "rotate-180")} />
          </button>
        )}
      </div>

      {/* ── Nav groups ── */}
      <nav className="flex-1 overflow-y-auto py-2">
        {groups.map((g) => {
          const key = g.group;
          const isOpen = isGroupOpen(key);
          const hasActive = g.items.some(
            (i) => pathname === i.to || pathname.startsWith(i.to + "/"),
          );

          return (
            <div key={key} className={cn("mb-1", collapsed ? "px-1.5" : "")}>
              {/* Group header — hidden when collapsed */}
              {!collapsed && (
                <button
                  onClick={() => toggleGroup(key)}
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
              )}

              {/* Group items */}
              {(isOpen || collapsed) && (
                <div className={collapsed ? "flex flex-col gap-0.5 py-0.5" : ""}>
                  {collapsed && !isOpen && (
                    <div className="my-1 h-px bg-sidebar-border" />
                  )}
                  {g.items.map((it) => {
                    const active = pathname === it.to || pathname.startsWith(it.to + "/");
                    const Icon = it.icon;

                    if (collapsed) {
                      return (
                        <Tooltip key={it.to}>
                          <TooltipTrigger asChild>
                            <Link
                              to={it.to as any}
                              onClick={onNavigate}
                              className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-md transition-all duration-150 mx-auto",
                                active
                                  ? "bg-sidebar-accent text-sidebar-primary shadow-[inset_2px_0_0_0_var(--color-sidebar-primary)]"
                                  : "text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                              )}
                            >
                              <Icon className={cn("h-4 w-4", active ? "opacity-100" : "opacity-60")} />
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="text-xs font-medium">
                            {it.label}
                          </TooltipContent>
                        </Tooltip>
                      );
                    }

                    return (
                      <Link
                        key={it.to}
                        to={it.to as any}
                        onClick={onNavigate}
                        className={cn(
                          "mx-2 mb-px flex items-center gap-2.5 rounded-[7px] px-2.5 py-1.5 text-[12.5px] transition-all duration-150",
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

              {/* Separator between collapsed groups */}
              {collapsed && <div className="mt-1 h-px bg-sidebar-border/40 mx-1" />}
            </div>
          );
        })}
      </nav>

      {/* ── Footer ── */}
      <div className={cn(
        "border-t border-sidebar-border py-3 shrink-0",
        collapsed ? "flex flex-col items-center gap-1 px-0" : "px-3.5",
      )}>
        {!collapsed && (
          <div className="mb-1 truncate text-[11px] font-medium text-sidebar-foreground/80">
            {profile?.nome ?? user?.email}
          </div>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={async () => {
                await signOut();
                navigate({ to: "/login", replace: true });
              }}
              className={cn(
                "inline-flex items-center gap-1 text-[10.5px] text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors",
                collapsed && "h-8 w-8 justify-center rounded-md hover:bg-sidebar-accent",
              )}
            >
              <LogOut className="h-3.5 w-3.5" />
              {!collapsed && <span>Sair</span>}
            </button>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right" className="text-xs">Sair</TooltipContent>
          )}
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

// ── App Layout ────────────────────────────────────────────────────────────────

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, role, user, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const allGroups = role === "admin" ? ADMIN_NAV : CLIENTE_NAV;

  const groups: NavGroup[] = allGroups
    .map((g) => ({
      ...g,
      items:
        role === "admin"
          ? g.items
          : g.items.filter((i) => hasPermission(profile?.permissoes, i.perm)),
    }))
    .filter((g) => g.items.length > 0);

  const navProps = { groups, pathname, profile, user, signOut, navigate };

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* ── Desktop sidebar ── */}
      <aside
        className="relative hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex overflow-hidden"
        style={{
          width: sidebarCollapsed ? "3.5rem" : "14rem",
          transition: "width 280ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <SidebarNav
          {...navProps}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        />
      </aside>

      {/* ── Mobile: header bar + Sheet drawer ── */}
      <div className="flex flex-1 min-w-0 flex-col md:contents">
        {/* Mobile top bar */}
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-4 shadow-sm md:hidden">
          <button
            aria-label="Abrir menu"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-foreground/60 hover:bg-muted transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <img
            src="https://tabghamkt.com.br/wp-content/uploads/2025/05/logo_tabgha_health_mkt_caixa_alta-04-scaled-e1747895382243.png"
            alt="Tabgha Health Marketing"
            className="h-6 w-auto"
            style={{ filter: "brightness(0) saturate(100%) invert(18%) sepia(56%) saturate(1200%) hue-rotate(204deg) brightness(82%) contrast(97%)" }}
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
