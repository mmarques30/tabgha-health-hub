export const ADMIN_PERMISSION_GROUPS = {
  dashboard: ['/admin/dashboard'],
  clientes: ['/admin/clientes', '/admin/clientes/$id'],
  estrategia: ['/admin/estrategia'],
  operacao: ['/admin/automacoes-leads', '/admin/automacoes'],
  roi: ['/admin/roi'],
  usuarios: ['/admin/usuarios'],
  diagnosticos: ['/admin/diagnosticos'],
} as const

export type AdminPermissionGroup = keyof typeof ADMIN_PERMISSION_GROUPS

export const ALL_ADMIN_PATHS = Object.values(ADMIN_PERMISSION_GROUPS).flat()

export function hasPermission(permissoes: string[], path: string): boolean {
  if (permissoes.includes('*')) return true
  if (permissoes.includes(path)) return true
  // Match dynamic segments, e.g. /admin/clientes/$id matches /admin/clientes/some-uuid
  for (const perm of permissoes) {
    const permParts = perm.split('/')
    const pathParts = path.split('/')
    if (permParts.length !== pathParts.length) continue
    const matches = permParts.every((part, i) => part.startsWith('$') || part === pathParts[i])
    if (matches) return true
  }
  return false
}
