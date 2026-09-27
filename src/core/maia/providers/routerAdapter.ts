/**
 * Enlace ERP - MaIA v2 Router Adapter (9router / Custom AI Gateway)
 * PRD 02 - Seção 35 (MaIA) & Seção 36 (Controle de Acesso da MaIA)
 * 
 * Implementa a interface AIProvider para gateways de IA (ex: 9router.enlace.slz.br ou proxy compatível)
 */

import { AIProvider, AIProviderHealth } from './types.js';
import { AIRequest, AIResponse, AIToolCall } from '../types.js';
import { logger } from '../../logger/index.js';

export class RouterAdapter implements AIProvider {
  id = 'ai-router-gateway';
  name = 'Enlace 9router AI Gateway';

  private baseUrl: string;
  private apiKey: string;
  private readonly supportedModels = [
    'router-economic',
    'router-balanced',
    'router-high-capacity',
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
  ];

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl || process.env.AI_ROUTER_BASE_URL || 'https://9router.enlace.slz.br/v1';
    this.apiKey = apiKey || process.env.AI_ROUTER_API_KEY || '';
  }

  supports(model: string): boolean {
    return this.supportedModels.includes(model) || model.startsWith('router-');
  }

  async healthCheck(): Promise<AIProviderHealth> {
    if (!this.apiKey && !process.env.AI_ROUTER_API_KEY) {
      return {
        healthy: false,
        message: 'AI_ROUTER_API_KEY não configurada no ambiente.',
        supportedModels: this.supportedModels,
      };
    }

    try {
      const startTime = Date.now();
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey || process.env.AI_ROUTER_API_KEY}`,
        },
      });

      const latencyMs = Date.now() - startTime;
      return {
        healthy: response.ok,
        latencyMs,
        message: response.ok ? '9router operacional' : `Status HTTP ${response.status}`,
        supportedModels: this.supportedModels,
      };
    } catch (err: any) {
      return {
        healthy: false,
        message: `Inacessível: ${err.message}`,
        supportedModels: this.supportedModels,
      };
    }
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    const key = this.apiKey || process.env.AI_ROUTER_API_KEY;
    if (!key) {
      throw new Error('AI_ROUTER_API_KEY não configurada para o 9router.');
    }

    let model = 'router-balanced';
    if (request.modelProfile === 'economic') model = 'router-economic';
    if (request.modelProfile === 'high_capacity') model = 'router-high-capacity';

    const toolsFormatted = (request.tools || []).map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const messages: any[] = [];
    if (request.systemInstruction) {
      messages.push({ role: 'system', content: request.systemInstruction });
    }

    if (request.history && request.history.length > 0) {
      for (const m of request.history) {
        messages.push({
          role: m.role === 'model' ? 'assistant' : m.role === 'tool' ? 'user' : m.role,
          content: m.content,
        });
      }
    }

    messages.push({ role: 'user', content: request.prompt });

    const body: Record<string, any> = {
      model,
      messages,
      temperature: request.temperature ?? 0.2,
    };

    if (toolsFormatted.length > 0) {
      body.tools = toolsFormatted;
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error(`[RouterAdapter] Falha na chamada ao gateway 9router: ${res.status} - ${errText}`);
      throw new Error(`9router retornou erro ${res.status}: ${errText}`);
    }

    const data: any = await res.json();
    const choice = data.choices?.[0];
    const message = choice?.message;

    const toolCalls: AIToolCall[] = [];
    if (message?.tool_calls && Array.isArray(message.tool_calls)) {
      for (const tc of message.tool_calls) {
        let args = {};
        try {
          args = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments;
        } catch {
          args = {};
        }
        toolCalls.push({
          id: tc.id || `call_${Date.now()}`,
          name: tc.function.name,
          args,
        });
      }
    }

    return {
      content: message?.content || '',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      modelUsed: data.model || model,
      providerId: this.id,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  }
}
