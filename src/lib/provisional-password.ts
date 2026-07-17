/** Senha provisória legível para enviar ao usuário (padrão operacional Tabgha). */
export function provisionalPassword(now = new Date()) {
  return `Tabgha${now.getFullYear()}`;
}
