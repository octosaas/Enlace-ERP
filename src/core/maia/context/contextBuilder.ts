/**
 * Enlace ERP - MaIA v2 Context Builder
 * PRD 02 - Seção 35 (MaIA) & Seção 36 (Controle de Acesso da MaIA)
 */

import { User, Company, Membership } from '../../../shared/types.js';
import { AIPrincipalContext } from '../types.js';

export interface CreateContextParams {
  user: User;
  company: Company;
  membership: Membership;
  requestId: string;
  sessionId?: string;
  locale?: string;
  timezone?: string;
}

export class ContextBuilder {
  /**
   * Constrói o contexto controlado e imutável para a MaIA.
   * O tenant é estritamente derivado do activeCompany validado no backend.
   */
  static build(params: CreateContextParams): AIPrincipalContext {
    return {
      principalId: 'maia-agent-core',
      delegatedUser: params.user,
      activeCompany: params.company,
      membership: params.membership,
      requestId: params.requestId,
      sessionId: params.sessionId,
      locale: params.locale || 'pt-BR',
      timezone: params.timezone || 'America/Sao_Paulo',
    };
  }
}
