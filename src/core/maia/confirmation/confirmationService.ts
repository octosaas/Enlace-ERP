/**
 * Enlace ERP - MaIA v2 Confirmation Service
 * PRD 02 - Seção 35 (MaIA) & Seção 36 (Controle de Acesso da MaIA)
 * 
 * Gerencia tokens de confirmação de duas etapas para operações de médio e alto risco
 */

import crypto from 'crypto';
import { PendingActionConfirmation, RiskLevel, AIPrincipalContext } from '../types.js';
import { UnauthorizedError, ForbiddenError, ValidationError } from '../../errors/index.js';
import { AuditService } from '../../audit/service.js';

export class ConfirmationService {
  private static instance: ConfirmationService | null = null;
  private pending: Map<string, PendingActionConfirmation> = new Map();

  private constructor() {
    // Limpeza periódica de tokens expirados a cada 2 minutos
    setInterval(() => this.cleanupExpired(), 2 * 60 * 1000).unref();
  }

  static getInstance(): ConfirmationService {
    if (!this.instance) {
      this.instance = new ConfirmationService();
    }
    return this.instance;
  }

  createPendingConfirmation(params: {
    context: AIPrincipalContext;
    toolName: string;
    toolParams: Record<string, any>;
    riskLevel: RiskLevel;
    description: string;
    ttlMinutes?: number;
  }): PendingActionConfirmation {
    const token = `mcf_${crypto.randomBytes(24).toString('hex')}`;
    const ttl = params.ttlMinutes || 5;
    const expiresAt = new Date(Date.now() + ttl * 60 * 1000).toISOString();

    const pending: PendingActionConfirmation = {
      token,
      toolName: params.toolName,
      params: params.toolParams,
      riskLevel: params.riskLevel,
      description: params.description,
      expiresAt,
      userId: params.context.delegatedUser.id,
      companyId: params.context.activeCompany.id,
    };

    this.pending.set(token, pending);

    AuditService.record({
      action: 'MAIA_CONFIRMATION_REQUESTED',
      resource: params.toolName,
      status: 'SUCCESS',
      userId: params.context.delegatedUser.id,
      companyId: params.context.activeCompany.id,
      requestId: params.context.requestId,
      details: {
        status: 'PENDING',
        token: `${token.slice(0, 8)}...`,
        riskLevel: params.riskLevel,
        description: params.description,
      },
    });

    return pending;
  }

  get(token: string): PendingActionConfirmation | undefined {
    const item = this.pending.get(token);
    if (!item) return undefined;

    if (new Date(item.expiresAt).getTime() < Date.now()) {
      this.pending.delete(token);
      return undefined;
    }
    return item;
  }

  consume(token: string, userId: string, companyId: string): PendingActionConfirmation {
    const item = this.get(token);
    if (!item) {
      throw new ValidationError('Token de confirmação inválido, expirado ou já utilizado.');
    }

    if (item.userId !== userId) {
      throw new ForbiddenError('Apenas o usuário solicitante pode confirmar esta ação.');
    }

    if (item.companyId !== companyId) {
      throw new ForbiddenError('Tentativa de confirmação fora do contexto da empresa solicitante.');
    }

    this.pending.delete(token);
    return item;
  }

  cancel(token: string, userId: string, companyId: string): void {
    const item = this.get(token);
    if (!item) return;

    if (item.userId === userId && item.companyId === companyId) {
      this.pending.delete(token);
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [token, item] of this.pending.entries()) {
      if (new Date(item.expiresAt).getTime() < now) {
        this.pending.delete(token);
      }
    }
  }
}
