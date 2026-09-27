/**
 * Enlace ERP - MaIA v2 Sandbox / Mock Adapter
 * PRD 02 - Seção 35 (MaIA) & Seção 36 (Controle de Acesso da MaIA)
 * 
 * Adapter determinístico para ambiente de testes, CI/CD e contingência local sem internet
 */

import { AIProvider, AIProviderHealth } from './types.js';
import { AIRequest, AIResponse, AIToolCall } from '../types.js';

export class SandboxAdapter implements AIProvider {
  id = 'maia-sandbox-mock';
  name = 'MaIA Sandbox Deterministic Adapter (Offline / Contingência)';

  private readonly supportedModels = [
    'sandbox-economic',
    'sandbox-balanced',
    'sandbox-high-capacity',
  ];

  supports(model: string): boolean {
    return true; // Suporta qualquer modelo em modo sandbox
  }

  async healthCheck(): Promise<AIProviderHealth> {
    return {
      healthy: true,
      latencyMs: 1,
      message: 'Sandbox contingência local operacional',
      supportedModels: this.supportedModels,
    };
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    const prompt = request.prompt.toLowerCase();
    const toolCalls: AIToolCall[] = [];

    // Detecção heurística de intenção de ferramenta para ambiente de testes e sandbox
    if (request.tools && request.tools.length > 0) {
      if (prompt.includes('receber') || prompt.includes('inadimpl')) {
        const tool = request.tools.find((t) => t.name === 'erp.consultar_contas_receber');
        if (tool) {
          toolCalls.push({
            id: `call_${Date.now()}_receivables`,
            name: tool.name,
            args: { status: 'PENDING' },
          });
        }
      } else if (prompt.includes('pagar') || prompt.includes('fornecedor')) {
        const tool = request.tools.find((t) => t.name === 'erp.consultar_contas_pagar');
        if (tool) {
          toolCalls.push({
            id: `call_${Date.now()}_payables`,
            name: tool.name,
            args: {},
          });
        }
      } else if (prompt.includes('fluxo') || prompt.includes('saldo') || prompt.includes('caixa')) {
        const tool = request.tools.find((t) => t.name === 'erp.consultar_fluxo_caixa');
        if (tool) {
          toolCalls.push({
            id: `call_${Date.now()}_cashflow`,
            name: tool.name,
            args: {},
          });
        }
      } else if (prompt.includes('cliente') || prompt.includes('parceiro')) {
        const tool = request.tools.find((t) => t.name === 'erp.consultar_clientes');
        if (tool) {
          toolCalls.push({
            id: `call_${Date.now()}_partners`,
            name: tool.name,
            args: {},
          });
        }
      } else if (prompt.includes('produto') || prompt.includes('catalogo')) {
        const tool = request.tools.find((t) => t.name === 'erp.consultar_produtos');
        if (tool) {
          toolCalls.push({
            id: `call_${Date.now()}_products`,
            name: tool.name,
            args: {},
          });
        }
      } else if (prompt.includes('estoque') || prompt.includes('armazem') || prompt.includes('cmp')) {
        const tool = request.tools.find((t) => t.name === 'erp.consultar_estoque');
        if (tool) {
          toolCalls.push({
            id: `call_${Date.now()}_inventory`,
            name: tool.name,
            args: {},
          });
        }
      } else if (prompt.includes('venda') || prompt.includes('pedido')) {
        const tool = request.tools.find((t) => t.name === 'erp.consultar_vendas');
        if (tool) {
          toolCalls.push({
            id: `call_${Date.now()}_sales`,
            name: tool.name,
            args: {},
          });
        }
      } else if (prompt.includes('fiscal') || prompt.includes('nf-e') || prompt.includes('nota')) {
        const tool = request.tools.find((t) => t.name === 'erp.consultar_documentos_fiscais');
        if (tool) {
          toolCalls.push({
            id: `call_${Date.now()}_fiscal`,
            name: tool.name,
            args: {},
          });
        }
      } else if (prompt.includes('criar cobrança') || prompt.includes('emitir cobranca')) {
        const tool = request.tools.find((t) => t.name === 'erp.criar_cobranca');
        if (tool) {
          toolCalls.push({
            id: `call_${Date.now()}_create_cobranca`,
            name: tool.name,
            args: {
              customerId: 'cust-test-01',
              customerName: 'Cliente Teste Sandbox',
              originalAmount: 150.0,
              dueDate: '2026-10-15',
              description: 'Cobrança gerada via MaIA Sandbox',
            },
          });
        }
      }
    }

    let content = 'Olá! Sou a MaIA, assistente do Enlace ERP. Como posso ajudar com finanças, estoque ou vendas hoje?';
    if (toolCalls.length > 0) {
      content = 'Consultando os dados do sistema através das ferramentas autorizadas...';
    } else if (request.history && request.history.length > 0) {
      const lastToolMsg = request.history.find((m) => m.role === 'tool');
      if (lastToolMsg) {
        content = `Com base nos dados consultados com sucesso no ERP, apurei os seguintes registros solicitados pelo operador. Todos os valores foram validados sob isolamento estrito de schema.`;
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      modelUsed: `sandbox-${request.modelProfile || 'balanced'}`,
      providerId: this.id,
      usage: {
        promptTokens: 25,
        completionTokens: 35,
        totalTokens: 60,
      },
    };
  }
}
