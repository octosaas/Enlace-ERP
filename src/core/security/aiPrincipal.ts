/**
 * Enlace ERP - AI Principal & MaIA Authorization Delegate
 * PRD 02 - Seção 35 (MaIA) & Seção 36 (Controle de Acesso da MaIA)
 * 
 * Regra Arquitetural Inviolável:
 * A MaIA opera estritamente através de serviços autorizados e herda o contexto do usuário.
 * NUNCA possui acesso SQL irrestrito direto ao banco de dados.
 */

import { User, Company, Membership } from '../../shared/types.js';
import { ForbiddenError } from '../errors/index.js';
import { AuditService } from '../audit/service.js';

export interface AIPrincipalContext {
  principalId: 'maia-agent-core';
  delegatedUser: User;
  activeCompany: Company;
  membership: Membership;
  requestId: string;
}

export class AIPrincipalManager {
  /**
   * Cria um contexto controlado de execução para a IA delegada
   */
  static createDelegatedContext(params: {
    user: User;
    company: Company;
    membership: Membership;
    requestId: string;
  }): AIPrincipalContext {
    return {
      principalId: 'maia-agent-core',
      delegatedUser: params.user,
      activeCompany: params.company,
      membership: params.membership,
      requestId: params.requestId,
    };
  }

  /**
   * Valida se a ação da IA é permitida com base nas permissões do usuário que delegou o comando
   */
  static assertPermission(context: AIPrincipalContext, requiredPermission: string, toolActionName: string) {
    const hasPerm = context.membership.permissions.includes(requiredPermission);

    if (!hasPerm) {
      AuditService.recordSecurityEvent({
        type: 'SECURITY_PERMISSION_DENIED',
        severity: 'HIGH',
        userId: context.delegatedUser.id,
        userEmail: context.delegatedUser.email,
        companyId: context.activeCompany.id,
        schemaNamespace: context.activeCompany.schemaNamespace,
        requestId: context.requestId,
        details: {
          principal: context.principalId,
          attemptedAction: toolActionName,
          requiredPermission,
          reason: 'A IA MaIA tentou executar ação não permitida pelas permissões do usuário solicitante.',
        },
        mitigationTaken: 'Operação bloqueada na camada de autorização do AI Principal.',
      });

      throw new ForbiddenError(
        `Ação da assistente MaIA bloqueada: O usuário solicitante não possui a permissão '${requiredPermission}' para a operação '${toolActionName}'.`
      );
    }
  }
}
