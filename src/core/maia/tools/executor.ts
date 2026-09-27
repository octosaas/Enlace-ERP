/**
 * Enlace ERP - MaIA v2 Tool Executor
 * PRD 02 - Seção 35 (MaIA) & Seção 36 (Controle de Acesso da MaIA)
 */

import { ToolRegistry } from './registry.js';
import { ActionPolicy } from '../security/actionPolicy.js';
import { DataPolicy } from '../security/dataPolicy.js';
import { ConfirmationService } from '../confirmation/confirmationService.js';
import { AIPrincipalContext, AIToolCall, AIToolCallResult, PendingActionConfirmation } from '../types.js';
import { AuditService } from '../../audit/service.js';
import { logger } from '../../logger/index.js';

export interface ExecuteResult {
  toolCallResult: AIToolCallResult;
  pendingConfirmation?: PendingActionConfirmation;
}

export class ToolExecutor {
  private static instance: ToolExecutor | null = null;

  private constructor() {}

  static getInstance(): ToolExecutor {
    if (!this.instance) {
      this.instance = new ToolExecutor();
    }
    return this.instance;
  }

  async execute(
    context: AIPrincipalContext,
    toolCall: AIToolCall,
    bypassConfirmation: boolean = false
  ): Promise<ExecuteResult> {
    const registry = ToolRegistry.getInstance();
    const tool = registry.get(toolCall.name);

    if (!tool) {
      return {
        toolCallResult: {
          toolCallId: toolCall.id,
          name: toolCall.name,
          error: `Ferramenta desconhecida ou não registrada: '${toolCall.name}'`,
          isSuccess: false,
        },
      };
    }

    try {
      // 1. Validação estrita de autorização RBAC e trava de privilégios
      ActionPolicy.validateToolExecution(context, tool);

      // 2. Se a ferramenta requer confirmação e não foi pré-confirmada, suspende e solicita aprovação
      if (ActionPolicy.requiresConfirmation(tool) && !bypassConfirmation) {
        const confirmationService = ConfirmationService.getInstance();
        const pending = confirmationService.createPendingConfirmation({
          context,
          toolName: tool.name,
          toolParams: toolCall.args,
          riskLevel: tool.riskLevel,
          description: `Confirmação de ação: ${tool.description}`,
        });

        return {
          toolCallResult: {
            toolCallId: toolCall.id,
            name: tool.name,
            result: {
              status: 'AWAITING_CONFIRMATION',
              message: `Esta operação (${tool.name}) possui nível de risco '${tool.riskLevel}' e requer confirmação explícita do operador.`,
              confirmationToken: pending.token,
              expiresAt: pending.expiresAt,
            },
            isSuccess: true,
          },
          pendingConfirmation: pending,
        };
      }

      // 3. Execução segura da ferramenta através de Repositories e Services
      const rawResult = await tool.execute(context, toolCall.args);

      // 4. Sanitização do retorno para proteção contra vazamentos
      const sanitizedResult = DataPolicy.sanitizeForAI(rawResult);

      // 5. Registro estruturado de auditoria
      AuditService.record({
        action: 'MAIA_TOOL_EXECUTED',
        resource: tool.name,
        status: 'SUCCESS',
        userId: context.delegatedUser.id,
        companyId: context.activeCompany.id,
        requestId: context.requestId,
        details: {
          toolName: tool.name,
          riskLevel: tool.riskLevel,
          args: DataPolicy.sanitizeForAI(toolCall.args),
        },
      });

      return {
        toolCallResult: {
          toolCallId: toolCall.id,
          name: tool.name,
          result: sanitizedResult,
          isSuccess: true,
        },
      };
    } catch (err: any) {
      logger.warn(`[ToolExecutor] Erro na execução da ferramenta [${tool.name}]: ${err.message}`);

      AuditService.record({
        action: 'MAIA_TOOL_EXECUTION_FAILED',
        resource: tool.name,
        status: 'FAILED',
        userId: context.delegatedUser.id,
        companyId: context.activeCompany.id,
        requestId: context.requestId,
        details: {
          toolName: tool.name,
          error: err.message,
        },
      });

      return {
        toolCallResult: {
          toolCallId: toolCall.id,
          name: tool.name,
          error: err.message,
          isSuccess: false,
        },
      };
    }
  }
}
