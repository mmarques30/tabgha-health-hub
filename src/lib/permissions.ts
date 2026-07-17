/**
 * Permission helpers — array text[] no banco, com `*` como wildcard total.
 * Usado pelo AppLayout p/ filtrar sidebar e por guards de rota.
 */
export function hasPermission(permissoes: string[] | null | undefined, required: string): boolean {
  if (!permissoes || permissoes.length === 0) return false;
  if (permissoes.includes("*")) return true;
  if (permissoes.includes(required)) return true;
  // suporte a prefixos: "admin.*" libera "admin.clientes"
  return permissoes.some((p) => p.endsWith(".*") && required.startsWith(p.slice(0, -1)));
}

export function hasAnyPermission(
  permissoes: string[] | null | undefined,
  required: string[],
): boolean {
  return required.some((r) => hasPermission(permissoes, r));
}

/** Grupos canônicos de permissão admin (notação dot, espelhada na sidebar) */
export const ADMIN_PERMISSION_GROUPS = {
  dashboard: "admin.dashboard",
  clientes: "admin.clientes",
  estrategia: "admin.estrategia",
  operacao: "admin.operacao",
  atendimento: "admin.atendimento",
  meta_ads: "admin.meta_ads",
  roi: "admin.roi",
  usuarios: "admin.usuarios",
  diagnosticos: "admin.diagnosticos",
} as const;

export type AdminPermissionGroup = keyof typeof ADMIN_PERMISSION_GROUPS;

/** Rótulos alinhados ao menu admin (AppLayout) */
export const ADMIN_PERMISSION_LABELS: Record<AdminPermissionGroup, string> = {
  dashboard: "Dashboard",
  roi: "ROI da operação",
  meta_ads: "Marketing Pago",
  clientes: "Clientes",
  diagnosticos: "Diagnósticos",
  atendimento: "Atendimento WhatsApp",
  estrategia: "Estratégia editorial",
  operacao: "Automações & Operação",
  usuarios: "Usuários & acessos",
};

/** Grupos canônicos do portal do médico */
export const CLIENT_PERMISSION_GROUPS = {
  dashboard: "cliente.dashboard",
  roi: "cliente.roi",
  meta_ads: "cliente.meta_ads",
  atendimento: "cliente.atendimento",
  leads: "cliente.leads",
  clientes: "cliente.clientes",
  conteudo: "cliente.conteudo",
  entregas: "cliente.entregas",
  calendario: "cliente.calendario",
  diagnostico: "cliente.diagnostico",
  conexoes: "cliente.conexoes",
} as const;

export type ClientPermissionGroup = keyof typeof CLIENT_PERMISSION_GROUPS;

export const CLIENT_PERMISSION_LABELS: Record<ClientPermissionGroup, string> = {
  dashboard: "Dashboard",
  roi: "ROI",
  meta_ads: "Marketing Pago",
  atendimento: "Atendimento",
  leads: "Leads",
  clientes: "Pacientes",
  conteudo: "Conteúdo",
  entregas: "Entregas",
  calendario: "Calendário",
  diagnostico: "Diagnóstico",
  conexoes: "Conexões",
};

/** Resumo legível das permissões para listagens */
export function summarizePermissions(
  permissoes: string[] | null | undefined,
  role: string | null,
): string {
  if (!permissoes || permissoes.length === 0) return "Sem permissões";
  if (permissoes.includes("*")) return "Acesso total";

  const labels = role === "cliente" ? CLIENT_PERMISSION_LABELS : ADMIN_PERMISSION_LABELS;
  const groups = role === "cliente" ? CLIENT_PERMISSION_GROUPS : ADMIN_PERMISSION_GROUPS;

  const matched = (Object.keys(groups) as Array<keyof typeof groups>)
    .filter((key) => permissoes.includes(groups[key]))
    .map((key) => labels[key as keyof typeof labels]);

  if (matched.length === 0) return `${permissoes.length} permissão(ões)`;
  if (matched.length <= 2) return matched.join(", ");
  return `${matched.slice(0, 2).join(", ")} +${matched.length - 2}`;
}
