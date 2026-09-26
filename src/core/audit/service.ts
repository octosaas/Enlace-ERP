/**
 * Enlace ERP - Serviço Central de Auditoria Imutável
 * PRD 01 - Seção 17 (Auditoria e Rastreabilidade)
 */

import crypto from 'crypto';
import { dbEngine } from '../database/engine.js';
import { PostgresService } from '../database/postgres.js';
import { RepositoryManager } from '../database/repositories/index.js';
import { AuditLogEntry, SecurityEvent, SecurityEventType, SecurityEventSeverity } from '../../shared/types.js';
import { logger } from '../logger/index.js';

export interface RecordAuditParams {
  userId?: string | null;
  userEmail?: string | null;
  companyId?: string | null;
  companyCnpj?: string | null;
  schemaNamespace?: string | null;
  action: string;
  resource: string;
  resourceId?: string;
  status: 'SUCCESS' | 'DENIED' | 'FAILED';
  ipAddress?: string;
  userAgent?: string;
  requestId: string;
  details?: Record<string, unknown>;
}

export interface RecordSecurityEventParams {
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  userId?: string;
  userEmail?: string;
  companyId?: string;
  schemaNamespace?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId: string;
  details: Record<string, unknown>;
  mitigationTaken: string;
}

export class AuditService {
  private static sanitizeDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!details) return undefined;
    const sensitiveKeys = new Set([
      'password',
      'passwordhash',
      'passwordplain',
      'token',
      'refreshtoken',
      'vaultsecret',
      'vaultkey',
      'enlacevaultkey',
      'secret',
      'jwt',
      'jwtsecret',
      'apikey',
      'credential',
      'privatekey',
      'authorization',
      'bearer',
    ]);
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(details)) {
      const lower = k.toLowerCase().replace(/[^a-z]/g, '');
      if (
        sensitiveKeys.has(lower) ||
        lower.includes('password') ||
        lower.includes('secret') ||
        lower.includes('token')
      ) {
        cleaned[k] = '[REDACTED]';
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        cleaned[k] = this.sanitizeDetails(v as Record<string, unknown>);
      } else {
        cleaned[k] = v;
      }
    }
    return cleaned;
  }

  static record(params: RecordAuditParams): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      userId: params.userId || null,
      userEmail: params.userEmail || null,
      companyId: params.companyId || null,
      companyCnpj: params.companyCnpj || null,
      schemaNamespace: params.schemaNamespace || undefined,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      status: params.status,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      requestId: params.requestId,
      details: this.sanitizeDetails(params.details),
    };

    // Se houver schema de tenant associado, grava no schema operacional do tenant
    if (params.schemaNamespace) {
      dbEngine.appendTenantAuditLog(params.schemaNamespace, entry);
      const cleanCnpj = params.schemaNamespace.replace('tenant_', '');
      try {
        const repo = RepositoryManager.getInstance().getRepositories();
        repo.audit.recordTenantAudit(cleanCnpj, entry).catch((err) => {
          logger.error(`[AuditService] Falha na persistência PostgreSQL de auditoria do tenant: ${err.message}`, {
            cleanCnpj,
            entryId: entry.id,
          });
        });
      } catch {
        // Fallback para modo isolado sem repositórios ativos
      }
    }

    logger.info(`[AUDITORIA] ${entry.status} - ${entry.action} em ${entry.resource}`, {
      action: entry.action,
      resource: entry.resource,
      status: entry.status,
      userId: entry.userId || undefined,
      companyId: entry.companyId || undefined,
      requestId: entry.requestId,
    });

    return entry;
  }

  /**
   * Persiste entrada de auditoria com confirmação assíncrona no PostgreSQL
   */
  static async recordAsync(params: RecordAuditParams): Promise<AuditLogEntry> {
    const entry = this.record(params);
    if (params.schemaNamespace && PostgresService.isDbConnected()) {
      const cleanCnpj = params.schemaNamespace.replace('tenant_', '');
      const repo = RepositoryManager.getInstance().getRepositories();
      await repo.audit.recordTenantAudit(cleanCnpj, entry);
    }
    return entry;
  }

  static recordSecurityEvent(params: RecordSecurityEventParams): SecurityEvent {
    const event: SecurityEvent = {
      id: `sec-${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
      type: params.type,
      severity: params.severity,
      userId: params.userId,
      userEmail: params.userEmail,
      companyId: params.companyId,
      schemaNamespace: params.schemaNamespace,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      requestId: params.requestId,
      details: this.sanitizeDetails(params.details) || {},
      mitigationTaken: params.mitigationTaken,
    };

    dbEngine.appendSecurityEvent(event);
    try {
      const repo = RepositoryManager.getInstance().getRepositories();
      repo.audit.recordSecurityEvent(event).catch((err) => {
        logger.error(`[AuditService] Falha na persistência PostgreSQL de evento de segurança: ${err.message}`, {
          eventId: event.id,
          type: event.type,
        });
      });
    } catch {
      // Fallback para modo isolado sem repositórios ativos
    }

    logger.warn(`[SECURITY EVENT] [${event.severity}] ${event.type}: ${params.mitigationTaken}`, {
      type: event.type,
      severity: event.severity,
      requestId: event.requestId,
      userEmail: event.userEmail,
      ipAddress: event.ipAddress,
    });

    return event;
  }

  static getLogsForTenant(schemaNamespace: string): AuditLogEntry[] {
    const tenant = dbEngine.getTenantStorage(schemaNamespace);
    return tenant ? tenant.auditLogs : [];
  }

  static getSecurityEvents(companyId?: string): SecurityEvent[] {
    return dbEngine.listSecurityEvents(companyId);
  }
}
