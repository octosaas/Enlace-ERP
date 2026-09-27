/**
 * Enlace ERP - MaIA v2 AI Audit Service & Observability
 * PRD 02 - Seção 35 (MaIA) & Seção 36 (Controle de Acesso da MaIA)
 */

import { AuditService } from '../../audit/service.js';
import { AIPrincipalContext, AIModelProfile } from '../types.js';

export interface AIAuditRecord {
  id: string;
  timestamp: string;
  requestId: string;
  companyId: string;
  cleanCnpj: string;
  userId: string;
  userEmail: string;
  modelUsed: string;
  profileUsed: AIModelProfile;
  providerId: string;
  promptSnippet: string;
  toolsInvoked?: string[];
  totalTokens?: number;
  latencyMs?: number;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED';
}

export class AIAuditService {
  private static instance: AIAuditService | null = null;
  private logs: AIAuditRecord[] = [];

  private constructor() {}

  static getInstance(): AIAuditService {
    if (!this.instance) {
      this.instance = new AIAuditService();
    }
    return this.instance;
  }

  recordInteraction(params: {
    context: AIPrincipalContext;
    modelUsed: string;
    profileUsed: AIModelProfile;
    providerId: string;
    prompt: string;
    toolsInvoked?: string[];
    totalTokens?: number;
    latencyMs?: number;
    status: 'SUCCESS' | 'FAILED' | 'BLOCKED';
  }): void {
    const cleanCnpj = params.context.activeCompany.cnpj.replace(/\D/g, '');

    const record: AIAuditRecord = {
      id: `ai_log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: new Date().toISOString(),
      requestId: params.context.requestId,
      companyId: params.context.activeCompany.id,
      cleanCnpj,
      userId: params.context.delegatedUser.id,
      userEmail: params.context.delegatedUser.email,
      modelUsed: params.modelUsed,
      profileUsed: params.profileUsed,
      providerId: params.providerId,
      promptSnippet: params.prompt.slice(0, 150),
      toolsInvoked: params.toolsInvoked,
      totalTokens: params.totalTokens,
      latencyMs: params.latencyMs,
      status: params.status,
    };

    this.logs.unshift(record);
    if (this.logs.length > 500) {
      this.logs.pop();
    }

    const auditStatus = params.status === 'BLOCKED' ? 'DENIED' : params.status;
    AuditService.record({
      action: 'MAIA_INTERACTION',
      resource: 'maia.chat',
      status: auditStatus,
      userId: params.context.delegatedUser.id,
      companyId: params.context.activeCompany.id,
      requestId: params.context.requestId,
      details: {
        modelUsed: params.modelUsed,
        profileUsed: params.profileUsed,
        providerId: params.providerId,
        toolsInvoked: params.toolsInvoked,
        totalTokens: params.totalTokens,
        latencyMs: params.latencyMs,
      },
    });
  }

  getAuditLogsForTenant(cleanCnpj: string, limit: number = 50): AIAuditRecord[] {
    return this.logs.filter((l) => l.cleanCnpj === cleanCnpj).slice(0, limit);
  }
}
