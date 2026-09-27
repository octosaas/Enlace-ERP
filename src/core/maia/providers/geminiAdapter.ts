/**
 * Enlace ERP - MaIA v2 Gemini Adapter
 * PRD 02 - Seção 35 (MaIA) & Seção 36 (Controle de Acesso da MaIA)
 * 
 * Implementa a interface AIProvider utilizando o SDK oficial @google/genai
 */

import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { AIProvider, AIProviderHealth } from './types.js';
import { AIRequest, AIResponse, AIToolCall, AIToolDefinition } from '../types.js';
import { logger } from '../../logger/index.js';

export class GeminiAdapter implements AIProvider {
  id = 'google-gemini';
  name = 'Google Gemini (Native @google/genai)';

  private client: GoogleGenAI | null = null;
  private readonly supportedModels = [
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-3.8-flash',
    'gemini-3.1-pro-preview',
  ];

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (key) {
      this.client = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
  }

  private getClient(): GoogleGenAI {
    if (!this.client) {
      const key = process.env.GEMINI_API_KEY;
      if (key) {
        this.client = new GoogleGenAI({
          apiKey: key,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });
      }
    }
    if (!this.client) {
      throw new Error(
        'Gemini API key não configurada. Defina GEMINI_API_KEY no ambiente ou configure o CredentialVault.'
      );
    }
    return this.client;
  }

  supports(model: string): boolean {
    return this.supportedModels.includes(model) || model.startsWith('gemini-');
  }

  async healthCheck(): Promise<AIProviderHealth> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return {
        healthy: false,
        message: 'GEMINI_API_KEY ausente',
        supportedModels: this.supportedModels,
      };
    }

    try {
      const startTime = Date.now();
      const client = this.getClient();
      // Teste leve com modelo econômico
      const res = await client.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: 'ping',
      });
      const latencyMs = Date.now() - startTime;
      return {
        healthy: !!res.text,
        latencyMs,
        message: 'Gemini operacional',
        supportedModels: this.supportedModels,
      };
    } catch (err: any) {
      return {
        healthy: false,
        message: err.message || 'Falha de conexão com a API Gemini',
        supportedModels: this.supportedModels,
      };
    }
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    const client = this.getClient();

    // Mapeamento de modelo conforme perfil solicitado
    let modelName = 'gemini-3.8-flash';
    if (request.modelProfile === 'economic') {
      modelName = 'gemini-3.1-flash-lite';
    } else if (request.modelProfile === 'high_capacity') {
      modelName = 'gemini-3.1-pro-preview';
    }

    // Mapear ferramentas para FunctionDeclarations
    const functionDeclarations: FunctionDeclaration[] = (request.tools || []).map((t) => {
      const properties: Record<string, any> = {};
      const requiredProps: string[] = t.parameters.required || [];

      for (const [propName, propDef] of Object.entries(t.parameters.properties || {})) {
        properties[propName] = {
          type: propDef.type === 'number' ? Type.NUMBER : propDef.type === 'boolean' ? Type.BOOLEAN : Type.STRING,
          description: propDef.description,
        };
      }

      return {
        name: t.name,
        description: t.description,
        parameters: {
          type: Type.OBJECT,
          properties,
          required: requiredProps,
        },
      };
    });

    const config: any = {
      systemInstruction: request.systemInstruction,
      temperature: request.temperature ?? 0.2,
    };

    if (request.maxTokens) {
      config.maxOutputTokens = request.maxTokens;
    }

    if (functionDeclarations.length > 0) {
      config.tools = [{ functionDeclarations }];
    }

    // Monta histórico de conteúdos
    const contents: any[] = [];
    if (request.history && request.history.length > 0) {
      for (const msg of request.history) {
        if (msg.role === 'tool' && msg.toolResults) {
          // Formata retornos de ferramentas para o formato Gemini
          for (const tr of msg.toolResults) {
            contents.push({
              role: 'user',
              parts: [
                {
                  text: `Resultado da ferramenta ${tr.name}: ${JSON.stringify(tr.result || tr.error)}`,
                },
              ],
            });
          }
        } else {
          contents.push({
            role: msg.role === 'model' ? 'model' : 'user',
            parts: [{ text: msg.content }],
          });
        }
      }
    }

    contents.push({
      role: 'user',
      parts: [{ text: request.prompt }],
    });

    try {
      const response = await client.models.generateContent({
        model: modelName,
        contents,
        config,
      });

      const text = response.text || '';
      const toolCalls: AIToolCall[] = [];

      if (response.functionCalls && response.functionCalls.length > 0) {
        for (const fc of response.functionCalls) {
          toolCalls.push({
            id: fc.id || `call_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            name: fc.name || 'unknown_tool',
            args: (fc.args as Record<string, any>) || {},
          });
        }
      }

      return {
        content: text,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        modelUsed: modelName,
        providerId: this.id,
        usage: {
          promptTokens: response.usageMetadata?.promptTokenCount || 0,
          completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata?.totalTokenCount || 0,
        },
      };
    } catch (err: any) {
      logger.error(`[GeminiAdapter] Erro ao invocar modelo ${modelName}:`, { error: err.message });
      throw err;
    }
  }
}
