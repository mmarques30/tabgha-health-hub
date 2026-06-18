import { type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Calendar,
  LineChart,
  Workflow,
  Settings,
  FileText,
  Megaphone,
  LogOut,
} from "lucide-react";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; perm: string };

const ADMIN_NAV: NavItem[] = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: "admin.dashboard" },
  { to: "/admin/clientes", label: "Clientes", icon: Users, perm: "admin.clientes" },
  { to: "/admin/diagnosticos", label: "Diagnósticos", icon: ClipboardList, perm: "admin.diagnosticos" },
  { to: "/admin/estrategia", label: "Estratégia", icon: FileText, perm: "admin.estrategia" },
  { to: "/admin/calendario", label: "Calendário", icon: Calendar, perm: "admin.calendario" },
  { to: "/admin/automacoes-leads", label: "Leads", icon: Megaphone, perm: "admin.leads" },
  { to: "/admin/roi", label: "ROI", icon: LineChart, perm: "admin.roi" },
  { to: "/admin/usuarios", label: "Usuários", icon: Users, perm: "admin.usuarios" },
  { to: "/admin/automacoes", label: "Automações", icon: Workflow, perm: "admin.automacoes" },
];

const CLIENTE_NAV: NavItem[] = [
  { to: "/cliente/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: "cliente.dashboard" },
  { to: "/cliente/leads", label: "Leads", icon: Megaphone, perm: "cliente.leads" },
  { to: "/cliente/clientes", label: "Pacientes", icon: Users, perm: "cliente.pacientes" },
  { to: "/cliente/roi", label: "ROI", icon: LineChart, perm: "cliente.roi" },
  { to: "/cliente/conteudo", label: "Conteúdo", icon: FileText, perm: "cliente.conteudo" },
  { to: "/cliente/diagnostico", label: "Diagnóstico", icon: ClipboardList, perm: "cliente.diagnostico" },
  { to: "/cliente/conexoes", label: "Conexões", icon: Settings, perm: "cliente.conexoes" },
  { to: "/cliente/calendario", label: "Calendário", icon: Calendar, perm: "cliente.calendario" },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, role, user, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = role === "admin" ? ADMIN_NAV : CLIENTE_NAV;
  const allowed = items.filter((i) => hasPermission(profile?.permissoes, i.perm));

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <div className="h-7 w-7 rounded-md bg-foreground text-background grid place-items-center text-xs font-semibold">
            T
          </div>
          <span className="text-sm font-semibold tracking-tight">Tabgha</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {allowed.map((it) => {
            const active = pathname === it.to || pathname.startsWith(it.to + "/");
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "mx-2 mb-0.5 flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3 text-xs text-muted-foreground">
          <div className="mb-2 truncate">{profile?.nome ?? user?.email}</div>
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/login", replace: true });
            }}
            className="inline-flex items-center gap-1.5 text-foreground/80 hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
