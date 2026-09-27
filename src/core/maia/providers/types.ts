/**
 * Enlace ERP - MaIA v2 AI Provider Types & Interface
 * PRD 02 - Seção 35 (MaIA) & Seção 36 (Controle de Acesso da MaIA)
 */

import { AIRequest, AIResponse } from '../types.js';

export interface AIProviderHealth {
  healthy: boolean;
  latencyMs?: number;
  message?: string;
  supportedModels: string[];
}

export interface AIProvider {
  id: string;
  name: string;
  generate(request: AIRequest): Promise<AIResponse>;
  supports(model: string): boolean;
  healthCheck(): Promise<AIProviderHealth>;
}
