/**
 * Enlace ERP - MaIA v2 Routing Policy
 * PRD 02 - Seção 35 (MaIA) & Seção 36 (Controle de Acesso da MaIA)
 */

import { AIModelProfile } from '../types.js';

export interface ProfileDefinition {
  name: AIModelProfile;
  description: string;
  defaultGeminiModel: string;
  defaultRouterModel: string;
  maxTokens: number;
  temperature: number;
  costTier: 'low' | 'medium' | 'high';
}

export class RoutingPolicy {
  static readonly PROFILES: Record<AIModelProfile, ProfileDefinition> = {
    economic: {
      name: 'economic',
      description: 'Econômico: Baixa latência, custo otimizado para consultas diretas e resumos breves.',
      defaultGeminiModel: 'gemini-3.1-flash-lite',
      defaultRouterModel: 'router-economic',
      maxTokens: 1024,
      temperature: 0.1,
      costTier: 'low',
    },
    balanced: {
      name: 'balanced',
      description: 'Balanceado: Equilíbrio padrão entre raciocínio corporativo, latência e custo.',
      defaultGeminiModel: 'gemini-3.8-flash',
      defaultRouterModel: 'router-balanced',
      maxTokens: 2048,
      temperature: 0.2,
      costTier: 'medium',
    },
    high_capacity: {
      name: 'high_capacity',
      description: 'Alta Capacidade: Raciocínio aprofundado para relatórios complexos, DRE e conciliações fiscais.',
      defaultGeminiModel: 'gemini-3.1-pro-preview',
      defaultRouterModel: 'router-high-capacity',
      maxTokens: 4096,
      temperature: 0.2,
      costTier: 'high',
    },
  };

  /**
   * Infere o perfil ideal com base na complexidade da consulta e palavras-chave
   */
  static inferProfile(prompt: string, requestedProfile?: AIModelProfile): AIModelProfile {
    if (requestedProfile && this.PROFILES[requestedProfile]) {
      return requestedProfile;
    }

    const lower = prompt.toLowerCase();

    // Consultas complexas que justificam alta capacidade
    if (
      lower.includes('dre') ||
      lower.includes('balancete') ||
      lower.includes('conciliação fiscal') ||
      lower.includes('análise de risco') ||
      lower.includes('auditoria completa') ||
      lower.includes('projeção') ||
      lower.includes('cenário')
    ) {
      return 'high_capacity';
    }

    // Consultas simples/pontuais que se beneficiam de custo econômico
    if (
      lower.includes('qual é') ||
      lower.includes('quantos') ||
      lower.includes('busca rápida') ||
      lower.includes('ping') ||
      lower.includes('olá') ||
      lower.includes('ajuda')
    ) {
      return 'economic';
    }

    // Padrão balanceado
    return 'balanced';
  }
}
