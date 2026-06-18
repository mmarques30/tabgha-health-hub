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

export function hasAnyPermission(permissoes: string[] | null | undefined, required: string[]): boolean {
  return required.some((r) => hasPermission(permissoes, r));
}

// Grupos canônicos de permissão admin (notação dot, espelhada na sidebar)
export const ADMIN_PERMISSION_GROUPS = {
  dashboard:    "admin.dashboard",
  clientes:     "admin.clientes",
  estrategia:   "admin.estrategia",
  operacao:     "admin.operacao",
  atendimento:  "admin.atendimento",
  meta_ads:     "admin.meta_ads",
  roi:          "admin.roi",
  usuarios:     "admin.usuarios",
  diagnosticos: "admin.diagnosticos",
} as const;

export type AdminPermissionGroup = keyof typeof ADMIN_PERMISSION_GROUPS;
