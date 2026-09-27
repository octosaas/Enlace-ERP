/**
 * Enlace ERP - MaIA v2 Core Types
 * PRD 02 - Seção 35 & 36: Inteligência Artificial Corporativa Delegada
 * 
 * Regras Invioláveis:
 * 1. A MaIA opera unicamente sob delegação do usuário em sessão.
 * 2. Isolamento estrito por schema ("tenant_<CNPJ>").
 * 3. NUNCA possui acesso SQL direto ou irrestrito.
 * 4. Toda execução de ferramenta utiliza Repositories e Application Services do ERP.
 */

import { User, Company, Membership } from '../../shared/types.js';

export type AIPrincipalId = 'maia-agent-core';

export interface AIPrincipalContext {
  principalId: AIPrincipalId;
  delegatedUser: User;
  activeCompany: Company;
  membership: Membership;
  requestId: string;
  sessionId?: string;
  locale?: string;
  timezone?: string;
}

export type AIModelProfile = 'economic' | 'balanced' | 'high_capacity';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AIToolParameterSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description: string;
    enum?: string[];
  }>;
  required?: string[];
}

export interface AIToolDefinition<TParams = any, TResult = any> {
  name: string;
  description: string;
  category: 'financial' | 'commercial' | 'inventory' | 'fiscal' | 'action';
  requiredPermission: string;
  riskLevel: RiskLevel;
  requiresConfirmation: boolean;
  parameters: AIToolParameterSchema;
  execute: (context: AIPrincipalContext, params: TParams) => Promise<TResult>;
}

export interface AIToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface AIToolCallResult {
  toolCallId: string;
  name: string;
  result?: any;
  error?: string;
  isSuccess: boolean;
}

export interface AIMessage {
  role: 'user' | 'model' | 'system' | 'tool';
  content: string;
  toolCalls?: AIToolCall[];
  toolResults?: AIToolCallResult[];
  timestamp?: string;
}

export interface AIRequest {
  prompt: string;
  systemInstruction?: string;
  history?: AIMessage[];
  tools?: AIToolDefinition[];
  modelProfile?: AIModelProfile;
  temperature?: number;
  maxTokens?: number;
  context: AIPrincipalContext;
}

export interface AIResponse {
  content: string;
  toolCalls?: AIToolCall[];
  modelUsed: string;
  providerId: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

export interface PendingActionConfirmation {
  token: string;
  toolName: string;
  params: Record<string, any>;
  riskLevel: RiskLevel;
  description: string;
  expiresAt: string;
  userId: string;
  companyId: string;
}

export interface ChatInteractionResult {
  response: string;
  sessionId: string;
  modelUsed: string;
  providerId: string;
  profileUsed: AIModelProfile;
  toolCallsExecuted?: Array<{
    name: string;
    args: Record<string, any>;
    isSuccess: boolean;
  }>;
  pendingConfirmation?: PendingActionConfirmation;
}
