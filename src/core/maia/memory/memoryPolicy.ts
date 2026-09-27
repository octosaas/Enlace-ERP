/**
 * Enlace ERP - MaIA v2 Memory Policy
 * PRD 02 - Seção 35 (MaIA) & Seção 36 (Controle de Acesso da MaIA)
 */

export class MemoryPolicy {
  static readonly MAX_MESSAGES_PER_SESSION = 10;
  static readonly SESSION_TTL_MINUTES = 60; // 1 hora de inatividade
}
