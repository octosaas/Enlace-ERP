/**
 * Enlace ERP - MaIA v2 Action Policy & Authorization
 * PRD 02 - Seção 35 (MaIA) & Seção 36 (Controle de Acesso da MaIA)
 */

import { ForbiddenError } from '../../errors/index.js';
import { AuditService } from '../../audit/service.js';
import { AIPrincipalContext, AIToolDefinition, RiskLevel } from '../types.js';

export class ActionPolicy {
  /**
   * Valida se a ação da IA é permitida com base nas permissões do usuário que delegou o comando
   */
  static assertPermission(
    context: AIPrincipalContext,
    requiredPermission: string,
    toolActionName: string
  ): void {
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

  /**
   * Avalia o risco e travas de privilégios para a ferramenta
   */
  static validateToolExecution(
    context: AIPrincipalContext,
    tool: AIToolDefinition
  ): void {
    // 1. Autorização estrita
    this.assertPermission(context, tool.requiredPermission, tool.name);

    // 2. Trava estrita para ações de alto risco/críticas
    if (
      (tool.riskLevel === 'high' || tool.riskLevel === 'critical') &&
      context.membership.role !== 'owner' &&
      context.membership.role !== 'admin'
    ) {
      throw new ForbiddenError(
        `Ação crítica '${tool.name}' requer privilégio de Administrador ou Titular da conta.`
      );
    }
  }

  /**
   * Determina se a execução exige etapa de confirmação de 2 fases
   */
  static requiresConfirmation(tool: AIToolDefinition): boolean {
    return tool.requiresConfirmation || tool.riskLevel === 'high' || tool.riskLevel === 'critical';
  }
}
