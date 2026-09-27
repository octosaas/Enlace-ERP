/**
 * Enlace ERP - MaIA v2 Model Router
 * PRD 02 - Seção 35 (MaIA) & Seção 36 (Controle de Acesso da MaIA)
 */

import { RoutingPolicy } from './routingPolicy.js';
import { ProviderRegistry } from '../providers/providerRegistry.js';
import { AIRequest, AIResponse, AIModelProfile } from '../types.js';
import { logger } from '../../logger/index.js';

export class ModelRouter {
  private static instance: ModelRouter | null = null;

  private constructor() {}

  static getInstance(): ModelRouter {
    if (!this.instance) {
      this.instance = new ModelRouter();
    }
    return this.instance;
  }

  /**
   * Roteia a requisição para o perfil e provedor ideais, com fallback automático
   */
  async routeAndExecute(request: AIRequest): Promise<AIResponse> {
    const profile = RoutingPolicy.inferProfile(request.prompt, request.modelProfile);
    const profileDef = RoutingPolicy.PROFILES[profile];

    const providerRegistry = ProviderRegistry.getInstance();
    const primaryProvider = providerRegistry.resolveProvider();

    // Atualiza parâmetros da requisição conforme perfil selecionado
    const routedRequest: AIRequest = {
      ...request,
      modelProfile: profile,
      maxTokens: request.maxTokens || profileDef.maxTokens,
      temperature: request.temperature ?? profileDef.temperature,
    };

    try {
      return await primaryProvider.generate(routedRequest);
    } catch (primaryErr: any) {
      logger.warn(
        `[ModelRouter] Provedor primário [${primaryProvider.id}] falhou. Tentando fallback para Sandbox/Contingência...`,
        { error: primaryErr.message }
      );

      // Fallback para Sandbox
      const fallbackProvider = providerRegistry.get('maia-sandbox-mock');
      if (fallbackProvider && fallbackProvider.id !== primaryProvider.id) {
        return await fallbackProvider.generate(routedRequest);
      }

      throw primaryErr;
    }
  }
}
