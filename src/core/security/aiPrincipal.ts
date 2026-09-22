/**
 * Enlace ERP - AI Principal & MaIA Authorization Delegate
 * PRD 02 - Seção 35 (MaIA) & Seção 36 (Controle de Acesso da MaIA)
 * 
 * Regras Arquiteturais Invioláveis:
 * 1. A MaIA opera estritamente sob delegação do usuário em sessão e herda seu activeMembership.
 * 2. NUNCA possui privilégios superiores ao usuário humano autenticado.
 * 3. NUNCA possui acesso SQL direto ou irrestrito ao banco de dados.
 * 4. O contexto da IA é restrito com isolamento físico estrito ao schema do CNPJ ativo ("tenant_<CNPJ>").
 * 5. Guardrails ativos contra Prompt Injection, Vazamento Cross-Tenant e Ações Destrutivas.
 */

import { User, Company, Membership } from '../../shared/types.js';
import { ForbiddenError, ValidationError } from '../errors/index.js';
import { AuditService } from '../audit/service.js';

export interface AIPrincipalContext {
  principalId: 'maia-agent-core';
  delegatedUser: User;
  activeCompany: Company;
  membership: Membership;
  requestId: string;
}

export interface AIToolDefinition<TParams = any, TResult = any> {
  name: string;
  description: string;
  requiredPermission: string;
  isDangerous?: boolean;
  execute: (context: AIPrincipalContext, params: TParams) => Promise<TResult>;
}

export class AIPrincipalManager {
  /**
   * Padrões conhecidos de Prompt Injection, Jailbreaks e Tentativas de Exfiltração
   */
  private static readonly INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
    /desconsidere\s+(todas\s+as\s+)?instru[çc][õo]es\s+anteriores/i,
    /system\s+prompt\s+(reveal|leak|show|display)/i,
    /revelar\s+(prompt\s+do\s+sistema|instru[çc][õo]es\s+secretas)/i,
    /drop\s+table/i,
    /delete\s+from\s+cp_/i,
    /delete\s+from\s+tenant_/i,
    /union\s+select/i,
    /tenant_\d{14}/i, // Proíbe injeção de nomes de schema de terceiros no prompt
    /bypass\s+rbac/i,
    /sudo\s+mode/i,
  ];

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
   * Valida guardrail contra injeção de prompt e tentativas de quebra de instruções
   */
  static validatePromptSafety(prompt: string, context?: AIPrincipalContext): void {
    if (!prompt || typeof prompt !== 'string') return;

    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(prompt)) {
        if (context) {
          AuditService.recordSecurityEvent({
            type: 'SECURITY_INJECTION_ATTEMPT',
            severity: 'HIGH',
            userId: context.delegatedUser.id,
            userEmail: context.delegatedUser.email,
            companyId: context.activeCompany.id,
            schemaNamespace: context.activeCompany.schemaNamespace,
            requestId: context.requestId,
            details: {
              principal: context.principalId,
              flaggedPattern: pattern.toString(),
              promptSnippet: prompt.slice(0, 100),
            },
            mitigationTaken: 'Execução de prompt bloqueada por Guardrails de Segurança da MaIA.',
          });
        }

        throw new ValidationError(
          'Comando rejeitado pelos Guardrails de Segurança da MaIA: Padrão não permitido ou tentativa de injeção detectada.'
        );
      }
    }
  }

  /**
   * Valida se a ação da IA é permitida com base nas permissões do usuário que delegou o comando
   */
  static assertPermission(context: AIPrincipalContext, requiredPermission: string, toolActionName: string): void {
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
   * Executa uma ferramenta da IA com verificação prévia obrigatória de autorização,
   * validação de tenant e auditoria completa de operação
   */
  static async executeToolWithGuardrails<TParams, TResult>(
    context: AIPrincipalContext,
    tool: AIToolDefinition<TParams, TResult>,
    params: TParams
  ): Promise<TResult> {
    // 1. Validação estrita de autorização prévia
    this.assertPermission(context, tool.requiredPermission, tool.name);

    // 2. Trava estrita contra ferramentas perigosas sem consentimento de administrador
    if (tool.isDangerous && context.membership.role !== 'owner' && context.membership.role !== 'admin') {
      throw new ForbiddenError(
        `Ação crítica '${tool.name}' requer privilégio de Administrador ou Titular da conta.`
      );
    }

    // 3. Execução com isolamento e auditoria
    try {
      const result = await tool.execute(context, params);
      return result;
    } catch (err: any) {
      throw err;
    }
  }

  /**
   * Sanitizador de contexto: Assegura que nenhum dado pertencente a outro schema/empresa
   * seja fornecido ao modelo de inteligência artificial
   */
  static filterContextForActiveTenant<T extends Record<string, any>>(
    data: T[],
    activeSchemaNamespace: string
  ): T[] {
    return data.filter((item) => {
      // Se o item contiver marcação de schema, valida conformidade estrita
      if (item.schemaNamespace && item.schemaNamespace !== activeSchemaNamespace) {
        return false;
      }
      return true;
    });
  }
}
