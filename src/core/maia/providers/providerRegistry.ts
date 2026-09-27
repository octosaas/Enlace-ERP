/**
 * Enlace ERP - MaIA v2 Provider Registry
 * PRD 02 - Seção 35 (MaIA) & Seção 36 (Controle de Acesso da MaIA)
 */

import { AIProvider, AIProviderHealth } from './types.js';
import { GeminiAdapter } from './geminiAdapter.js';
import { RouterAdapter } from './routerAdapter.js';
import { SandboxAdapter } from './sandboxAdapter.js';
import { logger } from '../../logger/index.js';

export class ProviderRegistry {
  private static instance: ProviderRegistry | null = null;
  private providers: Map<string, AIProvider> = new Map();

  private constructor() {
    this.registerDefaults();
  }

  static getInstance(): ProviderRegistry {
    if (!this.instance) {
      this.instance = new ProviderRegistry();
    }
    return this.instance;
  }

  private registerDefaults(): void {
    // 1. Provedor padrão: Google Gemini nativo via @google/genai
    const gemini = new GeminiAdapter();
    this.register(gemini);

    // 2. Provedor gateway: 9router
    const router = new RouterAdapter();
    this.register(router);

    // 3. Provedor de contingência e testes isolados: Sandbox
    const sandbox = new SandboxAdapter();
    this.register(sandbox);
  }

  register(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(providerId: string): AIProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Resolve o melhor provedor ativo com fallback inteligente e seguro:
   * 1. Se GEMINI_API_KEY estiver configurada -> GeminiAdapter
   * 2. Senão se AI_ROUTER_API_KEY estiver configurada -> RouterAdapter
   * 3. Senão -> SandboxAdapter (modo contingência para testes e CI/CD)
   */
  resolveProvider(preferredId?: string): AIProvider {
    if (preferredId && this.providers.has(preferredId)) {
      return this.providers.get(preferredId)!;
    }

    if (process.env.GEMINI_API_KEY) {
      const gemini = this.providers.get('google-gemini');
      if (gemini) return gemini;
    }

    if (process.env.AI_ROUTER_API_KEY) {
      const router = this.providers.get('ai-router-gateway');
      if (router) return router;
    }

    // Fallback garantido para ambiente de testes e sandbox
    return this.providers.get('maia-sandbox-mock') || new SandboxAdapter();
  }

  async healthCheckAll(): Promise<Record<string, AIProviderHealth>> {
    const results: Record<string, AIProviderHealth> = {};
    for (const [id, provider] of this.providers.entries()) {
      try {
        results[id] = await provider.healthCheck();
      } catch (err: any) {
        results[id] = {
          healthy: false,
          message: err.message,
          supportedModels: [],
        };
      }
    }
    return results;
  }
}
