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
import { PromptGuard } from '../maia/security/promptGuard.js';
import { ActionPolicy } from '../maia/security/actionPolicy.js';
import { DataPolicy } from '../maia/security/dataPolicy.js';
import { ContextBuilder } from '../maia/context/contextBuilder.js';
import {
  AIPrincipalContext as MaiaAIPrincipalContext,
  AIToolDefinition as MaiaAIToolDefinition,
} from '../maia/types.js';

export type AIPrincipalContext = MaiaAIPrincipalContext;
export type AIToolDefinition<TParams = any, TResult = any> = MaiaAIToolDefinition<TParams, TResult>;

export class AIPrincipalManager {
  /**
   * Padrões conhecidos de Prompt Injection, Jailbreaks e Tentativas de Exfiltração
   */
  static readonly INJECTION_PATTERNS = [
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
    sessionId?: string;
  }): AIPrincipalContext {
    return ContextBuilder.build(params);
  }

  /**
   * Valida guardrail contra injeção de prompt e tentativas de quebra de instruções
   */
  static validatePromptSafety(prompt: string, context?: AIPrincipalContext): void {
    PromptGuard.validatePromptSafety(prompt, context);
  }

  /**
   * Valida se a ação da IA é permitida com base nas permissões do usuário que delegou o comando
   */
  static assertPermission(
    context: AIPrincipalContext,
    requiredPermission: string,
    toolActionName: string
  ): void {
    ActionPolicy.assertPermission(context, requiredPermission, toolActionName);
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
    ActionPolicy.validateToolExecution(context, tool);
    return await tool.execute(context, params);
  }

  /**
   * Sanitizador de contexto: Assegura que nenhum dado pertencente a outro schema/empresa
   * seja fornecido ao modelo de inteligência artificial
   */
  static filterContextForActiveTenant<T extends Record<string, any>>(
    data: T[],
    activeSchemaNamespace: string
  ): T[] {
    return DataPolicy.filterByTenantSchema(data, activeSchemaNamespace);
  }
}
