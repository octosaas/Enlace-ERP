/**
 * Enlace ERP - MaIA v2 Core Service (Orquestrador Central)
 * PRD 02 - Seção 35 (MaIA) & Seção 36 (Controle de Acesso da MaIA)
 * 
 * Orquestra Contexto, Guardrails, Roteamento, Provedores, Ferramentas, Memória e Auditoria
 */

import {
  AIPrincipalContext,
  AIModelProfile,
  ChatInteractionResult,
  AIMessage,
  AIToolCallResult,
  PendingActionConfirmation,
} from './types.js';
import { PromptGuard } from './security/promptGuard.js';
import { ContextPolicy } from './context/contextPolicy.js';
import { ToolRegistry } from './tools/registry.js';
import { ToolExecutor } from './tools/executor.js';
import { ModelRouter } from './router/modelRouter.js';
import { MemoryService } from './memory/memoryService.js';
import { ConfirmationService } from './confirmation/confirmationService.js';
import { AIAuditService } from './observability/aiAuditService.js';
import { rateLimiter } from '../security/rateLimiter.js';
import { ValidationError, ForbiddenError } from '../errors/index.js';
import { logger } from '../logger/index.js';

export class MaiaService {
  private static instance: MaiaService | null = null;

  private constructor() {}

  static getInstance(): MaiaService {
    if (!this.instance) {
      this.instance = new MaiaService();
    }
    return this.instance;
  }

  /**
   * Processa uma mensagem enviada pelo usuário à MaIA
   */
  async processChat(params: {
    prompt: string;
    context: AIPrincipalContext;
    modelProfile?: AIModelProfile;
    sessionId?: string;
  }): Promise<ChatInteractionResult> {
    const startTime = Date.now();
    const cleanCnpj = params.context.activeCompany.cnpj.replace(/\D/g, '');
    const userId = params.context.delegatedUser.id;
    const sessionId = params.sessionId || `session_${Date.now()}`;

    // 1. Rate Limiting por usuário e tenant (máximo 60 tentativas/minuto)
    const rateLimitKey = `maia_chat:${cleanCnpj}:${userId}`;
    const status = rateLimiter.checkStatus(rateLimitKey);
    if (status.isLocked) {
      throw new ValidationError(
        `Limite de requisições à assistente MaIA atingido. Aguarde ${status.remainingSeconds} segundos antes de tentar novamente.`
      );
    }
    rateLimiter.recordFailure(rateLimitKey, 60, 60);

    // 2. Normalização e Guardrail estrito contra Prompt Injection e Exfiltração
    PromptGuard.validatePromptSafety(params.prompt, params.context);

    // 3. Recuperação de histórico de conversação isolado da sessão
    const memoryService = MemoryService.getInstance();
    const history = memoryService.getHistory(cleanCnpj, userId, sessionId);

    // 4. Montagem do System Prompt oficial e filtragem das ferramentas pelo RBAC do usuário
    const systemInstruction = ContextPolicy.buildSystemPrompt(params.context);
    const toolRegistry = ToolRegistry.getInstance();
    const authorizedTools = toolRegistry.getToolsForContext(params.context);

    // 5. Roteamento e chamada ao modelo de IA
    const modelRouter = ModelRouter.getInstance();
    const initialResponse = await modelRouter.routeAndExecute({
      prompt: params.prompt,
      systemInstruction,
      history,
      tools: authorizedTools,
      modelProfile: params.modelProfile,
      context: params.context,
    });

    const toolsInvokedNames: string[] = [];
    let executedToolsDetails: Array<{ name: string; args: Record<string, any>; isSuccess: boolean }> = [];
    let pendingConfirmation: PendingActionConfirmation | undefined;
    let finalAnswer = initialResponse.content;

    // 6. Tratamento de Function Calling (Tool Calls)
    if (initialResponse.toolCalls && initialResponse.toolCalls.length > 0) {
      const toolExecutor = ToolExecutor.getInstance();
      const toolResults: AIToolCallResult[] = [];

      for (const toolCall of initialResponse.toolCalls) {
        toolsInvokedNames.push(toolCall.name);
        const execResult = await toolExecutor.execute(params.context, toolCall);

        toolResults.push(execResult.toolCallResult);
        executedToolsDetails.push({
          name: toolCall.name,
          args: toolCall.args,
          isSuccess: execResult.toolCallResult.isSuccess,
        });

        // Se uma ferramenta demandar confirmação de 2 fases, suspende o fluxo
        if (execResult.pendingConfirmation) {
          pendingConfirmation = execResult.pendingConfirmation;
        }
      }

      // Se há confirmação pendente, comunica ao usuário com clareza
      if (pendingConfirmation) {
        finalAnswer = `A operação '${pendingConfirmation.toolName}' (${pendingConfirmation.description}) possui nível de risco '${pendingConfirmation.riskLevel}'. Confirme para prosseguir com a execução segura no sistema.`;
      } else {
        // Envia os resultados das ferramentas de volta ao modelo para síntese executiva
        const updatedHistory: AIMessage[] = [
          ...history,
          { role: 'user', content: params.prompt },
          { role: 'model', content: initialResponse.content || 'Consultando ferramentas...', toolCalls: initialResponse.toolCalls },
          { role: 'tool', content: 'Resultados das ferramentas executadas', toolResults },
        ];

        try {
          const synthesisResponse = await modelRouter.routeAndExecute({
            prompt: 'Sintetize os dados retornados pelas ferramentas de forma executiva, clara e objetiva para o operador.',
            systemInstruction,
            history: updatedHistory,
            modelProfile: params.modelProfile,
            context: params.context,
          });

          if (synthesisResponse.content) {
            finalAnswer = synthesisResponse.content;
          }
        } catch (synthErr) {
          logger.warn('[MaiaService] Falha na síntese final, formatando resultados brutos', { error: synthErr });
          finalAnswer = `Dados obtidos com sucesso:\n${JSON.stringify(toolResults.map((t) => t.result), null, 2)}`;
        }
      }
    }

    // 7. Persistência na memória de conversação
    memoryService.addMessage(cleanCnpj, userId, sessionId, {
      role: 'user',
      content: params.prompt,
    });
    memoryService.addMessage(cleanCnpj, userId, sessionId, {
      role: 'model',
      content: finalAnswer,
    });

    // 8. Observabilidade e Auditoria
    const latencyMs = Date.now() - startTime;
    AIAuditService.getInstance().recordInteraction({
      context: params.context,
      modelUsed: initialResponse.modelUsed,
      profileUsed: params.modelProfile || 'balanced',
      providerId: initialResponse.providerId,
      prompt: params.prompt,
      toolsInvoked: toolsInvokedNames.length > 0 ? toolsInvokedNames : undefined,
      totalTokens: initialResponse.usage?.totalTokens,
      latencyMs,
      status: 'SUCCESS',
    });

    return {
      response: finalAnswer,
      sessionId,
      modelUsed: initialResponse.modelUsed,
      providerId: initialResponse.providerId,
      profileUsed: params.modelProfile || 'balanced',
      toolCallsExecuted: executedToolsDetails.length > 0 ? executedToolsDetails : undefined,
      pendingConfirmation,
    };
  }

  /**
   * Executa ou rejeita uma ação pendente de alto risco previamente tokenizada
   */
  async confirmAction(params: {
    token: string;
    confirmed: boolean;
    context: AIPrincipalContext;
  }): Promise<{ success: boolean; message: string; result?: any }> {
    const confirmationService = ConfirmationService.getInstance();
    const userId = params.context.delegatedUser.id;
    const companyId = params.context.activeCompany.id;

    if (!params.confirmed) {
      confirmationService.cancel(params.token, userId, companyId);
      return {
        success: true,
        message: 'Ação cancelada pelo operador.',
      };
    }

    const pending = confirmationService.consume(params.token, userId, companyId);
    const toolExecutor = ToolExecutor.getInstance();

    const toolCall = {
      id: `confirmed_call_${Date.now()}`,
      name: pending.toolName,
      args: pending.params,
    };

    const execResult = await toolExecutor.execute(params.context, toolCall, true);

    if (!execResult.toolCallResult.isSuccess) {
      throw new Error(execResult.toolCallResult.error || 'Falha na execução da ação confirmada.');
    }

    return {
      success: true,
      message: `Ação '${pending.toolName}' executada com sucesso após confirmação.`,
      result: execResult.toolCallResult.result,
    };
  }
}
